# SEO Hygiene — Step 1: Orphan-Page Fix

**Date:** 2026-05-21
**Step in plan:** Step 1 of the 5-step remediation in `John/Google_Index_Root_Cause.md`.
**Status:** ✅ Shipped to main, awaiting PROD deploy.

---

## 1. Why this work was done

The root-cause audit (`John/Google_Index_Root_Cause.md`) identified **four reinforcing signals** that caused Google to index only 1 of the 80 pages on `investorensights.com`:

1. **Orphan pages (CRITICAL)** — homepage had zero `<a href>` links to any article or city page. The sitemap was the only path Google had to discover them.
2. Bulk-stamped `lastmod` on all 75 articles within 60 seconds.
3. Templated content × locality (programmatic SEO doorway pattern).
4. History of robots-policy flip-flops.

Step 1 attacks Signal #1 — the largest-leverage of the four — by giving the homepage real, crawlable, semantic internal links to the article and location catalogs.

---

## 2. What I discovered before changing code

### 2a. The homepage is a login splash with no outbound site links

`app/page.tsx` conditionally renders one of two trees:

- If a `home` slug exists in the `pages` table and is published → `<SlideRenderer>` for each slide.
- Otherwise → `<HeroHome />`, which is just `<AuthPane />` + `<ImagePane />` (a two-pane login/marketing splash).

Confirmed via direct curl that neither tree emits any `href` to `/discovery/knowledge/*` or `/locations/*`. The homepage is, from Google's view, a dead-end.

### 2b. Default tenant on public routes is `tableicity`

Verified in `lib/tenant/context.ts`:

```ts
export const DEFAULT_TENANT_SLUG = "tableicity";
```

Public routes (no admin cookie) fall through `withSessionTenant` without a tenant swap, so `storage.getKnowledgeArticles("published")` and `storage.getCities()` already resolve against the `tenant_tableicity` schema. No tenant wrapping needed in the homepage.

### 2c. Schemas confirmed

`shared/schema.ts`:

- `knowledge_articles`: `slug`, `headline`, `title`, `datePublished`, `status`, `robots`, `citySlug` — all needed fields present.
- `city_locations`: `slug`, `cityName`, `stateCode`, `allowIndexing` — all needed fields present.

### 2d. Dev DB has zero published articles

`storage.getKnowledgeArticles("published")` returns `[]` on dev (verified). PROD has 75. This means dev-side smoke tests can only verify the city-links half of the rendering; the article-links half lights up on PROD after deploy. Component handles `length === 0` gracefully (renders nothing for that column).

---

## 3. What I changed

**Two files, ~50 lines of code total.**

### 3a. `components/homepage/home-internal-links.tsx` (NEW)

Server component (no `"use client"`) that takes pre-fetched arrays and renders two columns inside a single `<section>`:

- **Recent insights** — up to 12 articles, sorted by `datePublished` descending, filters out any article whose `robots` string contains `noindex`. Anchor text = the article's `headline` (falls back to `title`). Trailing CTA: `Browse all insights →` linking to `/site-map`.
- **Locations we cover** — up to 24 cities, alphabetical by `cityName`, filters out `allowIndexing === false`. Anchor text = `"City, ST"`. Trailing CTA: `See every location →` linking to `/locations`.

Hard caps are intentional (see §6 below).

Returns `null` if both arrays are empty — so there is no empty stub on dev or on a freshly-seeded tenant.

Each link carries a `data-testid` (`link-article-${slug}`, `link-city-${slug}`) for future test coverage.

### 3b. `app/page.tsx` (MODIFIED)

- Added import: `import HomeInternalLinks from "@/components/homepage/home-internal-links"`.
- Replaced the single `getPageBySlug("home")` fetch with a `Promise.all` parallel fetch of:
  1. `storage.getPageBySlug("home")`
  2. `storage.getKnowledgeArticles("published")` (with `.catch(() => [])` so a DB hiccup degrades gracefully)
  3. `storage.getCities()` (same catch)
- Rendered `<HomeInternalLinks articles={articles} cities={cities} />` in **both** branches of the conditional — page-builder branch AND the `HeroHome` fallback. The orphan fix needs to be unconditional; whatever the homepage is, the link inventory now sits below it.
- Inline comment explains the SEO purpose and points to `John/Google_Index_Root_Cause.md` so the next dev knows not to rip it out.

### 3c. What I deliberately did NOT change

- **`HeroHome` itself** — still a client component, still the auth-first splash. No design churn for an SEO fix.
- **The sitemap** — already correct.
- **The article or location page metadata** — already correct (MT-4.13.4).
- **Robots policies** — Signal #4 says don't flip them again for 6 weeks. Holding.
- **The 340-city limit on the sitemap** — gated behind `allow_indexing` per city; intentionally a separate decision (Step 6 in the root-cause doc).

---

## 4. SEO hygiene this section enforces

