# Site Map & Indexing — Handover

> Audience: the Tableicity remix (and anyone porting this work back to the parent codebase).
> Scope: how indexing flows from the database → sitemap → Google, why our prod sitemap was "empty" of city pages, and the new admin UX (per-row toggle + bulk actions) that lets a publisher control indexing without touching SQL.

---

## 1. The discovery — why Google was "not seeing" the sitemap

### Symptom
After deploying the rebrand to `investorensights.com`, the sitemap appeared functional but Google Search Console reported few indexed pages. The publisher's expectation: "I have hundreds of city pages, why isn't Google crawling them?"

### What we checked

| Check | Result |
|---|---|
| `GET /sitemap.xml` over HTTPS | `200 OK`, valid XML, served as `application/xml` |
| `GET /robots.txt` | Returns correct `Sitemap:` line |
| `www.investorensights.com` → apex 301 redirect | Working (in `middleware.ts`) |
| URL counts in the live sitemap | 1 home + 3 legal + 41 articles + **0 cities** = **45 URLs** |
| Prod database row counts | 340 cities total, **0 with `is_published = true`**; 41 articles published & indexable |

### Root cause
**It was a data problem, not a code problem.**
`app/sitemap.ts` correctly calls `storage.getCities(true)` (only-published) and filters out rows where `allow_indexing = false`. Because every one of the 340 city rows in prod had `is_published = false`, the sitemap legitimately contained **zero `/locations/...` URLs**. Google was crawling exactly what we told it existed.

### Secondary smells (worth noting, not the root cause)
1. `/sitemap.xml` ships with `cache-control: private` (Next.js default for dynamic metadata routes). Googlebot still fetches it, but `public, max-age=300` is more correct.
2. Article slugs still contain the legacy `tableicity-...` prefix. Once Google indexes a URL, it's permanent — every indexed article on `investorensights.com` becomes a `tableicity-*` URL forever unless we add redirects.

---

## 2. The new feature — granular Index/NoIndex control

The fix isn't "publish everything and hope." A publisher needs the ability to:
- Mark a city/article **NoIndex** while still keeping it published (e.g., thin content, duplicate, regional placeholder).
- Mark something **Index** only after it's been Published (you can't tell Google to index a draft).
- Do both per-row and in bulk.

### Two independent boolean concepts

| Concept | Field | Purpose |
|---|---|---|
| **Published** | `city_locations.is_published` / `knowledge_articles.status === 'published'` | Is this row reachable on the public site? |
| **Indexable** | `city_locations.allow_indexing` / `knowledge_articles.robots` (contains "noindex" or not) | Should Google add it to its index? |

