import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import { db, withTenantAsync, DEFAULT_TENANT_SLUG } from "@/lib/db";
import { storage } from "@/lib/storage";
import { tenants, cityLocations } from "@shared/schema";
import { resolveBrandContext } from "@/lib/newsroom/brandContext";
import { generateCityMeta } from "@/lib/cities/cityMetaGenerator";
import { logAuditEvent } from "@/lib/audit";

/**
 * City-meta reconciling sweeper — the cron counterpart to the per-row admin
 * "sparkle" button (`app/api/admin/cities/[id]/generate-meta`).
 *
 * Why this exists: articles get their LLM meta inline, as a mandatory step of
 * the only pipeline that creates them (scheduler -> pairAgentOrchestrator).
 * Cities have no such step — CSV import / single-create write rows with NULL
 * meta, and the LLM city-meta generator was only reachable by a human clicking
 * sparkle on each row. This sweeper closes that gap: it walks every tenant that
 * has a truth document, finds cities still missing meta, and fills them — so
 * "meta fills itself once a truth doc exists." Import stays instant; sparkle
 * remains the manual override.
 *
 * Contract (identical to the one-city route, so the two can never diverge):
 *   - Eligible = meta_locked_at IS NULL AND meta_source IN (NULL, 'fallback')
 *     AND (meta_title IS NULL OR meta_description IS NULL). 'manual'/locked rows
 *     and rows that already carry both fields (incl. 'llm' and CSV-provided) are
 *     left untouched. No `force` path — the sweeper never overwrites an existing
 *     'llm' row.
 *   - Per-row write re-applies the eligibility predicates on the UPDATE itself
 *     (no TOCTOU clobber) and writes ONLY meta_title/meta_description/
 *     meta_source='llm' — never updated_at (sitemap last-mod stays
 *     content-driven), which is why it writes via `db` directly.
 *   - A generation that fails the contract writes NOTHING (never a degraded
 *     value); it is counted as `failed` and the render fallback keeps serving.
 *   - `dryRun` counts eligibility only — no LLM calls, no writes, no cost.
 *   - `limit` is a per-tick budget (attempts across all tenants) so the sweep
 *     drips like the newsroom scheduler instead of doing 340 LLM calls at once.
 *
 * Tenant scoping: `db`/`storage` resolve the tenant from AsyncLocalStorage, so
 * every per-tenant read/write runs inside `withTenantAsync(slug, …)`. The
 * `public.tenants` enumeration runs under DEFAULT_TENANT_SLUG so it works even
 * when TENANT_DEFAULT_SLUG is the empty refusal-guard value.
 */

let sweepInFlight = false;

const DEFAULT_LIMIT = 25;

export interface SweepInput {
  triggeredBy: "cron" | "manual";
  username?: string;
  /** Max generation attempts across ALL tenants this tick. Default 25. */
  limit?: number;
  /** Count eligibility only — no LLM calls, no writes, no cost. */
  dryRun?: boolean;
}

export interface SweepTenantResult {
  slug: string;
  /** Total cities eligible right now (not capped by the per-tick budget). */
  eligible: number;
  /** Attempts made this tick (generated + failed). 0 on dryRun. */
  processed: number;
  generated: number;
  failed: number;
  costUsd: number;
  note?: string;
}

export interface SweepResult {
  ok: boolean;
  triggeredBy: "cron" | "manual";
  dryRun: boolean;
  limit: number;
  tenantsConsidered: number;
  eligibleTotal: number;
  processed: number;
  generated: number;
  failed: number;
  costUsd: number;
  durationMs: number;
  perTenant: SweepTenantResult[];
  notes?: string;
}

/** AND-predicate shared by the count, the fetch, and the TOCTOU-safe UPDATE. */
function eligiblePredicate() {
  return and(
    isNull(cityLocations.metaLockedAt),
    or(isNull(cityLocations.metaSource), eq(cityLocations.metaSource, "fallback")),
    or(isNull(cityLocations.metaTitle), isNull(cityLocations.metaDescription)),
  );
}

async function countEligible(): Promise<number> {
  const rows = await db
    .select({ n: sql<string>`COUNT(*)::text` })
    .from(cityLocations)
    .where(eligiblePredicate());
  return Number(rows[0]?.n ?? "0");
}

