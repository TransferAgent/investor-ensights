# Newsroom Lifecycle Recap — April 29, 2026

**Companion to:** `Teacher_Student.md`
**Purpose:** Point-in-time snapshot of where the Newsroom system stands at end of session 2026-04-29 — what works manually, what works live, what's documented as the next architecture step, and what's deferred.

---

## What today's lifecycle covered

### 1. Haylo Library ingestion (manual today, API tomorrow)

Two manual paths into `haylo_articles` work today:
- Paste-in form at `/admin/haylo`
- Drop `.html` files into `haylo-inbox/` and click Scan Inbox

Both flows are correct, both write the same shape into the database. Neither is going to scale at volume.

**Beast Connection** (iHalo Publishing API consumer) replaces both. It's a separate workstream, separate doc (`Beast_Connection.md` to be written), doesn't touch Newsroom internals — meets the rest of the system at the `haylo_articles` table boundary.

---

### 2. Dry Run gets you ~80% home with zero LLM cost

Dry Run path is pure JavaScript — `composePressRelease` (Glue) + `mockAudit` (sha1-based deterministic verdict). Good for shaping. Manual polish closes the last 20%.

This path stays as-is. The Teacher / Student work doesn't change Dry Run behavior.

---

### 3. Newsroom (live 5-agent path) is viable but needs Human-in-the-Middle

The Researcher → Data Analyst → Local Copywriter → SEO QC → Internal Linker pipeline produces solid drafts. The finishing fields — meta description, headline, dateline, seed URLs — need a learned brand voice the agents don't have.

That's exactly what Teacher / Student is for: a small Professor-trained Student per topic of pain, slotted into the pipeline as a finishing stage, gated by Peer Review.

---

### 4. Architecture spec is shipped

`John/A Company - News Room/Teacher_Student.md` exists as the architecture document. Four sessions, explicit gates between each:

- **Session 1** — Foundation: schema + Knowledge tab shell + topic registry as data
- **Session 2** — Meta Description Professor full vertical
- **Session 3** — Meta Description Student in pipeline + Peer Review gate
- **Session 4** — Seed URL Professor (proves the pattern generalizes + unblocks live 5-agent path)

Each session leaves the system in a working state. Pause or redirect after any session without leaving broken code.

---

### 5. SEO meta description: solved for now, will be augmented later

Today's fixes:
- Body-derived greedy-sentence builder up to 300 chars (`buildMetaDescriptionFromBody` in `lib/newsroom/pairProcessor.ts`)
- Pending-article metadata fix on the public knowledge page so noindex pages still get correct metaDescription / canonical / OG tags (previously fell through to layout boilerplate)
- Live agent path still prefers SEO QC's metaDescription if ≥40 chars, falls back to body-derived

The Brand / Pain Point / Solution structure in 300 chars is the Student's job in Sessions 2 + 3 of the Teacher / Student doc — once the Meta Description Professor has been taught what those three components look like for Tableicity.

---

### 6. `tableicity-los-angeles-ca-early-funding-spa` looks good

Real PASS through the live 5-agent pipeline. Validates the architecture works when inputs are right.

---

### 7. Local Vibe absent from body, acceptable for now

The v3 Analyst's `localVibe` extraction (the "insufficient commercial signal" sentinel) is not wired into v4 polish-mode because the Copywriter writes directly from Researcher facts. Future Student work could backfill city-specific tone as a finishing pass.

Not a blocker. Documented as a known gap.

---

## Two small things worth keeping on the record

### A. Dateline auto-generation is OFF at all 3 insert sites

`enqueue-pairs`, `schedulerRunner`, and the review-approve route all now write `dateline=null`. The public page conditionally renders, so null = no dateline shown. Editors can still set a dateline manually via the admin edit form. Permanent change, not a temporary patch.

### B. The pasted T001–T005 plan IS the architecture already running in production

That plan describes the live 5-agent pair-agent orchestrator (`pairAgentOrchestrator.ts` + `cityResearchAutoSeeder.ts` + v4 polish-mode + verdict-mapping reshape). All five tasks are shipped and live per `replit.md`. Useful as a historical reference for what the current production behavior is.

---

## Beast Connection — confirmed direction

Stated explicitly today: "Currently you have Halo Library where I need to copy and Paste HTML — that goes away with an API Call to Publishing at Halo."

Locked in. When that workstream starts, `Beast_Connection.md` will document the API contract, the polling cadence, and how iHalo flips items from Ready to Published once Tableicity has consumed them. Orthogonal to Teacher / Student.

---

## What's not yet decided (open items for the next conversation)

- Cold-start curation for Meta Description Professor — who pastes the first 20–50 exemplars and when
- Whether to run Beast Connection or Teacher / Student first — both are valuable, neither blocks the other
- Held-out test set discipline — easy to skip, painful to retrofit

---

## Cross-references

- **Architecture spec:** `Teacher_Student.md` (this folder)
- **Production behavior reference:** `replit.md` (project root)
- **Future Beast Connection workstream:** `Beast_Connection.md` (to be written when that workstream begins)

---

**End of recap. Captured at end of session 2026-04-29 for handoff continuity.**
