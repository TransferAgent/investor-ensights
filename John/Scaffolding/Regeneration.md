# Regeneration — Restore Point for the Meta Subsystem

> **Purpose:** a deterministic snapshot that lets us restore the **exact** state of the Meta (title + description) subsystem captured below. If a future experiment goes sideways, this document tells you (a) how to confirm whether you're already at this state, (b) how to get back to it, and (c) every value that defines "this moment."
>
> **Companion:** `Meta_Desc_Title.md` (narrative evolution). This file is the **precise** state; that file is the story.

---

## Document Control

| Field | Value |
|---|---|
| Document | `John/Scaffolding/Regeneration.md` |
| Status | **CLOSED** — final restore point; shipped to PROD & Conductor-accepted 2026-06-05 (reopen by flipping back to LIVE + new revision) |
| Owner | Conductor (abc19@gmail) |
| Maintainer | Agent (document control — chapter closed) |
| Companion | `John/Scaffolding/Meta_Desc_Title.md` |

### Revision Log

| Rev | Date (UTC) | Author | Anchor commit | Summary |
|---|---|---|---|---|
| r1 | 2026-06-05 | Agent | `9f294dc` (tree at "Published your App"; meta build at `38d7305`) | City meta G1–G5 complete & live on PROD; article meta at MT-4.13.4. Bands: desc 130/160/165, title 55/65. |
| r2 | 2026-06-05 | Agent | *(this change set; commit recorded at task close)* | TD-0..TD-5 **Universal Truth Document Provisioning** — adds human designation (Haylo Library star + Persona Wizard auto-designate on seed) + readiness gate (`truthDoc.ready` in `publishReady`) for the per-tenant truth doc. **Contract / bands / models unchanged from r1** (desc 130/160/165, title 55/65, `gpt-4.1` / `gpt-4.1-mini`): §§2–3 numbers are identical; §4 updated for provisioning. |
| r3 | 2026-06-05 | Agent | `09c1c19` (state-ban); sparkle button at `5f95614` | **City Title now BANS the state code** — `cityMetaTitleAcceptable` rejects `title-contains-state` (uppercase word-boundary; code normalized to uppercase first), so city titles are city-only ("Austin", never "Austin, TX"). **City path only — the shared article gate is untouched.** Plus a per-row admin "generate meta" **sparkle** button on the Cities listing. **Bands / models unchanged from r1/r2** (desc 130/160/165, title 55/65, `gpt-4.1`/`gpt-4.1-mini`); §2 title-gate line updated, §5 gains a state-ban check. |
| r4 | 2026-06-05 | Agent | *(this change set; commit recorded at task close)* | **City-meta reconciling CRON sweeper** — `lib/cities/cityMetaSweeper.ts` + `app/api/cron/city-meta-sweeper/route.ts` auto-fill city meta for every tenant with a truth doc (mirrors the newsroom scheduler; `CRON_SECRET`-gated; `dryRun` free; per-tick `limit` drip; reuses the one-city eligibility whitelist + TOCTOU-safe forward-only write). **Contract / bands / models unchanged from r3** (desc 130/160/165, title 55/65, `gpt-4.1`/`gpt-4.1-mini`). Does NOT auto-designate truth docs. §4 data-state + §5 verify + §6 restore list updated. |
| r5 | 2026-06-05 | Agent | `192b7fc` ("City-meta sweep: auto-trigger on the newsroom heartbeat") | **Auto-trigger + CLOSE-OUT.** Sweep rides along on the newsroom-scheduler heartbeat (article tick first/committed, then `runCityMetaSweep` in its own try/catch), bounded by attempt budget (`CITY_META_SWEEP_PER_TICK=5`) AND wall-clock deadline (`CITY_META_SWEEP_DEADLINE_MS=80_000` → `SweepInput.deadlineMs`); OpenAI client timeout-bounded (`timeout 30_000, maxRetries 1`). Optional dedicated `scripts/city-meta-sweep-tick.mjs`. **Conductor tested Cities + Articles on PROD, accepted 100%; this is the FINAL restore point — document CLOSED.** Contract / bands / models unchanged from r4. |

