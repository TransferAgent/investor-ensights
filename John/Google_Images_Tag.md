# Google Images Alt-Text Tag Implementation — Tableicity

## Document Purpose

This document provides a granular reference for the Google Image Search SEO alt-text implementation on **www.tableicity.com**. It is designed to be consumed by other Replit agents or developers who need to understand what was changed, when, where in the codebase, how it works, and why it was done.

---

## What Was Done

All slideshow images across the Tableicity marketing site were updated from a generic `alt="Tableicity platform"` to keyword-rich, descriptive alt-text optimized for Google Image Search indexing. Two distinct strategies were applied:

1. **Homepage (national SEO)** — Brand-focused alt-text with no city/state, targeting broad keyword searches like "secure cap table software," "Carta alternative," and "SHA-256 equity encryption."

2. **City Landing Pages (local SEO)** — The same keyword-rich descriptions with `{{city}}` and `{{state}}` dynamically injected per page, creating unique alt-text on every city page (150+ pages) for local image search rankings.

---

## When

- **Implementation Date**: March 23, 2026
- **Deployed to Production**: Same day via Replit publish

---

## Where — Files Modified

### 1. Homepage Slideshow

**File**: `components/homepage/marketing-panel.tsx`

This component renders the left-panel slideshow on the homepage (`/`). It is a client component (`"use client"`) using Framer Motion for transitions.

**Lines of interest**:
- `SLIDES` array (line ~17): Defines the 4 image paths
- `SLIDE_ALTS` array (line ~24): Defines the 4 alt-text strings (homepage variant, no city)
- `<motion.img>` tag (line ~125): Where `alt={SLIDE_ALTS[currentSlide]}` is rendered

### 2. City Page Slideshow

**File**: `components/homepage/city-marketing-panel.tsx`

This component renders the left-panel slideshow on every city landing page (`/locations/[slug]`). It receives `cityName` and `stateCode` as props from the server-rendered page.

**Lines of interest**:
- `SLIDES` array (line ~17): Same 4 image paths as homepage
- `SLIDE_ALT_TEMPLATES` array (line ~24): Defines 4 alt-text templates with `{{city}}` and `{{state}}` placeholders
- `<motion.img>` tag (line ~118): Where alt-text is rendered with dynamic replacement:
  ```
  alt={SLIDE_ALT_TEMPLATES[currentSlide]
    .replace(/\{\{city\}\}/g, cityName)
    .replace(/\{\{state\}\}/g, stateCode)}
  ```

---

## How — Technical Implementation

### Image-to-Alt-Text Mapping

| Slide | Image File | Visual Content | Homepage Alt-Text | City Page Alt-Text Template |
|-------|-----------|---------------|-------------------|---------------------------|
| 1 | `/slideshow-f2.png` | Encrypted Hash shield with lock icon | Tableicity Encrypted Hash: Privacy-first cap table platform using SHA-256 encryption for equity ownership protection — a secure alternative to Carta. | Tableicity Encrypted Hash: Privacy-first cap table platform using SHA-256 encryption for equity ownership protection in {{city}}, {{state}} — a secure alternative to Carta. |
| 2 | `/slideshow-a.png` | Code/crypto security visual | Tableicity secure cap table code architecture featuring SHA-256 hashing, GDPR compliance, and Zero-Knowledge Proof stakeholder verification. | Tableicity secure cap table code architecture featuring SHA-256 hashing, GDPR compliance, and Zero-Knowledge Proof stakeholder verification for {{city}}, {{state}} startups. |
| 3 | `/slideshow-b.png` | Cap Table Dashboard with hashed names | Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control. | Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control for {{city}}, {{state}}. |
| 4 | `/slideshow-c.png` | Data center with security art | Privacy-first capitalization table management software featuring encrypted stakeholder names and time-boxed auditor access to prevent data leaks. | Privacy-first capitalization table management software in {{city}}, {{state}} featuring encrypted stakeholder names and time-boxed auditor access to prevent data leaks. |

### Dynamic Replacement (City Pages Only)

