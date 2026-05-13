import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { promises as dnsPromises } from "node:dns";
import net from "node:net";
import { db } from "@/lib/db";
import { cityResearchSources, cityLocations } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES_PER_SOURCE = 1_500_000;
const MAX_MARKDOWN_CHARS_PER_SOURCE = 12_000;
const TOTAL_MARKDOWN_BUDGET = 40_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; InvestorEnsightsNewsroomBot/1.0; +https://investorensights.com)";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "_",
});
turndown.remove(["script", "style", "noscript", "iframe", "form", "svg"]);

export interface FetchedSource {
  url: string;
  label: string | null;
  ok: boolean;
  bytes: number;
  markdown: string;
  error: string | null;
}

export interface CitySourcesResult {
  citySlug: string;
  cityId: string;
  fetchedAt: string;
  sources: FetchedSource[];
  combinedMarkdown: string;
  okCount: number;
  failCount: number;
  totalBytes: number;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n < 0) return true;
  const inRange = (start: string, mask: number): boolean => {
    const s = ipv4ToInt(start);
    const m = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (n & m) === (s & m);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) ||
    inRange("172.16.0.0", 12) ||
    inRange("192.0.0.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||
    inRange("240.0.0.0", 4)
  );
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice("::ffff:".length);
    if (net.isIPv4(v4)) return isPrivateOrReservedIPv4(v4);
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new Error(`blocked hostname: ${hostname}`);
  }
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isPrivateOrReservedIPv4(hostname)) {
      throw new Error(`blocked private/reserved IPv4: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateOrReservedIPv6(hostname)) {
      throw new Error(`blocked private/reserved IPv6: ${hostname}`);
    }
    return;
  }
  const records = await dnsPromises.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error(`no DNS records for ${hostname}`);
  for (const r of records) {
    if (r.family === 4 && isPrivateOrReservedIPv4(r.address)) {
      throw new Error(`blocked: ${hostname} resolves to private IPv4 ${r.address}`);
    }
    if (r.family === 6 && isPrivateOrReservedIPv6(r.address)) {
      throw new Error(`blocked: ${hostname} resolves to private IPv6 ${r.address}`);
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function fetchOne(url: string, label: string | null): Promise<FetchedSource> {
  const result: FetchedSource = {
    url,
    label,
    ok: false,
    bytes: 0,
    markdown: "",
    error: null,
  };

  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`unsupported protocol: ${u.protocol}`);
    }
    await assertPublicHost(u.hostname);

    const res = await withTimeout(
      fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      }),
      FETCH_TIMEOUT_MS,
      `fetch ${url}`
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("xml") && ct !== "") {
      throw new Error(`non-html content-type: ${ct}`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES_PER_SOURCE) {
      throw new Error(`response too large (${buf.byteLength} > ${MAX_BYTES_PER_SOURCE})`);
    }
    result.bytes = buf.byteLength;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.content) {
      const fallbackText = dom.window.document.body?.textContent?.trim().slice(0, 4000) ?? "";
      if (!fallbackText) throw new Error("no readable content extracted");
      result.markdown = fallbackText;
    } else {
      const md = turndown.turndown(article.content).trim();
      const title = article.title?.trim() ?? "";
      result.markdown = (title ? `# ${title}\n\n` : "") + md;
    }

    if (result.markdown.length > MAX_MARKDOWN_CHARS_PER_SOURCE) {
      result.markdown = result.markdown.slice(0, MAX_MARKDOWN_CHARS_PER_SOURCE) + "\n\n[...truncated]";
    }

    result.ok = true;
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

export async function fetchCitySources(citySlug: string): Promise<CitySourcesResult> {
  const [city] = await db
    .select({ id: cityLocations.id, slug: cityLocations.slug })
    .from(cityLocations)
    .where(eq(cityLocations.slug, citySlug))
    .limit(1);

  if (!city) throw new Error(`city not found: ${citySlug}`);

  const sourceRows = await db
    .select()
    .from(cityResearchSources)
    .where(and(eq(cityResearchSources.cityId, city.id), eq(cityResearchSources.enabled, true)))
    .limit(8);

  const sources: FetchedSource[] = [];
  let totalChars = 0;

  for (const row of sourceRows) {
    if (totalChars >= TOTAL_MARKDOWN_BUDGET) {
      sources.push({
        url: row.url,
        label: row.label,
        ok: false,
        bytes: 0,
        markdown: "",
        error: "skipped (total markdown budget exceeded)",
      });
      continue;
    }
    const fetched = await fetchOne(row.url, row.label);
    if (fetched.ok && totalChars + fetched.markdown.length > TOTAL_MARKDOWN_BUDGET) {
      const room = Math.max(0, TOTAL_MARKDOWN_BUDGET - totalChars);
      fetched.markdown = fetched.markdown.slice(0, room) + "\n\n[...truncated to budget]";
    }
    totalChars += fetched.markdown.length;
    sources.push(fetched);

    await db
      .update(cityResearchSources)
      .set({
        lastFetchedAt: new Date(),
        lastFetchOk: fetched.ok,
        lastFetchBytes: fetched.bytes,
        lastFetchError: fetched.error,
      })
      .where(eq(cityResearchSources.id, row.id));
  }

  const combined = sources
    .filter((s) => s.ok && s.markdown)
    .map((s, i) => {
      // MT-4.12: brand-neutral marker name (`pse_source_*` = persona-source).
      // Also defang both the new marker and the legacy `tableicity_source_*`
      // marker if it appears inside fetched content, so authors of source
      // pages can't smuggle in fake source headers.
      const safeMd = s.markdown
        .replace(/<\|pse_source_/gi, "<|sanitized_")
        .replace(/<\|END_PSE_SOURCE\|>/gi, "<|sanitized_end|>")
        .replace(/<\|tableicity_source_/gi, "<|sanitized_")
        .replace(/<\|END_TABLEICITY_SOURCE\|>/gi, "<|sanitized_end|>");
      return [
        `<|pse_source_${i + 1}_begin url="${s.url}"${s.label ? ` label="${s.label}"` : ""}|>`,
        safeMd,
        `<|END_PSE_SOURCE|>`,
      ].join("\n");
    })
    .join("\n\n");

  return {
    citySlug,
    cityId: city.id,
    fetchedAt: new Date().toISOString(),
    sources,
    combinedMarkdown: combined,
    okCount: sources.filter((s) => s.ok).length,
    failCount: sources.filter((s) => !s.ok).length,
    totalBytes: sources.reduce((a, s) => a + s.bytes, 0),
  };
}

export function summarizeFetchResult(r: CitySourcesResult): string {
  const lines = [
    `Fetched ${r.okCount}/${r.sources.length} sources for ${r.citySlug} (${r.totalBytes} bytes).`,
  ];
  for (const s of r.sources) {
    const status = s.ok ? `ok ${s.bytes}b ${s.markdown.length}c` : `FAIL: ${s.error}`;
    lines.push(`  - ${s.url} → ${status}`);
  }
  return lines.join("\n");
}
