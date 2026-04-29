import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { storage } from "@/lib/storage";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";

function highlightBrandInBody(html: string): string {
  let firstReplaced = false;
  let inAnchor = false;
  const tokens = html.split(/(<[^>]*>)/);
  return tokens
    .map((token) => {
      if (token.startsWith("<")) {
        if (/^<a[\s>]/i.test(token)) inAnchor = true;
        else if (/^<\/a>/i.test(token)) inAnchor = false;
        return token;
      }
      if (inAnchor) return token;
      return token.replace(/\bTableicity\b/g, () => {
        if (!firstReplaced) {
          firstReplaced = true;
          return `<a href="https://www.tableicity.com" class="text-blue-400 hover:underline">Tableicity</a>`;
        }
        return "Tableicity";
      });
    })
    .join("");
}

function markFirstAnswerBlock(html: string): string {
  let injected = false;
  return html.replace(
    /<p\b([^>]*\bclass=")(answer-block)([^"]*"[^>]*)>/gi,
    (match, before, cls, after) => {
      if (injected) return match;
      injected = true;
      return `<p${before}${cls} answer-block-first${after}>`;
    },
  );
}

function normalizeForCompare(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .toLowerCase()
    .trim();
}

function removeDuplicateLeadParagraph(html: string, subheadline?: string | null): string {
  if (!subheadline) return html;
  const subNorm = normalizeForCompare(subheadline);
  if (subNorm.length < 20) return html;
  let removed = false;
  return html.replace(
    /<p\b(?![^>]*\bclass=["'][^"']*answer-block)[^>]*>([\s\S]*?)<\/p>/i,
    (match, inner) => {
      if (removed) return match;
      const innerNorm = normalizeForCompare(inner);
      if (!innerNorm) return match;
      if (innerNorm === subNorm) {
        removed = true;
        return "";
      }
      const lenRatio =
        Math.min(innerNorm.length, subNorm.length) /
        Math.max(innerNorm.length, subNorm.length);
      if (lenRatio < 0.85) return match;
      const headLen = Math.min(80, subNorm.length, innerNorm.length);
      const subHead = subNorm.slice(0, headLen);
      const innerHead = innerNorm.slice(0, headLen);
      if (subHead === innerHead) {
        removed = true;
        return "";
      }
      return match;
    },
  );
}

function transformBodyForRender(html: string, subheadline?: string | null): string {
  return markFirstAnswerBlock(
    highlightBrandInBody(removeDuplicateLeadParagraph(html, subheadline)),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await storage.getKnowledgeArticleBySlug(slug);
  if (!article || article.status === "archived") return { title: "Not Found" };

  if (article.status === "pending") {
    return {
      title: `[PREVIEW] ${article.title}`,
      description: article.metaDescription || undefined,
      alternates: { canonical: `${BASE_URL}/discovery/knowledge/${article.slug}` },
      robots: { index: false, follow: false },
      openGraph: {
        title: article.headline,
        description: article.metaDescription || undefined,
        url: `${BASE_URL}/discovery/knowledge/${article.slug}`,
        type: "article",
        modifiedTime: article.dateModified.toISOString(),
        ...(article.ogImageUrl ? { images: [{ url: article.ogImageUrl }] } : {}),
      },
    };
  }

  const robotsString = (article.robots || "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1").toLowerCase();
  const isNoindex = robotsString.includes("noindex");
  const isNofollow = robotsString.includes("nofollow");

  return {
    title: article.title,
    description: article.metaDescription || undefined,
    alternates: { canonical: `${BASE_URL}/discovery/knowledge/${article.slug}` },
    robots: {
      index: !isNoindex,
      follow: !isNofollow,
      "max-snippet": -1 as any,
      "max-image-preview": "large" as any,
      "max-video-preview": -1 as any,
    },
    openGraph: {
      title: article.headline,
      description: article.metaDescription || undefined,
      url: `${BASE_URL}/discovery/knowledge/${article.slug}`,
      type: "article",
      publishedTime: article.datePublished?.toISOString(),
      modifiedTime: article.dateModified.toISOString(),
      ...(article.ogImageUrl ? { images: [{ url: article.ogImageUrl }] } : {}),
    },
  };
}

export default async function KnowledgeArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await storage.getKnowledgeArticleBySlug(slug);

  if (!article || article.status === "archived") {
    notFound();
  }

  const isPreview = article.status === "pending";

  const authorType = article.authorName.toLowerCase() === "tableicity" ? "Organization" : "Person";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.headline,
    description: article.metaDescription || undefined,
    datePublished: article.datePublished?.toISOString(),
    dateModified: article.dateModified.toISOString(),
    author: {
      "@type": authorType,
      name: article.authorName,
      ...(authorType === "Organization" ? { url: BASE_URL } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: article.publisherName,
      url: BASE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/discovery/knowledge/${article.slug}`,
    },
  };

  if (article.ogImageUrl) {
    jsonLd.image = [article.ogImageUrl];
  }

  return (
    <div className="min-h-screen bg-[#0f1b2d]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .knowledge-article-body p.answer-block.answer-block-first {
          position: relative;
          background-color: rgba(59, 130, 246, 0.08);
          border-left: 4px solid #fbbf24;
          border-radius: 0 0.375rem 0.375rem 0;
          padding: 2.25rem 1.25rem 1.25rem 1.5rem;
          margin: 1.75rem 0;
          color: rgb(219, 234, 254);
          font-style: normal;
        }
        .knowledge-article-body p.answer-block.answer-block-first::before {
          content: "QUICK ANSWER";
          position: absolute;
          top: 0.625rem;
          left: 1.5rem;
          font-size: 0.625rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #fbbf24;
          text-transform: uppercase;
        }
        .knowledge-article-body p.answer-block:not(.answer-block-first) {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        }
        .knowledge-article-body strong,
        .knowledge-article-body b {
          font-weight: inherit !important;
          color: inherit !important;
        }
        .knowledge-article-body p:not(.answer-block) {
          margin-top: 0.75em !important;
          margin-bottom: 0.75em !important;
          line-height: 1.65 !important;
        }
      `}} />

      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2" data-testid="link-home">
            <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Tableicity</span>
          </a>
          <nav className="flex items-center gap-4">
            <a href="/locations" className="text-sm text-blue-200/70 hover:text-white transition-colors" data-testid="link-locations">
              Locations
            </a>
          </nav>
        </div>
      </header>

      {isPreview && (
        <div className="bg-yellow-500/90 text-black text-center py-2 px-4 text-sm font-semibold" data-testid="banner-preview">
          PREVIEW — This article has not been published yet. It will not appear in search results or the sitemap.
        </div>
      )}

      <article className="max-w-4xl mx-auto px-6 py-12" data-testid="article-content">
        {article.dateline && (
          <p className="text-xs uppercase tracking-wider text-blue-200/50 mb-4" data-testid="text-dateline">
            {article.dateline}
          </p>
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight" data-testid="text-headline" dangerouslySetInnerHTML={{ __html: article.headline.replace(/<\/?h[1-6][^>]*>/gi, "") }} />

        {article.subheadline && (
          <h2 className="text-lg font-normal text-blue-200/70 mb-4" data-testid="text-subheadline" dangerouslySetInnerHTML={{ __html: article.subheadline.replace(/<\/?h[1-6][^>]*>/gi, "") }} />
        )}

        {article.metaDescription && (
          <p
            className="text-sm italic text-blue-200/60 border-l-[3px] border-blue-300/40 pl-3 mb-10 pb-6 border-b border-white/10"
            data-testid="text-meta-description"
          >
            {article.metaDescription}
          </p>
        )}

        {!article.metaDescription && article.subheadline && (
          <div className="mb-10 pb-6 border-b border-white/10" />
        )}

        <div
          className="knowledge-article-body prose prose-invert prose-blue max-w-none
            prose-headings:text-blue-200/70 prose-headings:font-medium
            prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-blue-100/80
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white prose-li:text-blue-100/80"
          dangerouslySetInnerHTML={{
            __html: transformBodyForRender(
              article.bodyHtml,
              article.metaDescription || article.subheadline,
            ),
          }}
          data-testid="article-body"
        />

        {article.boilerplateHtml && (
          <div className="mt-12 pt-8 border-t border-white/10">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-200/50 mb-4">About {article.publisherName}</h3>
            <div
              className="text-sm text-blue-200/60 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: article.boilerplateHtml }}
              data-testid="article-boilerplate"
            />
          </div>
        )}
      </article>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-blue-200/40">
          &copy; {new Date().getFullYear()} Tableicity. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
