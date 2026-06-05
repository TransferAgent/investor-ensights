---
name: City meta generation — tight char band needs a strong model
description: Why City Meta Description generation uses full gpt-4.1, not gpt-4.1-mini, and how the safety net is layered.
---

# City Meta generation: hitting a tight char band

**Rule:** When an LLM must hit a NARROW character band (e.g. the City Meta
Description's ~130–165 with two natural sentences + brand-once-in-closing), use
a strong instruction-following model (full **gpt-4.1**), not gpt-4.1-mini.

**Why:** gpt-4.1-mini cannot count characters. On the City Meta Description it
overshoots the 165 ceiling ~50% of the time, and that failure rate does NOT
improve with: aiming the prompt lower, more shots (tried 3), surgical
length-aware retry hints ("shorten by N chars"), or lowering the floor. Pass
rate stayed ~50%. Switching only the DESCRIPTION step to full gpt-4.1 jumped it
to ~90% with clean, varied, on-contract output. The TITLE step (≤65, city
verbatim, no brand) is easy and stays on mini.

**Why it's affordable:** this is WRITE-TIME generation (runs once per city, via
admin/script — never at render time), so the per-call price difference is
immaterial — ~$0.0037/city, ~$1.25 for a full ~340-city rollout.

**How to apply:** keep the description on a strong model. Don't try to claw back
the band with more mini retries — it's a model-capability limit, not a prompt
bug. The deterministic sentence-drop repair only rescues 3+ sentence overshoots
(it preserves the city sentence + brand closing sentence); 2-sentence
overshoots that are still too long are correctly SKIPPED (llm-failed → no write,
render fallback stays). The Description floor (130) is ours to tune; the Target
(160) and Hard-max (165) are the Conductor's pinned spec — don't relax the max
without sign-off.

## Persistence / admin trigger (G4) — two non-obvious traps

**Direct `db.*` calls are NOT auto-tenant-scoped; `storage.*` calls ARE.** The
`storage` Proxy wraps every method in `withSessionTenant` (reads tenant from the
session cookie), but the `db` Proxy only resolves the tenant from
AsyncLocalStorage / `TENANT_DEFAULT_SLUG` (defaults to `tableicity`). So a route
that mixes `storage.getX()` (correct schema) with a raw `db.update(...)` will
silently write to the DEFAULT tenant's schema for any non-default tenant —
wrong-tenant writes that *look* successful on the tableicity dev box. **Fix:**
wrap the whole handler body in `withTenantAsync(session.tenantSlug, async () =>
…)` so both storage and direct db share the tenant context.
**Why:** caught in G4 review — the bug is invisible while testing as tableicity.

**Forward-only meta writes must bypass `storage.updateCity`.** `updateCity`
always stamps `updatedAt: new Date()`. City/article meta is SEO-only and the
public sitemap last-mod must stay CONTENT-driven, so meta writes touch ONLY
`meta_title` / `meta_description` / `meta_source` via a direct `db.update`, never
`updateCity`. Same discipline as the article backfill (which never touches
`updated_at` / `date_modified`).

**Overwrite guard must be a positive whitelist re-checked at WRITE time, not
just read time.** Eligible = `meta_locked_at IS NULL AND (meta_source IS NULL OR
'fallback' OR (force AND 'llm'))`. NEVER 'manual', never locked. Put the same
predicates in the UPDATE `WHERE` (and treat 0 rows as 409/skip) so a row
locked/curated between the read and the write can't be clobbered (TOCTOU). The
generator only ever stamps `'llm'`; a city that fails the contract is SKIPPED,
never written with a degraded value. `--persona` is interpolated into a raw
`tenant_<persona>` identifier in the backfill script — validate it against
`^[a-z0-9_]+$` first (identifier sink, no quoting can sanitize it).
