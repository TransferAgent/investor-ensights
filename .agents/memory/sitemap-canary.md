---
name: Sitemap canary baseline drift
description: The sitemap-as-canary baseline in replit.md drifts every time we ship a new page or article batch. Always verify the live count before treating divergence as a regression.
---

`replit.md` "Gotchas" section pins a sitemap baseline for `investorensights.com/sitemap.xml`. Treat that number as a floor, not a contract — it gets stale every time we intentionally publish a new article batch or add a static page.

**Why:** the canary's job is to alarm on a SHRINK (a regression that silently dropped URLs), not on growth. Every intentional add (new articles, new static pages like `/about`, new persona hubs) bumps the floor. The number in `replit.md` lags those events until someone refreshes it.

**How to apply:**
1. Before treating a count mismatch as a bug, `curl -s https://investorensights.com/sitemap.xml | grep -c '<loc>'` to see the live truth.
2. If the live count is ≥ the documented baseline, no regression — refresh the `replit.md` number in the same edit as whatever else you're shipping.
3. If the live count is BELOW the documented baseline, THAT is the alarm — something dropped URLs (forward-only deletes rule was broken, or a noindex sweeper got reintroduced).
