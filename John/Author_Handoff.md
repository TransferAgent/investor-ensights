# Author Handoff — E-E-A-T Masthead Patch

**Purpose:** apply the Investor Ensights author/E-E-A-T system to a Remix repo (e.g. Tableicity) as a clean patch. This document is self-contained — a second Replit Agent on a different repo should be able to follow this end-to-end without referring back to the source repo.

**Shipped on origin repo (TransferAgent/investor-ensights):** 2026-05-27, deployed to investorensights.com.

---

## What this patch delivers

1. **Author byline on every article** — name, title, publisher, LinkedIn icon, headshot avatar, published date
2. **Author bio block at the bottom of every article** — 140px headshot + ~210-word bio + email + phone + LinkedIn
3. **Full JSON-LD `Person` + `Organization` schema** on every article and on `/about`
4. **`/about` page** — publisher mission (Section 1) + editorial team with masthead author (Section 2), linked from footer
5. **One-shot data rollup script** — stamps the masthead author + contact details across all `knowledge_articles`, `tenants`, and `city_locations` rows in a single atomic Postgres transaction
6. **Decoupled rendering pattern** — display identity is driven by a single source of truth in `lib/author-config.ts`, not by per-row DB columns. The DB column is preserved for data hygiene but ignored at render time. Prevents mixed-identity bugs when a rogue row carries a different `author_name`.

---

## Prerequisites on the target repo

| Item | Requirement |
|---|---|
| Framework | Next.js App Router (any 14+ version) |
| React | 18+ with TypeScript |
| Styling | Tailwind CSS 3 |
| Icons | `lucide-react` already installed |
| Image | `next/image` (built into Next) |
| DB | PostgreSQL with these columns on `knowledge_articles`: `author_name` (text), `publisher_name` (text), and on `city_locations`: `email` (text), `phone_number` (text). If absent, add via migration first. |
| Asset | A headshot JPG at `/public/<headshot>.jpg` (e.g. `/public/john-reynolds.jpg`) |
| Article page | Existing route at `app/discovery/knowledge/[slug]/page.tsx` (rename path as needed for the target) |

---

## Apply order

1. **Add asset** — drop the headshot JPG into `/public/`
2. **Create `lib/author-config.ts`** — the single source of truth
3. **Create `components/articles/author-byline.tsx`** — top-of-article byline
4. **Create `components/articles/author-bio.tsx`** — bottom-of-article bio block
5. **Edit article page** — import + render `<AuthorByline>` and `<AuthorBio>`, add JSON-LD
6. **Create `app/about/page.tsx`** — about + editorial team
7. **Add `/about` link** to footer(s)
8. **Add `/about` to sitemap**
9. **Create `scripts/eeat-author-and-contact-rollup.ts`** — one-shot DB stamp
10. **Run rollup** — `npx tsx scripts/eeat-author-and-contact-rollup.ts --prod --confirm`
11. **Verify** — 4-query check + sitemap canary
12. **Deploy**

---

## File 1: `lib/author-config.ts` (NEW)

This is the single source of truth for the masthead identity. **Update the constants in `PLATFORM_AUTHOR` for the target brand.**

