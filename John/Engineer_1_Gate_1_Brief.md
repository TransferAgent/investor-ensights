# Engineer 1 — Gate 1 Brief

_Companion to the Locked Gate Table v1.0 and Newsroom Worker Contract v1.1._
_Authored by App Builder. Pre-reading for Engineer 1 (Platform) before he writes a line of code._
_Estimated read time: 15 minutes. Estimated implementation time: 1-2 days._

---

## What the Architect ordered (verbatim)

> Gate 1 — Database + Worker Skeleton — is now OPEN.
> Owner: Engineer 1 (Platform).
> **Definition of Done:** A dry-run job can be claimed, flow through all 5 agent stages emitting fixture data, hit /review, and complete — with zero LLM calls and zero external scrapes. End-to-end plumbing, no intelligence.

Plain English: build a Python worker loop that pretends to be all 5 agents, talks to the real shell endpoints, writes real rows to the real database, but never calls Anthropic and never scrapes a URL. The point is to prove the plumbing works before any agent gets smart.

---

## Reading order

1. **Locked Gate Table v1.0** (Architect publishes when Halo Memo v0.2 is attached) — situational awareness
2. **`John/Newsroom_Worker_Contract_v1.1.md`** — the API spec, authoritative
3. **`John/Newsroom_Worker_Contract.md`** (v1) — kept for compatibility, you can ignore unless something in v1.1 confuses you
4. **This brief** — the local wiring guide

You may skip the Halo Integration Memo at Gate 1. Halo lives at Gate 2.5 and does not touch your work.

---

## Auth (one env var, one header)

The shell expects every worker request to carry the bearer token in the `Authorization` header:

```
Authorization: Bearer <NEWSROOM_WORKER_SECRET>
```

The shell helper that validates this is `verifyWorkerSecret` in `lib/newsroom.ts`. The env var is `NEWSROOM_WORKER_SECRET` — already set in this Replit project. Ask the Conductor for the value when you need to set it on your worker side.

A 403 means your header is missing or wrong. Nothing else returns 403.

---

## The 7 endpoints you'll talk to

All under `https://www.tableicity.com` (or your dev URL).

| Verb | Path | Purpose |
|---|---|---|
| POST | `/api/newsroom/worker/claim` | Atomically claim the next queued job. Body: `{workerId}`. Returns `{job}` or `{job:null}`. |
| POST | `/api/newsroom/worker/heartbeat` | Keep the lease alive. Body: `{jobId, currentStage, workerId}`. **409 = lease lost, stop immediately.** |
| POST | `/api/newsroom/worker/runs` | Append an audit row per agent invocation. Body matches `newsroomAgentRuns` shape. |
| PATCH | `/api/newsroom/worker/jobs/{id}` | Update job status / current_stage / agents_completed / error_message. |
| POST | `/api/newsroom/worker/review` | Submit final draft for HITL review. Body: `{jobId, citySlug, draftPayload, qcScore, qcNotes}`. Marks the job `completed`. |
| POST | `/api/newsroom/worker/knowledge` | Optional — write structured facts to `newsroom_agent_knowledge`. Skip at Gate 1. |
| POST | `/api/newsroom/worker/internal-links` | Optional — write internal-linker output. Skip at Gate 1 (or post one fixture row). |

Direct DB writes to `newsroom_source_documents` and `newsroom_lead_signals` are also authorized — see Contract v1.1's "Direct-DB row shapes" section. **Skip these at Gate 1.** They belong to Engineers 2 and 3 at Gate 2.

---

## The 5 stages (this is your loop)

Defined in `shared/schema.ts` as `NEWSROOM_PIPELINE_STAGES`:

```
researcher → data_analyst → copywriter → seo_qc → internal_linker → review (terminal)
```

For each stage in order, your worker should:

1. PATCH `/jobs/{id}` setting `currentStage` to the stage name and `status: "running"`.
2. Look up the agent UUID for that stage by querying `newsroom_agents` (filter by `role`).
3. POST `/runs` with `agentId`, `jobId`, `status: "completed"`, `dryRun: true`, `input: {fixture: true}`, `output: {fixture stage output}`, `tokensUsed: 0`, `costUsd: 0`. **Zero tokens, zero cost — this is the dry-run contract.**
4. PATCH `/jobs/{id}` appending the stage to `agents_completed`.
5. Heartbeat between stages (every 60s minimum during long stages; for Gate 1 fixtures each stage is instant, so one heartbeat per stage is fine).

After all 5 stages emit fixture runs, POST `/review` with the fixture draft payload (see below). The shell will mark the job `completed` automatically.

---

## The dry-run flag (already wired, you just consume it)

The `dry_run` boolean column exists on both `newsroom_pipeline_jobs` and `newsroom_agent_runs`, defaulting to `false`. The admin UI at `/admin/newsroom` already has a filter chip to view dry-run jobs separately (built in Phase 2).

**For Gate 1, every job you process will have `dryRun: true`.** Your worker SHALL:
- Set `dryRun: true` on every `/runs` POST.
- Treat `dryRun: true` as "fixture mode" — never call an LLM, never make an outbound HTTP request, never INSERT to `newsroom_source_documents` or `newsroom_lead_signals`.
- Behave identically across runs (deterministic output) so the Conductor and Architect can repro any failure.

