# Regeneration — Restore Point for the Meta Subsystem

> **Purpose:** a deterministic snapshot that lets us restore the **exact** state of the Meta (title + description) subsystem captured below. If a future experiment goes sideways, this document tells you (a) how to confirm whether you're already at this state, (b) how to get back to it, and (c) every value that defines "this moment."
>
> **Companion:** `Meta_Desc_Title.md` (narrative evolution). This file is the **precise** state; that file is the story.

---

## Document Control

| Field | Value |
|---|---|
| Document | `John/Scaffolding/Regeneration.md` |
| Status | **LIVE** — under active revision control |
| Owner | Conductor (abc19@gmail) |
| Maintainer | Agent (document control until Meta work is fully revised) |
| Companion | `John/Scaffolding/Meta_Desc_Title.md` |

### Revision Log

| Rev | Date (UTC) | Author | Anchor commit | Summary |
|---|---|---|---|---|
| r1 | 2026-06-05 | Agent | `9f294dc` (tree at "Published your App"; meta build at `38d7305`) | City meta G1–G5 complete & live on PROD; article meta at MT-4.13.4. Bands: desc 130/160/165, title 55/65. |

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
- **Title:** city verbatim; brand-free; length ≤ 65; **no minimum**; **state neither required nor forbidden.**

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
| Other personas (haylo/payrol/texitie/veltroy) | columns present; **not yet backfilled** (no truth doc / cities seeded for city meta) |

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

> Recorded so a future change is mechanical and reversible. As of r1 this is **NOT done** — current bands stand (Conductor: "Cities and rendering are correct, take no action").

To move to, e.g., **description 290–320** / **title 50–65** / **title state-free**:
1. `lib/cities/cityMetaContract.ts` — change the desc constants (min/target/max); add `CITY_META_TITLE_MIN`; have `cityMetaTitleAcceptable` pass it.
2. `lib/newsroom/brandContext.ts` — add an **optional** `minLen` param to `metaTitleAcceptable` defaulting to `0` (keeps the article path unchanged); city wrapper passes 50.
3. `lib/cities/cityMetaGenerator.ts` — desc prompt: "3–4 complete sentences" (two won't fill 290–320); title prompt: state the 50–65 range + "city only, no state/abbreviation"; **remove** the `State code:` line from the title user prompt; add a `title-too-short` retry hint.
4. Re-run backfill with `--force` (dev → verify bands → prod), then publish.
5. **Document control:** add a new revision row to BOTH this file and `Meta_Desc_Title.md`, and re-snapshot §§1–4 here.
- No schema change / no migration is needed for a pure band change (columns already wide enough: `meta_description varchar(500)` comfortably holds 320).
