import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { storage } from "@/lib/storage";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.tableicity.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await storage.getKnowledgeArticleBySlug(slug);
  if (!article || article.status === "archived") return { title: "Not Found" };

  if (article.status === "pending") {
    return {
      title: `[PREVIEW] ${article.title}`,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: article.title,
    description: article.metaDescription || undefined,
    alternates: { canonical: `${BASE_URL}/discovery/knowledge/${article.slug}` },
    robots: {
      index: true,
      follow: true,
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

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight" data-testid="text-headline">
          {article.headline}
        </h1>

        {article.subheadline && (
          <p className="text-lg text-blue-200/70 mb-8" data-testid="text-subheadline">
            {article.subheadline}
          </p>
        )}

        <div className="flex items-center gap-4 mb-8 text-sm text-blue-200/50 border-b border-white/10 pb-6">
          <span data-testid="text-author">By {article.authorName}</span>
          {article.datePublished && (
            <span data-testid="text-date">
              {new Date(article.datePublished).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        <div
          className="prose prose-invert prose-blue max-w-none
            prose-headings:text-white prose-p:text-blue-100/80
            prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white prose-li:text-blue-100/80"
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
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
