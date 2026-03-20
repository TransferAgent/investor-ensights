export type PromptVersion = "v1";

export const LOCAL_VIBE_PROMPTS: Record<PromptVersion, string> = {
  v1: `
You are writing a Tableicity press-release-style knowledge article for US founders and finance operators.

CITY CONTEXT:
- cityName: {{cityName}}
- stateCode: {{stateCode}}
- stateName: {{stateName}}
- citySlug: {{citySlug}}
- landmarks: {{landmarks}}
- nearbyCities: {{nearbyCities}}

CONDUCTOR DIRECTIVE (optional):
{{manualDirective}}

OUTPUT REQUIREMENTS:
Return ONLY valid JSON for the following schema:
{
  "slug": "string",
  "locale": "en-US",
  "seo": { "title": "string", "description": "string", "ogImageUrl": "https://www.tableicity.com/... (optional)" },
  "article": {
    "headline": "string",
    "subheadline": "string (optional)",
    "dateline": "UNITED STATES — (optional)",
    "bodyHtml": "string (HTML, no <script>, minimum 600 chars)",
    "boilerplateHtml": "string (optional)"
  },
  "attribution": { "authorName": "Tableicity", "authorType": "Organization", "publisherName": "Tableicity" },
  "conductor": { "manualDirective": "string (optional)", "sourceUrl": "string url (optional)" }
}

CONTENT RULES:
- Must be unique and city-specific (use landmarks/nearbyCities naturally).
- Must include Tableicity narrative (privacy, accuracy, cap table readiness).
- Keep SEO title under ~60 chars if possible.
- Do NOT mention you are an AI.
`,
};
