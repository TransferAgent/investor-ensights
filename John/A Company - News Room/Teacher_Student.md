# Teacher / Student Architecture for Tableicity Newsroom

**Status:** Draft spec — agreed in planning conversation, ready to break into 4 implementation sessions.
**Owner:** John (Human / Trainer)
**Scope:** Newsroom finishing pipeline only. Replaces heuristic + agent-only meta description writing (and other "topics of pain") with a Professor → Classroom → Student loop.
**Out of scope:** Beast Connection (iHalo Publishing API consumer) — see separate `Beast_Connection.md`.

---

## 1. The model in one paragraph

A **Human** trains a **Professor LLM** through chat sessions, optionally pointing the Professor at URLs that it silently absorbs. After enough teaching, the Human questions the Professor to confirm understanding. When satisfied, the Human clicks **Push to Classroom**, which promotes the session's absorbed knowledge into a versioned, persistent store. At inference time, a lightweight **Student LLM** runs as a finishing stage inside the Newsroom pipeline, retrieves relevant lessons from the current Classroom version, and produces the polished output. A **Conductor** (server-side service, not an LLM) manages session lifecycle — iteration counting, session close, ledger snapshotting, next-session spool. Every Student output is gated by a **Peer Review** step before it counts as final. The whole system is replicated per **topic of pain** — meta description, seed URL, headline, dateline, etc. — each with its own Professor, its own Classroom, its own Student stage.

---

## 2. The roles

| Role | Type | Responsibility | Where it runs |
|---|---|---|---|
| **Human** | You | Teach the Professor, paste URLs, ask test questions, click Push to Classroom, run Peer Review on Student output | Admin UI under `/admin/knowledge` |
| **Professor** | LLM (mid-weight, e.g. gpt-4.1-mini or gpt-4o) | Absorb chat + silent-fed URL content, surface absorbed-knowledge ledger, answer test questions | OpenAI API call per iteration, server-side |
| **Conductor** | Server logic, no LLM | Track iteration count per session, enforce hard cap (~5), close sessions cleanly, snapshot ledger, spool next session | TypeScript service, e.g. `lib/knowledge/conductor.ts` |
| **Classroom** | Postgres | Versioned, read-only-from-pipeline persistent store of distilled lessons + curated examples | Postgres tables, queried via Drizzle |
| **Student** | LLM (lightweight, gpt-4.1-nano) | Retrieve relevant Classroom lessons, generate the polished output for one article | New finishing stage inside `lib/newsroom/pipelineWorker.ts` |
| **Peer Review gate** | Human + record | Hold every Student output for one Human approval before it counts as final | Admin UI, blocks the article from advancing in the pipeline until reviewed |

---

## 3. The "topic of pain" model

**Do not build one mega-Professor that knows everything about Newsroom.** Build N small Professors, each scoped to exactly one operational pain point. Adding a new topic is a config row + a small Student wrapper, not an architectural change.

