# Web Site Pages — Capabilities & Slide Drop-In Notes

**Saved**: April 30, 2026
**Purpose**: Reference document for revisiting the Pages feature in 1–2 weeks (currently 3–4 weeks out from EU handoff and follow-on UI work). Captures what the Pages tab in the admin panel can and cannot do today, and confirms how a hand-fed slide can be dropped into a page.

---

## 1. Full capabilities of the Admin → Pages tab

The Pages tab is **not** a full WordPress engine. It's a much lighter, structured "block-based" page builder. Honest picture below.

### What Pages CAN do today

#### Page-level fields (per page)

* **Page Title** — display name in the admin.
* **URL Slug** — page lives at `https://www.tableicity.com/{slug}` (e.g. `/pricing`).
* **Meta Title** — SEO `<title>` tag.
* **Meta Description** — SEO `<meta name="description">`.
* **OG Image URL** — Open Graph image for social sharing. *Stored in the database and used by the renderer, but the editor UI does NOT yet expose a field for it. Values can only be set by API call right now.*
* **Status** — Draft or Live (publish/unpublish toggle).
* **Display Order** — exists in the database for ordering pages in a future nav menu, but no UI uses it yet.

When published, every page is automatically:

* Included in `/sitemap.xml`.
* Auto-canonicalized to the base URL.
* Wrapped in OpenGraph tags.
* Statically generated at deploy time.

#### Slide-based content (the "engine")

A page is built as an ordered stack of **slides** (think Bootstrap/Webflow blocks). Seven slide types exist:

| Slide type | What it gives you |
|---|---|
| **Hero Section** | Headline, subheadline, CTA button with URL, optional background image. |
| **Feature Grid** | 3-column or 4-column grid of feature cards. Each card has icon name, title, description. 1–12 features. |
| **Pricing Table** | 1–5 pricing tiers, each with name, price, "popular" flag, feature list, CTA button. |
| **Text Block** | Optional headline + freeform body (paragraphs separated by newlines). |
| **Image + Text** | Image-left or image-right layout, headline, body, image URL, alt text. |
| **Call to Action** | Headline, subheadline, CTA button. Compact bottom-of-page module. |
| **Custom HTML** | Raw HTML/Tailwind escape hatch. Anything you can write in HTML, you can drop in here. |

#### Per-slide layout controls (no coding required)

For every slide you can pick:

* **Background**: Default / Primary / Muted / Subtle.
* **Padding**: Default / Small / Medium / Large / Extra Large.
* **Container Width**: Default / Narrow / Medium / Wide / Full Width.

#### Editor mechanics

* Add slides with a **+ Add Slide** button.
* Reorder with **up/down arrow buttons** on each slide card.
* Edit any slide in a dialog; delete with confirm.
* When you pick a slide type, it auto-loads a **template** with sample content so you have a starting point.
* The editor shows a live "Valid JSON / Invalid JSON" indicator while you type.
* **Publish / Unpublish** toggle and a **View Live** button open the public page in a new tab.

### Where it falls short of WordPress (honest list)

The user-facing reality is that this is closer to a SaaS landing-page builder than to WordPress. Specifically:

1. **No WYSIWYG/rich-text editor.** Slide content is edited as **raw JSON** in a textarea. You don't get a Word-like toolbar (bold, italic, bullet, link picker). Non-technical users will struggle. WordPress's Gutenberg block editor is its biggest UX advantage and we don't have an equivalent.
2. **No media library.** There's no image upload, no asset gallery, no built-in CDN. Image URLs must be hosted somewhere else (Unsplash, an S3 bucket, your own CDN) and pasted in.
3. **Limited block vocabulary.** Seven slide types, fixed schemas. WordPress has hundreds of blocks plus thousands of plugins. The escape hatch is the **Custom HTML** slide — anything you can do in WordPress visually, you can do here if you can write HTML/Tailwind.
4. **No revision history.** Once you save a slide, the previous version is gone. No "restore previous version" like WordPress.
5. **No scheduled publishing.** Pages are Draft or Live, no "publish at this date/time" feature.
6. **No categories, tags, taxonomies, comments, or page hierarchy.** All pages live flat at `/{slug}` — you can't have `/about/team`. There's also no parent-child relationship between pages.
7. **No themes/plugins ecosystem.** Styling is locked to the site's existing Tailwind theme tokens. To change the visual system you change code.
8. **No menu/navigation builder.** New pages don't automatically appear in a header or footer nav. Right now they're only discoverable via direct URL or via the sitemap (which Google reads). If you want them in the site nav, that requires a code change.
9. **No multi-author / role-based editing.** Anyone with admin access can edit any page. There's no "Author / Editor / Contributor" role split.
10. **Reserved slugs.** You can't use `admin`, `api`, `locations`, `_next`, or `favicon.ico` as a page slug — they're protected because they're real routes. The editor will let you save them but the page won't render.

