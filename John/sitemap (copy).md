# Sitemap Postmortem & Playbook — Investor Ensights

> **Purpose**: Captures the full story of getting Google Search Console to accept the sitemap on `investorensights.com` (May 2026), the dead-ends we chased, the actual fix, and a reusable playbook for the next site.
>
> **Outcome**: ✅ GSC reports **Status: Success, 45 discovered pages** as of 2026-05-06.

---

## TL;DR

**Root cause**: The Next.js metadata-route sitemap (`app/sitemap.ts`) shipped with two HTTP response headers that Google's sitemap fetcher rejects:
1. `Cache-Control: private, max-age=0, must-revalidate` (Next.js + Replit Frontend default for dynamic responses)
2. `Set-Cookie: GAESA=...` (Google Frontend session cookie attached to dynamic responses)

Sitemaps are public artifacts that should never be session-bound. Google's general-purpose crawler tolerates these headers on HTML pages, but the **sitemap-specific fetcher is stricter** and rejects responses that look session-bound.

**The fix**: Replace `app/sitemap.ts` (Next metadata-route convention) with `app/sitemap.xml/route.ts` (custom route handler) that returns a `Response` with explicit, sitemap-correct headers:
```
Content-Type:  application/xml; charset=utf-8
Cache-Control: public, s-maxage=300, stale-while-revalidate=3600
X-Robots-Tag:  noindex
```
**No cookies. No `private`. No RSC framework noise.**

Total cost of the fix: one new file (~135 lines), one deleted file, ~20 minutes of work, zero behavior change for users.

---

## Timeline — what we tried, in order

| # | Hypothesis | Action | Result |
|---|---|---|---|
| 1 | Sitemap content is wrong | Verified XML is valid, 45 URLs, served as `application/xml` | ✅ Content fine — not the issue |
| 2 | Sitemap is being cached as HTML | Added `revalidate = 300` and dynamic `lastmod` from `max(updatedAt)` | Helped freshness but didn't fix GSC |
| 3 | GSC error "Sitemap is HTML" | Found `/sitemap` (no `.xml`) was returning Next.js 404 HTML page; added 4 redirects in `next.config.mjs` (`/sitemap`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/sitemaps.xml` → 308 → `/sitemap.xml`) | ✅ Fixed the HTML-fallback issue, but new error appeared: "Couldn't fetch" |
| 4 | `www.investorensights.com` had no DNS | Recommended apex-only submission in GSC; user added `www` DNS in GoDaddy as belt-and-suspenders | DNS added, but TLS cert (`CN=investorensights.com`) doesn't cover `www`, so HTTPS to `www` fails. Apex was always the correct submission anyway. |
| 5 | GSC entry was a stale "Couldn't fetch" from before redirect deploy | Suggested remove + re-add sitemap in GSC | Worth trying but didn't change status |
| 6 | **Headers**: `Cache-Control: private` + `Set-Cookie` are tripping Google's sitemap fetcher | **Migrated `app/sitemap.ts` → `app/sitemap.xml/route.ts`** (route handler with clean headers) and deployed | ✅ **Fixed.** GSC went from "Couldn't fetch" → "Success, 45 pages discovered" within minutes of resubmission. |

---

## Red herrings — what looked promising but wasn't the cause

These all consumed time and turned out not to matter. Recognize them faster next time:

### 1. "Framework serves homepage as an HTML fallback when `sitemap.xml` is missing"
**False for Next.js App Router.** Next never falls back to the homepage. It returns a real 404 (HTML) only for paths that have no route. If `/sitemap.xml` is present (even as a metadata route), it returns XML. The real "HTML fallback" issue was specifically `/sitemap` (no extension) hitting the 404 page — fixed with redirects, not relevant to the actual GSC error we were chasing.

### 2. "GSC must be pointed at `www`"
The user had **already submitted the apex** (`/sitemap.xml` under property `https://investorensights.com/`). The `www` DNS detour was a self-inflicted distraction; apex was correct from the start. Lesson: **always look at the GSC screenshot first** before theorizing about which URL was submitted.

### 3. "Need to add `www` DNS + TLS cert"
Adding the DNS record without also adding `www` to the deployment's TLS-covered domains made things slightly *worse* — DNS resolved to a server that couldn't complete the TLS handshake for that hostname. If you don't need `www` (most modern sites don't), don't add it.

### 4. "The `Vary: rsc, next-router-state-tree, ...` headers are confusing Google"
**Plausible but turned out not to be the blocker.** Per RFC 9110, multiple `Vary` field-lines combine into one comma-separated list, so Google sees `Vary: Accept-Encoding, rsc, ...`. Removing cookies + fixing cache-control was sufficient; Vary tokens were not the cause. We tried and **could not** strip the rsc tokens from inside the Next.js stack (middleware runs before the response is generated; setting `Vary` in the route handler results in two Vary lines, not replacement). We accept this limitation; it didn't block GSC acceptance.

### 5. "GSC just needs more time / retries on its own"
Worth waiting 24–72h before deploying changes, but not in this case — we had a clear technical hypothesis and a fast fix. **Don't wait when you have a real lead.**

