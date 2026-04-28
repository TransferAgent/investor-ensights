import { createHash } from "node:crypto";
import type { InsertHayloArticle } from "@shared/schema";

export function hashHaylo(bodyHtml: string): string {
  return createHash("sha256").update(bodyHtml).digest("hex");
}

export function slugifyHaylo(text: string, fallback = "haylo-article"): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s.length === 0 ? fallback : s;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Pull a title-like phrase out of body prose. Prefers the first complete
 * sentence; if no sentence boundary exists within ~120 chars, falls back to
 * the longest word-boundary substring under 80 chars (never mid-word). Adds
 * an ellipsis when truncation actually happened so downstream consumers can
 * tell it isn't a clean editorial title.
 */
export function deriveTitleFromProse(prose: string, maxLen = 80): string {
  const text = prose.trim();
  if (text.length === 0) return "";
  if (text.length <= maxLen) return text;
  const sentenceEnd = text.search(/[.!?]\s/);
  if (sentenceEnd > 10 && sentenceEnd < 120) {
    const sentence = text.slice(0, sentenceEnd + 1).trim();
    if (sentence.length <= maxLen + 40) return sentence;
  }
  const window = text.slice(0, maxLen);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > 30 ? lastSpace : maxLen;
  return text.slice(0, cut).trim() + "…";
}

export interface ParsedHayloFile {
  title: string;
  topicSlug: string;
  bodyHtml: string;
  summary: string | null;
}

export function parseHayloFile(filename: string, contents: string): ParsedHayloFile {
  const baseName = filename.replace(/\.html?$/i, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const topicMatch = contents.match(/<!--\s*topic:\s*([a-z0-9-_]+)\s*-->/i);
  const topicSlug = topicMatch ? topicMatch[1].toLowerCase() : baseName;

  let title: string | null = null;
  const h1 = contents.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) title = stripHtml(h1[1]);
  if (!title) {
    const t = contents.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) title = stripHtml(t[1]);
  }
  if (!title) {
    const p = contents.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (p) title = deriveTitleFromProse(stripHtml(p[1]));
  }
  if (!title) title = baseName;

  const stripped = stripHtml(contents);
  const summary = stripped.length > 0 ? stripped.slice(0, 220) : null;

  return { title, topicSlug, bodyHtml: contents, summary };
}

export function buildInsertFromPaste(input: {
  title: string;
  topicSlug: string;
  bodyHtml: string;
  summary?: string | null;
  status?: string;
  source?: string;
  sourceFilename?: string | null;
  slug?: string | null;
}): InsertHayloArticle {
  const title = input.title.trim();
  const topicSlug = slugifyHaylo(input.topicSlug, "general");
  const slug = input.slug && input.slug.trim().length > 0
    ? slugifyHaylo(input.slug)
    : slugifyHaylo(`${title}-${topicSlug}`);
  return {
    slug,
    title,
    topicSlug,
    bodyHtml: input.bodyHtml,
    summary: input.summary ?? null,
    status: input.status ?? "ready",
    source: input.source ?? "paste",
    sourceFilename: input.sourceFilename ?? null,
  };
}

export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Could not find unique slug after 1000 attempts (base=${base})`);
}