### What it's good for, realistically

This setup is well-suited for **marketing/landing pages**: pricing, about, FAQ, terms, privacy, contact, partners, "Why Tableicity," feature highlight pages. Anything that's a structured layout of hero → features → pricing → CTA.

It is **not** well-suited for: a blog (the Knowledge/Discovery system handles that role), long-form articles with rich formatting, anything that needs file uploads, or pages a non-technical writer has to maintain solo.

### If you want it closer to WordPress later

The smallest, highest-leverage upgrades to consider whenever the Pages CMS becomes a priority:

1. **Replace the JSON textarea with proper form fields** for each slide type (one input per field). Big UX win, non-technical-user-safe. Half a day of work.
2. **Add a TipTap or Lexical rich-text editor** for the Text Block and Image+Text body fields (bold, italic, lists, links). Closes the biggest WordPress gap.
3. **Add an image upload field** that pushes to a storage bucket and returns a URL — kills the "paste a URL" friction.
4. **Surface the OG Image URL field** in the editor UI (it already works on the back end).
5. **Auto-generate a header nav** from `displayOrder` on published pages (the field already exists).

---

## 2. Dropping a hand-fed slide into a page

**Short answer: yes, easily.** That's exactly the case the system is built for.

How it would work in practice:

* If the slide is **a chunk of HTML** (something from a designer, ChatGPT, a Webflow export, a CodePen, a marketing email template) — drop it into the page as a **Custom HTML** slide. That slide type is the universal escape hatch; it renders whatever HTML/Tailwind you give it, exactly as written. No format conversion, no rebuild, no code change.
* If the slide is **structured content** that maps to one of the seven built-in types (a hero, a feature grid, a pricing table, a CTA, an image+text section, a text block) — use that native slide type instead. Cleaner, theme-aware, mobile-responsive automatically.
* If you have **a screenshot or a design** — recreate it as either a Custom HTML slide or a combination of native slides, depending on what fits best.

### The drop-in workflow

1. Hand off the slide content (HTML, design, copy + structure, or "I want this section to say X and look like Y").
2. Open the target page in `/admin/pages` (or create a new page first).
3. Add the slide via **+ Add Slide**, position it in the stack with the up/down arrows, and pick the background, padding, and container width.
4. Click Publish. The page is live at `/your-page-slug`, included in the sitemap, and ready for Google Search Console resubmit.

### Why this fits the speed-to-market design

The front end was built for speed-to-market with the marketing site as a redirect gateway to the Cap Table app. The page builder is intentionally wide-open for hand-fed slides because of the Custom HTML escape hatch — it doesn't try to constrain you to a fixed component library. When you want a polished section that doesn't fit the seven built-in types, the Custom HTML slide takes anything you give it and renders it inline.

---

## 3. Things to remember when revisiting this in 1–2 weeks

* **Two unrelated content systems already exist** and shouldn't be confused with Pages:
  * **Knowledge / Discovery** (`/discovery/knowledge/{slug}`) — long-form articles produced by the Newsroom 5-agent pipeline from Haylo essays. Different schema (`knowledge_articles`), different renderer, different SEO treatment.
  * **Press releases per city** (`/locations/{slug}/press-releases`) — the city-targeted output of the Newsroom Pair flow.
  * Pages is for static marketing pages only (pricing, about, FAQ, etc).
* **The "Custom HTML" slide is the lever.** Whenever a designer or AI hands you something polished, that's the slide type to reach for first. The native slide types are for repeatable structured layouts only.
* **No image uploads yet.** Whatever images go into hand-fed slides need to be hosted somewhere first (cloud bucket, CDN, public URL).
* **OG Image is invisible in the UI.** If a new page needs a custom social-share image, it currently requires an API call to set `ogImageUrl`. Surfacing this field in the editor is one of the recommended upgrades.
* **Sitemap & GSC flow** is documented in `replit.md` under the "Sitemap & Search Console Flow" section — after publishing a new Page, the sitemap regenerates on deploy and Google can be nudged via Search Console resubmit.
* **EU handoff** notes in `replit.md` already cover this — the EU clone inherits the same Pages system. No EU-specific changes needed for the page builder itself.
