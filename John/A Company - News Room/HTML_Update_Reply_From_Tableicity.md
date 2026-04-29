# Tableicity Reply to Halo's HTML_Update Response

**From:** Tableicity Newsroom (consumer)
**To:** Halo Lab (producer)
**Re:** `HTML_Update_Reply_From_Halo.md` — your reply to our HTML export format request
**Date:** April 2026
**Status:** Spec round closed pending §1.1 ship. All three open questions answered below.

---

## Summary

Tableicity accepts Halo's reply in full. The three open questions are answered:

1. **§1.1 (h1-only emission):** Confirmed acceptable. Ship `<h1>` immediately.
2. **§5 (flat vs sections):** Stay flat. Halo's recommendation accepted.
3. **§8 (Beast Connection timeline):** No commitment yet. ~4–6 weeks earliest. Please harden API for stability, no deadline pressure.

Once Halo ships §1.1, Tableicity proceeds with its three internal work items (sanitizer allowlist, stop stripping `<strong>`, add `.answer-block` CSS) in a single tight session.

---

## Answers to Halo's open questions

### Q1 — §1.1: Is `<h1>`-only emission acceptable for the importer?

**Answer: YES, fully acceptable. Please ship.**

Tableicity's importer title-detection chain is `<h1>` → `<title>` → first `<p>` → filename, evaluated in order with first-match-wins. Since Halo commits to always emitting `<h1>`, the chain stops at the first node and never falls through.

The `<title>` fallback was insurance for malformed exports that lacked `<h1>` — never a requirement on Halo. With Halo's commitment that every export will include `<h1>`, the fallback is dead code (still there as defense-in-depth, but never exercised in practice).

**Action:** Halo can deploy the `<h1>` prepend immediately. No coordinating release on Tableicity's side required — the importer already handles `<h1>` correctly, today.

### Q2 — §5: Stay flat or add `<section>` sub-blocks?

**Answer: STAY FLAT (Option A). Halo's recommendation accepted in full.**

Tableicity agrees with all four points in Halo's reasoning:

1. Answer Block microdata (`itemprop="abstract"`) carries the schema.org weight; sections are cosmetic to crawlers.
2. Adding `<section>` requires an LLM prompt change in Halo, which adds a failure mode for marginal benefit.
3. Tableicity's `<div class="pr-body">` wrapper would create a third nesting layer.
4. Marginal SEO benefit not worth the complexity.

The `<section>`-wrapped template in §5 of `HTML_Update.md` was aspirational, not a hard requirement. Tableicity has no current feature that needs section landmarks. If accessibility audits ever demand HTML5 outline structure, Tableicity will revisit and submit a new spec request with concrete justification — but that's not the case today.

**Action:** No Halo change. The flat structure stays as-is.

### Q3 — §8: Beast Connection timeline?

**Answer: NO COMMITMENT YET. Earliest start ~4–6 weeks.**

Tableicity has two priority workstreams in front of Beast Connection:

1. **Teacher / Student architecture** — a four-session implementation building Professor + Conductor + Classroom + Student per topic of pain (Meta Description first, then Seed URL). Spec is documented in `Teacher_Student.md`.
2. **Tableicity-side Answer Block fixes** — a single tight session unblocked the moment Halo ships `<h1>` (sanitizer allowlist, normalizer change, CSS).

Beast Connection naturally slots after both. Realistic earliest start is 4–6 weeks from this date. No specific deadline pressure on Halo.

**Request to Halo:** Please proceed with API hardening for stability — preserving URL paths, response schemas, and the additive-only schema commitment you made. The five publishing endpoints documented in your reply (§8) are accepted as the integration targets. When Tableicity is ready to wire Beast Connection, we will request:

- Authentication scheme (will accept either API key or OAuth — Halo's choice based on which is easier to secure on your side)
- Rate limiting expectations (so Tableicity can implement appropriate backoff)
- Webhook options (push notification when an entry hits "published" status — preferred over polling)

Tableicity will write a `Beast_Connection.md` spec doc when this workstream begins. That doc will be the formal handoff to scope and execute the integration.

---

## Section-by-section acknowledgements

For correspondence completeness, Tableicity's positions on the rest of Halo's reply:

| Halo's position | Tableicity response |
|---|---|
| §1.1 — Add `<h1>` (drafted, awaiting ack) | **Ship.** See Q1 above. |
| §1.2 — Topic comment deferred | **Accepted.** Tableicity will derive topic slug from filename (current behavior) or title (kebab-case fallback if filename is missing). No further request. |
| §2.1 — `<strong>` rescission | **Confirmed.** `hayloBodyNormalizer.ts` will be updated to preserve `<strong>` rather than strip it. |
| §2.2 — Dateline not generated | **Acknowledged.** Will treat any future dateline as a regression and report. |
| §2.3 — No `<style>` or inline styles | **Acknowledged.** Will treat any future style attribute as a regression and report. |
| §3.1 — Media tags not generated | **Acknowledged.** Will treat any future media tag as a regression and report. |
| §3.2 — No outbound link auto-injection | **Acknowledged.** Tableicity's Internal Linker stage will operate as the sole link source. |
| §3.3 — `<article class="halo-published">` wrapper stable | **Acknowledged.** Tableicity will rely on this as a marker for Halo-sourced content. |
| §4 — Allowed body tags | **Acknowledged.** Tableicity's sanitizer allowlist will be updated to match Halo's emission set (specifically: permit `class` and `itemprop` on `<p>`, permit `class` on `<article>`, preserve `<strong>`). |
| §5 — Flat vs sections | **Stay flat.** See Q2 above. |
| §6 — Priority ranking | **Acknowledged.** §1.1 is highest priority. |
| §7 — Answer Block format formally committed | **Accepted with appreciation.** The versioning + transition window commitment is exactly what Tableicity needs to invest in the integration with confidence. |
| §7.2 — "Do not" items endorsed | **Acknowledged.** Tableicity-side implementation will respect all three. |
| §8 — Beast Connection endpoint contract | **Accepted as integration targets.** See Q3 above for timeline. |

---

## Tableicity-side action plan (unblocked once §1.1 ships)

The moment Halo deploys `<h1>` to the HTML renderer, Tableicity executes the following in one tight session:

1. **Update `lib/newsroom/htmlSanitizer.ts`** — add `class` and `itemprop` to the `<p>` allowlist and `class` to the `<article>` allowlist. Verify Answer Block attributes survive end-to-end through the live agent path.

2. **Update `lib/newsroom/hayloBodyNormalizer.ts`** — remove the `<strong>`/`<b>` stripping. Update the file's docstring and any associated tests. Update `replit.md` to reflect the new behavior.

3. **Add `.answer-block` CSS to the public knowledge page** — start from Halo's baseline CSS, restyle to Tableicity's brand palette. Verify visually with a synthetic test article that includes Answer Blocks.

4. **End-to-end smoke test** — pick one bulk-imported Halo essay (after Halo ships `<h1>` and Tableicity's three changes are in), run it through the live 5-agent pipeline, confirm the published article renders with:
   - Clean `<h1>`-derived title
   - Preserved `<strong>` emphasis on key terms
   - Visible `.answer-block` callouts with the styled "QUICK ANSWER" label
   - `class="answer-block"` and `itemprop="abstract"` present in the rendered DOM (DevTools confirmation)

Estimated effort: ~1 hour of code work + verification.

---

## Confirmed action items by owner

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Implement `<h1>` prepend in HTML renderer | Halo | **Cleared to ship.** Tableicity confirmed h1-only acceptable. |
| 2 | Decide on flat vs `<section>` sub-blocks | Tableicity | **Closed: stay flat.** No Halo change. |
| 3 | Update sanitizer allowlist for `class` and `itemprop` | Tableicity | Queued — unblocked by Halo §1.1 ship. |
| 4 | Stop stripping `<strong>` | Tableicity | Queued — unblocked by Halo §1.1 ship. |
| 5 | Add CSS for `.answer-block` | Tableicity | Queued — unblocked by Halo §1.1 ship. |
| 6 | Confirm h1-only emission acceptable | Tableicity | **Closed: confirmed acceptable.** |
| 7 | Topic field decision | Both | Deferred — no current need. Revisit if it becomes a recurring pain point. |
| 8 | Beast Connection API design | Both | Future workstream. Earliest start ~4–6 weeks. Halo to harden API for stability. |

---

## What happens next

1. Halo deploys the `<h1>` change.
2. Halo confirms deployment to Tableicity (a one-line message is enough; no ceremony required).
3. Tableicity executes its three-item internal work plan in one session.
4. Tableicity verifies end-to-end with a real Halo-sourced article on a Tableicity city page.
5. Spec round closes. Both teams move to their next workstreams (Teacher / Student on Tableicity's side; whatever Halo prioritizes next on theirs).

The Beast Connection workstream remains open as a future joint effort. Tableicity will initiate when ready by writing `Beast_Connection.md` and sending it to Halo as the formal kickoff document.

---

*Tableicity Newsroom — Local Paper that adds the hometown garnish.*
*Reply prepared in response to `HTML_Update_Reply_From_Halo.md` from Halo Lab.*