---

## What actually fixed it

### The change

```diff
- app/sitemap.ts                  (Next.js metadata-route convention; deleted)
+ app/sitemap.xml/route.ts        (custom route handler; new)
```

### The new route handler — annotated skeleton

```ts
// app/sitemap.xml/route.ts
import { storage } from "@/lib/storage"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com").replace(/\/$/, "")

export const revalidate = 300         // ISR every 5 min
export const dynamic = "force-static" // Cache at the edge between revalidations

// ... entry-collection logic identical to the old sitemap.ts ...

function renderXml(entries: Entry[]): string {
  // Hand-rendered <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  // with XML-escaping for slugs (defends against & < > " ' in URLs)
}

export async function GET(): Promise<Response> {
  const entries = await buildEntries()
  return new Response(renderXml(entries), {
    status: 200,
    headers: {
      "Content-Type":  "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "X-Robots-Tag":  "noindex",  // hide the sitemap URL from search results, not its contents
      "Vary":          "Accept-Encoding",
    },
  })
}
```

### Why this works

| Old header (rejected) | New header (accepted) | Why it matters |
|---|---|---|
| `cache-control: private, max-age=0, must-revalidate` | `cache-control: public, s-maxage=300, stale-while-revalidate=3600` | `private` tells caches "this is per-user." Sitemaps are public artifacts. Google's sitemap fetcher reads `private` as "you don't intend this to be a shared resource" and bails. |
| `set-cookie: GAESA=...` | *(no cookie)* | Sitemaps must not set cookies. A response with `Set-Cookie` looks session-bound — Google can't reliably re-fetch it. |
| `vary: rsc, next-router-state-tree, ...` | *(framework still appends; can't suppress)* | Per RFC, multiple Vary lines are equivalent to a combined list. Not the blocker once cookie + private are gone. |

---

## Reusable diagnostic playbook — for the next site

### Step 0 — Look at the GSC screenshot before theorizing

Before any code change or DNS change, **get a screenshot of the GSC Sitemaps page.** Confirm:
- Which property is verified? (apex vs `www` vs Domain Property)
- What URL was submitted? (the full path, not just `/sitemap.xml`)
- What is the exact status text? ("Couldn't fetch" vs "Sitemap is HTML" vs "Couldn't read your sitemap" — these are different errors)
- What is the "Last read" timestamp? Empty = Google has never successfully read it.

Skipping this step caused us to chase the `www` DNS rabbit hole when the user had already submitted the apex.

### Step 1 — Verify the URL works from outside

```bash
# 1. Headers (quick sanity)
curl -I https://YOUR_DOMAIN/sitemap.xml

# 2. Headers as Googlebot
curl -I -A "Googlebot/2.1 (+http://www.google.com/bot.html)" https://YOUR_DOMAIN/sitemap.xml

# 3. Body sanity — should start with <?xml and contain <urlset>
curl -s https://YOUR_DOMAIN/sitemap.xml | head -5

# 4. URL count
curl -s https://YOUR_DOMAIN/sitemap.xml | grep -c '<url>'

# 5. robots.txt allows crawling
curl -s https://YOUR_DOMAIN/robots.txt

# 6. SSL/TLS sanity
echo | openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName -dates
```

If any of these fail → fix that first. If all pass and GSC still rejects, go to Step 2 (the real diagnosis).

### Step 2 — Check the response headers carefully

This is the step we missed initially. Look at the **full** header block, not just status code:

```bash
curl -sI https://YOUR_DOMAIN/sitemap.xml
```

**Red flags for sitemaps:**
- `Cache-Control: private` → bad. Should be `public, s-maxage=N, stale-while-revalidate=M`.
- `Set-Cookie: ...` → bad. Sitemap responses must not set cookies.
- `Content-Type: text/html` → bad. Must be `application/xml` (or `text/xml`).
- `Cache-Control: no-store` → bad. Sitemaps should be cacheable.
- `WWW-Authenticate` → bad. Sitemap requires auth (broken setup).

Any one of these can cause "Couldn't fetch."

### Step 3 — Use GSC's URL Inspection → Test Live URL

In Search Console: top search bar → paste the full sitemap URL → click "Test Live URL." This gives a precise error code (DNS error, server error, blocked, redirect loop, etc.) that the Sitemaps page hides.

If Test Live URL says **OK** but Sitemaps tab still says "Couldn't fetch" → it's a stale GSC status, not a real failure. Remove + re-add the sitemap entry to force a fresh fetch.

### Step 4 — If headers are bad and you're on Next.js App Router

The Next.js metadata-route convention (`app/sitemap.ts`) gives you very little control over response headers. If you need clean headers, **migrate to a route handler:**

1. Create `app/sitemap.xml/route.ts` returning a `Response` with explicit headers (template above).
2. Hand-render the XML (~30 lines including escaping).
3. Move the entry-collection logic verbatim from `app/sitemap.ts`.
4. **Delete `app/sitemap.ts` in the same commit** to avoid duplicate-route registration.
5. Verify locally: `curl -I http://localhost:5000/sitemap.xml` should show your new headers and **no `Set-Cookie`**.
6. Deploy. Verify in prod with the same `curl -I` command.
7. In GSC: remove the existing sitemap entry → re-add → Test Live URL. Should flip to Success within minutes.

### Step 5 — DNS / hostname checklist (only if applicable)

Only relevant if Step 1's curl tests fail with DNS or TLS errors:
- DNS resolves: `getent hosts your-domain.com` or `dig your-domain.com`
- TLS cert covers the hostname being submitted: check `Subject` and `subjectAltName` from `openssl s_client`
- If the cert doesn't cover `www`, either (a) submit the apex in GSC, or (b) add `www` to your deployment's custom domains so TLS gets issued for it. **Adding `www` DNS alone is not enough — TLS must also cover it.**

---

## Decision matrix — when to use which sitemap pattern in Next.js

| Situation | Use | Why |
|---|---|---|
| Static site, <100 URLs, no DB | `app/sitemap.ts` (metadata route) | Simplest. Defaults are fine. |
| DB-backed, <5K URLs, no GSC issues | `app/sitemap.ts` (metadata route) | Easiest path. Revisit if GSC complains. |
| DB-backed, GSC rejecting with header-related errors | **`app/sitemap.xml/route.ts` (route handler)** | Full header control. Our case. |
| DB-backed, >5K URLs | Route handler with sitemap-index split | Single file approaches the 50K URL / 50 MB limit. |
| Hosted on a platform that injects session cookies on all dynamic responses (Replit Deployments, some App Engine setups, Vercel with auth middleware) | **Route handler from day one** | Avoid the diagnostic detour entirely. |

---

## Per-platform gotchas

### Replit Deployments (Google Frontend)
- Attaches `Set-Cookie: GAESA=...` to dynamic responses by default. **Always** use a route handler for sitemaps to avoid this.
- Returns `Cache-Control: private, max-age=0, must-revalidate` on dynamic responses unless your handler explicitly sets `Cache-Control`.

### Vercel
- Doesn't attach session cookies by default, but auth middleware (e.g., NextAuth, Clerk middleware matchers) can. Make sure your sitemap path is excluded from auth middleware matchers.

### Self-hosted (Node behind nginx/Cloudflare)
- Check that your reverse proxy isn't injecting `Set-Cookie` for analytics/session tracking on `/sitemap.xml`.
- Cloudflare can be configured to bypass cache for `/sitemap.xml` — verify with `curl -I` against the production URL.

---

## What to do *first* on the next site (the 5-minute SEO health check)

Run this before submitting to GSC. Catches 90% of sitemap-acceptance issues before Google ever sees them:

```bash
URL="https://YOUR_DOMAIN/sitemap.xml"

echo "=== Headers ==="
curl -sI "$URL"

echo
echo "=== Headers as Googlebot ==="
curl -sI -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "$URL"

echo
echo "=== Cookies present? (BAD if any output) ==="
curl -sI "$URL" | grep -i "set-cookie"

echo
echo "=== Cache-Control ==="
curl -sI "$URL" | grep -i "cache-control"

echo
echo "=== Content-Type (must be application/xml or text/xml) ==="
curl -sI "$URL" | grep -i "content-type"

echo
echo "=== URL count ==="
curl -s "$URL" | grep -c '<url>'

echo
echo "=== robots.txt sanity ==="
curl -s "https://YOUR_DOMAIN/robots.txt"
```

**Pass criteria:**
- Status: `200`
- `Content-Type: application/xml` (or `text/xml`)
- `Cache-Control: public, ...` — never `private`
- **No** `Set-Cookie` header
- URL count > 0 and matches your expectation
- `robots.txt` allows crawling and includes a `Sitemap:` line

Fail any of these → fix before submitting. Saves you from "Couldn't fetch" diagnostics later.

---

## Files changed in this fix (Investor Ensights, May 2026)

| Commit | What |
|---|---|
| `b23ac04` (Phase 1) | Added `revalidate = 300` and dynamic `lastmod` to `app/sitemap.ts` |
| `7716d80` | Added 4 redirects in `next.config.mjs` for `/sitemap`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/sitemaps.xml` → `/sitemap.xml` |
| `73e0f849` (the fix) | Replaced `app/sitemap.ts` with `app/sitemap.xml/route.ts` (route handler with clean headers, no cookies) |
| `427b2f9` | Deployed the route handler to prod |

After deploy: removed and re-added sitemap entry in GSC → Status flipped from "Couldn't fetch" to **"Success, 45 pages discovered"** within minutes.

---

## Reference — full route handler

See `app/sitemap.xml/route.ts` in this repo. ~135 lines, no external dependencies beyond `@/lib/storage`. Reusable as a template for any Next.js App Router project that needs a DB-backed sitemap with clean headers.

---

*Document last updated: 2026-05-06 — sitemap accepted by GSC. Use this as the playbook for the next site (Tableicity remix, future tenant subdomains, any new Next.js publication).*
