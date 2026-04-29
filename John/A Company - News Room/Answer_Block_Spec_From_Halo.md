# Halo → Tableicity Handoff: Answer Block Markup Specification

**From:** Halo Lab (content production)
**To:** Tableicity News Room (content assembly + publishing)
**Date:** April 2026
**Purpose:** Specify the exact HTML markup Halo uses for Answer Blocks so Tableicity can preserve, style, and benefit from them when wrapping Halo's "Master Articles" with local context.

**Status:** Authoritative spec from Halo. Supersedes any earlier assumptions in `HTML_Update.md` section 7.

---

## What is an Answer Block?

An Answer Block is a **standalone, citation-ready summary paragraph** designed to be picked up directly by AI search engines — SearchGPT (OpenAI), Perplexity, Google AI Overviews, and Anthropic's Claude with web access. When one of these systems answers a user query, it scans pages for short, self-contained paragraphs with clear semantic markup. An Answer Block is engineered to BE that paragraph.

Halo automatically generates 1–N Answer Blocks per article during the publishing pipeline, then weaves them inline at appropriate section boundaries.

---

## The exact markup Halo emits

Every Answer Block uses this exact opening tag:

```html
<p class="answer-block" itemprop="abstract">…the summary text…</p>
```

**Two attributes are required and non-negotiable:**

| Attribute | Value | Purpose |
|---|---|---|
| `class` | `answer-block` | Hook for CSS styling and any custom selectors |
| `itemprop` | `abstract` | Schema.org microdata signal — tells crawlers "this paragraph is the abstract/summary of the surrounding content" |

**No other attributes are used on Answer Block paragraphs.** No inline styles, no IDs, no data-attributes.

---

## Where Answer Blocks appear in a Halo article

A typical Halo-published article looks like this:

```html
<article class="halo-published">
  <p class="answer-block" itemprop="abstract">
    [Intro abstract — 30-70 words summarizing the article's core thesis]
  </p>
  <p>[Body paragraph 1 — full prose with <strong>key terms bolded</strong>]</p>
  <p>[Body paragraph 2]</p>
  <p>[Body paragraph 3]</p>
  <p class="answer-block" itemprop="abstract">
    [Solution/transition abstract — 30-70 words summarizing a major section]
  </p>
  <p>[Body paragraph 4]</p>
  <p>[Body paragraph 5]</p>
  <p>[Body paragraph 6]</p>
</article>
```

Key structural facts:
- The whole article is wrapped in `<article class="halo-published">`
- Answer Blocks appear at meaningful section boundaries (intro, mid-article transitions, conclusions)
- Body paragraphs are plain `<p>` tags with no class
- The only inline formatting Halo emits is `<strong>` for emphasis on key terms

---

## What Tableicity MUST do

### 1. Preserve the markup

When the News Room ingests a Halo Master Article and wraps it in city-specific context, **do not strip** the `class="answer-block"` or `itemprop="abstract"` attributes. If your HTML sanitizer has an attribute allowlist, ensure both `class` and `itemprop` are permitted on `<p>` tags.

If you use a library like DOMPurify, sanitize-html, or similar, configure it like:

```js
// sanitize-html example
allowedTags: [..., 'p', 'article', 'strong'],
allowedAttributes: {
  p: ['class', 'itemprop'],
  article: ['class'],
}
```

### 2. Style them visibly (recommended, not required)

Answer Blocks are designed to be **invisible to humans by default** — they look identical to regular paragraphs unless you give them CSS. Most production sites style them to stand out, both because (a) they're high-value content the reader should notice, and (b) visible styling reinforces the semantic meaning to crawlers.

Suggested baseline CSS for Tableicity:

```css
.answer-block {
  background: #f7f3e9;            /* warm parchment tint */
  border-left: 4px solid #c89b3c; /* gold accent */
  padding: 1rem 1.25rem;
  margin: 1.5rem 0;
  font-size: 1.05rem;
  line-height: 1.6;
  border-radius: 0 6px 6px 0;
}

.answer-block::before {
  content: "Quick answer";
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a6a1f;
  margin-bottom: 0.4rem;
}
```

This produces a tinted callout box with a "QUICK ANSWER" label — friendly to humans, still semantically machine-readable.

### 3. Do NOT modify Answer Block text content

When the News Room performs city-localization (substituting landmarks, regulatory references, etc.), **do not rewrite the inside of an Answer Block.** Halo's Answer Block agent is trained on a 30-70 word budget and a strict residual-prose drift threshold (5%). Edits to the summary text can break:
- The word-budget guardrail
- The "lead with subject + claim, active voice" Direct Truth voice rule
- The semantic accuracy that makes AI engines trust it as a citation source