> **Rule:** create a NEW revision row each time the meta subsystem changes, and re-snapshot §§2–5 below to match. Never edit an old row. The newest row is the live restore point.

---

## 1. Snapshot identity (rev r1 — 2026-06-05)

| Anchor | Value |
|---|---|
| Date (UTC) | 2026-06-05 |
| Branch | `main` |
| HEAD commit | `9f294dcf907a1f872fbd03fd63a31c9211c87073` ("Published your App") |
| Meta-build commit | `38d7305` ("City meta backfill: chunked generation + PROD rollout (tableicity)") |
| Backup ref | `gitsafe-backup/main` at same SHA as HEAD |
| Article meta level | **MT-4.13.4** (brand-out-of-title, 80/20 description) |
| City meta level | **G5 complete** (PROD rollout done) |
| Replit checkpoints | `cd66559`, `9f294dc` (both "Published your App", deployment-triggered) |

---

## 2. Locked contract values (the numbers that define this moment)

### City meta — `lib/cities/cityMetaContract.ts`
| Constant | Value |
|---|---|
| `CITY_META_DESC_MIN` | `130` |
| `CITY_META_DESC_TARGET` | `160` |
| `CITY_META_DESC_HARD_MAX` | `165` |
| `CITY_META_DESC_BRAND_LEAD_GUARD` | `40` |
| `CITY_META_TITLE_TARGET` | `55` |
| `CITY_META_TITLE_HARD_MAX` | `65` |
| `CITY_META_DESC_PRODUCT_RATIO` / `_BRAND_RATIO` | `0.8` / `0.2` |

City gates:
- **Description:** length 130–165; complete sentence (terminal punctuation); city verbatim; brand **exactly once**, **in closing sentence**, **not** in first 40 chars.
- **Title:** city verbatim; brand-free; length ≤ 65; **no minimum**; **state code BANNED** (r3 — `title-contains-state`, uppercase word-boundary match; **city titles only** — article titles still allow the state).

### City generator — `lib/cities/cityMetaGenerator.ts`
| Setting | Value |
|---|---|
| `DESC_MODEL` | `gpt-4.1` |
| `TITLE_MODEL` | `gpt-4.1-mini` |
| `TRUTH_DOC_EXCERPT_CHARS` | `4000` |
| Desc attempts | up to 3 (two-shot+); Title attempts | up to 2 |
| Temperatures | shot 0 = 0.6, retries = 0.3 |
| Order | description FIRST, title SECOND |

### Article meta — `lib/newsroom/brandContext.ts`
- `metaTitleAcceptable(meta, brand, cityName, maxLen=65)` — max-only (no min), city verbatim, brand-free.
- `metaDescriptionAcceptable(meta, brand, cityName, {minLen=100, maxLen=200, brandLeadGuardChars=40})` — band 100–200, city verbatim, brand 1–2×, brand not in first 40 chars.

---

## 3. Schema columns (must exist, all environments)

`shared/schema.ts`:
- `city_locations`: `meta_title varchar(120)`, `meta_description varchar(500)`, `meta_source varchar(16)`, `meta_locked_at timestamptz`
- `knowledge_articles`: `meta_title text`, `meta_description text`, `meta_source varchar(16)`, `meta_locked_at timestamptz`
- `tenants`: `default_haylo_article_id uuid`

**PROD reality at this snapshot:** the meta columns exist in `public` **and** in all 5 tenant schemas: `tenant_haylo`, `tenant_payrol`, `tenant_tableicity`, `tenant_texitie`, `tenant_veltroy`.

---

## 4. Data state at this snapshot

