# HTML Update Request — Halo Essay Export Format

**From:** Tableicity (consumer of Halo essays)
**To:** Halo (producer of essays)
**Purpose:** Define the HTML shape Tableicity's Newsroom needs from Halo essays so the importer produces clean press releases without per-file manual cleanup.

---

## Context

Tableicity ingests Halo essays into its Haylo Library and uses them as the source body for city-specific press releases. The importer reads each `.html` file, extracts a title, derives a topic slug, and stores the body for downstream rendering on the public press-release pages.

Some HTML elements are kept and rendered. Some are stripped on import (effort spent producing them is wasted). Some pass through but break the rendered page. This document is the complete checklist of what to add, what to stop generating, and what's safe to keep.

---

## 1. Definitely add

### 1.1 `<h1>` at the top of every essay

The importer's title detection runs in this order: first `<h1>` → `<title>` → first `<p>` → filename. Today many essays have none of the first three, so it falls all the way through to "use the first sentence of the first paragraph as title." That produces verbose 100+ character editorial titles instead of clean headlines.

**Required:** Every exported essay should open with an `<h1>` containing a headline-style title, ~50–70 characters, headline case.

```html
<h1>Securing Series A Funding Without Losing Sleep</h1>
```

The importer strips the first `<h1>` from the body after lifting it to the title field, so it won't appear twice.

### 1.2 `<!-- topic: ... -->` comment (optional)

If the topic slug should differ from the filename, add a topic comment as the very first line:

```html
<!-- topic: cap-table-equity-stress -->
```

If the filename (without `.html`) is already the desired topic slug, this comment can be omitted.

---

## 2. Definitely stop generating

These are wasted effort — Tableicity strips them on import or they degrade the rendered page.

### 2.1 `<strong>` and `<b>` tags

The importer's `normalizeHayloBody` strips every `<strong>` and `<b>` tag from the body before rendering. Heavy bolding of terms like *Series A*, *12-15%*, *SAFEs*, *409A valuations* does not survive.

**Two options:**
- Stop bolding entirely
- Switch to `<em>` instead — `<em>` is on the allowed-tags list and renders as italics on Tableicity. Use sparingly (one or two terms per paragraph) so it carries weight.

### 2.2 Leading dateline paragraph

If Halo auto-generates a dateline paragraph at the top of the body like:

```html
<p>FORT LAUDERDALE, FL — APRIL 28, 2026 — ...</p>
```

It gets stripped on import. Tableicity owns dateline rendering separately. If Halo isn't generating these, ignore this item.

### 2.3 Inline `<style>` blocks and `style="..."` attributes

These pass through unchanged but won't match Tableicity's CSS. Likely to look broken, override theme colors, or break the layout. Halo's visual styling should not follow the export.

---

## 3. Worth knowing — only matters if Halo is generating these

### 3.1 Media tags: `<img>`, `<figure>`, `<figcaption>`, `<video>`, `<iframe>`

These pass through to the rendered page as-is, but Tableicity's press-release page has no CSS targeting them. Likely to render full-bleed or break the layout.

**Required:** Strip media from Halo essays before export. Or wrap in a class Tableicity is told to ignore.

### 3.2 Outbound `<a href="...">` links

Links survive intact. Tableicity's live agent pipeline includes an Internal Linker stage that adds Tableicity-specific links automatically. If Halo essays are heavily linked to Halo's own properties, the published article will have both Halo links and Tableicity links interleaved.

**Decision needed:** Strip Halo-side links at export, or leave them and let both coexist.

### 3.3 The `<article class="halo-published"><section>...</section></article>` wrapper

Fine to keep. Tableicity wraps it again in `<div class="pr-body">` so it nests cleanly. The `halo-published` class is a no-op on Tableicity's side — harmless.

---

## 4. Allowed body tags (use freely)

These render correctly on Tableicity:

- `<p>` — paragraphs
- `<h2>` — subheads (one or two per essay, concrete with a number or named entity)
- `<ul>` and `<li>` — bulleted lists
- `<em>` — italic emphasis (replacement for `<strong>`)
- `<a href="...">` — links (with the caveat in §3.2)

---

## 5. Recommended export template

```html
<!-- topic: cap-table-equity-stress -->     <!-- optional -->
<h1>Headline, ~50–70 chars, headline case</h1>
<article class="halo-published">
  <section>
    <p>Body paragraph using <em>italic</em> for emphasis instead of bold...</p>
  </section>
  <section>
    <h2>A concrete subhead with a number or name</h2>
    <p>More body...</p>
    <ul>
      <li>List item</li>
      <li>List item</li>
    </ul>
  </section>
</article>
```