```typescript
export interface AuthorConfig {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  avatarPath: string;
  publisherName: string;
  bioHtml: string;
  /**
   * True when the resolved name matches a known author profile (avatar, social,
   * bio all belong to this person). False when the row carries an unrecognized
   * author name — in that case the byline shows the name but the renderer must
   * suppress avatar, social link, and the bio box to avoid mixed identity.
   */
  hasFullProfile: boolean;
}

export const PLATFORM_AUTHOR: AuthorConfig = {
  name: "Brian Reynolds",
  title: "Senior Financial Analyst",
  email: "info@investorensights.com",
  phone: "(800) 684-8034",
  linkedinUrl: "https://www.linkedin.com/in/brian-reynolds-aa62a457/",
  avatarPath: "/john-reynolds.jpg",
  publisherName: "Investor Ensights",
  bioHtml:
    "Brian Reynolds is the Senior Financial Analyst at Investor Ensights, with 10+ years covering U.S. company formation, equity activity, and small-business capital markets. His work focuses on translating institutional-grade data into clear, actionable insights for founders and investors. Brian publishes daily across Investor Ensights and its sister brands — Tableicity, Veltroy, Haylo, Texitie, and Payrol.",
  hasFullProfile: true,
};

/**
 * Registry of known author profiles keyed by lowercased display name. Add new
 * staff here (with their own avatar, social, bio) before assigning their name
 * to any tenant's `author_name` column. Names not in this registry render as
 * "byline name only" with no avatar/social/bio (prevents mixed identity).
 */
const KNOWN_AUTHORS: Record<string, AuthorConfig> = {
  "brian reynolds": PLATFORM_AUTHOR,
};

export function resolveAuthor(opts: {
  articleAuthorName?: string | null;
  articlePublisherName?: string | null;
}): AuthorConfig {
  const rawName = opts.articleAuthorName?.trim();
  const publisher = opts.articlePublisherName?.trim();
  const effectivePublisher =
    publisher && publisher.length > 0 ? publisher : PLATFORM_AUTHOR.publisherName;

  if (!rawName || rawName.length === 0) {
    return { ...PLATFORM_AUTHOR, publisherName: effectivePublisher };
  }

  const known = KNOWN_AUTHORS[rawName.toLowerCase()];
  if (known) {
    return { ...known, publisherName: effectivePublisher };
  }

  // Unknown author name: render the name + publisher only. Suppress avatar,
  // social, and bio to avoid attaching the platform author's identity to a
  // different person.
  return {
    name: rawName,
    title: PLATFORM_AUTHOR.title,
    email: PLATFORM_AUTHOR.email,
    phone: PLATFORM_AUTHOR.phone,
    linkedinUrl: "",
    avatarPath: "",
    publisherName: effectivePublisher,
    bioHtml: "",
    hasFullProfile: false,
  };
}

export function formatPublishedDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
```

**Tableicity-specific tweaks:** change `name`, `email`, `phone`, `linkedinUrl`, `publisherName`, and `bioHtml`. Keep the `avatarPath` filename consistent with whatever JPG you dropped into `/public/`.

---

## File 2: `components/articles/author-byline.tsx` (NEW)

```tsx
import Image from "next/image";
import { Linkedin } from "lucide-react";
import { formatPublishedDate, type AuthorConfig } from "@/lib/author-config";

interface AuthorBylineProps {
  author: AuthorConfig;
  publishedAt: Date | string | null | undefined;
}

export function AuthorByline({ author, publishedAt }: AuthorBylineProps) {
  const dateLabel = formatPublishedDate(publishedAt);
  const isoDate =
    publishedAt instanceof Date
      ? publishedAt.toISOString()
      : typeof publishedAt === "string"
        ? publishedAt
        : undefined;
  return (
    <div
      className="flex items-center gap-4 mb-8 pb-6 border-b border-white/10"
      data-testid="author-byline"
    >
      {author.avatarPath && (
        <Image
          src={author.avatarPath}
          alt={author.name}
          width={56}
          height={56}
          className="rounded-full object-cover border border-white/15 flex-shrink-0"
          data-testid="img-author-avatar"
        />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <p
          className="text-sm text-blue-100/90 flex flex-wrap items-center gap-x-2 gap-y-1"
          data-testid="text-byline"
        >
          <span>
            <span className="text-blue-200/60">Author </span>
            <span className="font-semibold text-white" data-testid="text-author-name">
              {author.name}
            </span>
          </span>
          <span className="text-blue-200/40">|</span>
          <span className="text-blue-200/80" data-testid="text-author-title">
            {author.title}, {author.publisherName}
          </span>
          {author.linkedinUrl && (
            <a
              href={author.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer me"
              className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/5 border border-white/10 hover:bg-blue-600/30 hover:border-blue-400/40 transition-colors"
              aria-label={`Follow ${author.name} on LinkedIn`}
              data-testid="link-author-linkedin"
            >
              <Linkedin className="h-3.5 w-3.5 text-blue-300" />
            </a>
          )}
        </p>
        {dateLabel && (
          <time
            dateTime={isoDate}
            className="text-xs text-blue-200/60"
            data-testid="text-published-date"
          >
            Published: {dateLabel}
          </time>
        )}
      </div>
    </div>
  );
}
```

> **Color palette note:** these colors (`text-blue-100/90`, `border-white/10`, etc.) assume a **dark article background** (e.g. `bg-[#0f1b2d]`). If the Remix article page uses a light background, invert: `text-neutral-700`, `border-neutral-200`, etc.

---

## File 3: `components/articles/author-bio.tsx` (NEW)