| Item | Value |
|---|---|
| tableicity PROD cities total | 340 |
| tableicity PROD cities with `meta_source='llm'` | **340 (100%)** |
| Eligible (NULL/`fallback`) remaining | **0** |
| Contract violations on audit | **0** |
| Observed title length range | 42–65 |
| Observed description length range | 131–165 |
| tableicity `tenants.default_haylo_article_id` (PROD) | `b6ecfe27-b110-4076-a68f-9e5c53bd13cf` (matched by truth-doc **title**; dev id differs) |
| tableicity DEV cities | 18 total; **2 `meta_source='llm'` + 16 NULL** as of r4 (was 1+17 at r3 — one row was filled by the r4 sweeper smoke-test, `limit=1`, $0.00258). Dev was never fully backfilled — **PROD is the source of truth**; dev meta is not user-facing, so the remaining 16 are left as-is rather than paying OpenAI to regenerate. |
| Other personas (haylo/payrol/texitie/veltroy) | columns present; **no tenant rows in dev**; on PROD columns present but not backfilled. As of r2 they are onboarded via the **gated Persona Wizard**, which auto-designates the seeded Haylo essay as the truth doc (TD-3) — so a new persona is grounded by construction before any city-meta backfill is run. |

> **r2 provisioning note:** the truth doc is now human-designatable without SQL (Haylo Library star toggle for the active tenant; Wizard auto-designate + Conductor cross-tenant POST for onboarding). This is a **code-level** change only — **no new schema** (`tenants.default_haylo_article_id` already existed) and **no contract change**. Per-persona city-meta backfill (`scripts/backfill-city-meta.ts --persona=<slug> --confirm`) is unchanged and remains the rollout step once a persona has a truth doc + cities.

> **r4 sweeper note:** city meta now ALSO fills automatically via the `CRON_SECRET`-gated sweeper (`/api/cron/city-meta-sweeper`, runner `lib/cities/cityMetaSweeper.ts`) — once a tenant has a truth doc, the sweeper drains its NULL/`fallback` rows over successive ticks (per-tick `limit`, default 25), reusing the same generator + one-city whitelist. The backfill script and the sparkle button remain available as manual overrides; the sweeper is purely additive and does **not** auto-designate truth docs.

---

## 5. Verify you are AT this state

```bash
# 1) Code anchor
git --no-optional-locks rev-parse HEAD            # expect 9f294dc... (or a later rev that re-snapshots this doc)

# 2) City contract constants unchanged
rg -n "CITY_META_DESC_MIN|CITY_META_DESC_TARGET|CITY_META_DESC_HARD_MAX|CITY_META_TITLE_TARGET|CITY_META_TITLE_HARD_MAX" lib/cities/cityMetaContract.ts
#   expect 130 / 160 / 165 / 55 / 65

# 3) City models unchanged
rg -n "DESC_MODEL|TITLE_MODEL|TRUTH_DOC_EXCERPT_CHARS" lib/cities/cityMetaGenerator.ts
#   expect gpt-4.1 / gpt-4.1-mini / 4000

# 4) City title state-ban present (r3)
rg -n "title-contains-state" lib/cities/cityMetaContract.ts lib/cities/cityMetaGenerator.ts
#   expect matches in BOTH files (gate reject reason + generator retry hint)

# 5) City-meta CRON sweeper present (r4)
ls lib/cities/cityMetaSweeper.ts app/api/cron/city-meta-sweeper/route.ts
#   expect both files to exist
# Free, no-cost wiring probe against the running dev server (counts only):
curl -s -H "x-cron-secret: $CRON_SECRET" "http://localhost:5000/api/cron/city-meta-sweeper?dryRun=1"
#   expect ok:true, tenantsConsidered:1 (tableicity), eligibleTotal = current NULL/fallback count
```

PROD data check (read-only; user owns PROD — run via the database skill with `environment: "production"`):
```sql
SELECT meta_source, count(*)
FROM tenant_tableicity.city_locations
GROUP BY meta_source;
-- expect: llm = 340 (no NULL / 'fallback' rows)
```

---

## 6. How to RESTORE this exact moment

