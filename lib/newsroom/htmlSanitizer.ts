import sanitizeHtml from "sanitize-html";

const NEWSROOM_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "br", "blockquote"],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }, true),
  },
};

const NEWSROOM_PLAINTEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

export function sanitizeNewsroomHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, NEWSROOM_HTML_OPTIONS).trim();
}

export function sanitizeNewsroomPlaintext(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, NEWSROOM_PLAINTEXT_OPTIONS).trim();
}
