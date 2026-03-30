# Liquid Encrypt — Split-Panel Landing Page Architecture

This document provides granular implementation specs for building a two-panel landing page with a marketing pitch on the left and a login card with cookie gateway on the right. Adapted from the Tableicity marketing site.

---

## Overall Layout (HeroHome Wrapper)

The landing page is a full-screen horizontal split — two panels side by side.

```
Container: min-h-screen flex (flexbox row)
├── Left Panel  (MarketingPanel) — 45% width, scrollable content
└── Right Panel (LoginPanel)     — flex-1 (fills remaining 55%), sticky, full viewport height
```

- The left panel scrolls independently while the right panel stays locked in the viewport.
- On screens below `lg` (1024px), the left panel is hidden (`hidden lg:flex`), and only the right panel displays with a mobile brand header.

---

## LEFT PANEL — Marketing Pitch

### Colors

| Element | Value |
|---|---|
| Panel background | `#0f1b2d` |
| Primary text (headings) | `text-white` |
| Secondary text (body, features) | `text-blue-200/80` (rgba 191, 219, 254, 0.8) |
| Muted text (labels, section headers) | `text-blue-200/50` (rgba 191, 219, 254, 0.5) |
| Feature list text | `text-blue-200/70` |
| Accent icon color (checkmarks) | `text-green-400` |
| Accent icon color (security icons) | `text-blue-400` |
| Highlight badges | `text-yellow-400` (zap icon), `text-green-400` (check icon) |
| Brand icon background | `bg-blue-600` |
| Divider lines | `border-white/10` |

### Fonts

| Element | Size | Weight | Extra |
|---|---|---|---|
| Brand name (h1) | `text-lg` (18px) | `font-bold` | `tracking-tight` |
| Subtitle (h2) | `text-sm` (14px) | `font-normal` | `leading-relaxed` |
| Body pitch (h3) | `text-sm` (14px) | `font-normal` | `leading-relaxed` |
| Section headers | `text-xs` (12px) | `font-normal` | `uppercase tracking-wider` |
| Feature list items | `text-xs` (12px) | `font-normal` | — |
| Security labels | `text-xs` (12px) | `font-medium` | — |
| Badge text | `text-xs` (12px) | — | — |

### Slideshow (Auto-Scroll Feature)

The slideshow is the centerpiece of the left panel — a full-width image carousel with Ken Burns zoom effect.

**Container:**
- `w-full overflow-hidden rounded-xl`
- Aspect ratio: `16/10`
- Images are `absolute inset-0 w-full h-full object-cover`

**Animation (Framer Motion):**
- `AnimatePresence mode="popLayout"` wraps the current slide
- Each slide enters with `opacity: 0, scale: 1.0`
- Animates to `opacity: 1, scale: endScale`
- Exits with `opacity: 0`
- Opacity transition: `duration: 1s, ease: easeInOut`
- Scale transition: `duration: slideDuration / 1000, ease: linear`

**Slide Timing (per slide):**
- Default duration: `7200ms` (7.2 seconds)
- Extended slides (e.g., slides 3–5): `14400ms` (14.4 seconds)
- Configure via array: `SLIDE_DURATIONS = [7200, 7200, 14400, 14400, 14400, 7200, 7200]`

**Zoom Scale (per slide):**
- Default end scale: `1.08` (subtle zoom)
- Extended slides (e.g., slides 3–5): `1.62` (dramatic zoom)
- Configure via object: `SLIDE_END_SCALE = { 2: 1.62, 3: 1.62, 4: 1.62 }`

**Overlay gradient on top of slideshow:**
```css
background: linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)
```
- `absolute inset-0 pointer-events-none z-10`

**Auto-advance logic:**
```
useEffect with setTimeout → advances to next slide index
Wraps around: (currentSlide + 1) % totalSlides
Cleans up timeout on unmount or slide change
```

### Left Panel Padding
- `p-10 xl:p-12` on the content wrapper
- `flex flex-col justify-between h-full` fills the panel vertically

---

## RIGHT PANEL — Login Card Stack

The right panel uses absolute positioning to layer four elements on top of each other. Think of it as a stack of transparent sheets, bottom to top:

