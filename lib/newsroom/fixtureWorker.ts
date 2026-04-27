import { db } from "@/lib/db";
import {
  newsroomAgents,
  newsroomPipelineJobs,
  newsroomAgentRuns,
  newsroomAgentKnowledge,
  newsroomReviewQueue,
  newsroomInternalLinkSuggestions,
  cityLocations,
  type NewsroomAgent,
} from "@shared/schema";
import { and, eq, ne } from "drizzle-orm";
import { ensureDefaultAgents } from "@/lib/newsroom";
import {
  newsroomDraftPayloadV1Schema,
  type NewsroomDraftPayloadV1,
} from "@/lib/newsroom/draftPayload";

const STAGE_ORDER = [
  "researcher",
  "data_analyst",
  "copywriter",
  "seo_qc",
  "internal_linker",
] as const;

type StageRole = typeof STAGE_ORDER[number];

interface StageOutput {
  role: StageRole;
  runId: string;
  tokens: number;
  costUsd: number;
}

export interface FixtureRunResult {
  jobId: string;
  reviewQueueId: string;
  stagesCompleted: StageRole[];
  draftSummary: {
    title: string;
    suggestedSlug: string;
    bodyChars: number;
    internalLinks: number;
    qcScore: number;
  };
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

function titleCaseFromSlug(slug: string): string {
  const parts = slug.split("-");
  if (parts.length === 0) return slug;
  const stateMaybe = parts[parts.length - 1];
  const isStateCode = stateMaybe.length === 2;
  const namePart = isStateCode ? parts.slice(0, -1) : parts;
  const name = namePart
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return isStateCode ? `${name}, ${stateMaybe.toUpperCase()}` : name;
}

function fixtureFactsFor(cityName: string, stateCode: string): Array<{
  key: string;
  value: Record<string, unknown>;
  sourceUrl: string;
}> {
  return [
    {
      key: "metro_population_estimate",
      value: { population: 206000, year: 2024, source: "US Census ACS 5-year" },
      sourceUrl: "https://www.census.gov/quickfacts/",
    },
    {
      key: "active_startup_count",
      value: { count: 47, sectorTop: "edtech", quarter: "2026-Q1", source: "Crunchbase fixture" },
      sourceUrl: "https://www.crunchbase.com/",
    },
    {
      key: "anchor_employer",
      value: { name: `${cityName} University`, employees: 8500, sector: "education" },
      sourceUrl: "https://www.bls.gov/oes/",
    },
  ];
}

function buildDraftPayload(opts: {
  citySlug: string;
  cityName: string;
  stateCode: string;
  qcScore: number;
  internalLinks: Array<{ targetSlug: string; anchorText: string; position: number }>;
}): NewsroomDraftPayloadV1 {
  const { citySlug, cityName, stateCode, internalLinks } = opts;
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10);
  const suggestedSlug = `${citySlug}-fintech-pulse-${yyyymmdd}`;

  const title = `${cityName} Fintech Pulse: 47 Cap-Table-Ready Startups Across the ${stateCode} Metro`;
  const metaDescription = `A weekly snapshot of cap-table activity across ${cityName}, ${stateCode}: who's hiring, who's raising, and which founders are reaching for clean equity infrastructure.`;
  const headline = `${cityName} Fintech Pulse — Week of ${yyyymmdd}`;
  const subheadline = `Forty-seven local startups now meet the Tableicity readiness threshold; here's what changed this week.`;
  const dateline = `${cityName.toUpperCase()}, ${stateCode} — ${today.toDateString()}`;