On city pages, the component receives props from the server-rendered page at `app/locations/[slug]/page.tsx`:

- `cityName` — e.g., "Fontana", "New York", "Chicago"
- `stateCode` — e.g., "CA", "NY", "IL"

At render time, `{{city}}` is replaced with `cityName` and `{{state}}` is replaced with `stateCode`.

**Example output for Fontana, CA (Slide 3)**:
```
Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities,
ZK-Proof verification network, and 30-minute auditor reveal access control
for Fontana, CA.
```

### Slideshow Behavior

- Slides auto-advance using `setTimeout` (not `setInterval`)
- Slide durations: `[7200, 7200, 14400, 7200]` milliseconds
- Slide 3 (Cap Table Dashboard) displays for 2x duration (14.4 seconds vs 7.2 seconds)
- Each slide has a slow zoom animation (Ken Burns effect) whose duration matches the slide's display time
- The alt-text updates dynamically as slides change via `SLIDE_ALTS[currentSlide]` or `SLIDE_ALT_TEMPLATES[currentSlide]`

---

## Why — SEO Rationale

### Google Image Search Indexing

Google crawls and indexes `alt` attributes on `<img>` tags. By including specific product keywords, Google associates Tableicity images with relevant search queries.

### Targeted Keywords Embedded

| Keyword | Why It Ranks |
|---------|-------------|
| SHA-256 | Tells Google this is a cryptographic security product |
| ZK-Proof / Zero-Knowledge Proof | Associates Tableicity with privacy-preserving technology |
| Auditor Reveal | Unique feature differentiator — captures niche search intent |
| Cap Table | Core product category keyword |
| Carta alternative | Competitor keyword capture |
| GDPR compliance | European regulatory search intent |
| Encrypted stakeholder names | Feature-specific long-tail keyword |
| Privacy-first | Brand positioning keyword |

### Local SEO Tie-In (City Pages)

Including `{{city}}, {{state}}` in the alt-text on 150+ city pages creates unique per-page signals for local search. When a founder in Fontana, CA searches Google Images for "secure cap table Fontana," the city-specific alt-text helps Tableicity's images surface.

### Two-Tier Strategy

| Layer | Page | Alt-Text Style | Search Target |
|-------|------|---------------|---------------|
| National | Homepage (`/`) | Brand + feature keywords, no location | "secure cap table software", "Carta alternative" |
| Local | City pages (`/locations/[slug]`) | Brand + feature keywords + city/state | "cap table management Fontana CA", "equity encryption New York" |

---

## Image Source Files

All 4 slideshow images are served from the `public/` directory at the project root:

| File | Source Origin | Dimensions | Compressed Size |
|------|-------------|-----------|----------------|
| `public/slideshow-f2.png` | `John/History/New folder (5)/Tableicity_F (2).png` | Standard web | 418 KB |
| `public/slideshow-a.png` | `John/History/New folder (5)/Tableicity_A.png` | Standard web | 648 KB |
| `public/slideshow-b.png` | `John/History/New folder (5)/Tableicity_B.png` | Standard web | 487 KB |
| `public/slideshow-c.png` | `John/History/New folder (5)/Tableicity_C (2).png` | Standard web | 578 KB |

Original source files have been archived to `John/History/`.

---

## Verification

To verify alt-text is rendering correctly:

1. **Homepage**: Open `https://www.tableicity.com`, inspect the slideshow image element — the `alt` attribute should show the brand-focused text (no city).
2. **City Page**: Open any city page (e.g., `https://www.tableicity.com/locations/fontana-ca`), inspect the slideshow image — the `alt` attribute should include "Fontana, CA" in the text.
3. **Google Search Console**: After Google re-crawls, check the Image Search performance report for impressions on target keywords.

---

## Dependencies

- **Framer Motion** (`framer-motion`): Used for slide transitions — the `<motion.img>` component accepts the `alt` prop like a standard `<img>`.
- **Next.js App Router**: City pages are server-rendered at `app/locations/[slug]/page.tsx`, which passes `cityName` and `stateCode` props to the client component.
- No additional packages were installed for this change.