```
z-[1]  →  PNG Peek Image (your app screenshot — FULL OPACITY, no transparency)
z-[2]  →  Dark Filter Overlay (controls how much peek image shows through)
z-[3]  →  Login Card (glass card with form fields)
z-[10] →  Cookie Card (gateway overlay on top of everything)
```

### Layer 1: PNG Peek Image (z-[1])

This is your app screenshot. It fills the entire right panel as a background peek.

```css
position: absolute;
inset: 0;
pointer-events: none;
z-index: 1;
background-image: url(/your-peek-image.png);  /* YOUR PNG — keep at 100%, no opacity reduction */
background-size: cover;
background-repeat: no-repeat;
background-position: 0% center;  /* Aligned to left edge so the peek shows the app's left side */
```

**Critical: The PNG itself must remain at 100% opacity. The image is NOT dimmed. The filter layer above it handles the dimming.**

### Layer 2: Dark Filter Overlay (z-[2])

This sits on top of the peek image and controls how much of it bleeds through.

```css
position: absolute;
inset: 0;
pointer-events: none;
z-index: 2;
background-color: rgba(10, 22, 40, 0.80);  /* 80% opacity dark navy filter */
```

- Color `rgb(10, 22, 40)` is a deep navy that matches the overall dark theme
- `0.80` opacity means 20% of the peek image shows through — enough to hint at the app without distracting from the login card
- Adjust the `0.80` value to control peek intensity (higher = darker, lower = more peek visible)

### Layer 3: Login Card (z-[3])

The login card floats centered in the panel with a glass-morphism effect.

**Card Container:**
```css
position: absolute;
inset: 0;
overflow-y: auto;
display: flex;
align-items: center;
justify-content: center;
padding: 24px;  /* p-6 */
z-index: 3;
```

**Card Itself:**
```css
width: 100%;
max-width: 420px;
border-radius: 16px;  /* rounded-2xl */
padding: 32px;  /* p-8 */
position: relative;  /* IMPORTANT: Cookie card positions absolute relative to this */
border: 1px solid rgba(99, 179, 237, 0.2);
box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.08);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: rgba(13, 20, 35, 0.92);  /* Semi-transparent dark glass */
```

**Login Card Colors:**

| Element | Value |
|---|---|
| Card background | `rgba(13, 20, 35, 0.92)` |
| Card border | `rgba(99, 179, 237, 0.2)` — light blue at 20% |
| Title text | `text-white` |
| Subtitle text | `#718096` (gray-500) |
| Label text | `#A0AEC0` (gray-400) |
| Input background | `rgba(255, 255, 255, 0.06)` |
| Input border | `rgba(99, 179, 237, 0.2)` |
| Input border (focused) | `#63B3ED` with `box-shadow: 0 0 0 2px rgba(99,179,237,0.2)` |
| Input text | `#E2E8F0` (gray-200) |
| Submit button | `#2B6CB0` (blue-600), hover: `#2C5282` (blue-700) |
| Link color (create account) | `#63B3ED` (blue-300) |
| Link color (free trial) | `#48BB78` (green-400) |
| Footer divider | `rgba(99, 179, 237, 0.1)` |

**Login Card Fonts:**

| Element | Size | Weight |
|---|---|---|
| App title (h1) | `22px` | `font-bold` |
| Subtitle | `13px` | normal |
| Labels | `0.8rem` (~13px) | `font-medium` |
| Input text | `text-sm` (14px) | normal |
| Submit button | inherits | `font-semibold` |
| Footer links | `text-sm` (14px) | `font-medium` |
| Email link | `text-xs` (12px) | normal |

**Beta Badge (optional):**
```css
font-size: 11px;
font-weight: bold;
letter-spacing: wide;
color: #FACC15;  /* yellow-400 */
border: 1px solid rgba(250, 204, 21, 0.4);
border-radius: 6px;
padding: 2px 8px;
```

### Layer 4: Cookie Card (z-[10]) — The Gateway

The cookie card is an absolute-positioned overlay that sits ON TOP of the login card. It is always visible — never saved, never dismissed. Both buttons redirect to your app.

