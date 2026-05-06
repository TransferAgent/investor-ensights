# Site Map & Indexing — Handover

> Audience: the Tableicity remix (and anyone porting this work back to the parent codebase).
> Scope: how indexing flows from the database → sitemap → Google, the new admin UX (per-row toggle + bulk actions) that lets a publisher control indexing without touching SQL, and the **two-phase scale plan** for the sitemap itself.

---

## 0. Two-phase strategy at a glance

| Phase | Trigger to enter | What it covers | Status |
|---|---|---|---|
| **Phase 1 — current** | 0 → ~5,000 articles | Data-correctness, admin Index/NoIndex controls, basic Next.js metadata-route sitemap | ✅ **Live in prod** |
| **Phase 2 — scale** | When indexed URLs exceed ~5,000, **or** when crawler load becomes visible in logs, **or** when you need fine-grained HTTP cache control | Convert `app/sitemap.ts` → `app/sitemap.xml/route.ts` (route handler), explicit `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`, prepare for sitemap-index split, optional gzip | 🟡 **Deferred** — see §12 |

Phase 1 is sufficient for "several months" at the current growth rate. Phase 2 is a 15–30 min upgrade with a clean migration path; revisit when article count clears ~5K or you want CDN-level caching.

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

### Root cause (resolved as of 2026-05-06)
**It was a data problem, not a code problem.** `app/sitemap.ts` correctly calls `storage.getCities(true)` (only-published) and filters out rows where `allow_indexing = false`. Because every one of the 340 city rows in prod had `is_published = false`, the sitemap legitimately contained zero `/locations/...` URLs.

**Resolution path taken**: Cities are intentionally NoIndex by design — *articles* are the platform's product, cities are the geographic anchor / data scaffold for article generation. The publisher confirmed all 340 cities should remain NoIndex. Sitemap is correct.

### Final reconciled state (post-deploy, commit `77a2c28`)

| Bucket | Sitemap | DB truth | Match |
|---|---|---|---|
| Articles | 41 | 41 published & indexable | ✓ |
| Cities | 0 | 0 indexable (340 NoIndex by design) | ✓ |
| Home + Terms + Privacy + Site-map | 4 | — | — |
| **Total URLs** | **45** | — | — |

---

## 2. The new feature — granular Index/NoIndex control

The fix isn't "publish everything and hope." A publisher needs the ability to:
- Mark a city/article **NoIndex** while still keeping it published (e.g., thin content, duplicate, regional placeholder, or — as in this deployment — entire-table-by-design).
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
  app/sitemap.ts                                ← Phase 1 caching tweaks (revalidate=300, fixed static lastmod, dynamic home lastmod)

EDITED (frontend):
  app/admin/cities/page.tsx                     ← new column, toolbar buttons, two new mutations
  app/admin/knowledge/page.tsx                  ← new column, toolbar buttons, two new mutations
```

No schema migration required — the underlying columns (`city_locations.allow_indexing`, `knowledge_articles.robots`) already existed and were already user-editable through the row-edit dialog. This feature surfaces them in the table for at-a-glance visibility and bulk control.

---

## 8. How the sitemap consumes this (Phase 1 — current)

`app/sitemap.ts` (Next.js metadata route, returns `MetadataRoute.Sitemap`):

```ts
export const revalidate = 300                   // ISR — regenerate at most every 5 min

const [cities, pages, articles] = await Promise.all([
  storage.getCities(true),                      // is_published = true ONLY
  storage.getCustomPagesPublished(),
  storage.getKnowledgeArticlesByStatus("published"),
])

const cityEntries = cities
  .filter((c) => c.allowIndexing !== false)     // also drop NoIndex cities
  .map((c) => ({ url: `${BASE_URL}/locations/${c.slug}`, ... }))

const articleEntries = articles
  .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
  .map((a) => ({ url: `${BASE_URL}/discovery/knowledge/${a.slug}`, ... }))