```tsx
import Image from "next/image";
import { Linkedin } from "lucide-react";
import type { AuthorConfig } from "@/lib/author-config";

interface AuthorBioProps {
  author: AuthorConfig;
}

export function AuthorBio({ author }: AuthorBioProps) {
  if (!author.hasFullProfile) {
    return null;
  }
  return (
    <aside
      className="mt-12 pt-8 border-t border-white/10"
      data-testid="author-bio"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-200/50 mb-4">
        About the Author
      </h3>
      <div className="flex gap-4 items-start">
        <Image
          src={author.avatarPath}
          alt={author.name}
          width={72}
          height={72}
          className="rounded-full object-cover border border-white/15 flex-shrink-0"
          data-testid="img-bio-avatar"
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white" data-testid="text-bio-name">
            {author.name}
          </p>
          <p className="text-sm text-blue-200/70 mb-3" data-testid="text-bio-title">
            {author.title}, {author.publisherName}
          </p>
          <p
            className="text-sm text-blue-100/80 leading-relaxed mb-3"
            data-testid="text-bio-body"
          >
            {author.bioHtml}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-200/60">
            <a
              href={`mailto:${author.email}`}
              className="hover:text-blue-300 transition-colors"
              data-testid="link-bio-email"
            >
              {author.email}
            </a>
            <span className="text-blue-200/30">|</span>
            <a
              href={`tel:${author.phone.replace(/[^\d+]/g, "")}`}
              className="hover:text-blue-300 transition-colors"
              data-testid="link-bio-phone"
            >
              {author.phone}
            </a>
            <span className="text-blue-200/30">|</span>
            <a
              href={author.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer me"
              className="inline-flex items-center gap-1 hover:text-blue-300 transition-colors"
              data-testid="link-bio-linkedin"
            >
              <Linkedin className="h-3 w-3" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

---

## File 4: Wire into the article page

Inside `app/discovery/knowledge/[slug]/page.tsx` (or whatever the Remix calls it):

### 4a. Imports at top
```tsx
import { PLATFORM_AUTHOR } from "@/lib/author-config";
import { AuthorByline } from "@/components/articles/author-byline";
import { AuthorBio } from "@/components/articles/author-bio";
```

### 4b. Resolve the author (in the page component, before the render)
```tsx
// Display author is ALWAYS the platform author. article.author_name is preserved
// in the DB for data hygiene but does not drive the rendered byline, bio, or
// JSON-LD identity. When new staff are added later, extend PLATFORM_AUTHOR /
// KNOWN_AUTHORS in lib/author-config.ts and switch this back to per-row
// resolution via resolveAuthor({...}).
const author = PLATFORM_AUTHOR;
```

### 4c. JSON-LD block (put before the article body in the JSX)
```tsx
const jsonLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  headline: article.headline,
  description: article.metaDescription || undefined,
  datePublished: (article.datePublished ?? article.createdAt).toISOString(),
  dateModified: article.dateModified.toISOString(),
  author: {
    "@type": "Person",
    name: author.name,
    jobTitle: author.title,
    email: author.email,
    image: `${BASE_URL}${author.avatarPath}`,
    sameAs: [author.linkedinUrl],
    worksFor: {
      "@type": "Organization",
      name: author.publisherName,
      url: BASE_URL,
    },
  },
  publisher: {
    "@type": "Organization",
    name: author.publisherName,
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/investor-ensights-logo.png`,  // ← replace with target brand's logo path
    },
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${BASE_URL}/discovery/knowledge/${article.slug}`,
  },
};

if (article.ogImageUrl) {
  jsonLd.image = [article.ogImageUrl];
}
```

### 4d. Render in the JSX tree
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>

{/* …other article header content… */}

<AuthorByline author={author} publishedAt={article.datePublished} />

{/* …article body HTML… */}

<AuthorBio author={author} />
```

---

## File 5: `app/about/page.tsx` (NEW)

Full file. Substitute brand-specific copy in the body — the structure is what matters.