**Positioning (relative to the login card's `relative` container):**
```css
position: absolute;
z-index: 10;
top: 150px;       /* Positioned below the card header/logo area */
left: 50%;
transform: translateX(-50%);  /* Centered horizontally */
width: 87%;       /* Slightly narrower than the card for visual hierarchy */
```

**Cookie Card Container:**
```css
background: rgba(13, 20, 35, 0.97);  /* Nearly opaque dark glass */
border: 1px solid rgba(99, 179, 237, 0.3);
border-radius: 12px;
overflow: hidden;
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
```

**Top accent bar:**
```css
height: 4px;
background: #2B6CB0;  /* Solid blue strip at top of card */
```

**Content padding:** `16px`

**Cookie Icon:**
- Uses emoji "🍪" (not a lucide icon — avoids production minification bugs)
- Container: `32px x 32px`, `border-radius: 8px`
- Background: `rgba(99, 179, 237, 0.15)`
- Border: `1px solid rgba(99, 179, 237, 0.25)`

**Cookie Card Text:**

| Element | Size | Color | Weight |
|---|---|---|---|
| Heading ("We value your privacy") | `text-sm` (14px) | `text-white` | `font-semibold` |
| Body text | `text-xs` (12px) | `#A0AEC0` | normal, `leading-relaxed` |

**Buttons (side by side, equal width):**
```
Container: flex gap-2.5 mt-3.5
Both buttons: flex-1 py-2 rounded-lg text-[13px] font-medium
```

Reject All button:
```css
border: 1px solid rgba(99, 179, 237, 0.2);
background: transparent;
color: #A0AEC0;
```

Accept All button:
```css
border: none;
background: #2B6CB0;
color: white;
```

**Behavior:**
- No X button — card cannot be dismissed
- No localStorage — nothing is saved, card always appears on every page load
- Both "Accept All" and "Reject All" redirect to your app URL
- The user perceives a choice even though both paths lead to the same destination
- Uses `useState(false)` for `mounted` + `useEffect` to set `true` — prevents SSR hydration mismatch
- Only renders after client-side mount (`if (!mounted) return null`)

---

## Right Panel Base Settings

```css
flex: 1;              /* Takes remaining width after left panel's 45% */
position: sticky;
top: 0;
height: 100vh;        /* Locked to viewport height — does not scroll with left panel */
background-color: #0a1628;  /* Fallback color behind the peek image */
```

---

## Mobile Behavior (below 1024px)

- Left panel: `hidden lg:flex` — completely hidden on mobile
- Right panel: fills full screen
- Mobile brand header appears: `lg:hidden absolute top-6 left-6` with the app icon and name
- Login card and cookie card function identically on mobile

---

## Production Build Warning

Avoid these patterns in production-minified Next.js builds — they cause silent JavaScript crashes:
- `Set`, `Map`, and IIFE patterns inside JSX
- Lucide icon imports used only inside conditionally-rendered blocks (use emoji instead)
- HTML entities like `&ldquo;` in JSX strings (use escaped quotes in plain strings instead)
- `onMouseEnter`/`onMouseLeave` inline handlers with complex logic

---

## Z-Index Summary

| Layer | z-index | Element |
|---|---|---|
| PNG Peek Image | `z-[1]` | Full-panel background screenshot |
| Dark Filter | `z-[2]` | `rgba(10, 22, 40, 0.80)` overlay |
| Login Card + mobile header | `z-[3]` | Glass card with form |
| Cookie Gateway Card | `z-[10]` | Always-visible redirect overlay |

---

## Color Palette Quick Reference

| Name | Hex/RGBA | Usage |
|---|---|---|
| Deep Navy | `#0a1628` | Right panel background |
| Panel Navy | `#0f1b2d` | Left panel background |
| Card Glass | `rgba(13, 20, 35, 0.92)` | Login card background |
| Cookie Glass | `rgba(13, 20, 35, 0.97)` | Cookie card background |
| Filter Overlay | `rgba(10, 22, 40, 0.80)` | Peek image dimmer |
| Blue Accent | `#63B3ED` | Links, focus states, icon tints |
| Blue Button | `#2B6CB0` | Primary buttons |
| Blue Button Hover | `#2C5282` | Button hover state |
| Green Accent | `#48BB78` | Free trial link |
| Yellow Badge | `#FACC15` | Beta badge text |
| Gray Text | `#718096` | Subtitles, muted text |
| Gray Label | `#A0AEC0` | Labels, descriptions |
| Light Text | `#E2E8F0` | Input text |
| White | `#FFFFFF` | Headings, button text |
