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
        │  ▸ MISSING STEP: promote draft → ready  (edit essay, Status = Ready)
        │    PATCH /api/admin/haylo-articles/[id]  (status ∈ draft|ready|retired)
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

**The one rule that explains the Textitie symptom:** Content Studio Step 1 only shows **Ready** essays. Fresh Halo pulls are **Draft**. So a just-pulled essay is in the Library but invisible to the Studio until you set it Ready. That is the *only* missing hop between Library and Studio.

---

## 2. The gates, by hop (what actually blocks what)

| Hop | Gate | Where enforced |
|---|---|---|
| Pull → Library | Per-tenant Halo key must be set | `pull-from-halo` reads `tenants.halo_distribution_key`; 400 `halo_key_not_configured` if empty |
| Library: essay visible to Studio | `status = 'ready'` | Studio picker fetches `/api/admin/haylo-articles?status=ready` (`app/admin/knowledge/page.tsx`) |
| Library: essay visible to auto-scheduler | `status = 'ready'` **AND** city grounding (≥1 enabled `city_research_sources`) | `lib/newsroom/schedulerPicker.ts` — `WHERE h.status='ready'` + grounding subquery. **No topic check.** |
| Studio pairing → article | valid `hayloArticleId` (uuid) + ≥1 `citySlug` | `app/api/admin/newsroom/enqueue-pairs/route.ts` (zod) |

**Topic is never a gate** anywhere in this spine (see §4).

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

## 4. Topic — soft signal, not a gate

`topic_slug` is **nullable** and indexed. Halo imports set it to `null` ("Needs topic" badge). It does real-but-soft work and **blocks nothing**:

- **Before:** Library filter/organizer; slug seed for pasted entries; a steering hint to the newsroom LLM ("stay on-topic"); a fallback title when the essay `<h1>` is truncated.
- **After:** stamped as a hidden `data-topic="…"` attribute on the rendered article wrapper.
- **Never:** gates Studio, the scheduler, publishing, or the Truth-Document/city-meta track.

Leaving every essay at "Needs topic" is cosmetically noisy but functionally harmless.

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
