import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { storage } from "@/lib/storage";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com";

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
      return token.replace(/\bInvestor Ensights\b/g, () => {
        if (!firstReplaced) {
          firstReplaced = true;
          return `<a href="https://investorensights.com" class="text-blue-400 hover:underline">Investor Ensights</a>`;
        }
        return "Investor Ensights";
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

const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&ndash;": "\u2013",
  "&mdash;": "\u2014",
  "&hellip;": "\u2026",
  "&ldquo;": "\u201c",
  "&rdquo;": "\u201d",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m) => {
    const lower = m.toLowerCase();
    if (NAMED_ENTITIES[lower] !== undefined) return NAMED_ENTITIES[lower];
    const num = m.match(/^&#(x?)([0-9a-fA-F]+);$/);
    if (num) {
      const code = parseInt(num[2], num[1] ? 16 : 10);
      if (!Number.isNaN(code)) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return m;
        }
      }
    }
    return m;
  });
}

function normalizeForCompare(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .toLowerCase()
    .trim();
}

const VOID_HTML_TAGS = new Set([
  "br", "img", "hr", "wbr", "input", "meta", "link",
  "source", "area", "col", "embed", "param", "track",
]);

function stripDekPrefixFromInnerHtml(
  innerHtml: string,
  dekNorm: string,
): string | null {
  // Walk innerHtml token-by-token. Track an open-inline-tag stack so we only
  // ever cut at a position where the stack is empty (no dangling open tags).
  // Decode HTML entities so normalization matches normalizeForCompare. Require
  // a hard sentence boundary (terminator immediately after the dek, optionally
  // after a balanced closing tag) before stripping, so we don't decapitate a
  // longer sentence that merely opens with the dek text.
  const stack: string[] = [];
  let normIdx = 0;
  let lastWasSpace = true;
  let cutAt = -1;
  let i = 0;

  const consumeNormChar = (c: string): boolean => {
    let normCh: string | null = null;
    if (/\s/.test(c)) {
      if (!lastWasSpace) {
        normCh = " ";
        lastWasSpace = true;
      }
    } else {
      normCh = c.toLowerCase();
      lastWasSpace = false;
    }
    if (normCh === null) return true;
    if (normIdx >= dekNorm.length) return true;
    if (normCh !== dekNorm[normIdx]) return false;
    normIdx++;
    return true;
  };

  while (i < innerHtml.length && normIdx < dekNorm.length) {
    const ch = innerHtml[i];
    if (ch === "<") {
      const close = innerHtml.indexOf(">", i);
      if (close < 0) return null;
      const tag = innerHtml.slice(i, close + 1);
      const m = tag.match(/^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/);
      if (m) {
        const isClose = m[1] === "/";
        const name = m[2].toLowerCase();
        const isSelf = /\/\s*>$/.test(tag) || VOID_HTML_TAGS.has(name);
        if (isClose) {
          if (stack.length && stack[stack.length - 1] === name) stack.pop();
        } else if (!isSelf) {
          stack.push(name);
        }
      }
      i = close + 1;
      continue;
    }
    if (ch === "&") {
      const semi = innerHtml.indexOf(";", i);
      if (semi > 0 && semi - i <= 10) {
        const entity = innerHtml.slice(i, semi + 1);
        const decoded = decodeHtmlEntities(entity);
        if (decoded !== entity) {
          for (const c of decoded) {
            if (!consumeNormChar(c)) return null;
            if (normIdx === dekNorm.length) break;
          }
          i = semi + 1;
          if (normIdx === dekNorm.length) {
            if (stack.length > 0) return null;
            cutAt = i;
            break;
          }
          continue;
        }
      }
    }
    if (!consumeNormChar(ch)) return null;
    i++;
    if (normIdx === dekNorm.length) {
      if (stack.length > 0) return null;
      cutAt = i;
      break;
    }
  }

  if (cutAt < 0 || normIdx !== dekNorm.length) return null;

  // Sentence-boundary check: after the cut, the very next non-tag character
  // must be a sentence terminator. We allow ourselves to step over balanced
  // closing tags (e.g. dek wrapped to end of an inline tag), but never over
  // arbitrary text or whitespace before the terminator — that would indicate
  // the dek matched a clause, not a complete sentence.
  let next = cutAt;
  while (next < innerHtml.length && innerHtml[next] === "<") {
    const close = innerHtml.indexOf(">", next);
    if (close < 0) return null;
    const t = innerHtml.slice(next, close + 1);
    if (!/^<\s*\//.test(t)) break;
    next = close + 1;
  }
  if (next >= innerHtml.length) return "";
  if (!/[.!?]/.test(innerHtml[next])) return null;

  // Eat the terminator(s) and following whitespace so the body resumes cleanly
  // at the next sentence. Do NOT eat commas/dashes — those would belong to the
  // following sentence and removing them changes meaning.
  while (next < innerHtml.length && /[.!?]/.test(innerHtml[next])) next++;
  while (next < innerHtml.length && /\s/.test(innerHtml[next])) next++;
  return innerHtml.slice(next);
}

function removeDuplicateLeadParagraph(html: string, subheadline?: string | null): string {
  if (!subheadline) return html;
  const subNorm = normalizeForCompare(subheadline);
  if (subNorm.length < 20) return html;
  let removed = false;
  return html.replace(
    /(<p\b(?![^>]*\bclass=["'][^"']*answer-block)[^>]*>)([\s\S]*?)(<\/p>)/i,
    (match, openTag, inner, closeTag) => {
      if (removed) return match;
      const innerNorm = normalizeForCompare(inner);
      if (!innerNorm) return match;

      // Case 1: body p1 is essentially identical to the dek → drop it entirely.
      if (innerNorm === subNorm) {
        removed = true;
        return "";
      }
      const lenRatio =
        Math.min(innerNorm.length, subNorm.length) /
        Math.max(innerNorm.length, subNorm.length);
      if (lenRatio >= 0.85) {
        const headLen = Math.min(80, subNorm.length, innerNorm.length);
        if (subNorm.slice(0, headLen) === innerNorm.slice(0, headLen)) {
          removed = true;
          return "";
        }
      }

      // Case 2: dek is a PREFIX of body p1 (much longer paragraph that opens
      // with the dek text, then continues). Strip just the dek-matching prefix
      // so the rest of the paragraph survives. Tag-aware so inline markup
      // later in the paragraph is preserved.
      if (innerNorm.startsWith(subNorm)) {
        const stripped = stripDekPrefixFromInnerHtml(inner, subNorm);
        if (stripped !== null) {
          removed = true;
          if (stripped.trim() === "") return "";
          return openTag + stripped + closeTag;
        }
      }
      return match;
    },
  );
}

function splitSentencesPreservingTags(html: string): string[] {
  const sentences: string[] = [];
  let current = "";
  let inTag = false;
  let i = 0;
  while (i < html.length) {
    const ch = html[i];
    current += ch;
    if (ch === "<") {
      inTag = true;
    } else if (ch === ">") {
      inTag = false;
    } else if (!inTag && (ch === "." || ch === "!" || ch === "?")) {
      let j = i + 1;
      while (j < html.length && html[j] === "<") {
        const end = html.indexOf(">", j);
        if (end === -1) break;
        const tag = html.slice(j, end + 1);
        if (!/^<\//.test(tag)) break;
        current += tag;
        j = end + 1;
      }
      if (j >= html.length || /\s/.test(html[j])) {
        sentences.push(current.trim());
        current = "";
        while (j < html.length && /\s/.test(html[j])) j++;
        i = j;
        continue;
      }
    }
    i++;
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences.filter((s) => s.length > 0);
}

function chunkSentences(sentences: string[]): string[][] {
  const chunks: string[][] = [];
  let i = 0;
  const n = sentences.length;
  while (i < n) {
    const remaining = n - i;
    if (remaining <= 3) {
      chunks.push(sentences.slice(i));
      break;
    }
    if (remaining === 4) {
      chunks.push(sentences.slice(i, i + 2));
      i += 2;
    } else if (remaining === 5) {
      chunks.push(sentences.slice(i, i + 3));
      i += 3;
    } else {
      chunks.push(sentences.slice(i, i + 2));
      i += 2;
    }
  }
  return chunks;
}

function rechunkParagraphs(html: string): string {
  return html.replace(
    /(?:<p\b(?![^>]*\bclass=["'][^"']*answer-block)[^>]*>[\s\S]*?<\/p>\s*)+/gi,
    (run) => {
      const innerRegex =
        /<p\b(?![^>]*\bclass=["'][^"']*answer-block)[^>]*>([\s\S]*?)<\/p>/gi;
      const sentences: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = innerRegex.exec(run)) !== null) {
        const inner = m[1].trim();
        if (!inner) continue;
        sentences.push(...splitSentencesPreservingTags(inner));
      }
      if (sentences.length === 0) return run;
      const chunks = chunkSentences(sentences);
      return chunks.map((c) => `<p>${c.join(" ")}</p>`).join("\n");
    },
  );
}

function transformBodyForRender(html: string, subheadline?: string | null): string {
  return markFirstAnswerBlock(
    highlightBrandInBody(
      rechunkParagraphs(removeDuplicateLeadParagraph(html, subheadline)),
    ),
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

  const authorType = article.authorName.toLowerCase() === "investor ensights" ? "Organization" : "Person";

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
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/investor-ensights-logo.png`,
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
            <span className="text-lg font-bold text-white">Investor Ensights</span>
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
          &copy; {new Date().getFullYear()} Investor Ensights. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
