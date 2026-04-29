# Halo Reply to HTML_Update Request

**From:** Halo Lab (producer)
**To:** Tableicity Newsroom (consumer)
**Re:** `HTML_Update.md` — HTML Export Format Request
**Date:** April 2026
**Status:** Halo accepts the spec with one item pending Tableicity's decision (§5).

---

## Summary

Halo has reviewed every section of `HTML_Update.md`. The short version:

- **One code change agreed and ready to ship: §1.1** (add `<h1>` to every essay export). Awaiting Tableicity's go-ahead before we deploy.
- **Five items already handled by Halo's pipeline today: §2.2, §2.3, §3.1, §3.2, §3.3.** No work needed; we are confirming behavior is stable.
- **One item deferred: §1.2** (topic comment). Tableicity to derive slug from title or filename for now.
- **One item formally committed in writing: §7** (Answer Block format stability). Halo will not change `<p class="answer-block" itemprop="abstract">` without a versioned spec announcement.
- **One item needs Tableicity's decision: §5** (flat `<p>` structure vs `<section>` sub-blocks). Halo recommends flat — see below.
- **§8** (Beast Connection API future) acknowledged. Halo will preserve the publishing endpoint contract.

---

## Section-by-section response

### §1.1 — Add `<h1>` at the top of every essay

**Status: AGREED. Code change drafted, ready to ship pending your acknowledgement.**

Halo already stores the article title separately in the publishing record. The HTML renderer will be modified to prepend `<h1>{title}</h1>` to its output, producing:

```html
<h1>Securing Series A Funding Without Losing Sleep</h1>
<article class="halo-published">
  <p class="answer-block" itemprop="abstract">…</p>
  <p>…</p>
  …
</article>
```

The h1 is escaped for safe HTML insertion (no markup injection from the title field). Title is sourced from the user-entered title in the Publishing UI — the same value that displays in Halo's queue.

**One question for confirmation:** your importer order is `<h1>` → `<title>` → first `<p>` → filename. Halo will only emit `<h1>` (not a document `<title>`, since exports are body fragments not full documents). Confirming this is acceptable.

### §1.2 — Optional `<!-- topic: -->` comment

**Status: DEFERRED.**

Halo has no internal topic-slug concept today. The article title is the canonical identifier in the publishing record. We don't have clean source data to populate a meaningful topic slug different from the title.

**Halo recommendation:** Tableicity derives the slug from either the title (kebab-case slugify) or the filename. If a per-article topic field becomes a recurring need, we can add it as a UI field in a future Halo release and emit it via this comment then. Open to revisit when there's evidence of need.

### §2.1 — `<strong>` and `<b>` tags (rescinded)

**Status: ACKNOWLEDGED. No change to Halo behavior.**

Halo will continue emitting `<strong>` for emphasis on key terms (named entities, regulatory references, dollar figures, statute names). Tableicity confirmed this rescission in §7.1 item 2 of the request — they will update their `hayloBodyNormalizer.ts` to preserve `<strong>` rather than strip it.

### §2.2 — Leading dateline paragraph

**Status: NOT GENERATED. Confirmed stable.**

Halo's HTML renderer prompt explicitly forbids "intros, outros, conclusions, commentary, or any text not in the source" (rule #3 of the renderer's Absolute Laws). Datelines have never been generated and will not be added.

### §2.3 — Inline `<style>` blocks and `style="..."` attributes

**Status: NOT GENERATED. Confirmed stable.**

Halo's HTML renderer prompt rule #6 explicitly forbids `<style>`, `<script>`, `<html>`, `<head>`, `<body>`, doctype, and Markdown code fences. Output is always a body fragment. Inline `style=""` attributes are not in the renderer's emission set and have never been observed in production output. Halo formally commits this stays the case.

### §3.1 — Media tags (`<img>`, `<figure>`, `<video>`, `<iframe>`)

**Status: NOT GENERATED. Confirmed stable.**

Halo's renderer wraps source prose in semantic text tags only. It does not generate, embed, or reference any media. If your importer ever sees a media tag from Halo, it's a regression — please report it.

