---
name: Haylo has two ingestion paths — keep them symmetric
description: Why Halo-API imports behaved differently from paste imports, and the rule to prevent it recurring.
---

Haylo essays enter the Library via **two independent code paths**, and they are NOT
guaranteed to agree on field defaults:

1. **Paste / file scan** — `parseHayloFile` + `buildInsertFromPaste` (`lib/haylo/ingest.ts`).
   Derives `topic_slug` (from a `<!-- topic: -->` comment or filename) and defaults
   `status='ready'`. This is how the `tableicity` tenant loaded.
2. **Halo API pull** — `parseHaloPayload` + `app/api/admin/haylo-articles/pull-from-halo`.
   Halo sends no topic. This path historically **forced `topic_slug=null`** and
   `status='draft'`. This is how the `texitie` tenant loaded.

**The trap:** the Library edit form (`app/admin/haylo/page.tsx`, `submitForm`) refuses
to save unless Title + Topic Slug + body are all present, and that same save is what
flips an essay to `ready`. So null-topic Halo imports were stuck in Draft and never
appeared in Content Studio (which only lists `ready`). Looked like a per-tenant bug;
was actually a path mismatch.

**Rule:** any field that gates downstream promotion/visibility must be set in BOTH
ingestion paths. When adding a new Haylo field, update `buildInsertFromPaste` AND the
pull-from-halo route together.

**Why:** the topic auto-fill lived only on the paste path for a long time; nobody
noticed the Halo path lacked it until a second tenant onboarded via the API. Root-causing
it took real effort because the symptom (essays trapped in Draft) was far from the cause.

**Status (2026-06-06):** fixed — the pull route now derives
`topic_slug = slugifyHaylo(title, "general")`, and `scripts/backfill-haylo-topic.ts`
(forward-only, `--persona/--prod/--confirm`) rescued the stuck rows. Promoting
Draft→Ready is still a separate manual step (no auto-promote on import, by decision).
Full history: `John/Scaffolding/API-WorkFlow.md` (rev r4, §4b).
