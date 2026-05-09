# Recovery_Google.md

**Purpose:** Portable runbook for recovering a site whose SEO indexability has been silently poisoned by a "mass-flip noindex baseline" sweeper endpoint. Written after running this exact recovery on Tableicity prod (May 2026). Carry to Remix or any sister project that shares the same code lineage.

**Audience:** You, the owner, working with an agent. Non-technical user, plain language, gate-by-gate pacing, ask before destructive actions, forward-only.

---

## 1. What happened (the incident pattern)

A well-intentioned admin endpoint was built to "park unprotected pages to noindex" by mass-mutating the `robots` field on knowledge articles and the `allowIndexing` boolean on city rows. The endpoint accepted an allowlist of "protected" slugs and flipped everything else to noindex in a single transaction.

**The damage:** even when fired only once or twice, the endpoint silently parked hundreds of published pages to noindex. They continued to render to humans normally but told Google "do not index me." Google's Search Console showed them as "Excluded by 'noindex' tag" within days. Sitemap inclusion logic also filtered them out, so Google had two independent signals that these pages were intentionally dark.

**Why it was hard to spot:**
- Pages still rendered fine to logged-in admins
- Pages still appeared in admin tables as "published"
- The damage only showed up in Google Search Console (delayed by days), in `view-source:` on each page, or by counting entries in `sitemap.xml`
- The destructive endpoint was a single button on the admin dashboard with no confirmation modal

---

## 2. Bug pattern to hunt for in your codebase

Search for these patterns. If you find any, you have the same bug class.

### Surface 1: a "noindex baseline" route
Look for files matching:
- `app/api/admin/seo/apply-noindex-baseline/route.ts`
- `app/api/admin/**/noindex*/route.ts`
- Any route that does a single bulk `UPDATE knowledge_articles SET robots = ...` or `UPDATE city_locations SET allow_indexing = false` without per-row gating

And the UI card that fires it:
- `NoindexBaselineCard` component in `app/admin/page.tsx` (or any admin dashboard root)
- Any button labeled "Apply Noindex Baseline", "Park Unprotected", "Mass Park to Noindex", etc.

### Surface 2: a "SEO Visibility" tab
Look for:
- `app/api/admin/knowledge/seo-visibility/preview/route.ts`
- `app/api/admin/knowledge/seo-visibility/apply/route.ts`
- `app/api/admin/knowledge/seo-visibility/protected-list/route.ts`
- `SeoVisibilitySection` component (typically rendered as a tab inside `app/admin/knowledge/page.tsx`)
- A `TabType` union that includes `"seo-visibility"`

This second surface is the same destructive capability with a different UI: paste a list of "keep indexable" slugs, click apply, everything else gets parked.

### Surface 3 (keep, don't delete): the reverse safety endpoint
- `app/api/admin/seo/apply-index-baseline/route.ts`

This one only flips a small hardcoded `PROTECTED_*_SLUGS` allowlist back to indexable. It cannot widen damage — leave it intact. It's the safety pair to the destructive sweeper and remains useful for emergency restoration of known-critical pages.

### Search commands
```
rg -ln 'noindex.baseline|seo-visibility|NoindexBaselineCard|SeoVisibilitySection|park.*unprotected'
find app/api -type d -name '*noindex*' -o -name '*seo-visibility*' -o -name '*baseline*'
```

---

## 3. The fix (the deletes you make)

Forward-only. Do not refactor, do not "fix" the sweepers — delete them entirely. Per-row toggles in the admin UI remain the only way to flip indexability, so a single click can never poison the whole catalog again.

### Files to delete
1. The route file(s) for any noindex baseline or seo-visibility endpoint (entire `route.ts`)
2. Recursively delete the route directory if no siblings remain
3. The UI card component(s) that fire them
4. Any tab wiring in admin pages — remove from `TabType` union, remove the tab button + label + icon, remove the `<Component />` render gate, remove now-unused imports (especially lucide-react icons)
5. Any TypeScript type definitions that only fed the deleted UI (e.g. `PreviewResp`, `FlipItemArticle`, `FlipItemCity`)