```tsx
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Linkedin } from "lucide-react"
import { PLATFORM_AUTHOR } from "@/lib/author-config"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"
const PUBLISHER_NAME = PLATFORM_AUTHOR.publisherName
const COMPANY_LEGAL = "Investor Ensights Inc."
const COMPANY_ADDRESS = "9121 Haven Ave., Rancho Cucamonga, CA 91730"
const CONTACT_EMAIL = PLATFORM_AUTHOR.email
const CONTACT_PHONE = PLATFORM_AUTHOR.phone

export const metadata: Metadata = {
  title: "About & Editorial Team | Investor Ensights",
  description:
    "About Investor Ensights and its editorial team. Meet Brian Reynolds, Senior Financial Analyst, and learn how we publish daily financial insights on U.S. company formation and equity activity.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About & Editorial Team | Investor Ensights",
    description:
      "About Investor Ensights and its editorial team — Brian Reynolds, Senior Financial Analyst, and how we cover U.S. company formation and equity activity.",
    url: `${BASE_URL}/about`,
    type: "website",
    images: [{ url: `${BASE_URL}${PLATFORM_AUTHOR.avatarPath}` }],
  },
  robots: { index: true, follow: true },
}

export default function AboutPage() {
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: PLATFORM_AUTHOR.name,
    jobTitle: PLATFORM_AUTHOR.title,
    image: `${BASE_URL}${PLATFORM_AUTHOR.avatarPath}`,
    email: `mailto:${PLATFORM_AUTHOR.email}`,
    telephone: PLATFORM_AUTHOR.phone,
    sameAs: [PLATFORM_AUTHOR.linkedinUrl],
    worksFor: {
      "@type": "Organization",
      name: PUBLISHER_NAME,
      url: BASE_URL,
    },
    url: `${BASE_URL}/about`,
  }

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLISHER_NAME,
    legalName: COMPANY_LEGAL,
    url: BASE_URL,
    logo: `${BASE_URL}/investor-ensights-logo.png`,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    address: {
      "@type": "PostalAddress",
      streetAddress: "9121 Haven Ave.",
      addressLocality: "Rancho Cucamonga",
      addressRegion: "CA",
      postalCode: "91730",
      addressCountry: "US",
    },
    sameAs: [PLATFORM_AUTHOR.linkedinUrl],
    founder: {
      "@type": "Person",
      name: PLATFORM_AUTHOR.name,
    },
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-10">
          <Link href="/" className="text-[13px] text-neutral-500 hover:text-neutral-900" data-testid="link-back-home">
            ← Back to home
          </Link>
          <h1 className="mt-4 text-[32px] font-semibold tracking-tight sm:text-[40px]" data-testid="text-page-title">
            About &amp; Editorial Team
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500">
            {PUBLISHER_NAME} — publisher and editorial masthead.
          </p>
        </header>

        {/* Section 1: About the publisher */}
        <section className="mb-14" data-testid="section-about-publisher">
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">About {PUBLISHER_NAME}</h2>
          <div className="prose prose-neutral max-w-none text-[15px] leading-relaxed">
            <p>
              {/* SUBSTITUTE brand-specific 3-paragraph mission copy here. */}
              {/* See origin app/about/page.tsx for the Investor Ensights version. */}
            </p>
          </div>
        </section>

        {/* Section 2: Editorial Team */}
        <section className="mb-14" data-testid="section-editorial-team">
          <h2 className="mb-6 text-[22px] font-semibold tracking-tight">Our Editorial Team</h2>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex-shrink-0">
              <Image
                src={PLATFORM_AUTHOR.avatarPath}
                alt={`Headshot of ${PLATFORM_AUTHOR.name}`}
                width={140}
                height={140}
                className="rounded-full border border-neutral-200 object-cover"
                data-testid="img-author-headshot"
                priority
              />
            </div>
            <div className="flex-1">
              <h3 className="text-[20px] font-semibold tracking-tight" data-testid="text-author-name">
                {PLATFORM_AUTHOR.name}
              </h3>
              <p className="mt-1 text-[14px] text-neutral-600" data-testid="text-author-title">
                {PLATFORM_AUTHOR.title}, {PUBLISHER_NAME}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-600">
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-neutral-900 hover:underline" data-testid="link-author-email">
                  {CONTACT_EMAIL}
                </a>
                <span className="text-neutral-300">·</span>
                <a href={`tel:${CONTACT_PHONE.replace(/[^0-9+]/g, "")}`} className="hover:text-neutral-900 hover:underline" data-testid="link-author-phone">
                  {CONTACT_PHONE}
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href={PLATFORM_AUTHOR.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-neutral-900 hover:underline"
                  data-testid="link-author-linkedin"
                  aria-label={`${PLATFORM_AUTHOR.name} on LinkedIn`}
                >
                  <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
          <div className="prose prose-neutral mt-8 max-w-none text-[15px] leading-relaxed">
            <p>
              {/* SUBSTITUTE brand-specific 2-3 paragraph author bio here. */}
              {/* The bio block above uses author.bioHtml (~70 words); this section */}
              {/* is the LONG bio (~200-250 words) for the About page only. */}
            </p>
          </div>
        </section>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-900">Terms of Service</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-neutral-900">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/site-map" className="hover:text-neutral-900">Sitemap</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-neutral-900">Home</Link>
        </footer>
      </div>
    </div>
  )
}
```

