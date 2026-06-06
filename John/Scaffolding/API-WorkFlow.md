# API-WorkFlow — Halo Pull → Haylo Library → Content Studio (Regeneration Document)

> **What this is:** the active Scaffolding regeneration/restore document for the **content-ingestion workflow** — how a Halo Lab essay travels from the external API into a published **Article**, and where every gate sits along the way. It exists because the steps were being discovered piecemeal ("set this, now set that"); this is the single end-to-end map so we stop the rabbit-holes.
>
> **Supersedes (as active doc):** `Meta_Desc_Title.md` and `Regeneration.md` — both RETIRED 2026-06-06 (kept in-folder per the forward-only rule). Those covered the **meta subsystem**, which is a *different* track (see §5).

| Field | Value |
|---|---|
| Title | API-WorkFlow — Halo → Library → Studio |
| Purpose | End-to-end, verified map of content ingestion + the exact gates at each hop |
| Status | **LIVE** — built from code + PROD data verified 2026-06-06; pre-meeting baseline |
| Owner | Conductor |
| Maintainer | Agent (document control) |
| Date | 2026-06-06 |
| Verified against | code (commit `596a7b1`) + read-only PROD query 2026-06-06 |
| Related (retired) | `Meta_Desc_Title.md`, `Regeneration.md` (meta subsystem, historical) |

### Revision Log

| Rev | Date | By | Summary |
|---|---|---|---|
| r1 | 2026-06-06 | Agent | Initial document. Captures the Halo-pull → Library(draft) → set-Ready → Content-Studio(pairing) → Article pipeline, the status/topic/truth-doc gates, the exact friction the Conductor hit on Textitie, and the verified file/endpoint map. Built from the current discussion (API call, Haylo Library, Content Studio) + read-only PROD verification. **No code changed** to produce this doc. |
| r2 | 2026-06-06 | Agent | **Correction (Conductor-caught).** r1 §4 claimed "Topic never gates pairing" — **false** at the human/UI path. The Library edit form (`app/admin/haylo/page.tsx` ~L292 `submitForm`) requires **Title AND Topic Slug AND body HTML** or it refuses to save; that same save writes `status`, so you **cannot reach Ready via the UI without a Topic Slug**, and only Ready essays appear in Content Studio. Net: Topic Slug **is** a de-facto gate to pairing/publishing on the path the Conductor uses. Halo-API pulls land `topic_slug=null`, so each pulled essay needs Title + Topic Slug set (manually, or by future H1-derivation logic) before it can go Ready. Conductor verified manually on a Textitie essay → green Ready pill → now selectable in Content Studio → Published. §1/§2/§4/§6 corrected accordingly. **No code changed.** |
| r3 | 2026-06-06 | Agent | **Root cause for "Halo imports arrive with no Topic Slug".** Two independent ingestion paths exist and only the paste path fills topic. (1) Paste/file-scan (`parseHayloFile` + `buildInsertFromPaste`, `lib/haylo/ingest.ts`) derives topic from a `<!-- topic: -->` comment or the filename (L52–53) and defaults `status='ready'` (L95). (2) Halo API pull (`parseHaloPayload` + `pull-from-halo/route.ts`) returns NO topic and the route **explicitly forces `topicSlug=null`** (route L130/L139, comment "admin assigns in the Library after import") and hard-codes `status='draft'` (L133). Tableicity's Ready library is `source='paste'` (path 1); Texitie's is `source='halo_api'` (path 2). So the topic auto-fill **never translated** — it was never in the Halo path. Conductor's recollection confirmed: the earlier fix lived on the paste path / was a manual paper-over; the real issue (two unreconciled paths) was never closed. New §4b records this; §8 carries the proposed fix. **No code changed.** |
| r4 | 2026-06-06 | Agent | **FIX SHIPPED (Conductor said "do both").** (1) Forward fix: `pull-from-halo/route.ts` now derives `topicSlug = slugifyHaylo(parsed.title, "general")` at import instead of forcing `null`, so future Halo pulls arrive topic-filled (still `status='draft'` for review — auto-promote remains §8 open). (2) Backfill: new `scripts/backfill-haylo-topic.ts` (dry-run default, `--persona`, `--prod`, `--confirm`, forward-only/audited) filled `topic_slug` on the **121** existing null-topic `halo_api` rows in `tenant_texitie` (PROD), derived from each title; status deliberately untouched. The 1 essay the Conductor fixed manually was already non-null and skipped. Verified PROD: 0 empty topics remain. **This is the real fix, not a per-tenant paper-over.** |
| r5 | 2026-06-06 | Agent | **§8 #4 actioned (one-time) — 121 Texitie drafts promoted to Ready.** Conductor chose "flip the 121 now." New `scripts/bulk-set-haylo-ready.ts` (same safety pattern: dry-run default, `--persona/--prod/--confirm`, audited) flips `status='draft'→'ready'` ONLY for rows passing the full Library Ready gate (title + topic_slug + body_html present), scoped to `source='halo_api'`. Ran on PROD `tenant_texitie`: 121 promoted, 0 blocked. Verified: all **122** `halo_api` essays now `ready` (121 + the 1 the Conductor did by hand). The script is reusable per-tenant; a *UI* "Mark all Ready" button (§8 #4) is still an open product decision the Conductor is weighing. PROD data changed; no public articles published by this (Ready = eligible for Studio/scheduler, not published). |