Initial topics (priority order):
1. **Meta Description** — what makes a great SEO description for this brand
2. **Seed URL** — which URL families to probe per city tier (highest strategic value — unblocks the live 5-agent path that's currently stalled by empty `city_research_sources` in prod)
3. **Headline** — truncation handling, banned phrases, brand voice
4. **Subheadline** — when to include, what tone
5. **Dateline** — formatting choices, when to omit
6. **Internal Linking** — anchors, targets, density rules
7. **City Voice** — per-region tone consistency

Topics 1 and 2 are scoped for Sessions 2–4 below. Topics 3–7 are mechanical clones once the pattern is proven.

---

## 4. Where it lives in Tableicity

**Admin UI:** New top-level sidebar entry `Knowledge`. Slim structure (no Training / Teacher Meeting / Homework / Research split — full iHalo mirror was rejected in favor of speed):

```
Knowledge
├── Meta Description
│   ├── Professor (chat sessions, absorbed-knowledge ledger, Push to Classroom)
│   ├── Classroom (read-only inspection of current published lessons + version history)
│   └── Student Reviews (peer-review queue for pending Student outputs)
├── Seed URL
│   ├── Professor
│   ├── Classroom
│   └── Student Reviews
└── (additional topics added as data, not code)
```

**Backend files (proposed paths):**
- `lib/knowledge/conductor.ts` — session lifecycle service
- `lib/knowledge/professor.ts` — Professor LLM call wrapper
- `lib/knowledge/classroom.ts` — Classroom read/write/version primitives
- `lib/knowledge/student.ts` — Student LLM call wrapper, retrieval-augmented
- `lib/knowledge/topics.ts` — topic registry (loaded from DB, not hardcoded)
- `lib/knowledge/urlAbsorber.ts` — silent URL fetch + content extraction for Professor sessions
- `lib/newsroom/pipelineWorker.ts` — modified to call Student as a new finishing stage per topic

**Stub Switch:** New top-level toggle in admin (above the sidebar or in a dev tools panel). When ON, all Professor and Student calls return canned responses instead of hitting OpenAI. Saves cost during development and lets the UI/data flow be tested without API spend. Replaces the current Dry Run checkbox buried in the Pair flow as the canonical real-vs-mock toggle.

---

## 5. Database schema sketch

All new tables; no changes to existing tables.

```
knowledge_topics
  id, slug (e.g. "meta-description"), name, status,
  professor_model, student_model, iteration_cap,
  created_at, updated_at

professor_sessions
  id, topic_id, status (active|closed|promoted|archived),
  iteration_count, started_at, closed_at, promoted_at,
  promoted_to_classroom_version_id (nullable)

professor_messages
  id, session_id, role (human|professor|url_absorb),
  content, url (nullable, for url_absorb rows),
  iteration_index, created_at

professor_absorbed_facts
  id, session_id, fact_text, fact_count,
  source_message_id, source_url (nullable), created_at

classroom_lesson_versions
  id, topic_id, version_number,
  promoted_from_session_id, promoted_by_user_id, promoted_at,
  is_published (boolean — exactly one row per topic is true),
  notes

classroom_lessons
  id, version_id, topic_id,
  lesson_text (the distilled rule or pattern),
  example_input (nullable), example_output (nullable),
  embedding (vector, nullable for retrieval),
  display_order

student_runs
  id, topic_id, classroom_version_id_consulted,
  article_id (nullable — null when run from a manual test, set when from pipeline),
  input_summary, output_text,
  retrieved_lesson_ids (array),
  status (pending_review|approved|rejected|superseded),
  reviewed_by_user_id (nullable), reviewed_at (nullable),
  reviewer_notes (nullable),
  created_at
```

Notes:
- `classroom_lesson_versions.is_published` enforces exactly one published version per topic; promoting a new version flips the old one to false in the same transaction.
- Every `student_runs` row stamps `classroom_version_id_consulted` so quality regressions can be traced back to a specific Classroom version (and from there, back to the Professor session that promoted it).
- `professor_absorbed_facts` mirrors the iHalo "Absorbed knowledge (2/5) — 8 facts / 10 facts" surface. Real-time count, displayed in the Professor UI as facts accumulate.

---

## 6. Peer Review gate

Confirmed: ON by default for every topic, including short outputs like meta description.

Flow:
1. Pipeline calls Student → `student_runs` row created with `status='pending_review'`
2. Article record is updated with the Student output AND a flag `meta_description_pending_review = true`
3. Public page renders the prior value (or fallback) until review passes — never renders unreviewed Student output
4. Admin sees the pending review in the topic's Student Reviews queue
5. Human clicks Approve → `status='approved'`, article flag flips to false, public page picks up new value
6. Human clicks Reject (with optional note) → `status='rejected'`, Student is re-invoked OR pipeline falls back to the deterministic builder, depending on topic config

Why on by default even for short outputs: per John, the cost of a bad meta description hitting production is higher than the friction of a one-click approval. Friction can be reduced later (batch approve, auto-approve when Classroom version is mature) but the gate itself stays.

---

## 7. Conductor behavior (no-LLM service)

Per session, the Conductor:
- Increments `iteration_count` on every Human message into a session
- When `iteration_count >= topic.iteration_cap` (default 5), closes the session: sets `status='closed'`, locks further messages, surfaces a "Spool New Session" button in the UI
- On Push to Classroom: snapshots the session's `professor_absorbed_facts` into a new `classroom_lesson_versions` row + child `classroom_lessons` rows in one transaction, flips the prior published version's `is_published` to false, sets the new version to true, marks the session `status='promoted'` with `promoted_to_classroom_version_id` populated
- Provides a "Continue in New Session" affordance that opens a fresh session pre-loaded with a summary of the previous session's absorbed facts as context (so teaching continuity isn't lost across the iteration cap)

Conductor is pure TypeScript. Zero LLM calls. Owns the session state machine.

---

## 8. URL silent absorption