---

## File 6: Footer links to `/about`

Add this `<Link>` to every public-facing footer in the target repo (landing page, terms, privacy, site-map, etc.):

```tsx
<Link href="/about" className="hover:text-neutral-900 hover:underline" data-testid="link-about">
  About
</Link>
```

---

## File 7: Add `/about` to sitemap

In `app/sitemap.xml/route.ts` (or `app/sitemap.ts` — whichever the Remix uses), add a static entry:

```typescript
{
  url: `${BASE_URL}/about`,
  lastModified: new Date(),
  changeFrequency: "monthly" as const,
  priority: 0.7,
},
```

---

## File 8: `scripts/eeat-author-and-contact-rollup.ts` (NEW)

**This is the one-shot DB stamp.** Atomic — either every row updates or none do. Run with `--prod --confirm` to commit, omit flags for dry-run.

Adapt the schema names to the target repo's tenant structure. For a single-tenant Remix (e.g. Tableicity standalone), drop the multi-tenant loop and just hit `public` schema directly.

```typescript
// scripts/eeat-author-and-contact-rollup.ts
import { Pool } from "pg";

const TARGET_AUTHOR_NAME = "Brian Reynolds";
const TARGET_PUBLISHER_NAME = "Investor Ensights";
const TARGET_CITY_EMAIL = "info@investorensights.com";
const TARGET_CITY_PHONE = "(800) 684-8034";

// Multi-tenant: list each tenant schema. Single-tenant Remix: just ["public"].
const TENANT_SCHEMAS = ["tableicity", "texitie", "veltroy", "haylo", "payrol"];

const useProd = process.argv.includes("--prod");
const confirm = process.argv.includes("--confirm");
const connectionString = useProd
  ? process.env.PROD_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(`Missing ${useProd ? "PROD_DATABASE_URL" : "DATABASE_URL"}`);
  process.exit(1);
}

console.log(`Mode: ${confirm ? "WRITE (--confirm)" : "DRY-RUN"}`);
console.log(`Targets:`);
console.log(`  author_name      = '${TARGET_AUTHOR_NAME}'`);
console.log(`  publisher_name   = '${TARGET_PUBLISHER_NAME}'`);
console.log(`  city.email       = '${TARGET_CITY_EMAIL}'`);
console.log(`  city.phone_number= '${TARGET_CITY_PHONE}'\n`);

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  let total = 0;
  try {
    await client.query("BEGIN");

    console.log("=== Phase A: knowledge_articles ===");
    for (const schema of TENANT_SCHEMAS) {
      const res = await client.query(
        `UPDATE ${schema === "public" ? "public" : `tenant_${schema}`}.knowledge_articles
         SET author_name = $1, publisher_name = $2
         WHERE author_name IS DISTINCT FROM $1 OR publisher_name IS DISTINCT FROM $2`,
        [TARGET_AUTHOR_NAME, TARGET_PUBLISHER_NAME]
      );
      console.log(`  [${schema}] articles: updated ${res.rowCount}/${res.rowCount} row(s)`);
      total += res.rowCount ?? 0;
    }

    console.log("\n=== Phase B: public.tenants ===");
    const tenantsRes = await client.query(
      `UPDATE public.tenants
       SET author_name = $1, publisher_name = $2
       WHERE author_name IS DISTINCT FROM $1 OR publisher_name IS DISTINCT FROM $2`,
      [TARGET_AUTHOR_NAME, TARGET_PUBLISHER_NAME]
    );
    console.log(`  public.tenants: updated ${tenantsRes.rowCount} row(s)`);
    total += tenantsRes.rowCount ?? 0;

    console.log("\n=== Phase C: city_locations ===");
    for (const schema of TENANT_SCHEMAS) {
      const res = await client.query(
        `UPDATE ${schema === "public" ? "public" : `tenant_${schema}`}.city_locations
         SET email = $1, phone_number = $2
         WHERE email IS DISTINCT FROM $1 OR phone_number IS DISTINCT FROM $2`,
        [TARGET_CITY_EMAIL, TARGET_CITY_PHONE]
      );
      console.log(`  [${schema}] cities: updated ${res.rowCount} row(s)`);
      total += res.rowCount ?? 0;
    }

    if (confirm) {
      await client.query("COMMIT");
      console.log(`\n✅ Committed. Total rows changed: ${total}`);
    } else {
      await client.query("ROLLBACK");
      console.log(`\n🧪 DRY-RUN. Would have changed ${total} rows. Re-run with --confirm to commit.`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Rollback. Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
```