> **Document-control rule:** any change to the ingestion workflow gets a new revision row here. Bump the rev letter, never overwrite history.

---

## 1. The spine — one essay, end to end

```
  Halo Lab (external)
        │  GET https://haylords.com/api/public/published?since=<watermark>
        │  Authorization: Bearer <per-tenant key>
        ▼
  [1] PULL  ── app/api/admin/haylo-articles/pull-from-halo
        │  lands each essay as: status='draft', source='halo_api',
        │  topic_slug = slugify(title)   ← r4 fix; was null before (see §4b)
        ▼
  [2] HAYLO LIBRARY (/admin/haylo)   ← essay is here, but DRAFT
        │  ▸ MISSING STEP: edit essay → set Title + Topic Slug → Status = Ready
        │    The Library edit form REFUSES to save unless Title + Topic Slug
        │    + body are all present (page.tsx ~L292). Save writes status, so
        │    no Topic Slug ⇒ can't save Ready ⇒ never reaches the Studio.
        │    (API PATCH /api/admin/haylo-articles/[id] alone doesn't enforce
        │     this — a code path could set ready bare — but the UI path does.)
        ▼
  [3] CONTENT STUDIO (/admin/knowledge → Studio tab)
        │  Step 1 "Select Haylo Article": lists ONLY status=ready essays
        │  Step 2 "Select Cities"
        │  POST /api/admin/newsroom/enqueue-pairs { hayloArticleId, citySlugs }
        ▼
  [4] NEWSROOM PIPELINE (processPair / runPairAgentPipeline)
        │  pairs the essay with each city's local-market grounding
        ▼
  [5] ARTICLE published  (app/discovery/knowledge/[slug])
```

**The rule that explains the Textitie symptom:** Content Studio Step 1 only shows **Ready** essays. Fresh Halo pulls are **Draft** with `topic_slug=null`. To make one Ready you must open the edit form and supply **Title + Topic Slug** (body is already there) — the form blocks the save otherwise. So the missing hop is really two coupled things: *fill Title + Topic Slug* → which lets you *save as Ready* → which makes it appear in the Studio.

---

## 2. The gates, by hop (what actually blocks what)