### §3.2 — Outbound `<a href="...">` links

**Status: NOT AUTO-INJECTED. Halo commits to keeping it that way.**

Halo's renderer does not inject any links — internal or external. If a link appears in the source homework draft, it could pass through scrubbing into the final HTML, but Halo's prompts do not currently encourage this and we're not aware of it happening in practice.

**Formal commitment:** Halo will not auto-inject outbound URLs in HTML output. Tableicity's Internal Linker stage can do its work without contention from us.

If you ever observe Halo links in production output, treat it as a regression and report. We will not silently start emitting them.

### §3.3 — `<article class="halo-published">` wrapper

**Status: STABLE.**

The wrapper format is canonical. Halo will not change the class name, drop the wrapper, or rename the element without a versioned spec announcement.

### §4 — Allowed body tags

**Status: ACKNOWLEDGED.**

Halo's emission set today: `<p>`, `<p class="answer-block" itemprop="abstract">`, `<strong>`, occasionally `<h2>` if a style guide rule activates it, occasionally `<ul>`/`<li>` if the source contains list-suitable content. No other body tags are in routine use.

### §5 — Recommended export template (`<section>` sub-blocks)

**STATUS: HALO INPUT REQUESTED. Decision needed from Tableicity.**

The template in §5 wraps content in `<section>` blocks within the `<article>` wrapper. Halo today emits a flat structure — `<p>` children directly under `<article>`, no `<section>` wrappers.

**Halo's recommendation: stay flat.** Reasoning:

1. The Answer Blocks already carry the schema.org weight (`itemprop="abstract"`). Crawlers treat `<section>` as cosmetic.
2. Adding `<section>` requires either an LLM prompt change (which adds prompt complexity and one more failure mode) or a new structural style-guide rule (which adds maintenance).
3. Tableicity wraps everything in `<div class="pr-body">` anyway, so `<section>` would be a third nesting layer.
4. Marginal SEO benefit not worth the complexity.

**However, this is your call as the consumer.** If §5's template represents a hard requirement on Tableicity's side, Halo will adapt. Two options if you want sections:

- **Option B1:** Halo wraps content between `<h2>` subheads in `<section>` — Halo handles the structural decision based on subhead presence.
- **Option B2:** Halo emits one `<section>` per Answer Block boundary — pairs naturally with the Answer Block placement logic.

If you choose A (stay flat), no Halo change. If you choose B1 or B2, Halo will scope and quote the prompt change. **Please indicate preference.**

### §6 — Priority ranking

**Status: ACKNOWLEDGED.**

Halo confirms §1.1 (add `<h1>`) is the highest-priority change. We're shipping it first. §2.1 (bolding) is rescinded by Tableicity.

### §7 — Answer Blocks — Halo confirms format stability

**STATUS: FORMALLY COMMITTED.**

Halo formally commits to the Answer Block markup as documented in `Answer_Block_Spec_From_Halo.md`. The exact emission format is and will remain:

```html
<p class="answer-block" itemprop="abstract">…40-50 word summary…</p>
```

Specifically:
- **Tag:** `<p>` (not `<section>`, not `<aside>`, not `<div>`)
- **Class attribute:** exactly `answer-block` (one class, no variations like `answerblock`, `answer-block-intro`, etc.)
- **Microdata:** exactly `itemprop="abstract"` (Schema.org)
- **Placement:** inline at section boundaries within the article body, not in a separate sidecar block, not in `<head>`, not as JSON-LD
- **No JSON-LD `FAQPage` schema duplicates.** The microdata is the chosen signal. We will not also emit JSON-LD for the same content.
- **Word count:** 30-70 words per block (target 40-50), enforced by Halo's Answer Block agent and a 5% residual-prose drift guardrail.

If Halo ever needs to evolve this format (e.g., add `itemtype` or move to a new schema), we will:
1. Publish a new spec doc with a version bump (`Answer_Block_Spec_v2.md`)
2. Notify Tableicity in writing before deploying
3. Provide a transition window where both formats can coexist

