# Newsroom Worker Contract — v1

_This document is the API contract between the Next.js admin shell and the Python agent workers._

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
{ "jobId": "uuid", "currentStage": "researcher" }
```

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

---

## Database (direct access also fine)

Workers may also write to Postgres directly for high-throughput operations. Tables:

- `newsroom_agents` — agent registry (read-only for workers)
- `newsroom_pipeline_jobs` — the queue
- `newsroom_agent_runs` — per-call audit
- `newsroom_agent_knowledge` — structured fact store (use this for the "Knowledge Browser" UI)
- `newsroom_source_documents` — raw scraped content + content_hash for de-dup
- `newsroom_lead_signals` — analyst output, tier_score 1-100
- `newsroom_review_queue` — drafts awaiting human approval
- `newsroom_internal_link_suggestions` — internal-linker output

For semantic memory (vector embeddings), enable the `pgvector` extension and add an `embedding vector(1536)` column to `newsroom_agent_knowledge` when you're ready. The shell does not depend on it — purely a worker-side concern.

---

## Lease / heartbeat semantics

- A job is claimed atomically (`SELECT ... FOR UPDATE SKIP LOCKED`).
- A worker that doesn't update `heartbeat_at` for **5 minutes** has its job re-claimable by another worker.
- Always update `heartbeat_at` at least every 60 seconds during long LLM calls.

---

## Versioning

This is **v1** of the contract. Breaking changes will increment to v2 with both endpoints kept live for 30 days. Non-breaking additions go in place.

Questions / proposals → leave a note in `John/Newsroom_Worker_Contract.md`.