If a city-specific version is genuinely needed, request a regenerated article from Halo with the city context provided as part of the source — don't post-edit.

### 4. Keep them in the rendered DOM, not just the source

Some static-site generators or React renderers flatten paragraphs or strip attributes during build. Confirm with browser DevTools that the final rendered page still shows:

```html
<p class="answer-block" itemprop="abstract">…</p>
```

If it doesn't, the SEO benefit is lost.

---

## Why this matters

| Behavior | Without Answer Blocks | With Answer Blocks |
|---|---|---|
| User asks SearchGPT a question your article covers | Maybe cited, maybe not — depends on which paragraph the LLM happens to pick | Halo's pre-summarized abstract is the most "pickable" paragraph — much higher citation rate |
| Google AI Overviews scans the page | Has to synthesize from full prose | Reads the `itemprop="abstract"` directly as a structured signal |
| Perplexity quotes the source | Pulls a random sentence | Pulls the Answer Block (cleaner, more accurate quote) |
| Reader skims the page | Has to read all paragraphs to find key takeaways | Sees a styled callout box and gets the answer immediately |

In short: Answer Blocks turn a regular article into one that **AI search engines prefer to cite**. That's free, high-quality referral traffic.

---

## Quick verification checklist for Tableicity

Before publishing any Halo-sourced article on a Tableicity city page, confirm:

- [ ] `<article class="halo-published">` wrapper survived the import
- [ ] At least 1 `<p class="answer-block" itemprop="abstract">` is present in the source
- [ ] `class` and `itemprop` attributes are present in the rendered DOM (check DevTools)
- [ ] CSS for `.answer-block` is loaded on the page
- [ ] No HTML sanitizer is stripping the attributes between import and render
- [ ] Answer Block text content is byte-identical to what Halo produced (no post-edits)

---

## Reference: full example from a real Halo article

Below is an actual published article from Halo (Tableicity persona, April 2026). Notice the two Answer Blocks marked with the required attributes:

```html
<article class="halo-published">
  <p class="answer-block" itemprop="abstract">Global expansion for startups is a complex ambition requiring a solid cap table to navigate equity management challenges. Regulatory compliance, investor trust, and equity compensation issues can derail growth if records are messy. A robust equity structure is essential to support international scaling and seize new market opportunities.</p>
  <p>Global expansion represents a thrilling yet complex ambition for startups, where the dream of entering new markets in <strong>Europe</strong> or <strong>Asia</strong> often collides with the harsh realities of equity management.</p>
  <p>Regulatory compliance across borders poses a significant hurdle, with varying rules like <strong>GDPR</strong> in the <strong>EU</strong>, data residency laws in <strong>Germany</strong>, or <strong>Beneficial Ownership Information</strong> reporting under the <strong>U.S. Corporate Transparency Act</strong>.</p>
  <p>Investor trust also hangs in the balance, as <strong>VCs</strong> assessing global potential scrutinize cap tables for clarity on dilution risks.</p>
  <p>Additionally, scaling internationally often involves equity compensation like <strong>ESOPs</strong> or <strong>RSUs</strong> to attract talent.</p>
  <p>Administrative burdens compound as cap tables grow with new investors or hires.</p>
  <p>These intertwined issues underscore the need for a robust equity structure to support ambitious expansion plans.</p>
  <p class="answer-block" itemprop="abstract">Platforms like Tableicity enhance global expansion by securing cap table data with Hash-256 encryption and Zero-Knowledge Proofs, meeting privacy demands in strict markets like the EU. Compliance-ready features and real-time automation align with standards like Open Cap Table Format, enabling startups to focus on growth.</p>
  <p>Platforms like <strong>Tableicity</strong> offer a solution by prioritizing privacy through <strong>Hash-256</strong> encryption and <strong>Zero-Knowledge Proofs</strong>.</p>
  <p>With compliance-ready features aligned to standards like the <strong>Open Cap Table Format</strong> and automation for real-time updates, such tools provide the precision and stability needed.</p>
  <p>A well-managed cap table thus becomes more than a record—it transforms into the backbone of trust, clarity, and compliance essential for turning global visions into reality.</p>
</article>
```

---

## Questions or issues

If Tableicity encounters HTML where Answer Blocks appear malformed, missing attributes, or inconsistently placed, contact the Halo Lab team. The publishing pipeline records an audit snapshot of every article (model, temperature, drift metrics, residual-prose ratio) so anomalies can be traced to a specific generation event.

---

*Halo Lab — National Wire Service for governed AI content.*
*Tableicity — Local Paper that adds the hometown garnish.*
