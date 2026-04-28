import { stitchHayloHtml, type StitchResult } from "./hayloStitcher";
import { normalizeHayloBody } from "./hayloBodyNormalizer";
import type { HayloPayload } from "./openaiGenerator";

export const LOCAL_VIBE_MARKER = "<!-- newsroom:local-vibe -->";

function titleFromTopic(topicSlug: string | null | undefined): string {
  if (!topicSlug) return "Press Release";
  return topicSlug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Common short English words that, when a title ends with one, strongly suggest
// the title was sliced mid-sentence rather than ending on an editorial choice.
// (Real headlines almost never end with "the", "a", "of", "to", "and", etc.)
const TRAILING_FRAGMENT_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "yet", "so", "for", "nor",
  "of", "to", "in", "on", "at", "by", "with", "from", "as", "is", "are",
  "was", "were", "be", "been", "it", "its", "this", "that", "these", "those",
  "oft", // common slice point of "often"
]);

/**
 * Detect Haylo titles that were truncated mid-sentence by an upstream slicer
 * (e.g. the legacy ingest "first <p> sliced at 80 chars" path). Conservative
 * by design — we only flag titles where the truncation signal is strong, so
 * legitimate headline-style titles like "Securing Series A Funding" pass
 * through untouched.
 */
function looksLikeTruncatedSentence(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 40) return false;
  // Explicit ellipsis marker (added by deriveTitleFromProse on truncation)
  if (/[\u2026]$|\.\.\.$/.test(trimmed)) return true;
  const last = trimmed.slice(-1);
  // Has terminal punctuation → assume editorial intent → keep
  if (/[.!?:)\]"'\u2014\u2013]/.test(last)) return false;
  // No punctuation: only flag if it ALSO ends in a stop-word fragment
  const lastWord = trimmed.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  return TRAILING_FRAGMENT_WORDS.has(lastWord);
}

function buildCleanTitle(hayloTitle: string, topicSlug: string | undefined, cityName: string, stateCode: string): string {
  const trimmed = hayloTitle.trim();
  const base = looksLikeTruncatedSentence(trimmed) ? titleFromTopic(topicSlug) : trimmed;
  const suffix = ` in ${cityName}, ${stateCode}`;
  if (base.toLowerCase().includes(cityName.toLowerCase())) return base;
  return `${base}${suffix}`;
}

export interface ComposeInput {
  hayloTitle: string;
  hayloBodyHtml: string;
  cityName: string;
  stateCode: string;
  stateName?: string | null;
  localVibe: string | null;
  vibeSourceUrl?: string | null;
  mayorName?: string | null;
  publishDateIso?: string;
  topicSlug?: string;
}