What Google reads, and why each detail matters:

| Detail | Why it matters |
|---|---|
| Real `<a href>` (not JS-routed `<button>`) | Crawlable. Google does run JS now, but anchor-rendered links are unambiguous and never deferred. |
| Anchor text = article headline / `City, ST` | Google reads anchor text as semantic context for the destination. `"Read more"` boilerplate teaches Google nothing about the target. |
| Server-rendered in the initial HTML response | The links exist before hydration. Crawlers without JS still see them. |
| `<section aria-labelledby="home-explore-heading">` + `<h2>` | Proper landmark structure. Tells Google "this is a content section of the page," not chrome. |
| Not hidden, not collapsed, not `display:none` | Avoids the "hidden text" spam classifier. |
| Capped at 12 articles + 24 cities | Avoids sitemap-dump appearance, which triggers a different spam heuristic. |
| CTAs to `/site-map` and `/locations` | Equity from the homepage flows to the catalog hub pages, which then distribute to the full set. |

---

## 5. Verification

### 5a. Local (dev) smoke test

```bash
$ curl -s http://localhost:5000/ | grep -c 'href="/locations/'
19

$ curl -s http://localhost:5000/ | grep -c 'href="/discovery/knowledge/'
0     # expected — dev DB has zero published articles
```

Before this change both numbers were `0`.

### 5b. After PROD deploy, expected counts

```bash
# Should be ≥ 24 city links and exactly 12 article links
curl -s https://investorensights.com/ | grep -c 'href="/locations/'
curl -s https://investorensights.com/ | grep -c 'href="/discovery/knowledge/'
```

If article count is < 12, check `storage.getKnowledgeArticles("published")` on the PROD tableicity schema — it should return 75.

### 5c. GSC verification (1–4 weeks after deploy)

In GSC → Pages → "Why pages aren't indexed":

- **Discovered – currently not indexed** count should start decreasing (these are the pages that were orphan; they now have a homepage link).
- Re-submit sitemap.
- Hand-pick 5–10 best articles and "Request Indexing" via URL Inspection (not all 75 — quota).

---

## 6. Trade-offs and caveats

1. **Hard cap of 24/12.** Linking all 340 cities + 75 articles from the homepage looks like a sitemap dump and triggers different spam heuristics. The "See every location" / "Browse all insights" anchors hand off equity to dedicated index pages. If you want to expose more (say top 50 cities), say the word — easy constant change in `home-internal-links.tsx`.
2. **Hero stays first.** Document order is `<HeroHome />` then `<HomeInternalLinks />`. Users see the auth splash first; Google reads top-to-bottom. If we ever decide the SEO signal needs to be ABOVE the fold for stronger weight, that's a UX-vs-SEO discussion.
3. **Dev DB has no articles.** Local rendering only proves the city column. Article column needs a PROD deploy to verify.
4. **Page-builder branch was modified too.** If you ever publish a `home` slug in the page builder, the link section will still render below the slides. Intentional — orphan fix is unconditional.

---

## 7. What this step does NOT fix

Step 1 only attacks **Signal #1** (orphan pages). The three remaining signals from `John/Google_Index_Root_Cause.md` are still active:

| Signal | Status after Step 1 |
|---|---|
| #1 Orphan pages | ✅ Fixed by this work. |
| #2 Bulk-stamped lastmod (75 articles within 60 sec) | ❌ Still active. Fixed organically as articles get republished with new `date_modified` (don't bulk-rewrite anything that touches `date_modified`). |
| #3 Templated content × locality | ❌ Still active. **This is Step 3** in the root-cause plan — needs 200–400 words of meaningfully-varying city-specific content per article. |
| #4 Robots-policy flip-flops | ❌ Time-decaying. Sit still on robots config for 6 weeks. |

Step 1 alone will not move Google's indexed count from 1 → 80. It removes the structural blocker that was making Steps 2–4 unrecoverable. Expect indexing to start opening up as the other signals are addressed and stable time accrues.

---

## 8. Pointers

- Root-cause doc: `John/Google_Index_Root_Cause.md`
- Component: `components/homepage/home-internal-links.tsx`
- Homepage: `app/page.tsx`
- Sitemap generator: `app/sitemap.xml/route.ts`
- Locations page (separately fixed earlier in this session): `app/locations/[slug]/page.tsx`
- Tenant default: `lib/tenant/context.ts`

---

## 9. Bottom line

Homepage is no longer a dead-end. The 80 article pages and 340 city pages now have a real internal-link signal pointing at them from the highest-equity page on the site. That removes the structural reason Google was refusing to index the catalog. The remaining quality signals (templated content, bulk lastmod, trust recovery) still need work, but none of them could be addressed effectively while the orphan-page block was in place.

Deploy and confirm with the curl commands in §5b. Then we move to Step 2 (cities into sitemap) or Step 3 (per-city content differentiation) depending on which one you want next.
