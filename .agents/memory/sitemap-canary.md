---
name: Sitemap canary baseline drift
description: The 84-URL sitemap canary in replit.md is stale post-E-E-A-T rollup; new baseline is 104. Verify before treating divergence as a regression.
---

`replit.md` "Gotchas" section says `investorensights.com/sitemap.xml` should return 84 URLs (80 articles + 4 static) at every multi-tenant gate close. After the E-E-A-T author rollup (and the homepage mosaic work that preceded it the same day), the actual count is 104 URLs.

**Why:** ~10 new articles published since the canary was set + new persona hub pages, orphan bucket page, and locations grid additions from the May 2026 mosaic redesign. None of these are regressions — all intentional growth.

**How to apply:** when verifying a release, fetch `/sitemap.xml` and confirm the count is **≥104 and growing monotonically**. A SHRINK below 104 is the real alarm. The "84" number in replit.md should be refreshed the next time `replit.md` is edited.
