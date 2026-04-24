# Halo Integration Memo — v0.2

_Authored by App Builder under Architect authorization (post Gate 0 close)._
_Status: Ready for Architect attachment to Locked Gate Table v1.0 at Gate 2.5._
_Scope: Defines how Newsroom workers consult Halo. Does not modify Halo._

**Revision history**
- **v0.2** (2026-04-23) — Architect redline applied: Researcher uses conditional fallback scrape (Halo first, scrape only if Halo returns zero high-confidence results), preserving the cost-savings thesis. Tier B rewrite caveat documented.
- **v0.1** — Initial draft, ratified by Architect with one redline.

---

## TL;DR

Halo is a separate Replit project containing a multi-persona LLM + knowledge base that John trained before Newsroom. Newsroom will treat Halo as a **read-only HTTP enrichment source**, scoped to the `tableicity` persona, behind the Architect-mandated `HALO_ENRICHMENT_ENABLED` feature flag. Halo owns its embeddings; Newsroom does not duplicate that work. Two integration points: Researcher pre-scrape consult, Copywriter few-shot Q&A injection. Read-only — no write-back at POC.

---

## Conductor's answers (the 5 questions)

| # | Question | Answer |
|---|---|---|
| 1 | Where does Halo live? | Separate Replit Project. API rails exposed on demand. |
| 2 | Access shape? | Read-only, format Newsroom's choice → **HTTP API + bearer token**. |
| 3 | What's in the KB? | Persona-segmented: Tableicity + 2 others. Newsroom uses Tableicity persona only. |
| 4 | Embeddings? | Unknown / flexible — Halo can become what we need. |
| 5 | Read or write? | Read-only. No write-back without justification. |

---

## Recommended access pattern

**Halo exposes two HTTP endpoints scoped by persona:**

```
GET /api/v1/search?q={query}&persona=tableicity&limit={n}
  → returns top-k semantically-ranked KB chunks
  → response: [{ id, text, sourceUrl?, score, lastUpdatedAt }]

GET /api/v1/qa-pairs?topic={topic}&persona=tableicity&limit={n}
  → returns vetted question/answer pairs for few-shot use
  → response: [{ question, answer, citation? }]
```

**Why Halo owns embeddings (not Newsroom):** John explicitly said he doesn't want to duplicate training. Halo already has the corpus and the persona segmentation. Asking Newsroom to re-embed Halo's content into pgvector would mean (a) duplicate cost, (b) drift between the two stores, (c) Newsroom needing read access to Halo's raw text. A search endpoint owned by Halo solves all three. Halo can implement search via pgvector, BM25, or a hybrid — Newsroom doesn't care.

**Persona safety:** Every Newsroom call MUST include `persona=tableicity`. Halo SHOULD reject calls without an explicit persona param (no defaulting). This prevents accidental leakage from the other two personas into Tableicity articles.

---

## Newsroom-side integration points

### Researcher (Gate 2.5 — first integration)

Researcher consults Halo **first**, then conditionally falls back to web scrape. The decision tree is:

1. Call `/search?q={city + topic}&persona=tableicity&limit=5`.
2. **If Halo returns ≥1 result with `score > 0.75`:** trust Halo. Write those chunks into `newsroom_source_documents` with `source_url` set to a `halo://` pseudo-URL and `fetched_by_agent_id` set to the researcher agent UUID. **Skip the web scrape for this query.**
3. **If Halo returns zero results, OR all results score ≤ 0.75:** fall back to the web scrape pipeline. Halo had nothing useful to say; we earn the scrape cost.
4. **If `HALO_ENRICHMENT_ENABLED=false`:** skip Halo entirely and scrape unconditionally (this is the current Gate 2 behavior — Halo is a strict additive layer).

This preserves the original Halo thesis on all three axes simultaneously: fewer ToS issues (we scrape less), token savings (vetted Halo chunks are tighter than scraped HTML), and quality (Halo is John-trained content). Parallel scraping would have given us the quality but forfeited the cost savings.

**Caveat — Tier B rewrites:** When the GSC heal loop re-enqueues an underperforming article for rewrite (Gate 5), the Researcher SHALL scrape in parallel with Halo regardless of Halo's score. Freshness matters more than cost on pages that already proved they're failing. The Architect will revisit this rule at Gate 5.

