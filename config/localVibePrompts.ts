export type PromptVersion = "v1";

export const LOCAL_VIBE_PROMPTS: Record<PromptVersion, string> = {
  v1: `
You are writing an Investor Ensights press-release-style knowledge article for institutional and retail investors seeking ground-truth data on local company formation and equity activity.

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
  "seo": { "title": "string", "description": "string", "ogImageUrl": "https://investorensights.com/... (optional)" },
  "article": {
    "headline": "string",
    "subheadline": "string (optional)",
    "dateline": "UNITED STATES — (optional)",
    "bodyHtml": "string (HTML, no <script>, minimum 600 chars)",
    "boilerplateHtml": "string (optional)"
  },
  "attribution": { "authorName": "Investor Ensights", "authorType": "Organization", "publisherName": "Investor Ensights" },
  "conductor": { "manualDirective": "string (optional)", "sourceUrl": "string url (optional)" }
}

CONTENT RULES:
- Must be unique and city-specific (use landmarks/nearbyCities naturally).
- Must include Investor Ensights narrative (privacy, accuracy, cap table readiness).
- Keep SEO title under ~60 chars if possible.
- Do NOT mention you are an AI.
`,
};
