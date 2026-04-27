import type { HayloPayload, HayloPayloadGroundedFact } from "./openaiGenerator";

export interface StitchOptions {
  onMissing?: "leave" | "blank" | "comment";
  allowHtmlInValues?: boolean;
}

export interface StitchReplacement {
  placeholder: string;
  key: string;
  value: string;
  occurrences: number;
  sourceUrl: string | null;
}

export interface StitchResult {
  html: string;
  replacements: StitchReplacement[];
  unfilled: string[];
  warnings: string[];
  citySlug: string | null;
  citationsAppendix: string;
}

export interface StitchInput {
  hayloHtml: string;
  factMap: Record<string, { value: string; sourceUrl?: string | null }>;
  citySlug?: string | null;
  options?: StitchOptions;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.:-]*)\s*\}\}/g;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stitchHayloHtml(input: StitchInput): StitchResult {
  const { hayloHtml, factMap } = input;
  const onMissing = input.options?.onMissing ?? "leave";
  const allowHtmlInValues = input.options?.allowHtmlInValues ?? false;

  const counts = new Map<string, number>();
  const unfilledSet = new Set<string>();
  const warnings: string[] = [];

  const html = hayloHtml.replace(PLACEHOLDER_RE, (match, rawKey: string) => {
    const key = String(rawKey).trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);

    const entry = factMap[key];
    if (!entry || entry.value === undefined || entry.value === null || entry.value === "") {
      unfilledSet.add(key);
      if (onMissing === "blank") return "";
      if (onMissing === "comment") return `<!-- unfilled:${key} -->`;
      return match;
    }
    return allowHtmlInValues ? String(entry.value) : escapeHtml(String(entry.value));
  });

  const replacements: StitchReplacement[] = [];
  Array.from(counts.entries()).forEach(([key, occurrences]) => {
    if (unfilledSet.has(key)) return;
    const entry = factMap[key];
    replacements.push({
      placeholder: `{{${key}}}`,
      key,
      value: String(entry.value),
      occurrences,
      sourceUrl: entry.sourceUrl ?? null,
    });
  });

  if (unfilledSet.size > 0) {
    warnings.push(
      `${unfilledSet.size} placeholder key(s) had no value and were ${onMissing === "leave" ? "left in place" : onMissing === "blank" ? "blanked" : "commented"}: ${Array.from(unfilledSet).join(", ")}`
    );
  }

  const isSafeHttpUrl = (u: string): boolean => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };
  const allCited = Array.from(
    new Set(
      replacements
        .filter((r) => r.sourceUrl)
        .map((r) => r.sourceUrl as string)
    )
  );
  const citedSources = allCited.filter(isSafeHttpUrl);
  const rejectedCount = allCited.length - citedSources.length;
  if (rejectedCount > 0) {
    warnings.push(`${rejectedCount} source URL(s) rejected from citations block (non-http(s) scheme)`);
  }
  const citationsAppendix =
    citedSources.length > 0
      ? `<aside class="haylo-stitch-sources" data-stitched="true"><h3>Sources for this localization</h3><ul>${citedSources
          .map((u) => `<li><a href="${escapeHtml(u)}" rel="nofollow noopener" target="_blank">${escapeHtml(u)}</a></li>`)
          .join("")}</ul></aside>`
      : "";

  return {
    html,
    replacements,
    unfilled: Array.from(unfilledSet),
    warnings,
    citySlug: input.citySlug ?? null,
    citationsAppendix,
  };
}

function findFact(facts: HayloPayloadGroundedFact[], predicate: (f: HayloPayloadGroundedFact) => boolean): HayloPayloadGroundedFact | null {
  for (const f of facts) if (predicate(f)) return f;
  return null;
}

function asMoneyShort(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)} million`;
  return `$${n.toLocaleString()}`;
}

function asArea(n: number): string {
  return `${n.toLocaleString()} sq ft`;
}

export function deriveFactMapFromPayload(payload: HayloPayload): Record<string, { value: string; sourceUrl: string | null }> {
  const map: Record<string, { value: string; sourceUrl: string | null }> = {};
  const set = (k: string, value: string | number | null | undefined, sourceUrl: string | null = null) => {
    if (value === null || value === undefined || value === "") return;
    if (map[k]) return;
    map[k] = { value: String(value), sourceUrl };
  };

  set("city_name", payload.city.name);
  set("state_code", payload.city.stateCode);

  if (payload.localVibe && !/^insufficient commercial signal/i.test(payload.localVibe)) {
    const vibeFact = findFact(payload.groundedFacts, (f) => f.sourceUrl !== null);
    set("local_vibe", payload.localVibe, vibeFact?.sourceUrl ?? null);
  }

  for (const f of payload.groundedFacts) {
    map[`fact:${f.key}`] = { value: typeof f.value === "string" ? f.value : JSON.stringify(f.value), sourceUrl: f.sourceUrl };
    if (typeof f.value !== "object" || f.value === null) continue;
    const v = f.value as Record<string, unknown>;

    if (typeof v.mayor === "string") set("mayor_name", v.mayor, f.sourceUrl);
    if (typeof v.city_manager === "string") set("city_manager", v.city_manager, f.sourceUrl);
    if (typeof v.population === "number") set("population", v.population.toLocaleString(), f.sourceUrl);
    if (typeof v.total === "number" && /population/i.test(f.key)) set("population", (v.total as number).toLocaleString(), f.sourceUrl);
    if (typeof v.gdp === "number") set("metro_gdp", asMoneyShort(v.gdp as number), f.sourceUrl);
    if (typeof v.investment === "number") set("investment_total", asMoneyShort(v.investment as number), f.sourceUrl);
    if (typeof v.square_feet_development === "number") set("development_size", asArea(v.square_feet_development as number), f.sourceUrl);
    if (typeof v.projects === "number") set("project_count", String(v.projects), f.sourceUrl);
    if (typeof v.institution === "string") set("top_institution", v.institution, f.sourceUrl);
    if (typeof v.enrollment === "number") set("institution_enrollment", (v.enrollment as number).toLocaleString(), f.sourceUrl);
    if (typeof v.elevation_ft === "number") set("elevation_ft", String(v.elevation_ft), f.sourceUrl);
    if (typeof v.year === "number" && /incorporation/i.test(f.key)) set("incorporation_year", String(v.year), f.sourceUrl);
  }

  return map;
}

export interface StitchFromPayloadInput {
  hayloHtml: string;
  payload: HayloPayload;
  options?: StitchOptions;
  extraFacts?: Record<string, { value: string; sourceUrl?: string | null }>;
}

export function stitchFromPayload(input: StitchFromPayloadInput): StitchResult {
  const derived = deriveFactMapFromPayload(input.payload);
  const factMap = { ...derived, ...(input.extraFacts ?? {}) };
  return stitchHayloHtml({
    hayloHtml: input.hayloHtml,
    factMap,
    citySlug: input.payload.city.slug,
    options: input.options,
  });
}