| Hop | Gate | Where enforced |
|---|---|---|
| Pull → Library | Per-tenant Halo key must be set | `pull-from-halo` reads `tenants.halo_distribution_key`; 400 `halo_key_not_configured` if empty |
| Library: **save an essay as Ready (UI path)** | **Title + Topic Slug + body all non-empty** | `app/admin/haylo/page.tsx` ~L292 `submitForm` — toasts "Title, topic, and body HTML are required" and aborts otherwise. This is the real Topic gate. |
| Library: essay visible to Studio | `status = 'ready'` | Studio picker fetches `/api/admin/haylo-articles?status=ready` (`app/admin/knowledge/page.tsx`) |
| Library: essay visible to auto-scheduler | `status = 'ready'` **AND** city grounding (≥1 enabled `city_research_sources`) | `lib/newsroom/schedulerPicker.ts` — `WHERE h.status='ready'` + grounding subquery. **No topic check.** |
| Studio pairing → article | valid `hayloArticleId` (uuid) + ≥1 `citySlug` | `app/api/admin/newsroom/enqueue-pairs/route.ts` (zod) |

**Topic Slug IS a gate** on the human path — it's required to save an essay Ready, and only Ready essays pair (see §4). The *scheduler* query itself doesn't check topic, but an essay can't legitimately be Ready (via the UI) without one.

---

## 3. Status semantics (`draft` / `ready` / `retired`)

| Status | Meaning | Effect |
|---|---|---|
| `draft` | **Default for every Halo-API import.** "Pulled, not reviewed." | Hidden from Content Studio Step 1 **and** the auto-scheduler. |
| `ready` | Reviewed / cleared for use. | Eligible for Studio pairing and the scheduler. |
| `retired` | Forward-only archive state. | Out of rotation; used instead of delete when an essay has active placements (DELETE returns 409 "Retire it instead"). |

- Promote/demote via the Library **edit form** (Status select) → `PATCH /api/admin/haylo-articles/[id]`. There is currently **no one-click row toggle and no bulk "set all Ready"** — it's per-essay through the edit dialog. *(Open question for the meeting — see §7.)*
- Manual **paste** entries default to `ready`; **Halo-API** entries default to `draft`. That asymmetry is by design (paste = you already vetted it; API = bulk, review first).

---

## 4. Topic Slug — a real gate on the human path (corrected r2)

> **r1 said this was "soft, blocks nothing." That was wrong — the Conductor caught it.** The column is nullable in the DB, but the **Library edit form refuses to save** an essay unless **Title AND Topic Slug AND body** are all present (`app/admin/haylo/page.tsx` ~L292). Because that save is also how you set `status`, **a missing Topic Slug means you can't save the essay Ready**, and a non-Ready essay never appears in Content Studio. So on the path a human actually uses, **Topic Slug gates pairing and publishing.**

**Two layers, don't conflate them:**

| Layer | Does Topic Slug block? |
|---|---|
| **Library edit form (the human path)** | **Yes** — required to save at all, hence required to reach Ready. |
| **`PATCH /api/admin/haylo-articles/[id]` (raw API / code)** | No — only checks the status allow-list; a script could set `ready` with a null topic. |
| **`schedulerPicker.ts` (auto-scheduler query)** | No topic check — but it filters `status='ready'`, and a UI-made Ready essay always has a topic. |

**Where Topic Slug comes from:**
- **Halo-API pull:** as of **r4**, the topic is **derived from the title** (`slugifyHaylo(parsed.title)`) at import — same shape as the paste path. (Before r4 it was forced `null`, which is the whole reason §4b exists.) Imports still land `draft` for review, but they now have a topic so they're one step from Ready.
- **Manual:** type it in the edit form (what the Conductor did on Textitie → green Ready pill → selectable in Studio → Published).
- **Tableicity precedent:** the Conductor notes existing logic that strips the essay **`<h1>`** to derive both Title and Topic Slug. As of **r4** the Halo-pull path does the same (title → topic), so this is now wired in, not manual.

**What Topic Slug also does (secondary, still true from r1):** Library filter/organizer; slug seed; an on-topic steering hint to the newsroom LLM; stamped as a hidden `data-topic="…"` on the rendered article. It does **not** touch the Truth-Document/city-meta track (§5).

---

## 4b. Root cause — why Topic Slug is empty after a Halo pull (full on Tableicity) [r3]

