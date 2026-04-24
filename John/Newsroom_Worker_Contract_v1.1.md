# Newsroom Worker Contract — v1.1

_This document is the API contract between the Next.js admin shell and the Python agent workers._

> **Revision history**
> - **v1.1** (2026-04-23) — Additive clarifications, no breaking API changes. Documents row shapes for `newsroom_source_documents` and `newsroom_lead_signals`, adds Retry/Idempotency section, mandates per-job hot-reload of agent config, names pgvector ownership.
> - **v1** — Initial contract.

The shell is the **brain** (UI, jobs, persistence, review). Workers are the **engine room** (scrapers, LLMs, intelligence). They communicate **only** through the HTTP endpoints below and the shared Postgres database.

---

## Auth

All worker endpoints are protected by a shared internal secret.

- **Header**: `x-newsroom-worker-secret: <NEWSROOM_WORKER_SECRET>`
- **Failure**: HTTP 403 `{"error":"forbidden"}`
- The secret is stored in Replit Secrets. Ask the admin for the value. Do **not** commit it.

---

## Lifecycle (the loop your worker runs)

```
loop:
  1. POST /api/newsroom/worker/claim          → claim a queued job
  2. for each agent stage in order:
       a. PATCH /api/newsroom/worker/jobs/{id}     → set currentStage
       b. POST  /api/newsroom/worker/heartbeat     → every 30s while working
       c. POST  /api/newsroom/worker/runs          → log the agent run + output
       d. POST  /api/newsroom/worker/knowledge     → persist any new facts
  3. POST /api/newsroom/worker/review              → submit final draft to HITL queue
  4. PATCH /api/newsroom/worker/jobs/{id}          → status="completed"
```

---

## Endpoints

### `POST /api/newsroom/worker/claim`

Atomically claim the next queued job (or steal one whose heartbeat is older than 5 minutes).

**Body**
```json
{ "workerId": "py-worker-01" }
```

**Response (job available)**
```json
{
  "job": {
    "id": "uuid",
    "citySlug": "worcester-ma",
    "status": "running",
    "dryRun": true,
    "payload": {}
  }
}
```

**Response (no job)** → `{ "job": null }`

---

### `POST /api/newsroom/worker/heartbeat`

Call every 30 seconds during long work to prevent another worker from stealing your job.

**Body**
```json
{ "jobId": "uuid", "currentStage": "researcher", "workerId": "py-worker-01" }
```

`workerId` is optional but **recommended** — when supplied, the heartbeat is only accepted if the job is still `status='running'` AND `claimed_by = workerId`. If the lease was forcibly released by an admin, or stolen by another worker, the endpoint returns **HTTP 409** `{"ok":false,"error":"lease lost ..."}`. On 409, the worker MUST stop work immediately and either re-claim or exit gracefully.

---

### `PATCH /api/newsroom/worker/jobs/{id}`

Update job status / stage / completed agents.

**Body** (all optional)
```json
{
  "status": "running" | "completed" | "failed",
  "currentStage": "copywriter",
  "agentsCompleted": ["researcher", "data_analyst"],
  "errorMessage": "..."
}
```

---

### `POST /api/newsroom/worker/runs`

Log a single agent invocation.

**Body**
```json
{
  "agentId": "uuid",
  "jobId": "uuid",
  "citySlug": "worcester-ma",
  "status": "completed",
  "dryRun": true,
  "input": { "prompt": "..." },
  "output": { "leads": [...] },
  "errorMessage": null,
  "tokensUsed": 1234,
  "costUsd": 0.0345,
  "startedAt": "2026-04-22T12:00:00Z",
  "finishedAt": "2026-04-22T12:00:42Z"
}
```

---

### `POST /api/newsroom/worker/knowledge`

Persist structured facts. Batch up to ~100 entries per call.

**Body**
```json
{
  "entries": [
    {
      "agentId": "uuid",
      "citySlug": "worcester-ma",
      "key": "company:massmutual:headcount",
      "value": { "count": 6500, "asOf": "2026-Q1" },
      "sourceUrl": "https://wbjournal.com/...",
      "confidence": 0.92,
      "expiresAt": "2026-07-22T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/newsroom/worker/review`

Submit final draft to human-in-the-loop review queue. This also marks the job `completed`.

