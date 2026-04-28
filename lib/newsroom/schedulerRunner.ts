import { db } from "@/lib/db";
import { sql, and, eq, gte } from "drizzle-orm";
import {
  newsroomSchedulerConfig,
  newsroomSchedulerRuns,
  knowledgeArticles,
  knowledgeGenerationLog,
  newsroomReviewQueue,
  hayloArticles,
  type NewsroomSchedulerConfig,
} from "@shared/schema";
import { runPairAgentPipeline } from "@/lib/newsroom/pairAgentOrchestrator";
import { newsroomDraftPayloadV1Schema } from "@/lib/newsroom/draftPayload";
import { pickNextPair, type PickerStrategy } from "@/lib/newsroom/schedulerPicker";
import { logAuditEvent } from "@/lib/audit";

let tickInFlight = false;

export interface TickInput {
  triggeredBy: "cron" | "manual";
  username?: string;
}

export interface TickResult {
  outcome:
    | "paired_pass"
    | "paired_warn"
    | "paired_fail"
    | "skipped_no_eligible"
    | "skipped_disabled"
    | "skipped_quota"
    | "skipped_budget"
    | "skipped_locked"
    | "error";
  hayloArticleId?: string;
  citySlug?: string;
  verdict?: "pass" | "warn" | "fail";
  flowScore?: number;
  knowledgeArticleId?: string;
  reviewQueueId?: string;
  costUsd?: number;
  totalTokens?: number;
  durationMs?: number;
  notes?: string;
}

async function getConfig(): Promise<NewsroomSchedulerConfig> {
  const [row] = await db.select().from(newsroomSchedulerConfig).where(eq(newsroomSchedulerConfig.id, "singleton")).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(newsroomSchedulerConfig)
    .values({ id: "singleton", enabled: false, pairingsPerDay: 5, dailyBudgetUsd: "1.0000", pickerStrategy: "balanced" })
    .returning();
  return created;
}

async function countTodayPairings(): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const result = await db
    .select({ n: sql<string>`COUNT(*)::text` })
    .from(newsroomSchedulerRuns)
    .where(and(gte(newsroomSchedulerRuns.tickAt, since), sql`outcome LIKE 'paired_%'`));
  return Number(result[0]?.n ?? "0");
}

async function sumTodayCost(): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const result = await db
    .select({ s: sql<string>`COALESCE(SUM(cost_usd), 0)::text` })
    .from(newsroomSchedulerRuns)
    .where(gte(newsroomSchedulerRuns.tickAt, since));
  return Number(result[0]?.s ?? "0");
}

async function recordRun(input: TickInput, result: TickResult): Promise<void> {
  await db.insert(newsroomSchedulerRuns).values({
    triggeredBy: input.triggeredBy,
    outcome: result.outcome,
    hayloArticleId: result.hayloArticleId,
    citySlug: result.citySlug,
    verdict: result.verdict,
    flowScore: result.flowScore,
    knowledgeArticleId: result.knowledgeArticleId,
    reviewQueueId: result.reviewQueueId,
    costUsd: result.costUsd != null ? String(result.costUsd) : null,
    totalTokens: result.totalTokens,
    durationMs: result.durationMs,
    notes: result.notes,
  });
  await db
    .update(newsroomSchedulerConfig)
    .set({ lastTickAt: new Date(), updatedAt: new Date() })
    .where(eq(newsroomSchedulerConfig.id, "singleton"));
}