**Run:**
```bash
# Dry-run first (always)
npx tsx scripts/eeat-author-and-contact-rollup.ts --prod
# Then commit
npx tsx scripts/eeat-author-and-contact-rollup.ts --prod --confirm
```

---

## Verification — run after the rollup commits

```sql
-- 1. Article counts per tenant (should be 100% Brian Reynolds)
SELECT 'tableicity', COUNT(*) FILTER (WHERE author_name='Brian Reynolds') AS brian, COUNT(*) AS total
FROM tenant_tableicity.knowledge_articles
-- repeat per tenant ...

-- 2. Tenant rollup
SELECT slug, author_name, publisher_name FROM public.tenants ORDER BY slug;

-- 3. City uniformity check
SELECT COUNT(DISTINCT email) AS distinct_emails, COUNT(DISTINCT phone_number) AS distinct_phones
FROM tenant_tableicity.city_locations;
-- Expect: 1 distinct email, 1 distinct phone

-- 4. Spot-check Atlanta
SELECT name, email, phone_number FROM tenant_tableicity.city_locations
WHERE name ILIKE 'Atlanta' LIMIT 1;
```

**Sitemap canary after deploy:**
```bash
curl -s https://<target-domain>/sitemap.xml | grep -c '<loc>'
# Expect: previous count + 1 (for /about)
```

---

## Known gotchas

1. **Renderer ignores DB `author_name`.** This is on purpose. The display author is hardcoded to `PLATFORM_AUTHOR` in `lib/author-config.ts`. The DB column is preserved for data hygiene (audit, future per-row resolution). Don't try to "fix" this by reading `article.author_name` — you'll reintroduce mixed-identity bugs.

2. **Avatar filename can drift from the displayed name.** In Investor Ensights the avatar is `/john-reynolds.jpg` even though the displayed author is Brian Reynolds (the photo IS Brian; filename is internal-only legacy). This is fine. Don't rename the file just to match the name — it triggers a no-value-add asset migration.

3. **`hasFullProfile: false` suppresses the bio.** This is the safety valve for unknown author names — if a rogue row carries someone we don't have a profile for, the byline shows just the name, no avatar/social/bio. Don't disable this guard.

4. **Color palette assumes dark article background.** The byline + bio components use `text-blue-100/90`, `border-white/10`, etc. If the target article page has a light background, invert the colors to `text-neutral-700`, `border-neutral-200`, etc., or those elements will be invisible.

5. **Forward-only deletes.** Once the rollup commits, those `author_name` values are the new floor. Don't run a "reset to NULL" script — it breaks the audit trail.

6. **Drizzle schema changes.** If the Remix uses Drizzle ORM, add `authorName` and `publisherName` to the `knowledge_articles` schema definition and run `drizzle-kit push` BEFORE running the rollup script — otherwise the type-checked admin UI won't see the columns.

---

## Rollback (if needed)

The rollup is atomic — if the transaction fails mid-way it rolls back automatically. To undo a successful commit:

```sql
-- Restore from backup, or:
UPDATE tenant_<slug>.knowledge_articles SET author_name = <previous_value> WHERE ...;
```

There is no automatic rollback script. Take a snapshot before running the rollup if you're nervous.

---

## Files summary

| Action | Path | Type |
|---|---|---|
| Add | `/public/<headshot>.jpg` | Asset |
| Add | `lib/author-config.ts` | New |
| Add | `components/articles/author-byline.tsx` | New |
| Add | `components/articles/author-bio.tsx` | New |
| Edit | `app/discovery/knowledge/[slug]/page.tsx` (or equivalent) | Imports + JSON-LD + render `<AuthorByline>`/`<AuthorBio>` |
| Add | `app/about/page.tsx` | New |
| Edit | Public footers (landing, terms, privacy, site-map) | Add `/about` link |
| Edit | `app/sitemap.xml/route.ts` (or `app/sitemap.ts`) | Add `/about` entry |
| Add | `scripts/eeat-author-and-contact-rollup.ts` | New |

End of handoff.
