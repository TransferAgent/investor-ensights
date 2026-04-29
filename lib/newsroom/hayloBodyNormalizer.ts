/**
 * Strips Haylo-specific stylistic noise so the press-release version reads
 * cleanly without duplicate H1s or duplicate datelines.
 *
 * Note (April 2026): Halo formally committed in writing that <strong> tags are
 * intentional editorial emphasis on key terms (named entities, regulatory
 * references, dollar figures, statute names) and not stylistic over-bolding.
 * Default `stripStrong` is therefore now `false`. The option remains for any
 * caller that explicitly opts back in (e.g., for legacy content rescue), but
 * the live + dry-run paths now preserve <strong> end-to-end.
 *
 * Pure string-only transformation (no DOM parser dependency).
 */

const STRONG_OPEN = /<strong\b[^>]*>/gi;
const STRONG_CLOSE = /<\/strong>/gi;
const B_OPEN = /<b\b[^>]*>/gi;
const B_CLOSE = /<\/b>/gi;

const FIRST_H1 = /<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i;

const LEADING_DATELINE_PARA = /^\s*<p\b[^>]*>\s*[A-Z][A-Z\s.-]{2,}\s*,\s*[A-Z]{2}\s*[—\-–]\s*[^<]{0,150}<\/p>\s*/;

export interface NormalizeOptions {
  stripFirstH1?: boolean;
  stripLeadingDateline?: boolean;
  stripStrong?: boolean;
}

const DEFAULTS: Required<NormalizeOptions> = {
  stripFirstH1: true,
  stripLeadingDateline: true,
  stripStrong: false,
};

export function normalizeHayloBody(html: string, opts: NormalizeOptions = {}): string {
  const o = { ...DEFAULTS, ...opts };
  let out = html;

  if (o.stripFirstH1) {
    out = out.replace(FIRST_H1, "");
  }
  if (o.stripLeadingDateline) {
    out = out.replace(LEADING_DATELINE_PARA, "");
  }
  if (o.stripStrong) {
    out = out.replace(STRONG_OPEN, "").replace(STRONG_CLOSE, "");
    out = out.replace(B_OPEN, "").replace(B_CLOSE, "");
  }

  return out.trim();
}
