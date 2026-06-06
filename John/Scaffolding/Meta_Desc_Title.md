# Meta Description & Meta Title — Evolution of the LLM Handling

> **Scope:** How Investor Ensights generates SEO **meta titles** and **meta descriptions** with an LLM — both the **Article** pipeline (Newsroom press releases) and the **City** pipeline (city landing pages). This is the granular engineering history, the locked rules, the file map, and the open questions.
>
> **Sibling document:** `Regeneration.md` (in this folder) captures the exact code/data state as of the latest entry below, so this evolution log can stay narrative while the restore point stays precise.

---

## Document Control

| Field | Value |
|---|---|
| Document | `John/Scaffolding/Meta_Desc_Title.md` |
| Status | **LIVE (reactivated 2026-06-06 by Conductor)** — reopened per the r5 reopen protocol; was RETIRED 2026-06-06 after PROD-accepted 2026-06-05. Active meta-control doc again, ready to receive the next meta change. |
| Owner | Conductor (abc19@gmail) |
| Maintainer | Agent (document control) |
| Companion | `John/Scaffolding/Regeneration.md` |
| Related (historical) | `John/Meta_Fix_Desc.md` (article-side meta fix, 2026-05-17), `replit.md` (MT-4.13.x history) |

### Revision Log

| Rev | Date (UTC) | Author | Change |
|---|---|---|---|
| r1 | 2026-06-05 | Agent | Initial document. Captures Article meta history (MT-4.13 → MT-4.13.4) and City meta build (G1 → G5, PROD rollout complete). Records the considered-and-parked 290–320 / 50–65 proposal. |
| r2 | 2026-06-05 | Agent | **Universal Truth Document Provisioning (TD-0..TD-5).** Adds the human-designation path for a per-tenant truth doc (Haylo Library star + Persona Wizard auto-designate on seed), readiness gating (`truthDoc.ready` folded into `publishReady`), and same-tenant + Conductor cross-tenant designation APIs. See new §G6. **No contract / band / model change** — only *how* a persona acquires the truth doc the City generator already required. |
| r3 | 2026-06-05 | Agent | **City Title: state code now BANNED + per-city admin "generate" sparkle button.** Two changes (commits `5f95614` sparkle, `09c1c19` state-ban): (1) `cityMetaTitleAcceptable` now takes `stateCode` and rejects `title-contains-state` (uppercase word-boundary match) so city titles read "Austin", never "Austin, TX" — the parked-then-revived "city-only title" sub-decision in §3 is now **SHIPPED for the city path only**; the shared article gate is untouched (article titles still allow state). (2) The admin Cities listing gained a per-row sparkle button calling the existing generate-meta route (amber = generate on null/fallback, indigo = regenerate w/ `?force=1` on `llm`, lock icon when `meta_locked_at`/`manual`). **Bands and models unchanged** (desc 130/160/165, title 55/65, `gpt-4.1`/`gpt-4.1-mini`). |
| r4 | 2026-06-05 | Agent | **City-meta reconciling CRON sweeper (auto-fill).** New `lib/cities/cityMetaSweeper.ts` + `app/api/cron/city-meta-sweeper/route.ts` mirror the newsroom scheduler: a `CRON_SECRET`-gated tick walks **every tenant whose `default_haylo_article_id` is set** and fills cities still missing meta — so "meta fills itself once a truth doc exists," retiring the per-city sparkle as the *only* path (sparkle stays as the manual override; CSV import stays instant). See new §G7. **No contract / band / model change** — reuses `generateCityMeta` and the *exact* one-city eligibility whitelist (`meta_locked_at IS NULL`, source ∈ {NULL,'fallback'}, title-or-desc NULL); re-applies that whitelist on a TOCTOU-safe UPDATE that writes only `meta_title`/`meta_description`/`meta_source='llm'` (never `updated_at`); `dryRun` counts free; per-tick `limit` budget drips. **Does NOT auto-designate truth docs** (tableicity's existing pointer untouched). |
| r5 | 2026-06-05 | Agent | **Auto-trigger (zero human setup) + chapter CLOSE-OUT.** The sweep now rides along on the existing newsroom-scheduler heartbeat (article tick first/committed, then `runCityMetaSweep` in its own try/catch), bounded by BOTH an attempt budget (`CITY_META_SWEEP_PER_TICK=5`) AND a wall-clock deadline (`CITY_META_SWEEP_DEADLINE_MS=80_000` from request start → `SweepInput.deadlineMs`); each OpenAI call is timeout-bounded (`timeout 30_000, maxRetries 1`). Optional dedicated cadence via `scripts/city-meta-sweep-tick.mjs` Scheduled Deployment. See §G7 auto-trigger + accepted-limitations bullets. **Conductor tested Cities + Articles on PROD and accepted 100% (2026-06-05); this document is now CLOSED** — the meta subsystem (article + city, manual + auto) is shipped & accepted. Reopen by flipping Status to LIVE and adding r6. **No contract / band / model change.** |
| r6 | 2026-06-06 | Agent | **Reactivated (Conductor).** Status flipped RETIRED→LIVE per the r5 reopen protocol; this is the active meta-control doc again. **No contract / band / model change** — reopened to receive the next meta change (work TBD). |
| r7 | 2026-06-06 | Agent | **ARTICLE meta re-band + article Title state-ban (Conductor).** Three changes to the **Article** path only (city path untouched): (1) **Haylo read excerpt 1000 → 4000 chars** — the orchestrator now calls `hayloBodyExcerptFromHtml(bodyHtml, 4000)` so the naturalizer grounds on a much larger slice (helper default stays 1000 for any other caller). (2) **Description re-banded: target 275, range 250–300** (was target 150 / 100–200) — updated in BOTH `metaNaturalizer.ts` local consts AND `pairProcessor.ts` `META_LIMITS` (+ new `descriptionMin: 250`, soft-warn → 290); the orchestrator Tier-1 desc gate now passes the new band so a short copywriter desc routes to the naturalizer. (3) **Article Title now BANS the state code** (city-only, no "City, ST" door-hanger) — mirrors the r3 city ban, now extended to articles: shared `metaTitleAcceptable` gained an optional `stateCode` param (`title-contains-state`, uppercase word-boundary), passed by the orchestrator Tier-1 gate + naturalizer `validateOrNull`; system prompt + retry hint forbid the state; formula fallback `buildMetaTitle` dropped its `${city}, ${state}:` prefix to `${city}:`. **Title band (55/65) and model (`gpt-4.1-mini`) unchanged.** See new §1 MT-4.14 subsection. |

> **Document-control rule:** every substantive change to meta behavior gets a new revision row here **and** a matching update to `Regeneration.md`. Bump the rev letter, never overwrite history.

---

## 0. The two pipelines at a glance

There are **two independent meta generators**. They share *philosophy* and one shared validator module, but they are separate code paths with separate contracts.

| | **Article meta** (Newsroom) | **City meta** (city pages) |
|---|---|---|
| Subject | A published press release / knowledge article | A city landing page |
| Trigger | During the Newsroom pair/pipeline run, at publish | Write-time backfill / admin "generate" button |
| Grounding | The article body itself | Per-persona **Haylo "truth document"** (RAG) |
| Generator | `lib/newsroom/metaNaturalizer.ts` (Tier-2.5) | `lib/cities/cityMetaGenerator.ts` |
| Contract | `lib/newsroom/brandContext.ts` (`metaTitleAcceptable`, `metaDescriptionAcceptable`) | `lib/cities/cityMetaContract.ts` (wraps the shared title gate; defines its own desc gate) |
| Storage | `knowledge_articles.meta_title/meta_description/meta_source/meta_locked_at` | `city_locations.meta_title/meta_description/meta_source/meta_locked_at` |
| Render | Page reads stored value; falls back to formula if absent | Same — read stored value, else pre-LLM render fallback |

**Shared, non-negotiable principles (both pipelines):**
- **Write-time only. Never render-time.** Pages only *read* stored meta. Generation never happens during a page request.
- **Explicit failure beats a silent bad value.** A candidate that fails the contract is **skipped** (no write), not degraded.
- **Forward-only.** Generators only ever UPDATE the meta columns. `meta_locked_at IS NOT NULL` = frozen, never re-generated.
- **City verbatim** in both title and description.
- **Brand discipline:** the brand earns its place at the *end* of the description and is *banned from the title* (the title budget is spent on the city; the brand lives in the H1, URL, and description).

---

## 1. Article meta — the road to the current contract

Source of truth for this section: `replit.md` (MT-4.13.x) and `John/Meta_Fix_Desc.md`.

### MT-4.13.2 — Brand-mention guard (pipeline body, not meta itself)
The public article renderer backlinks the **first** body occurrence of the persona display name. If the LLM body never mentioned the brand, the backlink silently vanished (two May-2026 articles shipped that way). A word-boundary guard was added in the pipeline worker *before* draft composition: on a brand-less body the run throws and the job is marked `failed`. (Context — this is why "brand must actually appear" became a hard rule that later carried into meta.)

### MT-4.13.3 — Tier-2.5 LLM meta **naturalizer** (initial version)
- Introduced `lib/newsroom/metaNaturalizer.ts` — a single gpt-4.1-mini "polish" call (~$0.0003/article).
- Introduced the `meta_source = 'naturalized'` value (no migration; it's just a `varchar(16)` string).
- Introduced the `--naturalize` flag on the article meta backfill.
- **Problem discovered:** the original prompt produced **81–87 char titles**. Google truncates SERP titles at ~60. The formula descriptions also read like door-hangers (brand at the front). → superseded.

### MT-4.13.4 — current article contract: "brand out of title, 80/20 description"
The Conductor decision that still governs article meta:
- **Title:** target **55**, hard max **65**. MUST contain the city verbatim. MUST NOT contain the persona display name. Formula safety net = `${city}, ${state}: ${haylo title trimmed}` (no brand prefix).
- **Description:** target **150**, range **100–200**. MUST contain city + brand verbatim. Brand mentioned **1–2×**, **never inside the first 40 chars** ("lead with content, not the brand"). Formula safety net puts the brand attribution at the end.
- **Two acceptance helpers** added to `lib/newsroom/brandContext.ts`:
  - `metaTitleAcceptable(meta, brand, cityName, maxLen=65)` — max-length + city-verbatim + brand-free. **No minimum length.**
  - `metaDescriptionAcceptable(meta, brand, cityName, {minLen=100, maxLen=200, brandLeadGuardChars=40})` — length band + city-verbatim + brand 1–2× + brand-lead guard.
  - Both return `null` on pass, or a short reason string on reject. The same helpers are used by both the orchestrator gate and the naturalizer validation, so the gates are guaranteed identical.
- **Naturalizer is two-shot:** first failure feeds the rejection reason back with a stricter retry (temperature 0.6 → 0.3). Falls open to the formula if both shots fail (never throws).
- **Shared constants** `META_LIMITS` and `META_DESCRIPTION_BRAND_LEAD_GUARD_CHARS` exported from `pairProcessor.ts` so the admin preview + naturalizer share one source of truth.

**Net article-meta rules today (superseded by MT-4.14 below):** title ≤65 / city verbatim / brand-free; description 100–200 / city + brand verbatim / brand 1–2× / brand not in first 40 chars.

### MT-4.14 — article meta re-band + article Title state-ban (r7, 2026-06-06)
Conductor decision, **Article path only** (city path untouched). Three changes:
- **Haylo read excerpt 1000 → 4000 chars.** The orchestrator now calls `hayloBodyExcerptFromHtml(input.hayloArticle.bodyHtml, 4000)` so the naturalizer grounds its angle on a much larger plain-text slice. The helper's own default stays `1000` (no other caller affected).
- **Description re-banded: target 275, range 250–300** (was target 150 / 100–200). Brand 1–2× / city + brand verbatim / brand-not-in-first-40 rules are **unchanged** — only the length band moved. Updated in BOTH places that define it: `metaNaturalizer.ts` local consts (`META_DESCRIPTION_TARGET=275`, `_MIN=250`, `_HARD_MAX=300`) and `pairProcessor.ts` `META_LIMITS` (added `descriptionMin: 250`, target `275`, hard max `300`, soft-warn `290`). The orchestrator's **Tier-1** desc gate now passes the new band, so a shorter copywriter description is rejected and routed through the Tier-2.5 naturalizer (which now targets 275).
- **Article Title now BANS the state code** — city-only, no "City, ST" door-hanger. This mirrors the r3 **city-path** ban (§2 G2) and now extends it to the **article path**:
  - Shared `metaTitleAcceptable(meta, brand, cityName, maxLen=65, stateCode?)` gained an **optional** `stateCode` param. When passed, a title containing the uppercase code as a word-boundary token is rejected as `title-contains-state` (case-sensitive on the UPPERCASE code, so lowercase words like "or"/"in" never false-positive). City callers that don't pass it are unaffected.
  - The state is now passed by **both** article gates: the orchestrator **Tier-1** gate (`input.city.stateCode`) and the naturalizer **Tier-2.5** `validateOrNull` (`input.stateCode`), so they stay identical.
  - The naturalizer **system prompt** + **two-shot retry hint** now explicitly forbid the state name / 2-letter code ("Albany", never "Albany, NY").
  - The **formula fallback** `buildMetaTitle` dropped its `${city}, ${state}: ` prefix to `${city}: ` (stateCode voided) so the safety net also obeys.
- **Unchanged:** title band (target 55 / hard max 65), model (`gpt-4.1-mini`), the never-throw / forward-only rules, and the entire **City** pipeline.

**Net article-meta rules as of r7:** title ≤65 / city verbatim / brand-free / **state-free**; description **250–300** / city + brand verbatim / brand 1–2× / brand not in first 40 chars; naturalizer grounds on the first **4000** chars of the Haylo body.

---

## 2. City meta — the build (this is the new work)

The City pipeline reused the *philosophy* of MT-4.13.4 but tightened it for city pages, and added the big new idea: **RAG grounding on a per-persona Haylo "truth document."**

### Conductor spec (the locked intent)
- **Cities only**, **per-persona**, **write-time only, never render-time**.
- **Description generated FIRST** via RAG from the persona's Haylo truth document: **~80% product / ~20% brand**, brand named **EXACTLY ONCE** in the **closing sentence**, **NOT** in the first 40 chars, **city verbatim**.
- **Title generated SECOND**: ≤65 (target 55), **city verbatim**, **brand-free**.
- **No truth doc → no write.** (A city with no grounding is skipped, not guessed.)

### G1 — Schema columns (no behavior, just storage)
Added (additively, no destructive migration):
- `city_locations.meta_source varchar(16)` — `'llm'` when generated; `NULL`/`'fallback'` = eligible for backfill.
- `city_locations.meta_locked_at timestamptz` — non-null = frozen, never overwritten (mirrors article `meta_locked_at`).
- `tenants.default_haylo_article_id uuid` — pointer to the persona's Haylo **truth document**.
- (`city_locations.meta_title varchar(120)` / `meta_description varchar(500)` already existed.)

### G2 — City meta **contract** (`lib/cities/cityMetaContract.ts`, pure functions, no LLM/DB)
Single source of truth for the SERP-fit rules. Current constants:

| Constant | Value | Meaning |
|---|---|---|
| `CITY_META_DESC_MIN` | **130** | floor (tuned below the ceiling for margin) |
| `CITY_META_DESC_TARGET` | **160** | aim |
| `CITY_META_DESC_HARD_MAX` | **165** | hard ceiling (Google renders ~155–160) |
| `CITY_META_DESC_BRAND_LEAD_GUARD` | **40** | brand banned in the first N chars |
| `CITY_META_TITLE_TARGET` | **55** | aim |
| `CITY_META_TITLE_HARD_MAX` | **65** | hard ceiling |
| `CITY_META_DESC_PRODUCT_RATIO` / `_BRAND_RATIO` | **0.8 / 0.2** | documentation-only (ratio isn't numerically enforced) |

Gates:
- **`cityMetaDescriptionAcceptable`** rejects unless: length in [130, 165]; ends on terminal punctuation (complete sentence, never mid-word); city verbatim; brand appears **exactly once**; that single mention is **in the closing sentence**; and the brand is **not** in the first 40 chars. (The lead guard also closes the single-sentence loophole.)
- **`cityMetaTitleAcceptable`** wraps the shared `metaTitleAcceptable` (pinned to the city max 65: city verbatim, brand-free, length ≤ max, **no minimum length**) and, as of **r3**, adds a City-only **"no state code" guard**: pass the `stateCode` and a title containing the uppercase code as a word-boundary token (e.g. the "TX" in "Austin, TX") is rejected as `title-contains-state`. The match is **case-sensitive on the UPPERCASE code** (code normalized to uppercase first), so lowercase words that happen to spell a code ("or", "in") never false-positive. The shared article gate is unaffected — **state is still allowed in article titles, banned only in city titles.**
- **`repairCityMetaDescriptionLength`** — deterministic length fix for an over-long-but-otherwise-valid description: drops whole *middle* content sentences (keeps the first content sentence, which carries the city, and the brand closing sentence), then re-validates against the FULL contract. Returns `null` if it can't be safely fixed (caller then treats it as an `llm-failed` skip). This exists because **LLMs cannot count characters**, so over-length is the dominant failure.

### G3 — RAG **generator** (`lib/cities/cityMetaGenerator.ts`, compute-only)
- **Order:** DESCRIPTION first, TITLE second (Conductor order).
- **Models (per step):** description uses **`gpt-4.1`** (the tight 130–165 band with two natural sentences + brand-in-closing is something `gpt-4.1-mini` fails ~50% of the time by overshoot); title uses **`gpt-4.1-mini`** (≤65 / city verbatim / brand-free is easy). Truth-doc excerpt capped at **4000 chars**.
- **Two-shot per step:** first shot temperature 0.6; on a contract reject, the **machine-readable reason is fed back** with a surgical retry hint and temperature drops to 0.3. Description gets up to **3** attempts; title gets **2**.
- **Hard guarantees:** NEVER throws; writes nothing; `no-truth-doc` status when the truth doc is missing/empty (caller writes nothing, page keeps its render fallback); `llm-failed` when both shots fail.
- **Cost:** typical ~$0.0006/city, worst case <~$0.0015/city.

### G4 — Persistence (admin route + backfill), still forward-only
- **Admin route:** `app/api/admin/cities/[id]/generate-meta/route.ts` — single-city "generate" for the dashboard.
- **Backfill:** `scripts/backfill-city-meta.ts`.
  - Overwrite policy: only rows where `meta_source IS NULL OR = 'fallback'`. `--force` also re-generates existing `'llm'` rows **but still never touches `meta_locked_at IS NOT NULL`**.
  - Forward-only: only ever UPDATEs the two meta columns + `meta_source`.
  - Dry-run by default; `--confirm` writes; every write + a per-city audit row.
  - Flags: `--persona=` (default `tableicity`), `--city=`, `--limit=`, `--concurrency=` (default 5), `--confirm`, `--force`, `--prod`.
  - TOCTOU-safe: the overwrite whitelist is repeated in the UPDATE `WHERE`, so a row locked/curated between read and write is skipped (treated as 0-rows).

### G4b — Chunked generation + input hardening
- Generation phase runs in concurrent chunks of `--concurrency=N`, results stitched back in candidate order; the single write transaction is unchanged.
- `--concurrency` parsing hardened to a finite-integer guard (falls back to 5 on garbage input).

### G5 — PRODUCTION rollout (tableicity) — COMPLETE
- **Schema-first:** PROD was missing the G1 columns (they were dev-only). Applied **additive** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to PROD `public`, then `node scripts/sync-tenant-schemas.mjs --prod` fanned the columns into **all 5 tenant schemas** (haylo, payrol, tableicity, texitie, veltroy). Deliberately **avoided** `drizzle-kit push --force`.
- Set tableicity `tenants.default_haylo_article_id` to the PROD truth doc (matched by **title**, because the row id differs from dev).
- Backfilled **all 340 tableicity PROD cities** to `meta_source='llm'` in resumable batches.
- **Verified:** 0 eligible remaining, **0 contract violations**, title **42–65** / description **131–165**.
- Throughput note: the real ceiling is OpenAI's **gpt-4.1 TPM limit**, not wall-clock; 429s are free and leave the city eligible, so re-running drains the rest (idempotent).

### G6 — Universal Truth Document Provisioning (TD-0..TD-5)
The City generator was already keyed on `tenants.default_haylo_article_id` + `--persona`, but **only tableicity ever had a pointer set** — every other persona silently produced no city meta (graceful no-op). G6 makes the truth doc a **first-class, human-designatable** object so any persona can be provisioned without SQL:
- **Designation API (TD-1):** `app/api/admin/haylo-articles/truth-doc/route.ts` (same-tenant GET current / PUT set+clear; validates the article lives in the session tenant and has a non-empty body; audit `haylo.truthdoc.set`) and `app/api/admin/personas/[slug]/truth-doc/route.ts` (Conductor-gated cross-tenant POST; `withTenantAsync(target)` validates the article, then sets `public.tenants`; audit `persona.truthdoc.set` into the actor's tenant).
- **Haylo Library (TD-2):** `app/admin/haylo/page.tsx` shows a **"Truth Document"** badge on the designated row and a per-row star toggle to set/clear it; an amber "paused" notice appears while no truth doc is set (city meta is a no-op until then).
- **Onboarding gate (TD-3):** `app/api/admin/personas/[slug]/readiness/route.ts` adds `truthDoc {articleId, ready}` (ready = pointer set AND body non-empty) and folds it into `publishReady`. The Persona Wizard (`app/admin/personas/new/page.tsx`) **auto-designates the single seeded essay** as the truth doc on save, and the Finish button stays disabled until `truthDoc.ready`. A new persona therefore cannot ship ungrounded city meta by construction.
- **Rollout (TD-4):** the backfill engine is unchanged (`--persona` already supported); per-persona rollout is now *data-gated on designation* rather than on SQL access. As of this snapshot **only tableicity exists as a tenant in dev** (truth doc set, 18 cities) and is fully backfilled on PROD (340/340); the other four personas (haylo/payrol/texitie/veltroy) have no tenant rows yet and are onboarded — truth doc included — through the gated Wizard.
- **No contract change:** bands (130/160/165 desc, 55/65 title), models (`gpt-4.1` / `gpt-4.1-mini`), and the never-throw / forward-only / `meta_locked_at`-sacred rules are **identical** to G5. G6 changes *provisioning*, not *generation*.

### G7 — Reconciling CRON sweeper (city meta auto-fills itself)
G6 made the truth doc designatable, but city meta still only filled when a human clicked the per-row **sparkle** (or ran the backfill script). Articles never had this problem: they get LLM meta inline as a mandatory step of the *only* pipeline that creates them (`cron → runSchedulerTick → pairAgentOrchestrator`). G7 gives cities the same "fills itself" property — a reconciling sweeper that mirrors the newsroom scheduler:

- **Runner — `lib/cities/cityMetaSweeper.ts`.** Enumerates `public.tenants WHERE default_haylo_article_id IS NOT NULL` (read under `DEFAULT_TENANT_SLUG` so it survives the empty-`TENANT_DEFAULT_SLUG` refusal guard), then `withTenantAsync(slug, …)` per tenant. **Eligible = the exact one-city whitelist:** `meta_locked_at IS NULL` AND `meta_source ∈ {NULL,'fallback'}` AND `(meta_title IS NULL OR meta_description IS NULL)` — so it *fills gaps* and never clobbers `manual`/locked rows, existing `'llm'` rows, or CSV-provided pairs. The write re-applies that whitelist on the UPDATE itself (TOCTOU-safe; a row locked/curated mid-tick just yields a 0-row update and is skipped) and sets **only** `meta_title`/`meta_description`/`meta_source='llm'` — **never `updated_at`** (sitemap last-mod stays content-driven), which is why it writes via `db` directly rather than a storage helper that stamps timestamps.
- **Cron route — `app/api/cron/city-meta-sweeper/route.ts`.** Mirrors `app/api/cron/newsroom-scheduler/route.ts`: `CRON_SECRET`-gated (`x-cron-secret` header or `Bearer`), `force-dynamic`, `maxDuration 120`, GET+POST, reads `?limit=` and `?dryRun=1`.
- **Cost controls:** `dryRun=1` **counts eligibility only — zero LLM calls, zero writes, zero cost** (the safe "what would be swept" probe). A per-tick `limit` (default 25) bounds generation *attempts across all tenants*, so the sweep **drips** like the scheduler instead of doing 340 calls in one request. Failures (contract miss) write nothing and the render fallback keeps serving.
- **Audit:** each fill logs `city.meta.generated` with `details.via='sweeper'` so dashboards counting generations stay correct while the origin is still distinguishable.
- **Explicitly does NOT auto-designate truth docs.** A tenant with no `default_haylo_article_id` is simply skipped (graceful no-op). Tableicity's existing pointer is untouched, per the Conductor constraint.
- **Verified in dev (2026-06-05):** `dryRun` reported 1 tenant (tableicity) / 17 eligible; a `limit=1` live tick generated 1 row ($0.00258) and the next `dryRun` showed 16 — proving enumeration, eligibility, generation, TOCTOU write, budget drip, and audit end-to-end.
- **No contract / band / model change** — reuses `generateCityMeta` unchanged. G7 changes *when generation is triggered* (now also automatically), not *how it generates*. The sparkle button remains the manual override; CSV import stays instant.
- **Auto-trigger / "keep the human out" (added 2026-06-05).** A route only runs when something pings it, and *nothing in the repo schedules either cron* — the schedule lives in Replit's deployment config (a Scheduled Deployment, set in the UI). So the sweep now **rides along on the existing newsroom-scheduler heartbeat**: `app/api/cron/newsroom-scheduler/route.ts` awaits `runSchedulerTick` first (article work fully committed), then calls `runCityMetaSweep` inside its **own try/catch** so a sweep error can never turn a successful publish tick into a 500. Bounded by **BOTH** an attempt budget (**`CITY_META_SWEEP_PER_TICK = 5`**) **and** a wall-clock deadline (`CITY_META_SWEEP_DEADLINE_MS = 80_000` from request start → `SweepInput.deadlineMs`); the sweep stops opening new cities past the deadline, so however long the article tick took, the combined route stays in the 120s `maxDuration`. Each OpenAI call in `cityMetaGenerator.getClient()` is itself timeout-bounded (`timeout: 30_000, maxRetries: 1`) so a single hung connection degrades to a graceful generation failure instead of stalling the route. When nothing is eligible the ride-along is ~2 cheap COUNT queries/tenant. This needs **zero new setup** — it inherits whatever cadence already triggers the newsroom cron. **Optional dedicated cadence:** `scripts/city-meta-sweep-tick.mjs` (mirrors `scripts/newsroom-cron-tick.mjs`) POSTs to `/api/cron/city-meta-sweeper?limit=…`; point a Replit **Scheduled Deployment** at `node scripts/city-meta-sweep-tick.mjs` every 60 min for a decoupled schedule. Running both is safe — the in-flight guard + per-row TOCTOU make overlapping runs harmless.
- **Accepted limitations (reviewed tradeoffs, 2026-06-05).** (1) *No distributed lock.* The in-flight guard is process-local; two instances/schedules could overlap. TOCTOU-safe writes prevent any data corruption (the loser's UPDATE matches 0 rows → counted `skipped`); the only cost is a few cents of duplicate LLM spend in a rare race. A robust shared lock (DB advisory lock on pooled connections) was judged too fragile (risk of never-released locks permanently skipping sweeps) for that small, bounded downside. (2) *Deadline bounds new work, not a pathological single city.* A city that hits multiple 30s OpenAI timeouts in one generation could approach `maxDuration`; the consequence is bounded and self-healing (articles already committed; sweeper writes commit per row; failed cron response simply retries next tick) — not data loss. A full per-generation `AbortController` tied to one shared deadline was deemed disproportionate to that residual, since it would touch the shared generator used by the sparkle button, the backfill script, and the persona-wizard preview.

---

## 3. Considered-and-parked proposals (kept for context)

> Recorded so future meta work doesn't re-litigate a decision that was already made.

**2026-06-05 — proposed wider bands, then PARKED.** The Conductor floated:
- Description range **290–320** (vs. current 130–165).
- Title range **50–65** (i.e. add a **50-char minimum**; today there is no title minimum).
- Title should **ignore the state** and use the **city only** (today the generator hands the model the state code and the gate neither requires nor forbids it).

Agent laid out the exact code changes required (contract constants, a `minLen` param on the shared `metaTitleAcceptable` so the article path stays unchanged, prompt edits to drop the state line + add a 3–4 sentence guidance, a `title-too-short` retry hint, and a `--force` re-backfill of all 340 cities). Two caveats raised: (a) 290–320 is ~2× Google's visible snippet (~155–160) — fine if the goal is LLM/social consumption, not just Google's grey line; (b) a 50-char title minimum slightly lowers first-shot hit rate.

**Decision (initial):** Conductor reviewed and said **"the Cities and the rendering are correct — take no action."** → contract stood (130–165 desc / 55–65 title, state allowed). The proposal was **parked.**

**UPDATE (r3, 2026-06-05) — the state sub-decision was revived and SHIPPED.** On re-testing, the Conductor confirmed the door-hanger concern was specifically the **`City, ST` stamp in the Title** and said **"wire the rule in for Meta Title."** So the **"city-only title / no state"** portion is now **implemented for the city path** (`title-contains-state` gate + prompt line + retry hint; see r3 + §2 G2 above). The other two parked items — **description 290–320** and the **50-char title minimum** — remain **NOT implemented**; the bands still stand at **130–165 desc / 55–65 title**. If those are revived, see `Regeneration.md` §"How to change the bands."

---

## 4. File map (where everything lives)

| File | Role |
|---|---|
| `shared/schema.ts` | meta columns (`city_locations`, `knowledge_articles`) + `tenants.default_haylo_article_id` |
| `lib/cities/cityMetaContract.ts` | **City** contract: constants + gates + length-repair (pure) |
| `lib/cities/cityMetaGenerator.ts` | **City** RAG generator (desc-first, title-second, two-shot, never-throws) |
| `app/api/admin/cities/[id]/generate-meta/route.ts` | single-city admin generate (POST; `?force=1` to re-stamp `llm`; 409 on locked/manual/llm-without-force; 422 on no-truth-doc / contract fail) |
| `lib/cities/cityMetaSweeper.ts` | **City reconciling sweeper** (G7) — walks every tenant with a truth doc, fills cities missing meta using the one-city whitelist; `dryRun` counts free; per-tick `limit` budget; TOCTOU-safe forward-only writes |
| `app/api/cron/city-meta-sweeper/route.ts` | **City sweeper CRON** (G7) — `CRON_SECRET`-gated GET/POST; `?limit=` / `?dryRun=1`; mirrors `app/api/cron/newsroom-scheduler/route.ts` |
| `app/api/cron/newsroom-scheduler/route.ts` | newsroom heartbeat — after the article tick, **rides along** a bounded `runCityMetaSweep` (`CITY_META_SWEEP_PER_TICK=10`) in its own try/catch (G7 auto-trigger) |
| `scripts/city-meta-sweep-tick.mjs` | optional dedicated trigger — POSTs to the sweeper route; for a Replit Scheduled Deployment on its own cadence (mirrors `scripts/newsroom-cron-tick.mjs`) |
| `app/admin/cities/page.tsx` | admin Cities listing — per-row **sparkle** generate button (amber generate / indigo regenerate / lock icon when frozen); per-row in-flight tracking via a `Set` |
| `scripts/backfill-city-meta.ts` | bulk backfill (dry-run default, `--confirm`, `--force`, `--prod`, `--concurrency`) |
| `app/api/admin/haylo-articles/truth-doc/route.ts` | same-tenant truth-doc designation (GET current / PUT set+clear) |
| `app/api/admin/personas/[slug]/truth-doc/route.ts` | Conductor cross-tenant truth-doc designation (POST) |
| `app/api/admin/personas/[slug]/readiness/route.ts` | persona readiness incl. `truthDoc.ready` gate |
| `app/admin/haylo/page.tsx` | Haylo Library — truth-doc badge + per-row star toggle |
| `app/admin/personas/new/page.tsx` | Persona Wizard — auto-designates seeded truth doc; Finish gated on it |
| `lib/newsroom/brandContext.ts` | **shared** validators: `metaTitleAcceptable`, `metaDescriptionAcceptable` |
| `lib/newsroom/metaNaturalizer.ts` | **Article** Tier-2.5 naturalizer + `hayloBodyExcerptFromHtml` (reused by city RAG) |
| `scripts/sync-tenant-schemas.mjs` | fans additive schema changes into every `tenant_<slug>` schema (`--prod` for prod) |
| `John/Meta_Fix_Desc.md` | historical article-meta fix narrative (2026-05-17) |

---

## 5. Gotchas specific to meta work

- **Schema-per-tenant drift:** any new meta column must be added to **every** `tenant_<slug>` schema, not just `public`. Symptom of forgetting: pages quietly show "0 results" because Drizzle SELECTs a column the active tenant schema lacks. Use `scripts/sync-tenant-schemas.mjs` (dev) / it runs inside `push-schema-to-prod.sh` (prod).
- **LLMs can't count characters** — that's why both pipelines have a length gate *and* a deterministic repair/fallback. Never trust the model to hit a char band on the first try.
- **`meta_locked_at` is sacred** — once set, the row is frozen. No generator, not even `--force`, overwrites a locked row.
- **Dev vs Prod diverge** — `default_haylo_article_id` differs per environment; on prod, match the truth doc by **title**, never reuse the dev row id.
- **Render path is read-only** — changing a contract does NOT change already-stored values; you must re-run the backfill (`--force`) and then publish to refresh statically-generated pages.