We will not silently change the format.

Tableicity-side work items in §7.1 (sanitizer allowlist, stop stripping `<strong>`, add CSS) are entirely within Tableicity's scope. Halo has no objections to the proposed approach. The baseline CSS in our spec doc is a suggestion only — restyle as needed for brand match.

### §7.2 — What Tableicity should NOT do

**Status: ACKNOWLEDGED AND ENDORSED.**

All three "do not" items align with Halo's design intent:

1. **Do not modify Answer Block text** — agreed. Halo's word-budget and drift guardrails depend on this.
2. **Do not add JSON-LD `FAQPage` schema separately** — agreed. The microdata is the single chosen signal.
3. **Do not parse Answer Blocks into a separate database column** — agreed. The body HTML is the source of truth.

### §8 — Future Beast Connection API

**Status: ACKNOWLEDGED. Endpoint contract preserved.**

Halo's publishing endpoints today:
- `POST /api/publishing/scrub` — accepts homework source, returns scrubbed entry
- `POST /api/publishing/:id/answer-blocks` — generates Answer Blocks for a scrubbed entry
- `POST /api/publishing/:id/generate-html` — renders final HTML
- `GET /api/publishing` — lists publishing queue entries by status
- `GET /api/publishing/:id` — single entry detail

These are the integration targets for Beast Connection. Halo commits to:
- Preserving the URL paths and HTTP methods
- Preserving the response schemas (we may add fields, never remove or rename)
- Versioning any breaking change as `/api/v2/publishing/...`

When Tableicity is ready to wire Beast Connection, Halo will provide:
- Authentication scheme (API key vs OAuth)
- Rate limiting expectations
- Webhook options (push notification when an entry hits "published" status)

---

## Action items by owner

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Implement `<h1>` prepend in HTML renderer (§1.1) | Halo | Drafted, awaiting Tableicity ack on confirmation question |
| 2 | Decide on flat vs `<section>` sub-blocks (§5) | Tableicity | Pending |
| 3 | Update sanitizer allowlist for `class` and `itemprop` (§7.1.1) | Tableicity | Their plan |
| 4 | Stop stripping `<strong>` (§7.1.2) | Tableicity | Their plan |
| 5 | Add CSS for `.answer-block` (§7.1.3) | Tableicity | Their plan |
| 6 | Confirm h1-only emission acceptable for importer (§1.1 question) | Tableicity | Pending |
| 7 | Decide whether topic field is needed (§1.2) | Both | Deferred — revisit if needed |
| 8 | Beast Connection API design (§8) | Both | Future workstream |

---

## What Halo is NOT changing

For the avoidance of doubt, the following Halo behaviors are **stable and unchanged** by this request:

- Scrubber pipeline (Grok-3, dynamic length budget, 70% floor, retry on under-compression)
- Answer Block agent (Grok-3, 30-70 word budget, 5% residual drift threshold, Direct Truth voice rule)
- HTML renderer prompt (PRESERVE EVERY WORD, 2% word-count drift threshold)
- Style guide rule library and the active/inactive toggle system
- Per-article audit snapshot (model, temperature, tokens, drift metrics)
- The `<article class="halo-published">` wrapper
- The `<strong>` emphasis tag for key terms
- The Answer Block markup as fully specified in `Answer_Block_Spec_From_Halo.md`

---

## Open questions for Tableicity

1. **§1.1:** Confirm h1-only (no document `<title>` element) is acceptable for the importer's title-detection chain.
2. **§5:** Stay flat (Halo recommendation) or add `<section>` sub-blocks (Option B1 or B2)?
3. **§8:** Rough timeline for Beast Connection so Halo can plan API hardening.

Once questions 1 and 2 are answered, Halo will ship the §1.1 change and consider this spec round closed. Question 3 can stay open.

---

*Halo Lab — National Wire Service for governed AI content.*
*Reply prepared in response to `HTML_Update.md` from Tableicity Newsroom.*
