# Sort_Haylo_Article.md — Stable ordering fix for Haylo Library + Content Studio dropdown

## The complaint

Two related symptoms reported on the same day:

1. **Haylo Library** (`/admin/haylo`) — when a new essay was added, it appeared at the **top** of the list. The desired behavior was the opposite: new essays should land at the **bottom**, preserving the existing old → new order so the user's mental map of where things live never shifts.
2. **Knowledge → Content Studio** — the Haylo essay dropdown (used to "glue" an essay to one or more cities) was re-sorting itself whenever an essay was glued. After the glue produced a Knowledge Article (or queued a Newsroom job), the essay's row in the dropdown jumped to the top instead of staying put.

The two screens looked unrelated, but they were the same bug.

---

## Root cause

Both screens read from the **same** API endpoint: `GET /api/admin/haylo-articles`. That endpoint calls `storage.listHayloArticles()` in `lib/storage.ts`. The query was:

```ts
const q = db.select().from(hayloArticles).orderBy(desc(hayloArticles.updatedAt));
```

`updatedAt` is a **mutable** timestamp. It gets bumped to `new Date()` every time `updateHayloArticle()` runs — and `updateHayloArticle()` runs on:

- Manual edits in the Haylo Library editor.
- Status flips (e.g. `ready` → `in_use` → etc.) that happen automatically as part of the glue / pair workflow in Content Studio.
- Bulk operations.

So the sort key was changing under the user's feet. Every administrative action — including ones the user didn't think of as "an edit" — was reshuffling the list. On the Haylo Library page, a freshly-added essay sorted to the top because its `updatedAt == createdAt` was the most recent value. In the Content Studio dropdown, gluing an essay touched its `updatedAt` (via the status flip) and bounced it to the top of the dropdown — which read as "the order changes when it goes to Published / Article".

The user's expectation was an **immutable** insertion order: position is decided once when the row is created, and nothing thereafter moves it.

---

## The fix

Single one-line change in `lib/storage.ts` (`listHayloArticles`):

```diff
- const q = db.select().from(hayloArticles).orderBy(desc(hayloArticles.updatedAt));
+ const q = db.select().from(hayloArticles).orderBy(asc(hayloArticles.createdAt));
```

Why this works:

- `createdAt` is set once at insert (`defaultNow()`) and is never written to again. Drizzle's `updateHayloArticle` only touches `updatedAt`, never `createdAt`. So the sort key is effectively immutable.
- `asc` puts the **oldest** row first and the **newest** row last — which is exactly the "old → new, new content goes to the bottom" requirement.
- Both consumers (Haylo Library page and Content Studio Haylo dropdown) hit the same storage method, so a single change fixes both surfaces simultaneously. No client-side sorting, no per-screen overrides.

---

## Why no schema change was needed

The `haylo_articles` table already had a `createdAt timestamp with time zone default now() not null` column (defined in `shared/schema.ts` around line 462) plus the constellation of indexes. We just switched which existing column the ORDER BY clause used. Zero migration risk on dev or prod.

---

## Files touched

| File | Change |
|---|---|
| `lib/storage.ts` | One-line change in `listHayloArticles()`: `desc(updatedAt)` → `asc(createdAt)` |

That's it. No API change, no UI change, no schema change, no DB push.

---

## Verification

- Dev server returned `200 OK` on both `/admin/haylo` and `/admin/knowledge` after the change.
- The fix is purely an ORDER BY swap on a SELECT — there's no possible runtime regression vs. behavior at the row level. The only observable difference is the order in which rows appear.

---

## Lessons / pattern for the Remix

When a user reports "the order keeps changing on me," the diagnostic order should be:

1. **Identify the sort key.** Find the `orderBy` in the storage / repository layer.
2. **Ask: is the sort key mutable?** If the column is touched by any update — even seemingly unrelated ones like a status flip — sorting on it will produce visual reshuffling that confuses users.
3. **Prefer immutable sort keys for "stable list" UX.** `createdAt` (or an explicit `displayOrder` integer) is almost always what the user actually wants, even when they describe it as "newest first" — because they really mean "in a stable order that I can build muscle memory around."
4. **Check shared API consumers.** Two unrelated-looking screens that re-sort at the same time are a strong signal they share a backend. Fix the shared layer, not each screen individually.

---

## Out of scope (do not change without an explicit request)

- The `hayloArticles.updatedAt` column is still updated on edits — it's just no longer used for ordering. Other features (e.g. "last edited" displays, freshness badges) may still depend on it, and they're untouched.
- Other lists in `lib/storage.ts` that sort by `updatedAt` or `createdAt` were left as-is. Only `listHayloArticles` was reported as buggy. Do not "consistency-fix" the others without an explicit ask — different screens have legitimately different ordering needs (e.g. the Knowledge Articles admin table sorts by `updatedAt desc` on purpose so the most-recently-edited article surfaces first).