export interface ComposeResult {
  title: string;
  dateline: string;
  bodyHtml: string;
  fullHtml: string;
  vibeInjected: boolean;
  vibeStrategy: "marker" | "after-first-section" | "skipped";
  warnings: string[];
  citations: string[];
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildVibeBlock(cityName: string, vibe: string, sourceUrl?: string | null): string {
  const cite = sourceUrl
    ? ` <a href="${escapeHtml(sourceUrl)}" rel="nofollow noopener" target="_blank" class="newsroom-cite">[source]</a>`
    : "";
  return `<section class="newsroom-local-vibe" data-newsroom-injected="local-vibe"><h2>Why ${escapeHtml(cityName)} Founders Choose Tableicity</h2><p>${escapeHtml(vibe)}${cite}</p></section>`;
}

function injectVibe(bodyHtml: string, vibeBlock: string): { html: string; strategy: ComposeResult["vibeStrategy"] } {
  if (bodyHtml.includes(LOCAL_VIBE_MARKER)) {
    const escapedMarker = LOCAL_VIBE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { html: bodyHtml.replace(new RegExp(escapedMarker, "g"), vibeBlock), strategy: "marker" };
  }
  const firstSectionClose = bodyHtml.indexOf("</section>");
  if (firstSectionClose === -1) {
    const firstParaClose = bodyHtml.indexOf("</p>");
    if (firstParaClose === -1) return { html: bodyHtml + vibeBlock, strategy: "after-first-section" };
    const insertAt = firstParaClose + "</p>".length;
    return { html: bodyHtml.slice(0, insertAt) + vibeBlock + bodyHtml.slice(insertAt), strategy: "after-first-section" };
  }
  const insertAt = firstSectionClose + "</section>".length;
  return { html: bodyHtml.slice(0, insertAt) + vibeBlock + bodyHtml.slice(insertAt), strategy: "after-first-section" };
}

function buildDateline(cityName: string, stateCode: string, dateIso: string): string {
  const d = new Date(dateIso);
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${cityName}, ${stateCode} — ${month} ${d.getDate()}, ${d.getFullYear()}`;
}

export function composePressRelease(input: ComposeInput): ComposeResult {
  const warnings: string[] = [];
  const dateIso = input.publishDateIso ?? new Date().toISOString();
  const title = buildCleanTitle(input.hayloTitle, input.topicSlug, input.cityName, input.stateCode);
  if (looksLikeTruncatedSentence(input.hayloTitle)) {
    warnings.push(
      `Haylo title appeared truncated mid-sentence ("${input.hayloTitle.slice(0, 60)}…") — fell back to topic-derived title "${title}". Consider re-ingesting this Haylo article with a proper <h1>.`,
    );
  }
  const dateline = buildDateline(input.cityName, input.stateCode, dateIso);

  const isSentinelVibe = input.localVibe ? /^insufficient commercial signal/i.test(input.localVibe) : true;
  let vibeInjected = false;
  let vibeStrategy: ComposeResult["vibeStrategy"] = "skipped";
  let bodyHtml = normalizeHayloBody(input.hayloBodyHtml);

  if (!input.localVibe) {
    warnings.push("no local vibe provided — body left without local injection");
  } else if (isSentinelVibe) {
    warnings.push("local vibe is sentinel ('insufficient commercial signal') — refusing to inject; expand seed URLs for this city");
  } else {
    const vibeBlock = buildVibeBlock(input.cityName, input.localVibe, input.vibeSourceUrl);
    // Inject into the already-normalized body so vibe injection doesn't
    // silently drop the normalization (no <strong> stripping, no leading
    // dateline strip) for cities that DO supply a vibe.
    const result = injectVibe(bodyHtml, vibeBlock);
    bodyHtml = result.html;
    vibeStrategy = result.strategy;
    vibeInjected = true;
    if (vibeStrategy === "after-first-section") {
      warnings.push("local vibe injected via positional fallback (no <!-- newsroom:local-vibe --> marker found in Haylo body)");
    }
  }

  const cityRefRegex = /\b(San Francisco|New York|Boston|Chicago|Austin|Seattle|Denver|Miami|Atlanta|Los Angeles|Portland|Nashville|Dallas|Houston|Philadelphia|Phoenix)\b/gi;
  const foreignCityHits = (input.hayloBodyHtml.match(cityRefRegex) ?? []).filter((m) => m.toLowerCase() !== input.cityName.toLowerCase());
  if (foreignCityHits.length > 0) {
    const unique = Array.from(new Set(foreignCityHits.map((s) => s.toLowerCase())));
    warnings.push(`Haylo body mentions other cities (${unique.join(", ")}) — verify intentional before publishing to ${input.cityName}`);
  }

  // The page template (and admin preview helper) render `article.headline` and
  // `article.dateline` from their dedicated columns, so the body MUST NOT
  // include its own <header><h1>/<dateline> block — doing so causes duplicate
  // titles + datelines on every published article. Body = body only.
  const wrapperTemplate = `<article class="newsroom-press-release" data-city-slug="{{city_slug}}" data-topic="{{topic}}">
  <div class="pr-body">{{haylo_body}}</div>
  <footer class="pr-footer">
    <h2>About Tableicity</h2>
    <p>Tableicity is a privacy-first cap table management platform combining zero-knowledge encryption with intuitive equity tools. Built for founders, CFOs, and legal teams in {{city_name}} and beyond.</p>
    <p class="pr-copyright">© {{year}} Tableicity. All rights reserved.</p>
  </footer>
</article>`;

  const factMap: Record<string, { value: string; sourceUrl?: string | null }> = {
    title: { value: escapeHtml(title) },
    publish_date: { value: escapeHtml(new Date(dateIso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })) },
    dateline: { value: escapeHtml(dateline) },
    city_name: { value: escapeHtml(input.cityName) },
    city_slug: { value: escapeHtml(`${input.cityName.toLowerCase().replace(/\s+/g, "-")}-${input.stateCode.toLowerCase()}`) },
    topic: { value: escapeHtml(input.topicSlug ?? "press-release") },
    year: { value: escapeHtml(String(new Date(dateIso).getFullYear())) },
    haylo_body: { value: bodyHtml },
  };

  const stitched: StitchResult = stitchHayloHtml({
    hayloHtml: wrapperTemplate,
    factMap,
    citySlug: factMap.city_slug.value,
    options: { onMissing: "comment", allowHtmlInValues: true },
  });

  if (stitched.warnings.length > 0) warnings.push(...stitched.warnings);

  return {
    title,
    dateline,
    bodyHtml,
    fullHtml: stitched.html,
    vibeInjected,
    vibeStrategy,
    warnings,
    citations: input.vibeSourceUrl ? [input.vibeSourceUrl] : [],
  };
}

export interface ComposeFromPayloadInput {
  hayloTitle: string;
  hayloBodyHtml: string;
  payload: HayloPayload;
  publishDateIso?: string;
  topicSlug?: string;
}

export function composeFromPayload(input: ComposeFromPayloadInput): ComposeResult {
  const p = input.payload;
  const vibeFact = p.groundedFacts.find((f) => f.sourceUrl !== null);
  let mayor: string | null = null;
  for (const f of p.groundedFacts) {
    const v = f.value as Record<string, unknown>;
    if (typeof v?.mayor === "string") { mayor = v.mayor; break; }
  }
  return composePressRelease({
    hayloTitle: input.hayloTitle,
    hayloBodyHtml: input.hayloBodyHtml,
    cityName: p.city.name,
    stateCode: p.city.stateCode,
    localVibe: p.localVibe,
    vibeSourceUrl: vibeFact?.sourceUrl ?? null,
    mayorName: mayor,
    publishDateIso: input.publishDateIso,
    topicSlug: input.topicSlug,
  });
}
