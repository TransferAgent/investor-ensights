import type {
  PipelineGenerator,
  StageContext,
  StageRunResult,
  PriorOutputs,
  CandidateCity,
} from "@/lib/newsroom/pipelineGenerator";

function fakeStageCost(seed: number): { tokens: number; costUsd: number } {
  const tokens = 250 + seed * 80;
  const costUsd = Number((tokens * 0.000004).toFixed(4));
  return { tokens, costUsd };
}

export const fixtureGenerator: PipelineGenerator = {
  mode: "fixture",
  modelLabel: "fixture/no-llm",

  async researcher(ctx: StageContext): Promise<StageRunResult> {
    const { tokens, costUsd } = fakeStageCost(0);
    const facts = [
      {
        key: "metro_population_estimate",
        value: { population: 206000, year: 2024, source: "US Census ACS 5-year (fixture)" },
        sourceUrl: "https://www.census.gov/quickfacts/" as string | null,
        confidence: 0.85 as number | null,
      },
      {
        key: "active_startup_count",
        value: { count: 47, sectorTop: "edtech", quarter: "2026-Q1", source: "Crunchbase fixture" },
        sourceUrl: "https://www.crunchbase.com/" as string | null,
        confidence: 0.85 as number | null,
      },
      {
        key: "anchor_employer",
        value: { name: `${ctx.cityName} University`, employees: 8500, sector: "education" },
        sourceUrl: "https://www.bls.gov/oes/" as string | null,
        confidence: 0.85 as number | null,
      },
    ];
    return {
      output: {
        fixture: true,
        facts: facts.map((f) => ({ key: f.key, value: f.value, sourceHint: f.sourceUrl, confidence: "high" })),
        summary: `Fixture researcher output for ${ctx.cityName}, ${ctx.stateCode}.`,
      },
      tokensUsed: tokens,
      costUsd,
      knowledge: facts.map((f) => ({
        key: f.key,
        value: f.value,
        sourceUrl: f.sourceUrl,
        confidence: f.confidence,
      })),
    };
  },

  async data_analyst(ctx: StageContext, _prior: PriorOutputs): Promise<StageRunResult> {
    const { tokens, costUsd } = fakeStageCost(1);
    return {
      output: {
        fixture: true,
        tableicityScore: 78,
        rationale: `${ctx.cityName} shows healthy seed-stage volume and clean cap-table hygiene from local university spin-outs.`,
        topAngles: [
          "three priced rounds this week",
          "university tech-transfer is taking common stock",
          "regional VC presence is thickening",
        ],
      },
      tokensUsed: tokens,
      costUsd,
    };
  },

  async copywriter(ctx: StageContext, _prior: PriorOutputs): Promise<StageRunResult> {
    const { tokens, costUsd } = fakeStageCost(2);
    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10);
    const bodyHtml = [
      `<p>The ${ctx.cityName} startup ecosystem added <strong>three priced rounds</strong> this week, all from founders who incorporated locally and chose to keep their cap table where their lawyer is — a quiet but durable signal that ${ctx.cityName} is graduating from "promising secondary market" to a real fintech corridor.</p>`,
      `<p>Among the most-watched moves: a Series A close at a midtown SaaS company, a seed extension from a ${ctx.cityName} University spin-out, and a friends-and-family round at a logistics startup that closed in eleven days using a clean SAFE stack.</p>`,
      `<h2>Why ${ctx.cityName}, why now</h2>`,
      `<p>Three structural factors are converging. First, ${ctx.cityName} University's tech-transfer office has shifted from arms-length licensing to taking common-stock positions in faculty spin-outs — which means cleaner cap tables out of the gate. Second, the regional VC presence has thickened: at least four ${ctx.stateCode}-resident funds now lead seed rounds in-state instead of routing them through Boston or New York. Third, the cost of capital outside the coastal hubs has compressed, making ${ctx.cityName} valuations defensible at exit.</p>`,
      `<h2>What we tracked this week</h2>`,
      `<ul><li>Total tracked round volume: <strong>$8.4M</strong> across three priced rounds and two SAFEs.</li><li>Median pre-money on priced rounds: <strong>$11M</strong> — up from $7.5M one year ago.</li><li>Average days-to-close from term sheet: <strong>23 days</strong>.</li></ul>`,
      `<h2>The cap-table angle</h2>`,
      `<p>For founders reading this in ${ctx.cityName}: the most common mistake we still see is option-pool sizing on a back-of-envelope at the term sheet stage, then renegotiating it at closing under time pressure. Tableicity's pool-modeling view does this in about ninety seconds.</p>`,
      `<p><em>Fixture content for plumbing verification only. Live runs replace this with LLM-generated copy.</em></p>`,
    ].join("\n");
    return {
      output: {
        fixture: true,
        title: `${ctx.cityName} Fintech Pulse: 47 Cap-Table-Ready Startups Across the ${ctx.stateCode} Metro`,
        metaDescription: `A weekly snapshot of cap-table activity across ${ctx.cityName}, ${ctx.stateCode}: who's hiring, who's raising, and which founders are reaching for clean equity infrastructure.`,
        headline: `${ctx.cityName} Fintech Pulse — Week of ${yyyymmdd}`,
        subheadline: `Forty-seven local startups now meet the Tableicity readiness threshold; here's what changed this week.`,
        dateline: `${ctx.cityName.toUpperCase()}, ${ctx.stateCode} — ${today.toDateString()}`,
        bodyHtml,
      },
      tokensUsed: tokens,
      costUsd,
    };
  },

  async seo_qc(_ctx: StageContext, _prior: PriorOutputs): Promise<StageRunResult> {
    const { tokens, costUsd } = fakeStageCost(3);
    return {
      output: {
        fixture: true,
        qcScore: 82,
        qcNotes: "Fixture content passes minimum thresholds. Live QC replaces this rubric.",
        issues: [],
      },
      tokensUsed: tokens,
      costUsd,
    };
  },

  async internal_linker(
    _ctx: StageContext,
    _prior: PriorOutputs,
    candidates: CandidateCity[]
  ): Promise<StageRunResult> {
    const { tokens, costUsd } = fakeStageCost(4);
    const links = candidates.slice(0, 3).map((c, idx) => ({
      targetSlug: `locations/${c.slug}`,
      anchorText: `cap-table activity in ${c.cityName}`,
      position: idx,
    }));
    if (links.length === 0) {
      links.push({ targetSlug: "locations", anchorText: "all Investor Ensights city pages", position: 0 });
    }
    return {
      output: { fixture: true, links, linkCount: links.length },
      tokensUsed: tokens,
      costUsd,
    };
  },
};
