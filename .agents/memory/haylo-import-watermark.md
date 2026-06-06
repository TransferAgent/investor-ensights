---
name: Halo "Pull from API" is incremental — deletes don't come back on re-pull
description: Why a deleted Haylo essay can't be recovered by clicking Pull, and the safe recovery.
---

The Haylo "Pull from API" button is **incremental, not a full re-sync**. Each tenant
has a high-water mark `public.tenants.halo_last_pulled_id`; the pull calls Halo with
`?since=<watermark>` and only ingests remote ids ABOVE it, then advances the watermark.

Deleting an essay in the Library is a **HARD delete** and does NOT rewind the watermark.
So the deleted essay's remote id is now below the watermark → Halo never re-sends it →
re-clicking Pull recovers nothing (shows "already imported / nothing new"). The dedup
layers (remote-id + content-hash) read live `haylo_articles`, so they would happily
re-import a truly-deleted row — the ONLY thing blocking recovery is the watermark.

**Recovery (no code change):** rewind that tenant's `halo_last_pulled_id` to just below
the lowest deleted remote id, then click Pull. Dedup skips everything still present and
re-imports only the gap. Re-imported essays arrive `draft` (with the title-derived topic
from the r4 fix), so they then need promoting to Ready. The upstream (Halo) still holds
the essays — a Library delete is local only.

**Why this matters:** it looks like a broken importer ("I deleted 3, Pull didn't give me
3 back") but it's expected incremental-sync behavior. Diagnose by listing
`halo_remote_id` for the tenant and finding the gap; the watermark is usually at the max
id, above the gap.

Full detail + incident log: `John/Scaffolding/API-WorkFlow.md` §4c (rev r6).