  const bodyHtml = [
    `<p>The ${cityName} startup ecosystem added <strong>three priced rounds</strong> this week, all from founders who incorporated locally and chose to keep their cap table where their lawyer is — a quiet but durable signal that ${cityName} is graduating from "promising secondary market" to a real fintech corridor.</p>`,
    `<p>Among the most-watched moves: a Series A close at a midtown SaaS company, a seed extension from a ${cityName} University spin-out, and a friends-and-family round at a logistics startup that closed in eleven days using a clean SAFE stack.</p>`,
    `<h2>Why ${cityName}, why now</h2>`,
    `<p>Three structural factors are converging. First, ${cityName} University's tech-transfer office has shifted from arms-length licensing to taking common-stock positions in faculty spin-outs — which means cleaner cap tables out of the gate. Second, the regional VC presence has thickened: at least four ${stateCode}-resident funds now lead seed rounds in-state instead of routing them through Boston or New York. Third, the cost of capital outside the coastal hubs has compressed, making ${cityName} valuations defensible at exit.</p>`,
    `<h2>What we tracked this week</h2>`,
    `<ul><li>Total tracked round volume: <strong>$8.4M</strong> across three priced rounds and two SAFEs.</li><li>Median pre-money on priced rounds: <strong>$11M</strong> — up from $7.5M one year ago.</li><li>Average days-to-close from term sheet: <strong>23 days</strong> — meaningfully faster than the national 41-day median.</li></ul>`,
    `<h2>The cap-table angle</h2>`,
    `<p>For founders reading this in ${cityName}: the most common mistake we still see is option-pool sizing on a back-of-envelope at the term sheet stage, then renegotiating it at closing under time pressure. If you're within sixty days of a priced round, the right move is to model the post-money pool against your actual hiring plan for the next eighteen months — not against a generic 10% target. Tableicity's pool-modeling view does this in about ninety seconds.</p>`,
    `<p><em>This is a Newsroom fixture run — content is illustrative for Phase 1 plumbing verification. Phase 2 wires the live LLM pipeline that produces this story for real, weekly, per city.</em></p>`,
  ].join("\n");

  const draft: NewsroomDraftPayloadV1 = {
    version: "v1",
    citySlug,
    suggestedSlug,
    title,
    metaDescription,
    headline,
    subheadline,
    dateline,
    bodyHtml,
    boilerplateHtml: `<p>About Tableicity: cap-table software built for founders outside the coastal hubs. Free for teams under 25; paid plans start at $29/mo. <a href="https://www.tableicity.com">tableicity.com</a></p>`,
    authorName: "Tableicity Newsroom",
    publisherName: "Tableicity",
    internalLinks,
  };

  const parsed = newsroomDraftPayloadV1Schema.safeParse(draft);
  if (!parsed.success) {
    throw new Error(
      `Fixture draft failed v1 schema validation: ${JSON.stringify(parsed.error.flatten())}`
    );
  }
  return parsed.data;
}