### Files to KEEP intact
- `apply-index-baseline` route (safety reverse)
- `config/protectedSlugs.ts` (consumed only by the safety reverse)
- All per-row PATCH routes for cities and articles
- All bulk publish/unpublish/restore/delete routes (these mutate `status`, not `robots`/`allowIndexing` — non-destructive to indexability)

### Document in your project README / replit.md
Add a permanent forward-only ban:
> **Re-introducing a "park-everything-to-noindex" sweeper is forbidden.** Flips must be per-row (existing checkbox toggles in `/admin/cities` and `/admin/knowledge`) so a single click can't poison the whole catalog.

---

## 4. The 7-step recovery plan

Follow in order. Do not skip steps. The user (you) controls every data flip — the agent only deletes code.

### Step 1: Remove first sweeper
Delete the noindex baseline route + its UI card + any references. Run a code review. Do not deploy yet.

### Step 2: Remove second sweeper
Delete the seo-visibility route directory + its tab component + tab wiring + types + unused imports. Run a code review. Do not deploy yet.

**Why split 1 and 2 across two steps:** smaller diffs are easier to review and roll back independently.

### Step 3: Raise the bulk action cap (if needed)
Check the bulk routes (`bulk-publish`, `bulk-unpublish`, `bulk-restore`, `bulk-delete` for articles; cities equivalents if they exist). If they cap at a number lower than your full catalog size (the original Tableicity cap was 100 articles, catalog was 683), raise the cap so you can process the full catalog in one click during step 4. Suggested: 1000.

**You then deploy.** Steps 1–3 must be in prod before step 4 — otherwise the destructive endpoints still exist on the live site and the bulk caps will block you.

### Step 4: Manually unpublish ALL cities and ALL articles in prod
Use the existing per-row bulk publish/unpublish UI (now uncapped). This sets `isPublished=false` on cities and `status='pending'` on articles. Both filters exclude these rows from the sitemap regardless of any indexability flag — this is the cleanest possible "known dark" baseline.

**Why unpublish instead of "flip to noindex":** unpublished rows are excluded from sitemap by status alone. You don't depend on the (potentially still-poisoned) `robots` / `allowIndexing` flags being correct. Fewer ways for stale state to hurt you.

### Step 5: Audit the per-row indexability pipeline
**This is read-only — no code or data changes.** The agent traces these end-to-end:

1. Per-row PATCH routes for cities and articles — confirm `isPublished`, `allowIndexing`, `robots` write through correctly
2. Public page meta tags — confirm `<meta name="robots">` reflects DB state correctly
3. Sitemap inclusion logic — confirm filters match meta-tag logic (a sitemap that says "include" while meta says "noindex" is the bug class that makes Google freak out)
4. Schema defaults — `allowIndexing` defaults true, `robots` defaults to a healthy "index, follow, ..." string
5. CSV importer / row-create defaults — defaults to indexable
6. Hidden write paths — newsroom auto-publisher, scheduler, content studio, cron jobs. Confirm none silently flip rows to noindex
7. Confirm zero mass-flip endpoints exist (the deletes from steps 1–2 didn't get reverted)

**Output:** PASS or a list of bugs found.

### Step 6: Publish (only if step 5 found bugs)
If bugs found: agent fixes, you deploy, then proceed to step 7. If PASS: skip step 6 entirely.

### Step 7: Manually re-publish the rows you actually want indexed
In `/admin/cities` and `/admin/knowledge`, use the per-row publish toggles to bring select cities and articles back online. Hand-pick — this is the entire point of the recovery: you never again let a single click decide what Google sees.

**Verify after each batch:** pull `https://your-domain/sitemap.xml` and count entries. The count should match what you published.

---

## 5. Two things to know before you re-publish (step 7)

These are findings from the Tableicity audit. Verify they hold in your codebase.

### A. For ARTICLES: publishing self-heals robots
The `publishKnowledgeArticle` function in `lib/storage.ts` (or your equivalent storage layer) should hardcode `robots: "index, follow, max-snippet:-1, ..."` on every publish. If yours does too, this means:

- Hitting Publish on an article — even one whose `robots` field still says "noindex" from the old sweeper damage — automatically wipes the noindex
- **Do not also flip the robots/Index column manually first.** The PATCH route's defensive 409 guard will reject `robots=index` on a non-published row

Verify in your code:
```
rg -n 'publishKnowledgeArticle' lib/storage.ts
```
Look for `robots: "index, follow, ..."` inside the publish function's update payload.

### B. For CITIES: publishing alone is NOT enough
There is no equivalent self-heal on the city publish path. `isPublished` and `allowIndexing` are independent flags. The sweeper damage on cities was via `allowIndexing=false`, and that flag is unchanged by the publish action.

So for each city you re-publish: **also confirm the Index checkbox is checked.** Recommend doing both flips in the same edit.

---

## 6. Verification after recovery

### Immediately
- Pull `https://your-domain/sitemap.xml` — total URL count should equal: (re-published cities) + (re-published articles) + (static pages: home, privacy, terms, etc.)
- View source on a re-published city page and a re-published article page — confirm `<meta name="robots" content="index, follow, ...">`. No "noindex" anywhere

### Over the next 1–4 weeks
- Google Search Console → Pages report
- Previously-affected URLs should move from "Excluded by 'noindex' tag" → "Indexed" (or "Discovered but not yet indexed")
- The URL Inspection tool lets you nudge specific URLs into the queue (~10/day quota)

---

## 7. The forward-only ban (write this into your replit.md)

> **Re-introducing a "park-everything-to-noindex" sweeper is forbidden.** Flips must be per-row (existing checkbox toggles in `/admin/cities` and `/admin/knowledge`) so a single click can't poison the whole catalog.

Also document in your replit.md:
- The exact files you deleted (route paths, component names, type names) so future agents understand the deletion was deliberate
- Which file you kept (`apply-index-baseline`, `config/protectedSlugs.ts`) and why (safety reverse — only widens to good, never to bad)
- The fact that schema defaults are healthy (`allowIndexing: true`, `robots: "index, follow, ..."`) — so any new row created by any code path is born indexable

---

## 8. Tableicity recovery summary (reference)

For comparison, here's what the Tableicity recovery produced:

| Metric | Before recovery | After step 4 (full unpublish) | After step 7 (selective re-publish) |
|---|---|---|---|
| Cities in sitemap | 70 (of 322 published; 252 silently parked to noindex) | 0 | 68 |
| Articles in sitemap | 67 (of 683 published; 616 silently parked to noindex) | 0 | 63 |
| Static pages | 3 | 3 | 3 |
| **Total sitemap URLs** | ~140 | 3 | **134** |

The 134 final count is a deliberate, hand-picked subset — exactly the controlled re-introduction the recovery plan was designed to enable. The 322 - 68 = 254 cities and 683 - 63 = 620 articles still in the catalog stay unpublished/dark until and unless the owner explicitly re-publishes them.

---

## 9. Rules of engagement for the agent running this

- Plain language, no emojis, no jargon unless asked
- Gate-by-gate pacing — finish each step, summarize, wait for "go" before next step
- Ask before any destructive action (this includes mass deletes, but here every destructive *data* action is done by the user via the admin UI, never by the agent)
- Forward-only — do not refactor sweepers, delete them
- Read-only on data during step 5 audit — pure code reading, no DB mutations
- Architect / code review after every code change (steps 1, 2, 3, and step 6 if bugs found)
- The user owns every flip in steps 4 and 7 — the agent never touches data