export async function runSchedulerTick(input: TickInput): Promise<TickResult> {
  const username = input.username ?? "scheduler";

  const config = await getConfig();

  if (!config.enabled) {
    const result: TickResult = { outcome: "skipped_disabled", notes: config.pausedReason ?? "scheduler disabled" };
    await recordRun(input, result);
    return result;
  }

  const todayPairings = await countTodayPairings();
  if (todayPairings >= config.pairingsPerDay) {
    const result: TickResult = { outcome: "skipped_quota", notes: `${todayPairings}/${config.pairingsPerDay} done today` };
    await recordRun(input, result);
    return result;
  }

  const todayCost = await sumTodayCost();
  const budget = Number(config.dailyBudgetUsd);
  if (budget > 0 && todayCost >= budget) {
    const result: TickResult = { outcome: "skipped_budget", notes: `$${todayCost.toFixed(4)}/$${budget.toFixed(4)} spent today` };
    await recordRun(input, result);
    return result;
  }

  if (!process.env.OPENAI_API_KEY && !process.env.OpenAi_Key) {
    const result: TickResult = { outcome: "error", notes: "OPENAI_API_KEY (or OpenAi_Key) is not set" };
    await recordRun(input, result);
    return result;
  }

  if (tickInFlight) {
    const result: TickResult = { outcome: "skipped_locked", notes: "another tick is already running" };
    await recordRun(input, result);
    return result;
  }
  tickInFlight = true;
  let pickedForRecovery: { haylo: { id: string; slug: string }; city: { slug: string } } | null = null;
  try {
    const picked = await pickNextPair(config.pickerStrategy as PickerStrategy);
    if (picked) pickedForRecovery = { haylo: { id: picked.haylo.id, slug: picked.haylo.slug }, city: { slug: picked.city.slug } };
    if (!picked) {
      const result: TickResult = { outcome: "skipped_no_eligible", notes: "no eligible (haylo × city) pairs remaining" };
      await recordRun(input, result);
      return result;
    }

    const t0 = Date.now();
    let pair: Awaited<ReturnType<typeof runPairAgentPipeline>>;
    try {
      pair = await runPairAgentPipeline({
        hayloArticle: picked.haylo,
        city: picked.city,
        localVibe: null,
        dryRun: false,
        username,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const result: TickResult = {
        outcome: "error",
        hayloArticleId: picked.haylo.id,
        citySlug: picked.city.slug,
        durationMs: Date.now() - t0,
        notes: `pipeline threw: ${msg.slice(0, 400)}`,
      };
      await recordRun(input, result);
      await db.insert(knowledgeGenerationLog).values({
        citySlug: picked.city.slug,
        directive: `scheduler:${picked.haylo.slug}`,
        status: "error",
        errorMessage: `Scheduler tick error: ${msg.slice(0, 800)}`,
      });
      return result;
    }

    const elapsed = Date.now() - t0;
    const verdict = pair.audit.verdict;
    const draft = pair.draftPayload;
    const draftValidation = newsroomDraftPayloadV1Schema.safeParse(draft);

    if (!draftValidation.success) {
      const result: TickResult = {
        outcome: "error",
        hayloArticleId: picked.haylo.id,
        citySlug: picked.city.slug,
        verdict,
        flowScore: pair.audit.flowScore,
        costUsd: pair.audit.costUsd,
        totalTokens: pair.audit.totalTokens,
        durationMs: elapsed,
        notes: `draftPayload V1 validation failed: ${JSON.stringify(draftValidation.error.flatten()).slice(0, 300)}`,
      };
      await recordRun(input, result);
      return result;
    }

    if (verdict === "pass") {
      const article = await db.transaction(async (tx) => {
        const [a] = await tx
          .insert(knowledgeArticles)
          .values({
            slug: draft.suggestedSlug,
            title: draft.title,
            metaDescription: draft.metaDescription ?? null,
            headline: draft.headline,
            subheadline: draft.subheadline ?? null,
            dateline: null,
            bodyHtml: draft.bodyHtml,
            boilerplateHtml: draft.boilerplateHtml ?? null,
            status: "pending",
            citySlug: picked.city.slug,
            hayloArticleId: picked.haylo.id,
          })
          .returning();
        await tx
          .update(hayloArticles)
          .set({ placementCount: sql`${hayloArticles.placementCount} + 1`, updatedAt: new Date() })
          .where(eq(hayloArticles.id, picked.haylo.id));
        return a;
      });
      await logAuditEvent({
        username,
        action: "scheduler.pair.pass",
        entityType: "knowledge_article",
        entityId: article.id,
        details: { hayloArticleId: picked.haylo.id, citySlug: picked.city.slug, flowScore: pair.audit.flowScore },
      });
      const result: TickResult = {
        outcome: "paired_pass",
        hayloArticleId: picked.haylo.id,
        citySlug: picked.city.slug,
        verdict,
        flowScore: pair.audit.flowScore,
        knowledgeArticleId: article.id,
        costUsd: pair.audit.costUsd,
        totalTokens: pair.audit.totalTokens,
        durationMs: elapsed,
        notes: pair.audit.summary.slice(0, 400),
      };
      await recordRun(input, result);
      return result;
    }

    if (verdict === "warn") {
      const [reviewRow] = await db
        .insert(newsroomReviewQueue)
        .values({
          citySlug: picked.city.slug,
          draftPayload: draftValidation.data as unknown as Record<string, unknown>,
          qcScore: pair.audit.flowScore,
          qcNotes: pair.audit.summary,
          status: "pending",
        })
        .returning();
      await logAuditEvent({
        username,
        action: "scheduler.pair.warn",
        entityType: "newsroom_review_queue",
        entityId: reviewRow.id,
        details: { hayloArticleId: picked.haylo.id, citySlug: picked.city.slug, flowScore: pair.audit.flowScore },
      });
      const result: TickResult = {
        outcome: "paired_warn",
        hayloArticleId: picked.haylo.id,
        citySlug: picked.city.slug,
        verdict,
        flowScore: pair.audit.flowScore,
        reviewQueueId: reviewRow.id,
        costUsd: pair.audit.costUsd,
        totalTokens: pair.audit.totalTokens,
        durationMs: elapsed,
        notes: pair.audit.summary.slice(0, 400),
      };
      await recordRun(input, result);
      return result;
    }

    await db.insert(knowledgeGenerationLog).values({
      citySlug: picked.city.slug,
      directive: `scheduler:${picked.haylo.slug}`,
      status: "failed",
      errorMessage: `Scheduler audit FAIL (${pair.audit.flowScore}/100): ${pair.audit.summary.slice(0, 800)}`,
    });
    const result: TickResult = {
      outcome: "paired_fail",
      hayloArticleId: picked.haylo.id,
      citySlug: picked.city.slug,
      verdict,
      flowScore: pair.audit.flowScore,
      costUsd: pair.audit.costUsd,
      totalTokens: pair.audit.totalTokens,
      durationMs: elapsed,
      notes: pair.audit.summary.slice(0, 400),
    };
    await recordRun(input, result);
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const result: TickResult = {
      outcome: "error",
      hayloArticleId: pickedForRecovery?.haylo.id,
      citySlug: pickedForRecovery?.city.slug,
      notes: `tick crashed during persistence: ${msg.slice(0, 400)}`,
    };
    try { await recordRun(input, result); } catch { /* swallow secondary failure */ }
    return result;
  } finally {
    tickInFlight = false;
  }
}