To create a dry-run job for testing, INSERT directly:

```sql
INSERT INTO newsroom_pipeline_jobs (city_slug, status, dry_run, payload)
VALUES ('worcester-ma', 'queued', true, '{"topic": "fixture-gate-1"}'::jsonb);
```

---

## The fixture draft payload

Use this exact shape for `/review`. It validates against `newsroomDraftPayloadV1Schema` in `lib/newsroom/draftPayload.ts`. Copy-paste:

```json
{
  "jobId": "<the job id you claimed>",
  "citySlug": "worcester-ma",
  "draftPayload": {
    "version": "v1",
    "citySlug": "worcester-ma",
    "suggestedSlug": "gate-1-fixture-worcester-ma",
    "title": "Gate 1 Fixture Article — Worcester, MA",
    "metaDescription": "End-to-end dry-run skeleton article emitted by the Gate 1 worker. Not for publication.",
    "headline": "Gate 1 Fixture: End-to-End Plumbing Verified",
    "subheadline": "This article was generated by a dry-run worker with zero LLM calls.",
    "dateline": "WORCESTER, MA",
    "bodyHtml": "<p>This is fixture body content emitted by the Gate 1 worker skeleton. It exists only to verify that a job can be claimed, flow through all five agent stages emitting audit rows, hit the review endpoint, and arrive in the HITL review queue. No language model was consulted. No website was scraped. If you are reading this in production, the dry-run filter chip at /admin/newsroom is the place to look.</p>",
    "authorName": "Tableicity Newsroom (Fixture)",
    "publisherName": "Tableicity",
    "internalLinks": []
  },
  "qcScore": 100,
  "qcNotes": "Fixture run — automatic pass."
}
```

The `bodyHtml` must be ≥200 chars (the schema enforces this). The above is exactly 488 chars — safe.

---

## Definition of Done — the checklist

Engineer 1 is done when **all** of these are true:

- [ ] Worker boots, reads `NEWSROOM_WORKER_SECRET` from env, fails loudly if missing
- [ ] Worker successfully claims a `dryRun=true` job from `newsroom_pipeline_jobs`
- [ ] Worker emits exactly 5 rows in `newsroom_agent_runs` for that job, one per stage, all with `dryRun=true`, `status='completed'`, `tokensUsed=0`, `costUsd=0`
- [ ] Worker heartbeats at least once between stages (visible by inspecting `heartbeat_at` advancing)
- [ ] Worker POSTs the fixture draft payload to `/review` and receives a `201`
- [ ] The job ends in `status='completed'` with `current_stage='review'` and `agents_completed` containing all 5 stages in order
- [ ] A row appears in `newsroom_review_queue` with `status='pending'` and the fixture `draftPayload`
- [ ] The job is visible in the admin UI at `/admin/newsroom` with the dry-run filter chip enabled
- [ ] Worker correctly handles a `409` from `/heartbeat` by stopping work and re-claiming (test by manually force-releasing the lease via the admin "release lease" button)
- [ ] Zero outbound HTTP calls were made other than to `tableicity.com` (verify with a network log or by running offline-except-localhost)
- [ ] Zero rows were written to `newsroom_source_documents` or `newsroom_lead_signals`

---

## Visual verification (do this before declaring done)

1. Open `/admin/newsroom` and toggle the **Dry-run** filter chip.
2. Your fixture job should appear with all 5 stages green.
3. Click into the job; the agent runs panel should show 5 rows, all `cost=$0.00` and `tokens=0`.
4. Open `/admin/newsroom/review` (or wherever the review queue surfaces — confirm with App Builder); your fixture article should be there awaiting human review.

If any of those visuals are missing, the plumbing isn't done — debug before claiming Gate 1 close.

---

## What you do NOT do at Gate 1

- Do NOT call Anthropic / OpenAI / any LLM. Zero tokens, zero cost.
- Do NOT scrape any website. Zero outbound HTTP except to the shell.
- Do NOT write to `newsroom_source_documents`. That's Gate 2 (Researcher Engineer).
- Do NOT write to `newsroom_lead_signals`. That's Gate 2 (Analyst Engineer).
- Do NOT integrate Halo. That's Gate 2.5.
- Do NOT implement Idempotency-Key behavior beyond passing a UUID per request. The shell doesn't enforce it yet (v1.2 will).
- Do NOT touch `pgvector`. That's Engineer 2 at Gate 2.

If you find yourself wanting to do any of the above, you're scope-creeping. Stop and ask.

---

## Help / escalation

- **API behaving weirdly?** Ping the App Builder. The shell-side endpoints are mine; I'll debug fast.
- **Schema question?** Cross-check against `shared/schema.ts` first. If the doc and the schema disagree, the schema wins (and tell App Builder so v1.2 can fix the doc).
- **Architect-level decision?** Ping the Conductor; he relays to the Architect.
- **Stuck for >30 min on something?** Don't burn a day silently. Surface it.

---

## Recap in one sentence

**Build a Python loop that claims a dry-run job, emits 5 fake agent runs in order, posts a fixture draft, and lets a human verify the whole pipeline works end-to-end — without spending a single LLM token or making a single scrape request.**

Good hunting. The shell side is ready for you.
