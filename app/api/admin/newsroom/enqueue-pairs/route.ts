import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { knowledgeArticles, knowledgeGenerationLog, newsroomReviewQueue, hayloArticles } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "@/lib/storage";
import { verifySession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { processPair } from "@/lib/newsroom/pairProcessor";
import { runPairAgentPipeline } from "@/lib/newsroom/pairAgentOrchestrator";
import { newsroomDraftPayloadV1Schema } from "@/lib/newsroom/draftPayload";
import { sanitizeNewsroomHtml } from "@/lib/newsroom/htmlSanitizer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CITIES_PER_REQUEST = 25;

const bodySchema = z.object({
  hayloArticleId: z.string().uuid(),
  citySlugs: z.array(z.string().min(1)).min(1).max(MAX_CITIES_PER_REQUEST),
  dryRun: z.boolean().optional().default(false),
});

interface PerCityResult {
  citySlug: string;
  outcome: "pass" | "warn" | "fail" | "error" | "skipped";
  verdict?: "pass" | "warn" | "fail";
  flowScore?: number;
  articleId?: string;
  reviewQueueId?: string;
  reason?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid request", details: e?.errors ?? String(e) }, { status: 400 });
  }

  const { hayloArticleId, citySlugs, dryRun } = body;

  const haylo = await storage.getHayloArticleById(hayloArticleId);
  if (!haylo) return NextResponse.json({ error: "Haylo article not found" }, { status: 404 });
  if (!dryRun && haylo.status !== "ready") {
    return NextResponse.json({ error: `Haylo article status is "${haylo.status}" — only "ready" articles can be paired.` }, { status: 409 });
  }

  if (!(process.env.OPENAI_API_KEY || process.env.OpenAi_Key)) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY (or OpenAi_Key) is not set. Add the secret in the environment to use the live multi-agent pipeline." },
      { status: 412 }
    );
  }

  const allCities = await storage.getCities(false);
  const slugSet = new Set(citySlugs);
  const cities = allCities.filter((c) => slugSet.has(c.slug));
  const missingSlugs = citySlugs.filter((s) => !cities.some((c) => c.slug === s));

  const results: PerCityResult[] = [];
  let passed = 0;
  let warned = 0;
  let failed = 0;
  let errored = 0;
  let skipped = 0;
  let placementBumps = 0;

  for (const slug of missingSlugs) {
    results.push({ citySlug: slug, outcome: "skipped", reason: "city slug not found" });
    skipped++;
  }

  for (const city of cities) {
    try {
      const pairInput = {
        hayloArticle: { id: haylo.id, slug: haylo.slug, title: haylo.title, topicSlug: haylo.topicSlug, bodyHtml: haylo.bodyHtml },
        city: { slug: city.slug, cityName: city.cityName, stateCode: city.stateCode, stateName: city.stateName },
        localVibe: null,
        dryRun,
      };
      const pair = dryRun
        ? await processPair(pairInput)
        : await runPairAgentPipeline({ ...pairInput, username: session.username });

      const verdict = pair.audit.verdict;
      const draft = {
        ...pair.draftPayload,
        bodyHtml: sanitizeNewsroomHtml(pair.draftPayload.bodyHtml),
      };

      const draftValidation = newsroomDraftPayloadV1Schema.safeParse(draft);
      if (!draftValidation.success) {
        errored++;
        results.push({
          citySlug: city.slug,
          outcome: "error",
          reason: `draftPayload failed V1 schema validation: ${JSON.stringify(draftValidation.error.flatten()).slice(0, 300)}`,
        });
        continue;
      }

      if (verdict === "pass") {
        if (dryRun) {
          passed++;
          results.push({ citySlug: city.slug, outcome: "pass", verdict, flowScore: pair.audit.flowScore });
          continue;
        }
        const existing = await db
          .select({ id: knowledgeArticles.id })
          .from(knowledgeArticles)
          .where(eq(knowledgeArticles.slug, draft.suggestedSlug))
          .limit(1);
        if (existing.length > 0) {
          results.push({
            citySlug: city.slug,
            outcome: "skipped",
            verdict,
            reason: `slug "${draft.suggestedSlug}" already exists — re-run with a different Haylo article or rename existing.`,
          });
          skipped++;
          continue;
        }
        const article = await db.transaction(async (tx) => {
          const [a] = await tx
            .insert(knowledgeArticles)
            .values({
              slug: draft.suggestedSlug,
              citySlug: city.slug,
              hayloArticleId: haylo.id,
              status: "pending",
              title: draft.title,
              metaDescription: draft.metaDescription ?? null,
              canonicalUrl: `${BASE_URL}/discovery/knowledge/${draft.suggestedSlug}`,
              headline: draft.headline,
              subheadline: draft.subheadline ?? null,
              dateline: null,
              bodyHtml: draft.bodyHtml,
              authorName: draft.authorName ?? "Tableicity",
              publisherName: draft.publisherName ?? "Tableicity",
            })
            .returning();
          const bumpResult = await tx
            .update(hayloArticles)
            .set({ placementCount: sql`${hayloArticles.placementCount} + 1`, updatedAt: new Date() })
            .where(eq(hayloArticles.id, haylo.id))
            .returning({ id: hayloArticles.id });
          if (bumpResult.length === 0) {
            throw new Error(`Haylo article ${haylo.id} disappeared mid-transaction; rolling back insert.`);
          }
          return a;
        });
        placementBumps++;
        passed++;
        results.push({ citySlug: city.slug, outcome: "pass", verdict, flowScore: pair.audit.flowScore, articleId: article.id });
      } else if (verdict === "warn") {
        if (dryRun) {
          warned++;
          results.push({ citySlug: city.slug, outcome: "warn", verdict, flowScore: pair.audit.flowScore });
          continue;
        }
        const dupe = await db
          .select({ id: newsroomReviewQueue.id })
          .from(newsroomReviewQueue)
          .where(
            and(
              eq(newsroomReviewQueue.citySlug, city.slug),
              eq(newsroomReviewQueue.status, "pending"),
              sql`${newsroomReviewQueue.draftPayload}->>'hayloArticleId' = ${haylo.id}`,
            ),
          )
          .limit(1);
        if (dupe.length > 0) {
          results.push({
            citySlug: city.slug,
            outcome: "skipped",
            verdict,
            reason: `pending review row already exists for this Haylo+city pair (id=${dupe[0].id}).`,
          });
          skipped++;
          continue;
        }
        const [reviewRow] = await db
          .insert(newsroomReviewQueue)
          .values({
            citySlug: city.slug,
            draftPayload: draftValidation.data as any,
            qcScore: pair.audit.flowScore,
            qcNotes: pair.audit.summary,
            status: "pending",
          })
          .returning();
        warned++;
        results.push({ citySlug: city.slug, outcome: "warn", verdict, flowScore: pair.audit.flowScore, reviewQueueId: reviewRow.id });
      } else {
        if (!dryRun) {
          await db.insert(knowledgeGenerationLog).values({
            citySlug: city.slug,
            directive: `pair:${haylo.slug}`,
            status: "failed",
            errorMessage: `Audit FAIL (${pair.audit.flowScore}/100): ${pair.audit.summary}`,
          });
        }
        failed++;
        results.push({ citySlug: city.slug, outcome: "fail", verdict, flowScore: pair.audit.flowScore, reason: pair.audit.summary });
      }
    } catch (e: any) {
      errored++;
      const msg = e?.message ?? String(e);
      if (!dryRun) {
        try {
          await db.insert(knowledgeGenerationLog).values({
            citySlug: city.slug,
            directive: `pair:${haylo.slug}`,
            status: "error",
            errorMessage: msg.slice(0, 500),
          });
        } catch {}
      }
      results.push({ citySlug: city.slug, outcome: "error", reason: msg });
    }
  }

  await logAuditEvent({
    username: session.username,
    action: "newsroom.enqueue_pairs",
    entityType: "haylo_article",
    entityId: haylo.id,
    details: {
      hayloSlug: haylo.slug,
      cities: cities.length,
      passed,
      warned,
      failed,
      errored,
      skipped,
      placementBumps,
      dryRun,
    },
  });

  return NextResponse.json({
    hayloArticleId: haylo.id,
    hayloTitle: haylo.title,
    dryRun,
    summary: { processed: cities.length, passed, warned, failed, errored, skipped, placementBumps },
    results,
  });
}