**A. Code drifted (someone changed the contract/generator) and you want it back:**
1. Preferred (non-destructive): use the Replit **checkpoint rollback** to commit `9f294dc` / `cd66559` — see the `diagnostics` skill. This restores codebase + chat + DB checkpoint together.
2. Git-level restore of just the meta files (destructive git ops must be delegated to a background Project Task, never run directly): restore `lib/cities/cityMetaContract.ts`, `lib/cities/cityMetaGenerator.ts`, `app/api/admin/cities/[id]/generate-meta/route.ts`, `scripts/backfill-city-meta.ts`, `lib/newsroom/brandContext.ts`, `shared/schema.ts` from commit `38d7305`/`9f294dc`.
3. **r2 provisioning files** (truth-doc designation; restore from the r2 commit, not `9f294dc`): `app/api/admin/haylo-articles/truth-doc/route.ts`, `app/api/admin/personas/[slug]/truth-doc/route.ts`, `app/api/admin/personas/[slug]/readiness/route.ts`, `app/admin/haylo/page.tsx`, `app/admin/personas/new/page.tsx`. These do not affect the generation contract — restoring r1's generator files alone leaves provisioning intact.
4. **r4 sweeper files** (auto-fill cron; restore from the r4 commit): `lib/cities/cityMetaSweeper.ts`, `app/api/cron/city-meta-sweeper/route.ts`, plus the **auto-trigger ride-along** in `app/api/cron/newsroom-scheduler/route.ts` (the `runCityMetaSweep` block + `CITY_META_SWEEP_PER_TICK` const) and the optional `scripts/city-meta-sweep-tick.mjs`. Purely additive — deleting the sweeper files + reverting the newsroom-route block reverts to manual-only fill (sparkle + backfill script) with **zero** effect on the generation contract or stored data. The ride-along is wrapped in its own try/catch, so even left in place it cannot affect article publishing.

**B. PROD data drifted (cities lost their meta) and you want it back:**
- The generator is **idempotent and forward-only**, so you regenerate rather than "restore a backup":
  1. Confirm the schema columns exist on PROD `public` + all tenant schemas (§3). If missing, add additively, then `node scripts/sync-tenant-schemas.mjs --prod`. **Do not** use `drizzle-kit push --force` for a surgical add.
  2. Confirm `tenants.default_haylo_article_id` points at the PROD truth doc (match by **title**).
  3. Re-run the backfill (USER runs PROD writes):
     ```bash
     npx tsx scripts/backfill-city-meta.ts --persona=tableicity --prod --confirm
     # add --force only to re-stamp existing 'llm' rows; never overwrites meta_locked_at rows
     ```
  4. Drain to 0 eligible (TPM-bound; just re-run — 429s are free and leave the city eligible).
  5. Publish/redeploy to refresh statically-generated pages.

**C. Full DB restore (last resort):** physical dumps live in `John/` (e.g. `Production Dump.dump`, `Dump_Four.dump`). These predate the meta work — restoring one would LOSE the meta backfill. Prefer regeneration (B) over a dump restore.

---

## 7. How to CHANGE the bands (forward path, if the parked proposal is revived)

> Recorded so a future change is mechanical and reversible.
>
> **UPDATE (r3, 2026-06-05):** the **title state-free** portion of this proposal is now **SHIPPED** for city titles (step 3's state-prompt edit + the gate guard are done — see r3 / §2). What **remains parked** is the **description 290–320** band and the **50-char title minimum**; the bands still stand at 130–165 / 55–65. Steps below cover those remaining band changes.

To move to, e.g., **description 290–320** / **title 50–65** (the title-state-free part is already done):
1. `lib/cities/cityMetaContract.ts` — change the desc constants (min/target/max); add `CITY_META_TITLE_MIN`; have `cityMetaTitleAcceptable` pass it.
2. `lib/newsroom/brandContext.ts` — add an **optional** `minLen` param to `metaTitleAcceptable` defaulting to `0` (keeps the article path unchanged); city wrapper passes 50.
3. `lib/cities/cityMetaGenerator.ts` — desc prompt: "3–4 complete sentences" (two won't fill 290–320); title prompt: state the 50–65 range + "city only, no state/abbreviation"; **remove** the `State code:` line from the title user prompt; add a `title-too-short` retry hint.
4. Re-run backfill with `--force` (dev → verify bands → prod), then publish.
5. **Document control:** add a new revision row to BOTH this file and `Meta_Desc_Title.md`, and re-snapshot §§1–4 here.
- No schema change / no migration is needed for a pure band change (columns already wide enough: `meta_description varchar(500)` comfortably holds 320).