**Body**
```json
{
  "jobId": "uuid",
  "citySlug": "worcester-ma",
  "draftPayload": {
    "headline": "...",
    "subheadline": "...",
    "bodyHtml": "...",
    "metaDescription": "...",
    "internalLinks": [
      { "targetSlug": "boston-ma", "anchorText": "Boston cap tables", "position": 312 }
    ],
    "leadsUsed": [...],
    "sources": [...]
  },
  "qcScore": 87,
  "qcNotes": "Similarity to boston-ma: 11%. Anchor diversity: ok."
}
```

After approval in the admin UI, the shell publishes this draft via the existing knowledge-articles publish flow.

---

## Dry Run Mode

Every job carries a `dryRun: boolean` flag. When `true`:

- Workers **must** skip paid LLM calls and external scrapes.
- Workers should still go through every stage and POST plausible-looking fixture data so the UI/state-machine can be tested end-to-end.
- Cost / token fields can be `0` or `null`.

This lets the admin verify the entire pipeline without burning credits.

---

## Agent IDs

Fetch the canonical agent UUIDs once at startup:

```
GET /api/admin/newsroom/agents
```

(Requires admin session cookie. For workers, query the Postgres `newsroom_agents` table directly using `DATABASE_URL` — it's the same database.)

Roles: `researcher`, `data_analyst`, `copywriter`, `seo_qc`, `internal_linker`.

> **v1.1 — Hot-reload mandate.** Workers SHALL reload `systemPrompt` and `sources` from `newsroom_agents` at the start of every job (not just at worker boot). This honors admin edits made via `/admin/newsroom` without requiring a worker restart. Caching agent UUIDs across jobs is fine; caching prompt/sources content across jobs is forbidden.

---

## Database (direct access also fine)

Workers may also write to Postgres directly for high-throughput operations. Tables:

- `newsroom_agents` — agent registry (read-only for workers)
- `newsroom_pipeline_jobs` — the queue
- `newsroom_agent_runs` — per-call audit
- `newsroom_agent_knowledge` — structured fact store (use this for the "Knowledge Browser" UI)
- `newsroom_source_documents` — raw scraped content + content_hash for de-dup (see v1.1 row shape below)
- `newsroom_lead_signals` — analyst output, tier_score 1-100 (see v1.1 row shape below)
- `newsroom_review_queue` — drafts awaiting human approval
- `newsroom_internal_link_suggestions` — internal-linker output

For semantic memory (vector embeddings), enable the `pgvector` extension and add an `embedding vector(1536)` column to `newsroom_agent_knowledge` when you're ready. The shell does not depend on it — purely a worker-side concern.

> **v1.1 — pgvector ownership.** The Architect authorizes `CREATE EXTENSION pgvector` on prod. The Data Engineer (Engineer 2) executes it during Gate 2. Workers are forbidden from attempting the `CREATE EXTENSION` themselves and must fail loudly if `pgvector` is not yet installed when they attempt to use it.

---

## Direct-DB row shapes (v1.1)

The following two tables are written **directly via Postgres `INSERT`** — there is no HTTP endpoint and none is needed. Workers connect with `DATABASE_URL` and use parameterized queries. Column names below are the live Drizzle column names from `shared/schema.ts` and are authoritative.

### `newsroom_source_documents` — Researcher write target

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | server-default `gen_random_uuid()`, omit on insert |
| `source_url` | text NOT NULL | the canonical URL the content was fetched from |
| `content_hash` | varchar(64) NOT NULL | SHA-256 hex of `clean_content` — used for dedupe |
| `city_slug` | text NULL | the city this scrape belongs to (e.g. `worcester-ma`); NULL only for cross-city sources |
| `title` | text NULL | extracted page title |
| `raw_content` | text NULL | original HTML/text (optional, kept for debugging) |
| `clean_content` | text NULL | LLM-ready cleaned text (Markdown preferred — this is what Crawl4AI emits) |
| `fetched_by_agent_id` | uuid NULL | FK → `newsroom_agents.id`; the researcher agent UUID |
| `fetched_at` | timestamptz | server-default `now()`, omit on insert |

**Researcher Engineer SHALL:**
- Write directly via DB INSERT, batched up to 100 rows per transaction.
- Compute `content_hash = SHA-256(clean_content)` before insert.
- Use `INSERT ... ON CONFLICT DO NOTHING` against an index on `content_hash` to dedupe.
- Use `fetched_by_agent_id` to record provenance.

> **Note (App Builder → Architect):** The Architect's order specified columns named `contentMd`, `sourceDomain`, and `agentRunId`. The live schema uses `clean_content`, no `source_domain` column, and `fetched_by_agent_id` (which references the agent, not a specific run). The intent is preserved — `clean_content` carries the Markdown payload and the FK ties the document to its agent. If the Architect wants a `source_domain` column or a stronger run-level FK to `newsroom_agent_runs`, that's a v1.2 schema migration to be queued separately.

### `newsroom_lead_signals` — Data Analyst write target

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | server-default `gen_random_uuid()`, omit on insert |
| `city_slug` | text NOT NULL | e.g. `worcester-ma` |
| `company_name` | text NOT NULL | resolved entity name (post Crunchbase autocomplete) |
| `tier_score` | integer NULL | 1-100, the "Tableicity Score" |
| `funding_total_usd` | numeric(14,2) NULL | total raised, USD |
| `investor_count` | integer NULL | number of distinct investors |
| `signal_type` | varchar(50) NULL | `growth` \| `risk` \| `neutral` |
| `payload` | jsonb NOT NULL | server-default `{}`; free-form bag for investor list, last_funding_at, headcount, etc. — anything the Copywriter might need |
| `source_document_id` | uuid NULL | FK → `newsroom_source_documents.id`; the scrape that produced this lead |
| `created_at` | timestamptz | server-default `now()`, omit on insert |

**Data Analyst Engineer SHALL:**
- Write directly via DB INSERT, batched up to 100 rows per transaction.
- Always populate `source_document_id` so the Copywriter can cite the original URL.
- Dedupe via `(city_slug, company_name)` — treat as logical unique; no DB unique constraint exists yet, so check before insert or use an UPSERT with conflict target on a future migration.
- Stash extras (investor names, last funding round date, headcount, deeplinks) in `payload` rather than asking for new columns.

> **Note (App Builder → Architect):** The Architect's order specified `fundingUsd`, `sourceUrl`, and `agentRunId`. The live schema is `funding_total_usd`, no direct `source_url` (the URL lives on the linked source document via `source_document_id`), and no run-level FK. Intent preserved — the linked source_document carries the URL, and analyst-specific provenance can sit in `payload` until v1.2.

---

## Retry / Idempotency (v1.1)

All worker → shell HTTP calls MUST be safe to retry. The shell endpoints are **mostly** idempotent today (SELECTs, UPDATEs by id), but worker authors must follow these rules to keep them so:

### Idempotency-Key header (REQUIRED on POSTs)

Every `POST` to a worker endpoint MUST include an `Idempotency-Key` header set to a UUIDv4 generated **once per logical operation** and reused across retries of that same operation.

```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

The shell does not yet enforce uniqueness server-side (planned for v1.2), but workers SHALL behave as if it does. This means: if you retry a `/runs` POST after a network blip, send the same key. Do not generate a new UUID per attempt.

### Backoff schedule (5xx responses)

On any `5xx` response from a worker endpoint, the worker SHALL retry with **exponential backoff: 2s → 4s → 8s → 16s**. After the 4th failed attempt, the worker SHALL:

1. PATCH the job to `status: "failed"` with a descriptive `errorMessage`.
2. Stop processing the job.
3. Loop back to `claim` for the next available job.

### `/review` 422 — slug collision regeneration

When `POST /review` returns `422` with a slug-collision error, the Copywriter SHALL regenerate `suggestedSlug` by appending `-v2`, `-v3`, `-v4`, `-v5` and retrying once each. After `-v5` fails, mark the job failed and surface the collision in `errorMessage`.

```
attempt 1: worcester-ma-fintech-funding-q2-2026
attempt 2: worcester-ma-fintech-funding-q2-2026-v2
attempt 3: worcester-ma-fintech-funding-q2-2026-v3
...
```

### `/heartbeat` 409 — lease lost (no retry, ever)

This is restated from v1 for clarity: a `409` from `/heartbeat` means another worker has stolen the lease (or an admin force-released it). The worker SHALL stop work **immediately**, abandon any partial output, and loop back to `claim`. Do not retry the heartbeat. Do not POST partial runs. Do not POST a review draft. Just stop and re-claim.

### What the shell guarantees in return

- `POST /claim` is atomic — two concurrent claims will never return the same job.
- `PATCH /jobs/{id}` and `POST /runs` are safe to call multiple times (last-write-wins on PATCH, append-only on runs).
- `POST /review` is **not** safe to retry blindly across a 2xx response — if you got a 200 back and then your network died, the article is already in the queue. Inspect `newsroom_review_queue` by `jobId` before resending.

---

## Lease / heartbeat semantics

- A job is claimed atomically (`SELECT ... FOR UPDATE SKIP LOCKED`).
- A worker that doesn't update `heartbeat_at` for **5 minutes** has its job re-claimable by another worker.
- Always update `heartbeat_at` at least every 60 seconds during long LLM calls.

---

## Draft Payload schema (v1) — REQUIRED for `/review`

The `draftPayload` object you POST to `/api/newsroom/worker/review` must conform to **NewsroomDraftPayloadV1**. The shell validates it server-side. If validation fails, the human reviewer cannot approve & publish — the article will be stuck in the queue.

Source of truth (frozen): `lib/newsroom/draftPayload.ts` (Zod).

```json
{
  "version": "v1",
  "citySlug": "worcester-ma",
  "suggestedSlug": "worcester-ma-fintech-funding-q2-2026",
  "title": "Worcester fintech funding hits record Q2 — Tableicity coverage",
  "metaDescription": "How three Worcester startups raised $42M in Q2 2026 and what it means for cap-table founders.",
  "headline": "Worcester fintechs raise $42M in Q2 2026",
  "subheadline": "Three local startups, three different cap-table strategies.",
  "dateline": "WORCESTER, MA — April 22, 2026",
  "bodyHtml": "<p>...</p>",
  "boilerplateHtml": "<p>About Tableicity...</p>",
  "ogImageUrl": "https://cdn.example.com/og/worcester.jpg",
  "authorName": "Tableicity Newsroom",
  "publisherName": "Tableicity",
  "internalLinks": [
    { "targetSlug": "worcester-ma", "anchorText": "Worcester city page", "position": 2 }
  ]
}
```

Constraints (enforced by Zod):
- `version` must be the string `"v1"`.
- `suggestedSlug` lowercase letters, digits, hyphens; max 120 chars; must be globally unique within `knowledge_articles` (publish will fail with 422 if collision — reject and regenerate).
- `title` 10–120 chars; `bodyHtml` ≥ 200 chars.
- `citySlug` must equal the parent job's `citySlug` (mismatch = 422).
- `internalLinks` optional, max 20 entries.

### What Approve does

When a human clicks **Approve & Publish** in `/admin/newsroom`:
1. The draft is re-validated against the v1 schema (server-side).
2. A `knowledge_articles` row is inserted in a single DB transaction with:
   - `status = "pending"` (NOT auto-published — human flips it to `published` in the Knowledge tab),
   - `robots = "noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"` (safe-default; protects ranking pages from being clobbered by an unproven new article),
   - `canonicalUrl` derived from `NEXT_PUBLIC_BASE_URL` + slug.
3. The review row is flipped to `status = "approved"` and `publishedArticleId` is set.
4. Any `internalLinks` from the draft are persisted to `newsroom_internal_link_suggestions` and linked to the new article.
5. An audit log entry is written.

This means the worker can publish drafts safely — the article is parked at `noindex` until a human chooses to flip it live.

---

### `POST /api/newsroom/worker/internal-links`

Optional standalone endpoint for the `internal_linker` agent if it runs after the copywriter has already submitted a draft (instead of inlining `internalLinks` in `draftPayload`).

**Body**
```json
{
  "reviewQueueId": "uuid",
  "suggestions": [
    { "targetSlug": "worcester-ma", "anchorText": "Worcester city page", "position": 2 }
  ]
}
```

Up to 20 per call. Returns `{ "inserted": N }`.

---

## Versioning

This is **v1** of the contract. Breaking changes will increment to v2 with both endpoints kept live for 30 days. Non-breaking additions go in place.

Questions / proposals → leave a note in `John/Newsroom_Worker_Contract.md`.
