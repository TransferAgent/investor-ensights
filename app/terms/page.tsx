import type { Metadata } from "next"
import Link from "next/link"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"
const EFFECTIVE_DATE = "May 5, 2026"

export const metadata: Metadata = {
  title: "Terms of Service | Investor Ensights",
  description:
    "Terms of Service governing use of Investor Ensights, a programmatic-SEO publishing platform providing financial insights on local company formation and equity activity.",
  alternates: { canonical: `${BASE_URL}/terms` },
  openGraph: {
    title: "Terms of Service | Investor Ensights",
    description:
      "Terms of Service governing use of Investor Ensights.",
    url: `${BASE_URL}/terms`,
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="text-[13px] text-neutral-500 hover:text-neutral-900"
            data-testid="link-back-home"
          >
            ← Back to home
          </Link>
          <h1
            className="mt-4 text-[32px] font-semibold tracking-tight sm:text-[40px]"
            data-testid="text-page-title"
          >
            Terms of Service
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500" data-testid="text-effective-date">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <article className="prose prose-neutral max-w-none text-[15px] leading-relaxed">
          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Investor Ensights (&quot;Service&quot;), provided by Investor
              Ensights Inc. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), you agree to be
              bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">2. Description of Service</h2>
            <p>
              Investor Ensights is a programmatic publishing platform providing financial
              insights on local company formation and equity activity for institutional and
              retail investors. Content is generated using a combination of public data sources
              and automated tooling and is provided for informational purposes only.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">3. No Investment Advice</h2>
            <p>
              Nothing on the Service constitutes legal, tax, accounting, or investment advice
              or a recommendation to buy or sell any security. You should consult a licensed
              professional before making any financial decision. We make no representations or
              warranties about the accuracy, completeness, or timeliness of any information on
              the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">4. Account Registration</h2>
            <p>
              If you create an account, you agree to provide accurate information and to keep
              your credentials secure. You are responsible for all activity under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6">
              <li>Scrape, crawl, or otherwise extract content at scale without written permission.</li>
              <li>Reverse-engineer, decompile, or attempt to bypass any access controls.</li>
              <li>Upload or transmit unlawful, infringing, or harmful content.</li>
              <li>Use the Service to violate any applicable law or third-party right.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">6. Intellectual Property</h2>
            <p>
              The Service, including all text, graphics, code, and design, is owned by Investor
              Ensights Inc. or its licensors and is protected by intellectual-property laws.
              You receive a limited, non-exclusive, non-transferable license to access the
              Service for personal, non-commercial use.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">7. Third-Party Content and Links</h2>
            <p>
              The Service may include links to third-party sites or content we do not control.
              We are not responsible for the availability, accuracy, or practices of any
              third-party site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
              warranties of any kind, express or implied, including merchantability, fitness for
              a particular purpose, and non-infringement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Investor Ensights Inc. and its affiliates
              will not be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of profits or revenues, arising out of or related to
              your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Investor Ensights Inc. from any claim or
              demand arising out of your use of the Service or your breach of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">11. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or
              without notice, for any reason, including violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">12. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. The updated version will be posted
              on this page with a new effective date. Continued use of the Service after a
              change constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, without regard to
              its conflict-of-law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">14. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a
                href="mailto:info@investorensights.com"
                className="font-medium text-neutral-900 underline"
                data-testid="link-contact-email"
              >
                info@investorensights.com
              </a>
              .
            </p>
          </section>
        </article>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
          <Link href="/privacy" className="hover:text-neutral-900" data-testid="link-privacy">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/site-map" className="hover:text-neutral-900" data-testid="link-sitemap">
            Sitemap
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-neutral-900" data-testid="link-home">
            Home
          </Link>
        </footer>
      </div>
    </div>
  )
}