**The symptom:** a Halo API pull drops essays into the Library with **no Title-quality Topic Slug**, all stuck at **Draft**, so none can go Ready and none reach Content Studio. On Tableicity the same kind of content arrived Ready, with topic. The Conductor's read — *"we coded it and didn't fix the real issue; the Tableicity fix didn't translate"* — is correct.

**Why:** there are **two independent ingestion paths**, and topic-fill only ever lived in one of them.

| Path | Code | Topic Slug | Status on arrival |
|---|---|---|---|
| **Paste / file-scan** (how Tableicity was loaded) | `parseHayloFile` + `buildInsertFromPaste` (`lib/haylo/ingest.ts`) | **Filled** — `<!-- topic: -->` comment, else filename (L52–53) | defaults **`ready`** (L95) |
| **Halo API pull** (how Texitie was loaded) | `parseHaloPayload` + `app/api/admin/haylo-articles/pull-from-halo/route.ts` | **Forced `null`** — route L130 sets `topicSlug:""`, L139 overwrites to `null` (comment: *"admin assigns in the Library after import"*) | hard-coded **`draft`** (L133) |

- `parseHaloPayload` (ingest.ts L107–124) returns only `{title, summary, bodyHtml}` — Halo sends no topic, and the route chooses **not** to derive one.
- So nothing regressed in the new Persona. The H1/topic auto-fill was **never** part of the Halo path; Tableicity's Ready essays are `source='paste'`, Texitie's are `source='halo_api'`. Different code, by design.
- That `null` then **collides with the Library form gate** (§4 / `page.tsx` ~L292): topic is required to save Ready → pulled essays are trapped in Draft until a human types one.

**This is a path mismatch, not a per-tenant bug.** The earlier fix patched the path Tableicity used (or was a manual/backfill paper-over). The real issue — the Halo-pull path doesn't derive a topic — was never closed.

> **RESOLVED (r4):** the Halo-pull path now derives the topic from the title at import, and a backfill (`scripts/backfill-haylo-topic.ts`) filled the 121 stuck `tenant_texitie` rows on PROD. The two paths are now symmetric on topic. Status promotion (Draft→Ready) is still a separate step — see §8.

---

## 5. Separate track — Truth Document & City Meta (Cities ≠ Articles)

This is a **different planet** from the article spine above and must not be conflated:

- **Truth Document** = `tenants.default_haylo_article_id`, designated by a human (Haylo Library star, or auto on Persona-Wizard seed).
- It feeds **City Meta only** — the per-city SEO title/description on **city landing pages** (`app/locations/[slug]`), via the city-meta generator + auto-sweeper.
- A **city is grounding input** that the newsroom uses to write an **article**; a city is **not** an article and never becomes one.
- Setting the Truth Document does **not** make essays Ready and does **not** put anything into Content Studio. The two tracks share the Haylo Library as a home but otherwise don't gate each other.

---

## 6. The friction this doc resolves (Textitie, 2026-06-06)

- Conductor set up Textitie (`texitie`), added the per-tenant Halo key, and pulled content into the Haylo Library — essays landed (123 rows; see §7 snapshot).
- Conductor designated the Truth Document — **works as advertised** (city-meta track unblocked).
- Conductor opened **Content Studio → Step 1** for Textitie and saw **no essays listed**.
- **Root cause (verified):** Studio Step 1 filters `status=ready`; the freshly pulled essays are all `draft`. Mechanical fix = set them Ready in the Library.
- **Why the meeting:** the answer was correct but arrived as yet another single step in a chain of single steps ("set Ready", "needs grounding", "topic optional"). The Conductor's call: stop the piecemeal glue and capture the whole workflow in one place — **this document** — then meet to decide whether any of these gates should be smoothed (auto-promote on pull? bulk Ready? auto-topic?).