### Copywriter (Gate 3 — quality lever)
At prompt assembly time, the Copywriter calls `/qa-pairs?topic={article_topic}&persona=tableicity&limit=3` and injects the pairs into the system prompt as few-shot examples. This is where Halo earns its keep visibly — articles will sound like they came from John's trained voice, not a generic LLM.

### Data Analyst — explicitly skipped at POC
Halo is a press-release / knowledge engine, not a structured financial dataset. The Analyst stays on Crunchbase/SEC. Reconsider at Tier B if Halo grows structured tables.

---

## Feature flag spec (Architect amendment)

```
HALO_ENRICHMENT_ENABLED=true|false   # master switch
HALO_API_BASE_URL=https://halo-...replit.app
HALO_API_TOKEN=<bearer token from John>
HALO_PERSONA=tableicity              # hard-coded for Newsroom; never overrideable per-job
HALO_TIMEOUT_MS=3000                 # fail fast, don't block the pipeline
```

**When `HALO_ENRICHMENT_ENABLED=false`:**
- Workers SHALL NOT make any network call to Halo.
- No log noise, no latency, no `try/catch` with silent failures.
- Pipeline behavior must be deterministic and bit-identical to a world where Halo doesn't exist.
- This protects dry-runs, Gate 4 reproducibility, and Halo-outage scenarios.

**When `HALO_ENRICHMENT_ENABLED=true` but Halo is down:**
- 3-second timeout, single retry, then proceed without Halo.
- Log one `INFO` line per failure (`halo.unreachable`), never `ERROR` (Halo is optional).
- Job MUST NOT fail because Halo failed.

---

## Caching (Newsroom-side, to bound Halo load)

Halo responses get cached into `newsroom_agent_knowledge` with `source='halo'` and a 24h TTL. The Researcher checks the local cache before calling Halo. This means a city + topic combination hits Halo at most once per day, regardless of how many articles get generated for it. Cache key: SHA-256 of `(persona, query, limit)`.

---

## What I recommend Halo build (small ask)

To make Newsroom integration clean, Halo needs three things on its side. None are urgent — they can be built when Gate 2.5 opens.

1. **The two endpoints above** (`/search`, `/qa-pairs`) with persona-scoping.
2. **A bearer token mechanism** Newsroom can stash in `HALO_API_TOKEN`. A single token is fine for POC; rotate quarterly.
3. **A `lastUpdatedAt` timestamp on every returned chunk** so Newsroom can later prefer fresher content during article rewrites (Tier B).

Halo does NOT need to build: webhooks, write endpoints, vector search standardization, or per-Newsroom-user authentication. POC is one trusted system talking to another.

---

## Why no write-back at POC (Conductor asked for justification)

Three reasons to keep Newsroom → Halo writes off the table for now:

1. **Quality risk.** Newsroom articles at POC will be machine-generated and human-reviewed for surface quality, but not for "is this correct enough to teach a student?" Pushing them into Halo's KB before that bar is met would degrade the training signal John already invested in.
2. **Coupling risk.** A write path means Halo's schema becomes a hard dependency for Newsroom. Read-only keeps the blast radius small — Halo can refactor freely.
3. **No clear consumer yet.** Halo's "Student Teach" / "Research" personas might want Newsroom articles eventually, but that's a Halo product decision (does the curriculum want news content?), not a Newsroom decision.

**When write-back DOES become worth it:** post-Tier-B, after GSC data proves which Newsroom articles are accurate and high-traffic. Then we have a quality signal worth feeding back. That's a Tier C conversation.

---

## Out of scope for this memo

- Halo's internal architecture (John's call)
- Multi-tenant auth (POC is single-tenant trusted)
- Write-back (deferred per above)
- Embedding strategy on Halo's side (Halo's call — search endpoint abstracts it)
- Newsroom UI surfacing of Halo provenance (Tier B)

---

## Suggested next step

Architect attaches this memo as a referenced artifact on the Gate Table at row Gate 2.5. When Gate 2 closes and the assigned Engineer (2 or 3) picks up Gate 2.5, they implement the `lib/halo/client.ts` (or `worker/halo_client.py`) adapter against the spec above. ETA estimate: 1 engineer-day for the adapter, an additional half-day at Gate 3 for the Copywriter prompt-assembly hook.
