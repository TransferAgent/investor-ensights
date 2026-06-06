/**
 * Plain-text excerpt helper for callers that only have body HTML (e.g. the
 * city-meta generator's RAG grounding). Strips tags + common entities and
 * truncates at a word boundary. Pure string util — no LLM, no DB.
 *
 * (Previously lived in the now-deleted `metaNaturalizer.ts`.)
 */
export function hayloBodyExcerptFromHtml(bodyHtml: string | null | undefined, maxChars = 1000): string {
  if (!bodyHtml) return "";
  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? slice.slice(0, lastSpace) : slice;
}