**Correction event (r2, same day).** After r1, the agent told the Conductor "Topic does not block pairing." The Conductor rejected it as false and supplied the real mechanics: in the Library, **Status = Ready does not exist unless Title and Topic Slug are provided** (the edit form enforces it); Halo imports arrive without a Topic Slug, so they can't go Ready until one is set — by code or manually. The Conductor did it manually on a Textitie essay, the status pill turned green (Ready), and it then appeared in the Content Studio Haylo dropdown for pairing and was Published. Code confirms the gate at `app/admin/haylo/page.tsx` ~L292. r1 §4 corrected in r2.

---

## 7. Verified facts / restore point (2026-06-06)

**Endpoints & files**

| Concern | Location |
|---|---|
| Halo pull (handshake) | `app/api/admin/haylo-articles/pull-from-halo/route.ts` — `GET https://haylords.com/api/public/published?since=<id>`, Bearer, page 100, max 50 pages |
| Per-tenant Halo key (set/redact) | `tenants.halo_distribution_key`; edited in **Settings → Users & Tenants** via `PATCH /api/admin/tenants/[slug]` — **NOT a Replit Secret** |
| Library UI | `app/admin/haylo/page.tsx` (status filter, edit form, Truth-Doc star, pull button) |
| Essay update (status/topic/title/body) | `PATCH /api/admin/haylo-articles/[id]` — status allow-list `{draft, ready, retired}` |
| Studio picker (Ready-only) | `app/admin/knowledge/page.tsx` → `GET /api/admin/haylo-articles?status=ready` |
| Studio → article enqueue | `POST /api/admin/newsroom/enqueue-pairs` → `lib/newsroom/pairProcessor.ts` / `pairAgentOrchestrator.ts` |
| Scheduler eligibility | `lib/newsroom/schedulerPicker.ts` — `status='ready'` + grounding, no topic |
| Truth Document | `tenants.default_haylo_article_id` via `app/api/admin/haylo-articles/truth-doc` (same-tenant) / `app/api/admin/personas/[slug]/truth-doc` (Conductor) |

**PROD data snapshot (read-only, 2026-06-06)**

| Tenant | Haylo rows | Status / source mix | Topic missing | Truth Doc |
|---|---|---|---|---|
| `tableicity` | 188 | 176 ready/paste · 11 draft/halo_api · 1 ready/inbox-import | 11 | set |
| `texitie` (Textitie) | 123 | 122 draft/halo_api · 1 ready/paste | 122 | set by Conductor 2026-06-06 |

Implication: Textitie has **1** ready essay (the paste) — that is the only row Content Studio Step 1 currently shows. The 122 pulled essays need promoting to Ready to appear.

---

## 8. Open questions for the meeting (decisions, not actions)

1. ✅ **DONE (r4) — Halo-pull path fixed.** `pull-from-halo` now derives `topicSlug = slugifyHaylo(parsed.title)` instead of forcing `null`. Imports arrive topic-filled.
2. ✅ **DONE (r4) — stuck rows rescued.** `scripts/backfill-haylo-topic.ts` filled `topic_slug` on the 121 null-topic `halo_api` rows in `tenant_texitie` (PROD, verified 0 remaining). Reusable for any tenant via `--persona`.
3. **OPEN — Auto-promote on pull?** With a topic now present, should imports land `ready`, or stay `draft` for a one-click review step? *(Today they still land `draft`.)*
4. **PARTLY DONE — Bulk "Set Ready".** One-time: the 121 Texitie essays were promoted to Ready via `scripts/bulk-set-haylo-ready.ts` (r5). **Still open:** whether to add a *UI* "Mark all Ready" / multi-select button in the Library so staff can do this without a script (today, ad-hoc promotion is one essay at a time via the edit dialog, or this script).
5. **OPEN — Grounding** for Textitie cities — are research sources enabled, so the scheduler path (not just manual Studio) can run?

Through **r3** this document was a verified map only (no code/data changed). **r4 shipped a fix:** code change in `pull-from-halo/route.ts` + new `scripts/backfill-haylo-topic.ts`, and a PROD data backfill of 121 `tenant_texitie` rows. All later revisions log their own change/no-change status in the table above.
