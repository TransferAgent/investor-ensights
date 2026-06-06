---
name: Article meta generation is a separate engine from city meta — never reconverge
description: Why article SEO meta uses one pure-LLM generator with a "needs-meta" flag and NO deterministic glue, kept distinct from the city-meta path.
---

# Article meta vs city meta: two deliberately separate engines

**Rule:** Article SEO meta and City SEO meta are produced by DIFFERENT engines on
purpose. Do NOT merge them or share gate code between them.

- **Articles** → `lib/newsroom/articleMetaGenerator.ts` (`generateArticleMeta`).
  One pure-LLM call (gpt-4.1) that READS the finished article body and writes
  Title + Description, retried a few times. The ONLY hard gates: title non-empty
  & ≤65; description non-empty & ≤320 & brand name injected. City optional, no
  description floor. Used by all three article entry points: the dry-run
  `processPair`, the live `runPairAgentPipeline`, and `scripts/backfill-tableicity-meta.ts`.
- **Cities** → `lib/cities/cityMetaGenerator.ts` + the `brandContext` gates
  (`metaTitleAcceptable` / `metaDescriptionAcceptable`) with a TIGHTER band
  (desc ~130–165, brand-once-in-closing, title city-verbatim/brand-free). The
  CRON sweeper + sparkle override flow live here. Untouched by the article work.

**The "never ship glue" rule (articles):** if the generator can't satisfy the
gates after retries it returns `status: "needs-meta"`. The caller then ships NO
meta (omits the fields) and stamps `meta_source = "needs-meta"` so a human is
flagged. We NEVER fall back to a deterministic formula string. The backfill
SKIPS needs-meta rows entirely (won't clobber existing meta with nulls;
forward-only).

**Why:** Conductor decision — a flagged-for-human article with no meta is better
than a robotic formula string. All the old deterministic glue (the
`buildMetaTitle`/`buildMetaDescription` formula builders, the `metaNaturalizer`
"Tier-2.5 polish" module, `META_LIMITS`, the brand-lead-guard) was DELETED from
the article path. The earlier MT-4.13.x multi-tier title/desc system no longer
exists for articles.

**How to apply:** route any new article-meta need through `generateArticleMeta`.
Leave the city/cron path alone — its tighter band still needs the `brandContext`
gates (see `city-meta-generation.md`). `hayloBodyExcerptFromHtml` was moved out
of the deleted naturalizer into `lib/newsroom/htmlExcerpt.ts` (cities import it
from there now). `meta_source` legacy values `'naturalized'`/`'fallback'` survive
only on pre-existing DB rows.
