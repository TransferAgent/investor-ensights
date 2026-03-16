# Two-Panel Login Page — Build Instructions

## Overview

Replicate the Tableicity login page as a **static front-end only** (no backend). The page is a two-panel split layout: a dark navy **Marketing Panel** on the left (45% width) and a dark glass **Login Panel** on the right (55% width). On mobile (below `lg` / 1024px), the Marketing Panel is hidden and only the Login Panel shows.

Build this in two steps:
1. **Step 1 — Marketing Panel** (left side)
2. **Step 2 — Login Panel** (right side)

---

## Global Page Setup

- Full viewport height: `min-h-screen flex`
- No page scroll; each panel scrolls independently if needed
- Font: system default (`sans-serif` / Inter if available)
- No backend — form submit does nothing or redirects to `https://www.tableicity.com`

---

## STEP 1: Marketing Panel (Left Side)

### Container
- Width: `45%` of viewport, hidden on screens < 1024px (`hidden lg:flex lg:w-[45%]`)
- Background: `#0f1b2d` (solid dark navy)
- Text color: white
- Layout: `flex flex-col justify-between`
- Padding: `p-10 xl:p-12`
- Overflow: `overflow-hidden`

### 1A. Header Row
- Flexbox row: `flex items-center justify-between mb-5`
- **Left group** (`flex items-center gap-3`):
  - Icon box: 36×36px (`h-9 w-9`), `rounded-lg bg-blue-600`, centered Building2 icon (18px, white) — use any building/office icon from Lucide
  - Brand text: `"Tableicity"`, `text-lg font-bold tracking-tight`, white
- **Right group** (`flex items-center gap-4`):
  - Zap icon (14px, `text-yellow-400`) + `"Under 5 min setup"` (`text-xs text-blue-200/60`)
  - CheckCircle icon (14px, `text-green-400`) + `"No credit card"` (`text-xs text-blue-200/60`)

### 1B. Subtext Paragraph
- `text-sm leading-relaxed mb-4`
- Color: `text-blue-200/80`
- Text: *"Privacy-First Cap Table Management Solution. Leveraging zero-knowledge proofs and encrypted hashes, we ensure your equity ownership remains pseudonymous."*

### 1C. Photo Slideshow Box
- Container: `mb-8`, full width
- Inner box: `relative w-full overflow-hidden rounded-xl`, aspect ratio `16/10`
- **Images**: Cycle through 4 PNG images (Tableicity_A through D from the John_Assets folder). Each slide:
  - Crossfade transition: 1 second ease-in-out opacity
  - Slow zoom-in: scale from 1.0 → 1.08 over 6 seconds
  - `object-cover` to fill the box edge-to-edge
  - Auto-advances every 6 seconds
- **Gradient overlay** on top of images:
  - `position: absolute; inset: 0; pointer-events: none; z-index: 10`
  - `background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)`
- **Animated text overlay** (z-index: 20):
  - Positioned: `top: 25%`, `left: 0; right: 0; text-center` (horizontally centered)
  - **Line 1**: `"Own Your Equity,"` — `text-2xl xl:text-[2rem] font-bold leading-tight text-white`
  - **Line 2**: Typewriter animation of `"Privately."` — same font size, `text-white italic`
    - Cursor: `inline-block w-[2px] h-[1.1em] bg-white ml-[1px] align-middle` with pulse animation
    - Typewriter behavior: type at 120ms/char, pause 2s when complete, delete at 80ms/char, pause 500ms, loop
  - Use Framer Motion (`framer-motion` package) for the slideshow transitions. The typewriter is plain JS `setTimeout` logic.

### 1D. Feature Badges Grid
- Divider: `border-t border-white/10 pt-5`
- Label: `"Everything you need — built in"`, `text-xs uppercase tracking-wider text-blue-200/50 mb-3`
- Grid: `grid grid-cols-3 gap-x-4 gap-y-2`
- Each item: `flex items-center gap-2`
  - CheckCircle icon: `h-3.5 w-3.5 text-green-400 shrink-0`
  - Label: `text-xs text-blue-200/70`
- Items (18 total, in order):
  1. Full ESOP Hierarchy
  2. 5 Equity Instruments
  3. SAFE Management
  4. Stakeholder Tracking
  5. Encrypted Data Room
  6. Share Class Definitions
  7. Dashboard & Metrics
  8. PDF Generation - Certificates
  9. Email MFA Security
  10. Role-Based Access (4 Roles)
  11. Audit Logging
  12. Test Drive System
  13. Multi-Tenant Isolation
  14. Platform Admin Panel
  15. 401A Validations
  16. Migrations
  17. AI Powered Simulations
  18. Parent - Child Apps

### 1E. Security Footer
- Divider: `border-t border-white/10 pt-5`
- Label: `"Enterprise-Grade Security"`, `text-[10px] uppercase tracking-wider text-blue-200/50 mb-3`
- 4 rows, each: `flex items-start gap-2.5`
  - Icon: `h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5`
  - Text: `text-xs text-blue-200/70`, with bold label in `text-blue-200/90 font-medium`