**Rule (enforced in 3 places):** `Indexable = true` requires `Published = true`. NoIndex on an unpublished row is meaningless but allowed (it's the safe default).

---

## 3. Where the new controls live

### Cities — `/admin/cities`

**Table** (column order, left to right):

| # | Column | Notes |
|---|---|---|
| 1 | Checkbox | Bulk select |
| 2 | City | Display name |
| 3 | State | 2-letter code |
| 4 | Status | `Published` / `Draft` badge |
| 5 | Coordinates | Lat/long or `--` |
| 6 | Slug | URL-safe identifier |
| 7 | **Index** *(NEW)* | Per-row toggle button |
| 8 | Actions | Edit / Delete / View |

**Toolbar** (visible when ≥1 row checked):

`Publish` · `Unpublish` · `[Template selector] Apply Template` · **`Index`** *(NEW)* · **`NoIndex`** *(NEW)* · `Clear`

### Articles — `/admin/knowledge` (both Pending and Published views)

**Table** (column order):

| # | Column | Notes |
|---|---|---|
| 1 | Checkbox | Bulk select |
| 2 | Headline | Stripped of HTML |
| 3 | Slug | URL-safe identifier |
| 4 | **Index** *(NEW)* | Per-row toggle button |
| 5 | Status | `pending` / `published` / `archived` badge |
| 6 | Freshness | Stale/fresh indicator |
| 7 | Modified | Last update date |
| 8 | Actions | View / Edit / Regen / Publish / Unpublish / Archive |

**Toolbar** (visible when ≥1 article checked):

`Publish Selected` · `Unpublish Selected` · **`Index`** *(NEW)* · **`NoIndex`** *(NEW)* · `Archive Selected` · `Restore Selected` · `[Template selector] Apply Template`

---

## 4. The per-row badge button — visual states

The toggle is rendered as a small pill button inside the **Index** column.

| State | Visual | Click behavior |
|---|---|---|
| Published + Index | Green border + ShieldCheck icon + "Index" | Flips to NoIndex (no friction) |
| Published + NoIndex | Amber border + ShieldOff icon + "NoIndex" | Flips to Index |
| **Draft + NoIndex** | Amber pill with `opacity-60` + `aria-disabled` | Click is intercepted → destructive toast: **"Publish first — Only Published rows can be flipped to Index."** |
| Draft + Index | (Cannot occur — guard prevents it) | — |

The pill is intentionally **clickable** even when locked so the publisher gets the toast explanation rather than a silent dead button. This was a deliberate UX choice from an earlier iteration of this pattern in the Tableicity codebase.

---

## 5. Bulk action workflow

Both pages follow the same pattern:

1. Publisher checks one or more rows (checkbox column).
2. The toolbar appears at the top with the selected count.
3. Publisher clicks **Index** or **NoIndex**.
4. The request is fired to the bulk endpoint.
5. The server filters to eligible rows (must be Published for `index`).
6. Toast reports `{applied} indexed` or `{applied} indexed, {skipped} skipped (must be Published to Index)`.
7. The cities/articles list is invalidated and refetched.

**No client-side filtering is trusted.** The eligibility filter runs server-side. The client only contributes the selected ID list.

---

## 6. Granular API contracts

### Cities — bulk

`POST /api/admin/bulk-update`

```json
// Set Index on selected cities (skips non-published server-side)
{ "cityIds": ["uuid1", "uuid2"], "action": "index" }

// Set NoIndex on selected cities (no eligibility filter)
{ "cityIds": ["uuid1", "uuid2"], "action": "noindex" }

// Pre-existing actions (unchanged):
{ "cityIds": [...], "action": "publish" }
{ "cityIds": [...], "action": "unpublish" }
{ "cityIds": [...], "action": "assign_template", "templateId": "uuid" }
```

**Response**: `{ "success": true, "applied": 17, "skipped": 3 }`
The `skipped` field is non-zero only when `action === "index"` and some IDs were not Published.

### Cities — per-row

`PATCH /api/admin/cities/{id}`

The toggle sends a **minimal payload** to avoid triggering geocoding side effects:

```json
{ "allowIndexing": true, "latitude": "...", "longitude": "..." }
```

Server-side guards (in this order):
1. `typeof allowIndexing !== "boolean"` → **400 Bad Request**
2. `typeof isPublished !== "boolean"` (when present) → **400 Bad Request**
3. `allowIndexing === true` AND city not published → **409 Conflict** with message *"Cannot enable Index on a non-published city. Publish the city first, then flip Index."*

### Articles — bulk

`POST /api/admin/knowledge/bulk-index`

```json
{ "articleIds": ["uuid1", "uuid2"], "action": "index" | "noindex" }
```

**Response**: `{ "success": true, "applied": 12, "skipped": 5 }`

When `action === "index"`, the endpoint loads each article and skips any whose `status !== "published"`. The `applied` count is the number actually written; `skipped` includes both not-found and non-published rows.

Storage writes one of two canonical robots strings:
- Index → `"index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"`
- NoIndex → `"noindex, nofollow"`

### Articles — per-row

`PATCH /api/admin/knowledge/{id}`

The toggle sends only:
```json
{ "robots": "index, follow, ..." }   // or "noindex, follow"
```

Server-side guard (already existed before this feature):
- If incoming `robots` does NOT contain `"noindex"` (i.e., user wants Index) AND the article is not `status: "published"` → **409 Conflict**.

---

## 7. Files touched

```
NEW:
  app/api/admin/knowledge/bulk-index/route.ts   ← bulk Index/NoIndex for articles

EDITED (backend):
  app/api/admin/bulk-update/route.ts            ← added "index" / "noindex" actions for cities
  app/api/admin/cities/[id]/route.ts            ← per-row guard + boolean validation

EDITED (frontend):
  app/admin/cities/page.tsx                     ← new column, toolbar buttons, two new mutations
  app/admin/knowledge/page.tsx                  ← new column, toolbar buttons, two new mutations
```

No schema migration required — the underlying columns (`city_locations.allow_indexing`, `knowledge_articles.robots`) already existed and were already user-editable through the row-edit dialog. This feature surfaces them in the table for at-a-glance visibility and bulk control.

---

## 8. How the sitemap consumes this

`app/sitemap.ts`:

```ts
const [cities, pages, articles] = await Promise.all([
  storage.getCities(true),                    // is_published = true ONLY
  storage.getCustomPagesPublished(),
  storage.getKnowledgeArticlesByStatus("published"),
])

const cityEntries = cities
  .filter((c) => c.allowIndexing !== false)   // also drop NoIndex cities
  .map((c) => ({ url: `${BASE_URL}/locations/${c.slug}`, ... }))

const articleEntries = articles
  .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
  .map((a) => ({ url: `${BASE_URL}/discovery/knowledge/${a.slug}`, ... }))
```

So a row appears in `/sitemap.xml` if and only if:
- **City**: `is_published = true` AND `allow_indexing = true`
- **Article**: `status = 'published'` AND `robots` does not contain `"noindex"`

This matches what the new admin toggle controls. **Publishing a city with NoIndex on means the page is reachable by direct URL but Google is told not to index it.**

---

## 9. Recommended workflow for the publisher

1. Triage city quality. Bulk-select the cities you trust → click **Publish**.
2. Bulk-select the same cities → click **Index**. (You can do this in either order; the server enforces the rule either way.)
3. For lower-quality cities you still want to publish (for direct links / internal use): leave them **Published + NoIndex**.
4. Wait for the scheduler / regeneration to refresh the sitemap, OR redeploy to force a fresh sitemap.
5. Resubmit the sitemap in Google Search Console.

For articles, the same flow: Publish first, then Index. The bulk **Index** button auto-skips Pending articles and tells you how many it skipped.

---

## 10. Known gaps / things deliberately not done

| Gap | Why deferred |
|---|---|
| TOCTOU race: two admins simultaneously unpublishing + indexing the same row could leave it in an inconsistent state. | Single-admin tool; near-zero real-world risk. Fix would require a new `updateCityWithCondition()` storage method using a SQL `WHERE` clause. |
| Sitemap ships with `cache-control: private`. | Cosmetic; Googlebot still crawls. Easy follow-up. |
| Article slugs still prefixed `tableicity-...` | Permanent once indexed. Needs a separate "rewrite slug + 301 redirect" migration before a large bulk-publish. |
| Sitemap is eventually-consistent (Next.js revalidate). | Documented in `replit.md`; redeploy to force-refresh. |

---

## 11. Test IDs (for E2E remix work)

```
Cities:
  toggle-index-{slug}                  per-row Index/NoIndex pill
  button-bulk-index                    toolbar Index button
  button-bulk-noindex                  toolbar NoIndex button

Articles:
  toggle-index-{articleId}             per-row Index/NoIndex pill
  button-bulk-index                    toolbar Index button
  button-bulk-noindex                  toolbar NoIndex button
```

---

*Last updated: 2026-05-06 — covers the per-row + bulk Index/NoIndex feature shipped in commit `0cf0e56`.*