When Human pastes a URL into a Professor session:
1. `urlAbsorber.ts` fetches the page server-side (SSRF-safe — block private IPs, follow `cityResearchAutoSeeder.ts` patterns)
2. Extract main content (boilerplate-stripped — Readability-style or Cheerio-based)
3. Send to Professor with a system instruction "absorb this silently, do not reply with chat — extract atomic facts and return as a list"
4. Store as `professor_messages` row with `role='url_absorb'`, `url=<source>`, `content=<extracted text>`
5. Store the returned facts as `professor_absorbed_facts` rows with `source_url=<source>`
6. UI updates the absorbed-knowledge counter in real time

The URL absorption is a separate iteration from chat iterations — counts toward the Conductor's iteration cap or not? **Decision needed in Session 1.** Recommendation: counts as 0.5 (URL absorbs are lighter than full chat turns), or use a separate `url_absorbs_per_session` cap. Defer until we see real usage.

---

## 9. Four-session implementation breakdown

Each session leaves the system in a working state. You can pause or redirect after any session without leaving broken code.

### Session 1 — Foundation + Knowledge tab shell

**Deliverables:**
- All 7 new tables created (schema + migration)
- `lib/knowledge/topics.ts` topic registry, seeded with two rows: `meta-description` and `seed-url`
- New `Knowledge` admin sidebar entry with sub-pages per topic (driven by registry)
- Each sub-page renders three tabs (Professor / Classroom / Student Reviews) as empty placeholders with "Coming in Session 2" copy
- Stub Switch added as a top-level admin toggle (no behavior wired yet)
- Conductor service file created with iteration-counting + session-close logic, fully tested with no LLM calls

**Acceptance:** The data spine exists. You can browse the Knowledge tab, see topic registry working. No Professor or Student calls happen yet. Database migrations are clean. No production behavior changes.

**Out of scope this session:** Any LLM call, any Student integration into the pipeline, any peer-review UI.

---

### Session 2 — Meta Description Professor (full vertical)

**Deliverables:**
- Meta Description Professor tab fully functional: Sessions list, New Session button, chat interface, URL paste-and-absorb, real-time absorbed-knowledge counter, archive sessions
- `lib/knowledge/professor.ts` wired to OpenAI (mid-weight model)
- `lib/knowledge/urlAbsorber.ts` — SSRF-safe URL fetch + Readability-style content extraction + Professor silent-absorb instruction
- Push to Classroom button + transaction (snapshot facts → new lesson version → flip published pointer)
- Classroom inspection tab — read-only view of current published lessons + version history with one-click rollback
- Stub Switch wired: when ON, Professor and URL absorb return canned responses

**Acceptance:** John can paste a meta description exemplar into a Meta Description Professor session, paste a URL of a great competitor page, see facts accumulate, ask test questions, click Push to Classroom, then see the new Classroom version published. Rollback works. Nothing in the Newsroom pipeline has changed yet.

**Out of scope this session:** Student integration. Pipeline still uses the existing body-derived heuristic for meta descriptions.

---

### Session 3 — Meta Description Student in pipeline + Peer Review gate

**Deliverables:**
- `lib/knowledge/student.ts` Student LLM wrapper with retrieval (vector or keyword search depending on Classroom size at this point)
- New finishing stage in `lib/newsroom/pipelineWorker.ts` after SEO QC + Internal Linker, parallel-eligible via `STAGE_GROUPS`, that calls the Meta Description Student
- Each Student call writes a `student_runs` row, stamps `classroom_version_id_consulted`, sets `status='pending_review'`
- Article record gains `meta_description_pending_review` flag — public page renders prior value until review approves
- Student Reviews tab in Knowledge → Meta Description shows pending queue with Approve / Reject buttons
- Approve flips flag, public page updates, audit trail recorded
- Reject re-invokes Student (configurable: max 2 retries before falling back to deterministic builder)
- Dry Run path **unchanged** — keeps deterministic body-derived builder, no LLM cost

**Acceptance:** A live Pair-flow article generates a meta description from the Meta Description Student, which retrieves Classroom lessons promoted in Session 2. The output sits in pending review. John approves it, it appears on the public page. Audit trail shows which Classroom version produced it.

**Out of scope this session:** Seed URL Professor. Other topics of pain.

---

### Session 4 — Seed URL Professor (proves the pattern generalizes + unblocks live 5-agent path)