async function sweepOneTenant(
  slug: string,
  docId: string,
  budget: number,
  dryRun: boolean,
  username: string,
): Promise<SweepTenantResult> {
  const eligible = await countEligible();
  if (dryRun || budget <= 0 || eligible === 0) {
    return { slug, eligible, processed: 0, generated: 0, failed: 0, costUsd: 0 };
  }

  const truthDoc = await storage.getHayloArticleById(docId);
  if (!truthDoc) {
    return { slug, eligible, processed: 0, generated: 0, failed: 0, costUsd: 0, note: "configured truth document not found" };
  }

  const brand = await resolveBrandContext(slug);

  // Public pages first, then the rest. Bounded by the per-tick budget.
  const cities = await db
    .select()
    .from(cityLocations)
    .where(eligiblePredicate())
    .orderBy(sql`${cityLocations.isPublished} DESC`)
    .limit(budget);

  let generated = 0;
  let failed = 0;
  let costUsd = 0;

  for (const city of cities) {
    const result = await generateCityMeta({
      brand,
      cityName: city.cityName,
      stateCode: city.stateCode,
      truthDocTitle: truthDoc.title,
      truthDocBody: truthDoc.bodyHtml,
    });
    costUsd += result.costUsd ?? 0;

    if (result.status !== "generated" || !result.title || !result.description) {
      failed++;
      continue;
    }

    // Re-apply the eligibility whitelist on the write so a row locked/curated
    // since the fetch can't be clobbered (a 0-row update just gets skipped).
    const updated = await db
      .update(cityLocations)
      .set({ metaTitle: result.title, metaDescription: result.description, metaSource: "llm" })
      .where(
        and(
          eq(cityLocations.id, city.id),
          isNull(cityLocations.metaLockedAt),
          or(isNull(cityLocations.metaSource), eq(cityLocations.metaSource, "fallback")),
        ),
      )
      .returning({ id: cityLocations.id });

    if (updated.length === 0) {
      // Lost a race against a lock/curate between fetch and write — skip.
      continue;
    }

    generated++;
    await logAuditEvent({
      username,
      action: "city.meta.generated",
      entityType: "city_location",
      entityId: city.id,
      details: {
        slug: city.slug,
        metaSource: "llm",
        via: "sweeper",
        titleLength: result.title.length,
        descriptionLength: result.description.length,
        costUsd: result.costUsd,
        model: result.model,
      },
    });
  }

  return { slug, eligible, processed: generated + failed, generated, failed, costUsd };
}

export async function runCityMetaSweep(input: SweepInput): Promise<SweepResult> {
  const t0 = Date.now();
  const username = input.username ?? "sweeper";
  const limit = Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT));
  const dryRun = input.dryRun ?? false;

  const base: SweepResult = {
    ok: false,
    triggeredBy: input.triggeredBy,
    dryRun,
    limit,
    tenantsConsidered: 0,
    eligibleTotal: 0,
    processed: 0,
    generated: 0,
    failed: 0,
    costUsd: 0,
    durationMs: 0,
    perTenant: [],
  };

  if (!dryRun && !process.env.OPENAI_API_KEY && !process.env.OpenAi_Key) {
    return { ...base, durationMs: Date.now() - t0, notes: "OPENAI_API_KEY (or OpenAi_Key) is not set" };
  }
  if (sweepInFlight) {
    return { ...base, durationMs: Date.now() - t0, notes: "another sweep is already running" };
  }
  sweepInFlight = true;

  try {
    // `tenants` is a public table — read under the default tenant so the proxy
    // resolves even if TENANT_DEFAULT_SLUG is the empty refusal-guard value.
    const tenantRows = await withTenantAsync(DEFAULT_TENANT_SLUG, async () =>
      db
        .select({ slug: tenants.slug, docId: tenants.defaultHayloArticleId })
        .from(tenants)
        .where(isNotNull(tenants.defaultHayloArticleId)),
    );

    const perTenant: SweepTenantResult[] = [];
    let remaining = limit;

    for (const t of tenantRows) {
      if (!dryRun && remaining <= 0) break;
      const budget = dryRun ? 0 : remaining;
      const res = await withTenantAsync(t.slug, async () =>
        sweepOneTenant(t.slug, t.docId as string, budget, dryRun, username),
      );
      perTenant.push(res);
      remaining -= res.processed;
    }

    const out: SweepResult = {
      ...base,
      ok: true,
      tenantsConsidered: tenantRows.length,
      eligibleTotal: perTenant.reduce((s, r) => s + r.eligible, 0),
      processed: perTenant.reduce((s, r) => s + r.processed, 0),
      generated: perTenant.reduce((s, r) => s + r.generated, 0),
      failed: perTenant.reduce((s, r) => s + r.failed, 0),
      costUsd: perTenant.reduce((s, r) => s + r.costUsd, 0),
      durationMs: Date.now() - t0,
      perTenant,
    };
    return out;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, durationMs: Date.now() - t0, notes: `sweep crashed: ${msg.slice(0, 400)}` };
  } finally {
    sweepInFlight = false;
  }
}
