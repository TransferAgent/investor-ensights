import { makeOpenAIGenerator, buildHayloPayload } from "./lib/newsroom/openaiGenerator";
import { db } from "./lib/db";
import { cityLocations } from "./shared/schema";
import { eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";

async function runOne(slug: string) {
  const [city] = await db.select().from(cityLocations).where(eq(cityLocations.slug, slug)).limit(1);
  if (!city) throw new Error(slug + " missing");
  const ctx = { citySlug: city.slug, cityName: city.cityName, stateCode: city.stateCode, stateName: city.stateName ?? city.stateCode, runId: slug + "-" + Date.now(), nearbyCities: [] } as any;
  const gen: any = makeOpenAIGenerator("v3");
  const stages: any = {};
  let totalTokens = 0, totalCost = 0;
  console.log(`\n>>> ${city.cityName}, ${city.stateCode}`);
  for (const s of ["researcher", "data_analyst", "copywriter", "seo_qc"]) {
    const t = Date.now();
    try {
      const r = await gen[s](ctx, stages);
      stages[s] = r.output;
      totalTokens += r.tokensUsed; totalCost += r.costUsd;
      console.log(`  [${s}] ${Date.now()-t}ms cost=$${r.costUsd.toFixed(4)}`);
    } catch (e: any) {
      console.error(`  [${s}] FAILED: ${e.message}`);
      throw e;
    }
  }
  const payload = buildHayloPayload({ ctx, promptVersion: "v3", prior: stages, totalCostUsd: totalCost, totalTokens });
  writeFileSync(`./haylo-${slug}.json`, JSON.stringify(payload, null, 2));
  return { slug, stages, totalCost, totalTokens, payload };
}

async function main() {
  const results = [];
  for (const slug of ["providence-ri", "lowell-ma", "manchester-nh"]) {
    results.push(await runOne(slug));
  }

  console.log("\n\n========================================================");
  console.log("    3-CITY PILOT REPORT — v3 SOURCE-GROUNDED");
  console.log("========================================================");
  for (const r of results) {
    const s = r.stages;
    const sources = s.researcher.sourcesSummary?.urls || [];
    const okSrcs = sources.filter((u: any) => u.ok).length;
    console.log(`\n--- ${r.slug.toUpperCase()} ---`);
    console.log(`  sources: ${okSrcs}/${sources.length} ok`);
    sources.forEach((u: any) => console.log(`    ${u.ok ? "✓" : "✗"} ${u.bytes}b ${u.url}${u.error ? " — " + u.error : ""}`));
    console.log(`  facts: ${s.researcher.facts.length} grounded, ${s.researcher.droppedFactsCount} dropped`);
    console.log(`  fact keys: ${s.researcher.facts.map((f: any) => f.key).join(", ")}`);
    console.log(`  named entities in facts:`);
    s.researcher.facts.forEach((f: any) => {
      const v = JSON.stringify(f.value);
      console.log(`    - ${f.key}: ${v.slice(0, 110)}${v.length > 110 ? "..." : ""}`);
      console.log(`      src: ${(f.sourceUrl || "(none)").slice(0, 80)}`);
    });
    console.log(`  topAngles: ${JSON.stringify(s.data_analyst.topAngles)}`);
    console.log(`  localVibe: "${s.data_analyst.localVibe}"`);
    console.log(`  draft.title: "${s.copywriter.title}"`);
    console.log(`  qcScore: ${s.seo_qc.qcScore}`);
    console.log(`  payload.warnings: ${JSON.stringify(r.payload.warnings)}`);
    console.log(`  totalCost: $${r.totalCost.toFixed(4)}`);
  }

  // Vibe strength heuristic: count distinct named-entity tokens in localVibe vs Worcester baseline
  console.log("\n========================================================");
  console.log("    VIBE STRENGTH (entity density in localVibe)");
  console.log("========================================================");
  const vibeMatch = (vibe: string | null) => {
    if (!vibe) return [];
    return (vibe.match(/\b[A-Z][a-zA-Z0-9&\.\-]*(?:\s+[A-Z][a-zA-Z0-9&\.\-]*){0,3}\b/g) || [])
      .filter(m => !["A","An","The"].includes(m));
  };
  for (const r of results) {
    const vibe = r.stages.data_analyst.localVibe;
    const ents = vibeMatch(vibe);
    console.log(`  ${r.slug}: vibe="${vibe}"`);
    console.log(`    named entities (${ents.length}): ${ents.join(" | ")}`);
  }
  // Worcester baseline (we ran earlier)
  console.log(`  worcester-ma (baseline): "Worcester's elevation of 479 feet contributes to its unique geographic character."`);
  console.log(`    named entities (1): Worcester  ← weak (no innovation seeds)`);

  process.exit(0);
}
main().catch((e) => { console.error("ERR:", e); process.exit(1); });