**Deliverables:**
- Clone Sessions 2 + 3 pattern for the Seed URL topic
- Seed URL Professor cold-starts with the four URL families already hardcoded in `cityResearchAutoSeeder.ts` (Wikipedia / city.gov / Chamber / Crunchbase) as pre-seeded absorbed facts
- Seed URL Student emits URL proposals for `city_research_sources` per city, gated by Peer Review
- Approved URLs INSERT into `city_research_sources` (idempotent on conflict do nothing)
- Live 5-agent path's Researcher gate stops failing on cities with no seeds (because Student backfills them on first encounter)
- Smoke test: pick a city in prod that's currently empty in `city_research_sources`, run the Seed URL Student, approve the proposals, then trigger a live (non-Dry-Run) Pair on that city — confirm the Researcher gate passes

**Acceptance:** Two distinct topics of pain (Meta Description + Seed URL) running end-to-end through the same Professor → Classroom → Student → Peer Review architecture. Adding the next topic (Headline, Subheadline, etc.) is a config row + a Student wrapper, no architectural change.

**Out of scope this session:** Topics 3–7. Search Console CTR signal integration. Auto-approve maturation logic.

---

## 10. Explicit gates between sessions

After each session, John reviews and explicitly green-lights before the next session begins. Each gate is a chance to redirect the architecture without sunk-cost momentum.

- **Gate 1 (after Session 1):** Schema feels right? Topic registry shape works? Sidebar layout matches expectations?
- **Gate 2 (after Session 2):** Professor UX matches iHalo muscle memory? URL silent-absorb works as expected? Push-to-Classroom workflow feels deliberate enough?
- **Gate 3 (after Session 3):** Student output quality acceptable? Peer Review friction tolerable? Audit trail useful?
- **Gate 4 (after Session 4):** Pattern confirmed generalizable? Live 5-agent path actually unblocked? Ready to mechanically clone Topics 3–7?

---

## 11. Hard parts to flag (will eat time if ignored)

1. **Cold start.** Meta Description Professor needs hand-curated bootstrap examples before Session 3's Student is useful. Plan to paste 20–50 great descriptions during Session 2.
2. **Domain segmentation inside topics.** A meta description rule for "Securing Series A" probably differs from one for "Hiring Your First Engineer." Schema accommodates topic-scoped lessons; whether to add sub-domain scoping is a Session 3 decision once we see Student output drift.
3. **Versioning + freeze-on-write.** Every `student_runs` row stamps which Classroom version it consulted. Articles published yesterday do NOT auto-regenerate when a new Classroom version is promoted today. Backfill is a separate explicit admin action — not a side effect of promotion.
4. **Held-out test set.** Before Session 2's Push-to-Classroom button gets clicked for the first time, John should hold back 5–10 articles the Professor was never trained on. Use them as the "does the Professor actually understand?" test before promoting. Without this, Professor sessions overfit to the examples John fed and underperform on anything new.
5. **Stub Switch discipline.** Every Professor and Student call site must respect the switch. Easy to add new call sites that bypass it. Code review checklist item.
6. **Peer Review backlog.** If Newsroom generates 50 articles a day and each one creates a pending meta description review, the queue can pile up fast. Plan for batch-approve UI in Session 3 even though it wasn't called out as a deliverable.

---

## 12. What this doc is NOT

- **NOT Beast Connection.** That's a separate workstream — iHalo Publishing API consumer that replaces manual paste into Haylo Library. Lives in `Beast_Connection.md`. Orthogonal to this architecture; meets at the `haylo_articles` table boundary.
- **NOT a replacement for the live 5-agent pipeline.** Professor / Student finishing stages run AFTER the existing 5 agents (Researcher → Data Analyst → Local Copywriter → SEO QC → Internal Linker). The agents do their job, then the Student polishes specific fields using Classroom knowledge.
- **NOT a Dry Run replacement.** Dry Run keeps its deterministic builders. The Student stage is live-path only.

---

## 13. Open items deferred until live usage

- URL absorb iteration weighting (counts toward iteration cap as 1.0, 0.5, or separate cap?)
- Embedding model choice for Classroom retrieval (OpenAI text-embedding-3-small vs alternatives)
- Whether Peer Review should support batch-approve from day one or wait until backlog pressure forces it
- Search Console CTR integration as a quality signal (post-Session 4)
- Auto-approve maturation rule (after N consecutive approvals with no rejections, auto-approve future runs?)

---

**End of spec. Ready to start Session 1 on John's green light.**