export async function runFixturePipeline(opts: {
  citySlug: string;
  username: string;
}): Promise<FixtureRunResult> {
  const startMs = Date.now();
  const { citySlug, username } = opts;

  const agents = await ensureDefaultAgents();
  const agentByRole = new Map<string, NewsroomAgent>(agents.map((a) => [a.role, a]));
  for (const role of STAGE_ORDER) {
    if (!agentByRole.has(role)) {
      throw new Error(`Default agent missing for role: ${role}`);
    }
  }

  const existingActive = await db
    .select({ id: newsroomPipelineJobs.id, status: newsroomPipelineJobs.status })
    .from(newsroomPipelineJobs)
    .where(
      and(
        eq(newsroomPipelineJobs.citySlug, citySlug),
        eq(newsroomPipelineJobs.dryRun, true),
        ne(newsroomPipelineJobs.status, "completed"),
        ne(newsroomPipelineJobs.status, "failed")
      )
    )
    .limit(1);
  if (existingActive.length > 0) {
    throw new Error(
      `A dry-run job for "${citySlug}" is already ${existingActive[0].status} (id=${existingActive[0].id}). Wait for it to complete or use Purge dry-run first.`
    );
  }

  const [city] = await db
    .select({
      cityName: cityLocations.cityName,
      stateCode: cityLocations.stateCode,
    })
    .from(cityLocations)
    .where(eq(cityLocations.slug, citySlug))
    .limit(1);
  const cityName = city?.cityName ?? titleCaseFromSlug(citySlug).split(",")[0];
  const stateCode = (city?.stateCode ?? citySlug.split("-").pop() ?? "MA").toUpperCase();

  const [job] = await db
    .insert(newsroomPipelineJobs)
    .values({
      citySlug,
      status: "running",
      currentStage: "researcher",
      dryRun: true,
      payload: { source: "in-app-fixture", username, mode: "gate1" },
      claimedBy: "in-app-fixture-worker",
      claimedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .returning();

  const stageOutputs: StageOutput[] = [];
  const completedRoles: StageRole[] = [];

  try {
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const role = STAGE_ORDER[i];
      const agent = agentByRole.get(role)!;
      const nextStage = STAGE_ORDER[i + 1] ?? "review";

      const startedAt = new Date();
      const tokens = 250 + i * 80;
      const costUsd = Number((tokens * 0.000004).toFixed(4));

      const stageInput: Record<string, unknown> = {
        citySlug,
        cityName,
        stateCode,
        stage: role,
        priorStages: completedRoles,
      };
      const stageOutput: Record<string, unknown> = {
        fixture: true,
        role,
        summary: `Fixture stage "${role}" completed for ${cityName}, ${stateCode}.`,
      };

      if (role === "seo_qc") {
        stageOutput.qcScore = 82;
        stageOutput.qcNotes = "Fixture content passes minimum thresholds. Live QC will replace this rubric in Phase 2.";
      }
      if (role === "internal_linker") {
        stageOutput.linkCount = 3;
      }

      const finishedAt = new Date();
      const [run] = await db
        .insert(newsroomAgentRuns)
        .values({
          agentId: agent.id,
          jobId: job.id,
          citySlug,
          status: "completed",
          dryRun: true,
          input: stageInput,
          output: stageOutput,
          tokensUsed: tokens,
          costUsd: String(costUsd),
          startedAt,
          finishedAt,
        })
        .returning({ id: newsroomAgentRuns.id });

      stageOutputs.push({ role, runId: run.id, tokens, costUsd });
      completedRoles.push(role);

      if (role === "researcher") {
        const facts = fixtureFactsFor(cityName, stateCode);
        await db.insert(newsroomAgentKnowledge).values(
          facts.map((f) => ({
            agentId: agent.id,
            citySlug,
            key: f.key,
            value: f.value,
            sourceUrl: f.sourceUrl,
            confidence: "0.85",
          }))
        );
      }

      await db
        .update(newsroomPipelineJobs)
        .set({
          currentStage: nextStage,
          agentsCompleted: [...completedRoles],
          heartbeatAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(newsroomPipelineJobs.id, job.id));
    }

    const otherCities = await db
      .select({ slug: cityLocations.slug, cityName: cityLocations.cityName })
      .from(cityLocations)
      .where(and(eq(cityLocations.isPublished, true), ne(cityLocations.slug, citySlug)))
      .limit(3);
    const internalLinks = otherCities.map((c, idx) => ({
      targetSlug: `locations/${c.slug}`,
      anchorText: `cap-table activity in ${c.cityName}`,
      position: idx,
    }));
    if (internalLinks.length === 0) {
      internalLinks.push({
        targetSlug: "locations",
        anchorText: "all Tableicity city pages",
        position: 0,
      });
    }

    const draft = buildDraftPayload({
      citySlug,
      cityName,
      stateCode,
      qcScore: 82,
      internalLinks,
    });

    const [reviewRow] = await db
      .insert(newsroomReviewQueue)
      .values({
        jobId: job.id,
        citySlug,
        draftPayload: draft,
        qcScore: 82,
        qcNotes: "Fixture run — content is illustrative for Phase 1 plumbing.",
        status: "pending",
      })
      .returning({ id: newsroomReviewQueue.id });

    await db.insert(newsroomInternalLinkSuggestions).values(
      internalLinks.map((l) => ({
        reviewQueueId: reviewRow.id,
        targetSlug: l.targetSlug,
        anchorText: l.anchorText,
        position: l.position,
        accepted: false,
      }))
    );

    await db
      .update(newsroomPipelineJobs)
      .set({
        status: "completed",
        currentStage: "review",
        agentsCompleted: [...completedRoles],
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsroomPipelineJobs.id, job.id));

    const totalTokens = stageOutputs.reduce((s, o) => s + o.tokens, 0);
    const totalCostUsd = Number(
      stageOutputs.reduce((s, o) => s + o.costUsd, 0).toFixed(4)
    );

    return {
      jobId: job.id,
      reviewQueueId: reviewRow.id,
      stagesCompleted: completedRoles,
      draftSummary: {
        title: draft.title,
        suggestedSlug: draft.suggestedSlug,
        bodyChars: draft.bodyHtml.length,
        internalLinks: internalLinks.length,
        qcScore: 82,
      },
      totalTokens,
      totalCostUsd,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    await db
      .update(newsroomPipelineJobs)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        heartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsroomPipelineJobs.id, job.id));
    throw err;
  }
}
