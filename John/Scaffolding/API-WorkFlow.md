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

> **Document-control rule:** any change to the ingestion workflow gets a new revision row here. Bump the rev letter, never overwrite history.

---

## 1. The spine — one essay, end to end

```
  Halo Lab (external)
        │  GET https://haylords.com/api/public/published?since=<watermark>
        │  Authorization: Bearer <per-tenant key>
        ▼
  [1] PULL  ── app/api/admin/haylo-articles/pull-from-halo
        │  lands each essay as: status='draft', topic_slug=null, source='halo_api'
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
- **Halo-API pull:** `topic_slug=null` — nothing is derived. Every pulled essay shows a "Needs topic" badge and must get a Title + Topic Slug before it can go Ready.
- **Manual:** type it in the edit form (what the Conductor did on Textitie → green Ready pill → selectable in Studio → Published).
- **Tableicity precedent:** the Conductor notes existing logic that strips the essay **`<h1>`** to derive both Title and Topic Slug for the article/edit. That derivation is **not** wired into the Halo-pull path today — hence the manual step. *(Open question §8: wire H1-derivation into the pull so imports arrive topic-filled.)*

**What Topic Slug also does (secondary, still true from r1):** Library filter/organizer; slug seed; an on-topic steering hint to the newsroom LLM; stamped as a hidden `data-topic="…"` on the rendered article. It does **not** touch the Truth-Document/city-meta track (§5).

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

1. **Auto-promote on pull?** Should Halo imports land `ready` instead of `draft` (skip the review hop), or keep the draft gate?
2. **Bulk "Set Ready"?** Add a multi-select / "mark all Ready" action in the Library (today it's one essay at a time via the edit dialog).
3. **Auto-topic?** Halo sends no topic. Derive one from the `<h1>`/body, or keep it a manual/optional field?
4. **Grounding** for Textitie cities — are research sources enabled, so the scheduler path (not just manual Studio) can run?

No code or data was changed to produce this document — it is a verified map only.