- Row content:
  1. **KeyRound icon** — **Authentication:** Multi-Factor Authentication (TOTP), httpOnly Cookies, Custom JWT with Tenant Claims
  2. **Shield icon** — **Access Control:** Role-Based Access Control (RBAC) with 4 tiers, Tenant Isolation Middleware
  3. **Lock icon** — **Encryption:** TLS 1.3 (Transit), pgcrypto for PII (Rest), AWS Parameter Store (Secrets)
  4. **FileCheck icon** — **Compliance:** Immutable Audit Logs, Webhook Signature Verification, CORS/CSRF Protection

---

## STEP 2: Login Panel (Right Side)

### Container
- Takes remaining width: `flex-1 relative`
- Background: `#0a1628`
- **Background image**: A screenshot PNG (you will be provided this separately). Applied as:
  - `position: absolute; inset: 0; background-size: cover; background-repeat: no-repeat; opacity: 0.50; pointer-events: none`
  - `background-position: 0% center`
- Content centered: `absolute inset-0 overflow-y-auto flex items-center justify-center p-6`

### Mobile Logo (visible only below 1024px)
- `lg:hidden absolute top-6 left-6 flex items-center gap-2`
- Icon box: `h-8 w-8 rounded-md bg-blue-600`, Building2 icon (16px, white)
- Text: `"Tableicity"`, `text-lg font-bold text-white`

### Login Card (Glass Card)
- Max width: `max-w-[420px]`, full width
- Styling: `rounded-2xl p-8`
- Border: `border border-[rgba(99,179,237,0.2)]`
- Shadow: `shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(99,179,237,0.08)]`
- Backdrop blur: `backdrop-blur-[20px]`
- Background: `rgba(13, 20, 35, 0.92)`

### Card Content (top to bottom)

**Header block** (`text-center mb-6`):
- Icon: `h-12 w-12 rounded-[10px]`, background `rgba(99,179,237,0.15)`, border `rgba(99,179,237,0.3)`, Building2 icon (24px, `#63B3ED`)
- Badge next to icon: `"Beta 1.01"`, `text-[11px] font-bold tracking-wide text-yellow-400`, border `border-yellow-400/40 rounded-md px-2 py-0.5`
- Title: `"TABLEICITY"`, `text-[22px] font-bold text-white mb-1`
- Subtitle: `"Equity Management for Startups"`, `text-[13px] text-[#718096]`

**Form fields** (`space-y-4`):
- Labels: `text-[#A0AEC0] text-[0.8rem] font-medium`
- Inputs: `bg-[rgba(255,255,255,0.06)] border-[rgba(99,179,237,0.2)] text-[#E2E8F0] placeholder:text-[#4A5568] rounded-lg`
  - Focus: `border-[#63B3ED] ring-2 ring-[rgba(99,179,237,0.2)]`
- Field 1: Email — label `"Email"`, placeholder `"you@company.com"`
- Field 2: Password — label `"Password"`, placeholder `"Password"`, type password

**Submit button**:
- `w-full bg-[#2B6CB0] hover:bg-[#2C5282] text-white font-semibold rounded-lg`
- Text: `"Sign In"`

**Footer links** (`text-center pt-2 space-y-2`):
- `"Don't have an account?"` + link `"Create one"` (`text-[#63B3ED] font-medium hover:underline`) — link to `#` or `https://www.tableicity.com/register`
- `"Or"` + link `"Start a Free Trial"` (`text-[#48BB78] font-medium hover:underline`) — link to `#` or `https://www.tableicity.com/launch`

---

## Color Reference (Hex / RGBA)

| Token | Value |
|---|---|
| Panel background (left) | `#0f1b2d` |
| Panel background (right) | `#0a1628` |
| Glass card background | `rgba(13, 20, 35, 0.92)` |
| Primary blue | `#2B6CB0` |
| Primary blue hover | `#2C5282` |
| Accent blue (links, icons) | `#63B3ED` |
| Border blue | `rgba(99,179,237,0.2)` |
| Green accent | `#48BB78` |
| Yellow accent (badge) | `text-yellow-400` |
| Label text | `#A0AEC0` |
| Muted text | `#718096` |
| Input placeholder | `#4A5568` |
| Input text | `#E2E8F0` |
| Input background | `rgba(255,255,255,0.06)` |

---

## Assets Required

The other agent will need:
1. **Slideshow images**: `Tableicity_A.png`, `Tableicity_B.png`, `Tableicity_C.png`, `Tableicity_D.png` from the `John_Assets/` folder
2. **Login panel background image**: A screenshot PNG (provided separately by you)
3. **Icons**: Use `lucide-react` for all icons (Building2, Zap, CheckCircle2, KeyRound, Shield, Lock, FileCheck)
4. **Animation library**: `framer-motion` for slideshow crossfade/zoom transitions

---

## Implementation Notes

- This is a **static page** — the login form does not submit to any API. The Sign In button can either do nothing or redirect to `https://www.tableicity.com`
- Use Tailwind CSS for all styling (the values above are Tailwind utility classes)
- The page uses the `class` strategy for dark mode but this mock page is always dark — no theme toggle needed
- The `"Create one"` and `"Start a Free Trial"` links should point to the live Tableicity app at `https://www.tableicity.com/register` and `https://www.tableicity.com/launch` respectively
- The Sign In button can redirect to `https://www.tableicity.com` on click
