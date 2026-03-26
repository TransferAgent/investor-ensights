# Beast Photo Gallery — Integration Guide

## Archive Contents

**File**: `beast-photo-gallery.tar.gz` (3.1 MB, 7 photos)

Extract with: `tar xzf beast-photo-gallery.tar.gz`

## Photo Inventory

| # | Filename | Name | Dimensions | Description |
|---|----------|------|-----------|-------------|
| 1 | beast-01-hash-wall.png | Hash Wall | 428 KB | Grid of SHA-256 hashes — the encrypted foundation of Tableicity's privacy layer |
| 2 | beast-02-code-vault.png | Code Vault | 663 KB | Code architecture showing SHA-256 hashing, GDPR compliance, and ZK-Proof verification |
| 3 | beast-03-masked-table.png | Masked Table | 317 KB | Cap Table Dashboard with encrypted stakeholder identities — pseudonymous hash labels like UQSQ-UHA5 and W375-EX65 |
| 4 | beast-04-reveal-mode.png | Reveal Mode | 316 KB | Cap Table Dashboard after auditor reveal — real names (Sarah Mitchell, James Carter) visible via consent-based 30-minute access |
| 5 | beast-05-core-value-desk.png | Core Value Desk | 345 KB | Ownership Card with SHA-256 Shareholder Privacy toggle, $10M secured investment, encryption shield active |
| 6 | beast-06-zk-network.png | ZK Network | 498 KB | SHA-256 hashed identities with ZK-Proof verification network and 30-minute auditor reveal access control |
| 7 | beast-07-lock-shield.png | Lock Shield | 592 KB | Encrypted stakeholder names with time-boxed auditor access — the security promise |

## Slideshow Behavior

The photos play in sequence (1 → 2 → 3 → 4 → 5 → 6 → 7 → loop).

### Timing

| Photos | Duration | Notes |
|--------|----------|-------|
| 1, 2 | 7.2 seconds | Standard |
| 3, 4, 5 | 14.4 seconds (2x) | Double time — these are the hero sequence |
| 6, 7 | 7.2 seconds | Standard |

### Zoom Effect

All photos start fully rendered at scale 1.0 and slowly zoom in during their display time.

| Photos | End Scale | Effect |
|--------|-----------|--------|
| 1, 2, 6, 7 | 1.08x | Subtle drift — barely noticeable |
| 3, 4, 5 | 1.62x | Cinematic pull-in — 50% more zoom than standard, slow and dramatic over 14.4 seconds |

### Transitions

- **Fade in**: 1 second ease-in-out on opacity
- **Zoom**: Linear scale over the full slide duration
- **Fade out**: Opacity drops to 0 on exit
- **Animation library**: Framer Motion (`AnimatePresence` with `popLayout` mode)

## Story Flow

The slideshow tells a visual narrative:

1. **Hash Wall** — "Everything is encrypted"
2. **Code Vault** — "Here's the architecture that does it"
3. **Masked Table** (cinematic) — "This is what your cap table looks like by default — hashed names"
4. **Reveal Mode** (cinematic) — "Auditors can see real names, but only for 30 minutes with consent"
5. **Core Value Desk** (cinematic) — "This is the product in action — privacy toggle, secured investment"
6. **ZK Network** — "The verification layer that makes it trustworthy"
7. **Lock Shield** — "Your data stays locked"

## Alt Text (SEO)

Each photo has a unique, keyword-rich alt text. On city pages, the alt text includes `{{city}}` and `{{state}}` placeholders that are replaced with the actual city/state values.

### Homepage Alt Text
1. "Tableicity Encrypted Hash: Privacy-first cap table platform using SHA-256 encryption for equity ownership protection — a secure alternative to Carta."
2. "Tableicity secure cap table code architecture featuring SHA-256 hashing, GDPR compliance, and Zero-Knowledge Proof stakeholder verification."
3. "Tableicity Cap Table Dashboard showing encrypted stakeholder identities with pseudonymous hash labels like UQSQ-UHA5 and W375-EX65 — ownership data stays private by default."
4. "Tableicity Cap Table Dashboard after auditor reveal showing real stakeholder names like Sarah Mitchell and James Carter — consent-based 30-minute identity access for compliance."
5. "Tableicity Core Value Desk — founder workspace showcasing the privacy-first equity management philosophy behind Tableicity."
6. "Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control."
7. "Privacy-first capitalization table management software featuring encrypted stakeholder names and time-boxed auditor access to prevent data leaks."

## OG Image

The default OpenGraph image used for knowledge articles and social sharing is **beast-06-zk-network.png**, served from `https://www.tableicity.com/beast-06-zk-network.png`.

## File Placement

On the Tableicity marketing site, all photos live in the `/public/` directory and are served as static files at the root URL path (e.g., `/beast-01-hash-wall.png`).

For the other Replit, place them wherever your static assets are served from and reference by the same filenames.
