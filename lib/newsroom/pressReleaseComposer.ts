import { stitchHayloHtml, type StitchResult } from "./hayloStitcher";
import type { HayloPayload } from "./openaiGenerator";

export const LOCAL_VIBE_MARKER = "<!-- newsroom:local-vibe -->";

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
  const title = `${input.hayloTitle.trim()} in ${input.cityName}, ${input.stateCode}`;
  const dateline = buildDateline(input.cityName, input.stateCode, dateIso);

  const isSentinelVibe = input.localVibe ? /^insufficient commercial signal/i.test(input.localVibe) : true;
  let vibeInjected = false;
  let vibeStrategy: ComposeResult["vibeStrategy"] = "skipped";
  let bodyHtml = input.hayloBodyHtml;

  if (!input.localVibe) {
    warnings.push("no local vibe provided — body left without local injection");
  } else if (isSentinelVibe) {
    warnings.push("local vibe is sentinel ('insufficient commercial signal') — refusing to inject; expand seed URLs for this city");
  } else {
    const vibeBlock = buildVibeBlock(input.cityName, input.localVibe, input.vibeSourceUrl);
    const result = injectVibe(input.hayloBodyHtml, vibeBlock);
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

  const wrapperTemplate = `<article class="newsroom-press-release" data-city-slug="{{city_slug}}" data-topic="{{topic}}">
  <header class="pr-header">
    <h1>{{title}}</h1>
    <p class="pr-byline">By Tableicity · {{publish_date}}</p>
    <p class="pr-dateline">{{dateline}}</p>
  </header>
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
