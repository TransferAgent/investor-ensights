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

## 7. Answer Blocks — see canonical spec from Halo

Halo's team has already written the authoritative spec for Answer Block markup. It lives in this folder as **`Answer_Block_Spec_From_Halo.md`** and supersedes anything earlier in this document on the topic.

The short version: Halo emits Answer Blocks **inline** in the body as `<p class="answer-block" itemprop="abstract">…</p>` Schema.org microdata — NOT as JSON-LD FAQPage and NOT as a separate `<section>` block. They appear at meaningful section boundaries within the prose (intro abstract, mid-article transition, etc.). Body paragraphs around them stay as plain `<p>` tags.

Read `Answer_Block_Spec_From_Halo.md` for the full spec, the suggested CSS, and the verification checklist.

### 7.1 What this means for Tableicity (concrete work)

Three items are required for Answer Blocks to actually deliver SEO value end-to-end. All three are on Tableicity's side.

1. **Allow `class` and `itemprop` attributes through the sanitizer.** Tableicity's `lib/newsroom/htmlSanitizer.ts` currently strips both attributes from `<p>` tags. Update its `allowedAttributes` config to permit `class` and `itemprop` on `<p>` (and `class` on `<article>` for the `halo-published` wrapper).

2. **Stop stripping `<strong>` tags.** Tableicity's `lib/newsroom/hayloBodyNormalizer.ts` currently strips every `<strong>` and `<b>` tag. Halo intentionally bolds key terms (*GDPR*, *EU*, *VCs*, *Series A*) and the Answer Block spec relies on that emphasis surviving to the rendered page. Remove the strong-stripping behavior. Item 3 of §2 of this document (which previously asked Halo to stop bolding) is rescinded — Halo's bolding is intentional and Tableicity should preserve it.

3. **Add CSS for `.answer-block`.** The public knowledge page needs styling for the answer-block class. Halo provided baseline CSS in their spec doc — warm parchment background, gold left border, "QUICK ANSWER" label. Drop it into Tableicity's CSS (or restyle to match Tableicity's brand palette).

### 7.2 What Tableicity should NOT do

- **Do not modify Answer Block text.** Halo enforces a 30–70 word budget and a 5% drift threshold on these summaries. City-localization passes (if any) must skip Answer Block paragraphs entirely.
- **Do not add JSON-LD `FAQPage` schema separately.** The microdata `itemprop="abstract"` is the chosen signal. Adding parallel JSON-LD would be redundant at best and conflicting at worst.
- **Do not parse Answer Blocks into a separate database column.** They live in the body HTML where Halo placed them. Round-tripping them through a structured column adds complexity without benefit — the body HTML IS the source of truth.

---

## 8. Future direction (informational)

Tableicity is planning a "Beast Connection" workstream — a direct API consumer of Halo's Publishing endpoint. When that's in place, Halo essays will move from Halo's Ready queue into Tableicity's Haylo Library automatically, replacing today's manual file drop and Scan Inbox flow.

The HTML format expectations in this document apply to both the file-drop path (today) and the future API path (Beast Connection). Getting the HTML right at the source means both paths benefit.

---

**End of request. Halo team — questions or pushback welcome.**
