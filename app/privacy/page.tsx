import type { Metadata } from "next"
import Link from "next/link"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"
const EFFECTIVE_DATE = "May 5, 2026"

export const metadata: Metadata = {
  title: "Privacy Policy | Investor Ensights",
  description:
    "Privacy Policy describing how Investor Ensights collects, uses, and shares information about visitors and account holders.",
  alternates: { canonical: `${BASE_URL}/privacy` },
  openGraph: {
    title: "Privacy Policy | Investor Ensights",
    description:
      "How Investor Ensights collects, uses, and shares information.",
    url: `${BASE_URL}/privacy`,
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500" data-testid="text-effective-date">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <article className="prose prose-neutral max-w-none text-[15px] leading-relaxed">
          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">1. Who We Are</h2>
            <p>
              Investor Ensights Inc. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates
              the Investor Ensights website at investorensights.com. This Privacy Policy explains
              what information we collect, how we use it, and the choices you have.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">2. Information We Collect</h2>
            <ul className="list-disc pl-6">
              <li>
                <strong>Information you provide:</strong> account details (email, name) when you
                register or contact us.
              </li>
              <li>
                <strong>Automatically collected:</strong> IP address, browser type, device
                information, pages viewed, and approximate location, captured through standard
                server logs and cookies.
              </li>
              <li>
                <strong>Cookies:</strong> small text files used to remember preferences and to
                measure aggregate usage. You can disable cookies in your browser; some features
                may not work without them.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">3. How We Use Information</h2>
            <ul className="list-disc pl-6">
              <li>To operate, secure, and improve the Service.</li>
              <li>To respond to inquiries and provide customer support.</li>
              <li>To produce aggregate analytics about Service usage.</li>
              <li>To comply with legal obligations and enforce our Terms of Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">4. Legal Bases (EEA / UK Visitors)</h2>
            <p>
              Where the GDPR or UK GDPR applies, we process personal data on the basis of your
              consent, our legitimate interests in operating and securing the Service, the
              performance of a contract with you, or compliance with a legal obligation.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">5. How We Share Information</h2>
            <p>We do not sell personal data. We share information only:</p>
            <ul className="list-disc pl-6">
              <li>
                With service providers (hosting, analytics, geocoding, AI inference) acting on
                our behalf under written agreements.
              </li>
              <li>To comply with law, legal process, or a lawful government request.</li>
              <li>To protect the rights, property, or safety of Investor Ensights, our users, or others.</li>
              <li>With your consent or at your direction.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">6. Service Providers We Use</h2>
            <p>
              We rely on third-party providers for cloud hosting and infrastructure, large-language-model
              inference (e.g., OpenAI), geocoding (e.g., OpenCage), and analytics. These providers
              process limited data on our behalf, under written agreements, only as needed to deliver
              the Service. A current list is available on request to{" "}
              <a
                href="mailto:info@investorensights.com"
                className="font-medium text-neutral-900 underline"
                data-testid="link-contact-providers"
              >
                info@investorensights.com
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">7. Data Retention</h2>
            <p>
              We keep personal data for as long as needed to provide the Service, comply with
              our legal obligations, resolve disputes, and enforce our agreements. Server logs
              are typically retained for a limited period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">8. Security</h2>
            <p>
              We use reasonable administrative, technical, and physical safeguards designed to
              protect personal information. No method of transmission over the internet is
              completely secure, however, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">9. International Transfers</h2>
            <p>
              Your information may be processed in the United States or other countries that
              may not have the same data-protection laws as your jurisdiction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">10. Your Rights</h2>
            <p>
              Depending on where you live, you may have the right to access, correct, delete, or
              port your personal data, or to object to or restrict certain processing. To
              exercise these rights, email{" "}
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

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">11. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to children under 16, and we do not knowingly collect
              personal information from children under 16.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The updated version will be
              posted on this page with a new effective date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-[20px] font-semibold">13. Contact</h2>
            <p>
              Questions about this Privacy Policy? Email{" "}
              <a
                href="mailto:info@investorensights.com"
                className="font-medium text-neutral-900 underline"
                data-testid="link-contact-email-bottom"
              >
                info@investorensights.com
              </a>
              .
            </p>
          </section>
        </article>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-900" data-testid="link-terms">
            Terms of Service
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