```

So a row appears in `/sitemap.xml` if and only if:
- **City**: `is_published = true` AND `allow_indexing = true`
- **Article**: `status = 'published'` AND `robots` does not contain `"noindex"`

`<lastmod>` strategy:
- Static pages (`/`, `/terms`, `/privacy`, `/site-map`) use a **fixed timestamp constant** so they don't generate noisy "freshness" signals on every request.
- The home page `<lastmod>` is computed as `max(updatedAt)` across all sitemap entries — gives Google a real signal whenever any article changes.
- Per-URL `<lastmod>` for articles/cities comes from each row's `updatedAt`.

**Phase 1 known limitation (acceptable):** The response ships with `cache-control: private, max-age=0, must-revalidate`. Next.js metadata routes don't reliably propagate `revalidate` into HTTP headers when the route reads from a database, and Replit Deployments' frontend defaults to `private` for dynamic responses. **Practical impact: none** — Googlebot crawls regardless of cache headers, and at <5K URLs the per-request regeneration cost is negligible. Phase 2 fixes this if/when it matters.

---

## 9. Recommended workflow for the publisher

1. Triage city quality. Bulk-select the cities you trust → click **Publish**.
2. Bulk-select the same cities → click **Index**. (You can do this in either order; the server enforces the rule either way.)
3. For lower-quality cities you still want to publish (for direct links / internal use): leave them **Published + NoIndex**.
4. Wait for the scheduler / regeneration to refresh the sitemap, OR redeploy to force a fresh sitemap.
5. Resubmit the sitemap in Google Search Console.

For articles, the same flow: Publish first, then Index. The bulk **Index** button auto-skips Pending articles and tells you how many it skipped.

**Note specific to this deployment:** Cities are intentionally NoIndex across the board. The publisher's path-to-Index is *articles only*. Steps 1–2 above apply when/if that policy ever changes.

---

## 10. Phase 1 known gaps (deliberately deferred)

| Gap | Why deferred | Resolved by |
|---|---|---|
| TOCTOU race: two admins simultaneously unpublishing + indexing the same row could leave it in an inconsistent state. | Single-admin tool; near-zero real-world risk. Fix would require a new `updateCityWithCondition()` storage method using a SQL `WHERE` clause. | Future hardening |
| Sitemap ships with `cache-control: private`. | Cosmetic at <5K URLs; Googlebot still crawls. | **Phase 2** (§12) |
| Sitemap is eventually-consistent (Next.js revalidate). | Documented in `replit.md`; redeploy to force-refresh. | Phase 2 makes this CDN-cached but still 5-min eventually-consistent by design |
| No sitemap index split. | Single `<urlset>` is fine up to 50,000 URLs / 50 MB per Google spec. | **Phase 2** (§12) when crossing ~5K URLs |
| No gzip compression. | XML at 41 URLs is ~6 KB; gzip saves nothing meaningful. | **Phase 2** (§12) when sitemap exceeds ~500 KB |

> **Out of scope (intentional, not gaps):** Article slugs containing `tableicity-...` tokens are working as designed — they include intentional internal backlinks to Tableicity city pages. Slugs are off-limits.

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

## 12. Phase 2 — scale plan (when to trigger and what to do)

### When to trigger

Pull the trigger on Phase 2 when **any one** of these is true:

1. **Indexed URL count crosses ~5,000.** Per-request regeneration starts to cost real CPU; CDN edge caching becomes worthwhile.
2. **Crawler load becomes visible** in Replit Deployments logs (e.g., Googlebot fetches `/sitemap.xml` >100×/hour, or response times start drifting >500 ms).
3. **You need to set custom HTTP headers** (e.g., `X-Robots-Tag`, hreflang index, `<image:image>` namespaces) that Next.js's metadata-route helper doesn't expose.
4. **Approaching the 50,000 URL / 50 MB hard limit** of a single sitemap (Google's spec). Below this, a single file is fine; at this point, an index is mandatory.

### Phase 2A — Route-handler migration (~15 min)

**Goal**: Move from Next.js's metadata convention to a hand-rolled route handler so we own headers and output completely.

1. **Create** `app/sitemap.xml/route.ts` returning a `Response` with:
   ```ts
   return new Response(xmlString, {
     status: 200,
     headers: {
       "Content-Type": "application/xml; charset=utf-8",
       "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
       "X-Robots-Tag": "noindex",   // hide the sitemap itself from search results
     },
   })
   ```
2. **Move** the entry-collection logic (cities/pages/articles fetch + filter) verbatim from `app/sitemap.ts`. No business-logic changes.
3. **Hand-render the XML** (small helper, ~30 lines): `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">…</urlset>`.
4. **Delete** `app/sitemap.ts` in the **same commit** to avoid Next.js registering both routes simultaneously (this is the only real risk in the migration).
5. **Verify** with `curl -I https://investorensights.com/sitemap.xml` — header should now show `cache-control: public, s-maxage=300, stale-while-revalidate=3600`.
6. **Verify URL count is unchanged** (should still match `Phase 1` reconciliation table from §1).

### Phase 2B — Sitemap index split (~30 min, only when >5K URLs)

When article count approaches 50K (or you simply want logical separation):

1. **Promote** `app/sitemap.xml/route.ts` to return a sitemap **index** (`<sitemapindex>` listing child sitemaps).
2. **Add** `app/sitemap-articles.xml/route.ts`, `app/sitemap-cities.xml/route.ts`, `app/sitemap-static.xml/route.ts` as separate route handlers.
3. **Optional**: paginate articles when a single child sitemap approaches 50K URLs (`/sitemap-articles-1.xml`, `/sitemap-articles-2.xml`).
4. **Update** `app/robots.ts` to point at the new index URL (it already points at `/sitemap.xml`, so no change needed if you keep the same name).
5. **Resubmit** in Google Search Console.

### Phase 2C — Gzip compression (~5 min, only when sitemap >500 KB)

1. In the route handler, gzip the XML body and emit `Content-Encoding: gzip` when the request `Accept-Encoding` includes `gzip`. Most CDN/edge layers handle this automatically — only do it manually if Replit's frontend doesn't.

### What Phase 2 does NOT change

- Database schema, admin UX, API contracts, per-row Index/NoIndex behavior — all stay identical.
- Filtering rules (Published + Indexable) — unchanged.
- The sitemap's *content* — stays semantically identical to Phase 1.

### Migration risk checklist

| Risk | Mitigation |
|---|---|
| Both `app/sitemap.ts` and `app/sitemap.xml/route.ts` registered → nondeterministic responses | Delete `app/sitemap.ts` in the **same commit** as the route handler is added. Verify with build log. |
| Lose Next.js's `MetadataRoute.Sitemap` typing | Acceptable — replaced by a small typed XML helper. |
| Replit Deployments edge layer ignores `s-maxage` | Verify with `curl -I` after deploy. If ignored, falls back to Next.js in-process ISR (still better than current). |
| `robots.txt` references stale URL | `app/robots.ts` already references `/sitemap.xml` — same path works for both. No edit needed. |

---

*Last updated: 2026-05-06 — Phase 1 live in prod (commit `77a2c28`). Phase 2 deferred until article count crosses ~5K or other §12 trigger fires.*
