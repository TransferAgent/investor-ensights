# Google_Cities.md — Patch handover for the Remix

This document is a **complete patch description** of two related-but-distinct features added to the admin dashboard. Pass this to the Remix as-is.

> **READ THIS FIRST — DO NOT CONFUSE THESE TWO FEATURES**
>
> | Feature | Lives on | What it tracks |
> |---|---|---|
> | **"Google" checkbox** | **Knowledge Articles** page (`/admin/knowledge`) | A *per-article* boolean — has this specific article been submitted to Google Search Console for indexing? |
> | **"Articles" count column** | **City Management** page (`/admin/cities`) | A *per-city* integer — how many Published knowledge articles are linked to this city? |
>
> They are **two separate pages**, **two separate columns**, and **two separate data flows**. The only thing they share is the word "article". Do not merge them, do not move one onto the other's page, and do not try to derive one from the other.

---

## Step 1 — "Google" checkbox on Knowledge Articles

### Goal
Track which published articles have been submitted to Google Search Console's URL Inspection / Request Indexing tool. GSC limits manual indexing requests to ~10/day, so the user needs a persistent visual record of what's already been submitted.

### Where it lives
- **Page**: `/admin/knowledge` → Articles tab → main article table
- **Column position**: between **Modified** and **Actions**, header label = `Google`
- **Per row**: a shadcn `<Checkbox>` showing whether `googleIndexed` is true

### Behavior
- Checkbox is **enabled** only when `article.status === "published"`. For Draft / Archived rows, it renders disabled (greyed out).
- Clicking the checkbox fires an immediate PATCH (no Save button). The `toggleGoogleIndexedMutation` invalidates the `/api/admin/knowledge` query so the table refreshes.
- Default value for all existing and new articles is `false` (unchecked).
- Tooltips:
  - Enabled: "Tick when you've requested indexing in GSC"
  - Disabled: "Publish before tracking Google indexing"

### Files touched
| File | Change |
|---|---|
| `shared/schema.ts` | Added `googleIndexed: boolean("google_indexed").notNull().default(false)` to `knowledgeArticles` table (after `gscLastSynced`, before `updatedAt`). |
| `app/api/admin/knowledge/[id]/route.ts` | PATCH handler accepts `googleIndexed` field, coerced via `!!body.googleIndexed`. |
| `app/admin/knowledge/page.tsx` | • Added `googleIndexed?: boolean` to the local `KnowledgeArticle` interface.<br>• Added `toggleGoogleIndexedMutation` (mirrors `toggleArticleIndexMutation` shape).<br>• Added `<TableHead>Google</TableHead>` between Modified and Actions.<br>• Added `<TableCell>` with `<Checkbox>`, `data-testid={\`checkbox-google-indexed-${a.id}\`}`. |

### Database migrations
- Dev DB: pushed via `npm run db:push`.
- Prod DB: pushed via `bash scripts/push-schema-to-prod.sh` (uses `PROD_DATABASE_URL` secret + `drizzle-kit push --force`).
- **Order rule**: prod schema push MUST happen before deploy. Otherwise prod throws `column "google_indexed" does not exist` on the first PATCH.

### Test ID
`checkbox-google-indexed-{articleId}`

---

## Step 2 — "Articles" count column on City Management

### Goal
At a glance, see how many Published knowledge articles are linked to each city. Helps spot productive vs. dormant cities and answers "is this city pulling its weight in the content pipeline?"

### Where it lives
- **Page**: `/admin/cities` → main city table
- **Column position**: **immediately after Slug, before Index**, header label = `Articles`
- **Per row**: a small pill showing the integer count

### Behavior
- Renders `0` for cities with no published articles, in a muted grey pill.
- Renders `N` (1+) in a colored pill using the brand's `primary` color so productive cities pop visually.
- Tooltip on hover: "3 published articles linked to this city" (singular/plural aware).
- Updates when the cities table is refreshed (page load, mutations on cities). Does **not** poll automatically.

### Source of truth
The `knowledge_articles` table, filtered by `status = 'published' AND city_slug IS NOT NULL`, grouped by `city_slug`. This is the **same filter** the public sitemap (`/sitemap.xml`) uses to decide which articles to emit, so the per-city count will always match what's actually live and indexable.

> Note: the user said "the sitemap should be the source of truth." We honor that intent by querying the same underlying table with the same `status='published'` filter. We deliberately do **not** scrape the rendered XML — that would be slow and brittle. Querying the DB directly with the matching filter gives identical results with one round trip.

### Files touched
| File | Change |
|---|---|
| `app/api/admin/cities/article-counts/route.ts` | **NEW.** GET endpoint. Auth-gated via `verifySession()`. Single grouped SQL query. Returns `Record<string, number>` keyed by `citySlug`. |
| `app/admin/cities/page.tsx` | • Added second `useQuery<Record<string, number>>` against `/api/admin/cities/article-counts`.<br>• Added `<th>Articles</th>` header between Slug and Index.<br>• Added `<td>` rendering a pill with `articleCounts[city.slug] ?? 0`, `data-testid={\`text-article-count-${city.slug}\`}`. |

### API contract
```
GET /api/admin/cities/article-counts
→ 200 { "miami-fl": 3, "austin-tx": 7, ... }
→ 401 { "error": "Unauthorized" } if no admin session
```
Cities with zero published articles are **omitted** from the response object — the UI defaults to `0` via `articleCounts[city.slug] ?? 0`.

### Test ID
`text-article-count-{citySlug}`

### No DB migration required
Pure read-only query against existing columns (`knowledge_articles.status`, `knowledge_articles.city_slug`). Safe on both dev and prod without any schema work.

---

## Quick mental model for the Remix

- If the Remix is asked to "show indexing status" → that's the **Google checkbox on Knowledge Articles**, per-article boolean, writes to `knowledge_articles.google_indexed`.
- If the Remix is asked to "show article volume per city" → that's the **Articles count on City Management**, per-city integer, derived from a `COUNT(*) GROUP BY city_slug` over `knowledge_articles WHERE status = 'published'`.
- The two features never read or write each other's data. A user toggling the Google checkbox does **not** change the Articles count (because count is based on `status`, not on `googleIndexed`).

---

## Future enhancements (not built — listed only so the Remix doesn't re-propose them)

1. Auto-invalidate `/api/admin/cities/article-counts` whenever the Newsroom publishes a new article. One-line addition wherever the publish mutation calls `queryClient.invalidateQueries`.
2. Bulk-tick the Google checkbox from the existing bulk action toolbar on the Knowledge page.
3. Click the Articles count pill to filter the Knowledge page to that city. (Currently the pill is a non-interactive label.)

These are intentionally NOT in scope for this patch. Do not implement them unless explicitly asked.