---

## 6. Priority ranking — if only one change can be made

If Halo can only invest time in one change, the highest-impact change is **adding `<h1>` to every essay**. That single fix improves titles in every Tableicity surface (live agent path, dry-run path, admin library browse) with zero downstream guessing.

Second-highest impact: **stop generating `<strong>` and `<b>`** (or replace with `<em>`). Eliminates the "why isn't my bolding showing up?" surprise and cleans the rendered output.

Everything else in this document is either already handled cleanly by Tableicity or only matters in edge cases.

---

## 7. Answer Blocks — currently missing from the export

Halo's system generates **Answer Blocks** alongside each prose essay — concise ~45–50 word summaries with their own headlines, explicitly designed as Google-bot content with low-to-zero drift from the original prose. These are an established SEO pattern that wins featured snippets, "People Also Ask" boxes, voice search results, and AI summary boxes.

**Status today:** Halo generates Answer Blocks but they are **NOT included in the HTML export** that lands in Tableicity's `haylo-inbox/`. The exported file contains only the editorial prose. As a result, no Tableicity-published press release has Answer Blocks, and the SEO opportunity is being lost end-to-end.

**Required:** Include Answer Blocks in every exported HTML file. Two acceptable formats — best practice is to do both.

### 7.1 Format A — JSON-LD `FAQPage` schema (required, gold standard)

Embed the structured data as a `<script type="application/ld+json">` block at the top or bottom of the file. Invisible to human readers, fully parsed by Google.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Challenges of Global Expansion",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Global expansion for startups is a complex ambition requiring a solid cap table to navigate equity management challenges. Regulatory compliance, investor trust, and equity compensation issues can derail growth if records are messy. A robust equity structure is essential to support international scaling and seize new market opportunities."
      }
    },
    {
      "@type": "Question",
      "name": "Solutions for Equity Management",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Platforms like Tableicity enhance global expansion by securing cap table data with Hash-256 encryption and Zero-Knowledge Proofs, meeting privacy demands in strict markets like the EU. Compliance-ready features and real-time automation align with standards like Open Cap Table Format, enabling startups to focus on growth."
      }
    }
  ]
}
</script>
```

### 7.2 Format B — Visible `<section class="answer-blocks">` markup (optional, additive)

If Halo also wants to render the Answer Blocks as visible content on the page, add a section at the end of the body (after the conclusion) with this exact structure:

```html
<section class="answer-blocks" data-source="halo-answer-blocks">
  <h2>Quick Answers</h2>
  <div class="answer-block">
    <h3>Challenges of Global Expansion</h3>
    <p>Global expansion for startups is a complex ambition...</p>
  </div>
  <div class="answer-block">
    <h3>Solutions for Equity Management</h3>
    <p>Platforms like Tableicity enhance global expansion...</p>
  </div>
</section>
```

Tableicity will detect this section by its `data-source="halo-answer-blocks"` attribute and render it cleanly under the press-release body.

### 7.3 What Tableicity will do with Answer Blocks once they arrive

- Add a structured `answerBlocks` storage column on the Haylo article record
- Parse them out of the HTML on ingest (preferring JSON-LD if present, falling back to visible markup)
- Render them as JSON-LD `FAQPage` schema on every published press release for Google
- Optionally render them as a visible "Quick Answers" section under the body

This is on Tableicity's roadmap as a follow-up workstream once Halo starts including them in the export. **No work happens on Tableicity's side until Halo confirms the export will include Answer Blocks** — there's nothing to build against until the data arrives.

### 7.4 Drift discipline (informational)

Halo's UI already reports prose drift when generating Answer Blocks (target ~0%). Maintain that discipline — Tableicity's downstream rendering assumes the Answer Block summaries are faithful to the prose, not contradictory restatements of it. If drift exceeds ~5% for a given essay, that essay should be flagged in Halo before export rather than shipped with mismatched Answer Blocks.

---

## 8. Future direction (informational)

Tableicity is planning a "Beast Connection" workstream — a direct API consumer of Halo's Publishing endpoint. When that's in place, Halo essays will move from Halo's Ready queue into Tableicity's Haylo Library automatically, replacing today's manual file drop and Scan Inbox flow.

The HTML format expectations in this document apply to both the file-drop path (today) and the future API path (Beast Connection). Getting the HTML right at the source means both paths benefit.

---

**End of request. Halo team — questions or pushback welcome.**
