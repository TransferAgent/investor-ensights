import { promises as dnsPromises } from "node:dns";
import net from "node:net";
import { db } from "@/lib/db";
import { cityLocations, cityResearchSources } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

const PROBE_TIMEOUT_MS = 5_000;
const MIN_CONTENT_BYTES = 800;
const MAX_PROBE_BYTES = 200_000;
const TOTAL_SEEDING_BUDGET_MS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; TableicityNewsroomBot/1.0; +https://www.tableicity.com)";

export interface AutoSeedResult {
  citySlug: string;
  alreadyHadEnabled: number;
  added: Array<{ url: string; label: string; bytes: number }>;
  failed: Array<{ url: string; error: string }>;
  totalEnabledAfter: number;
}

interface UrlCandidate {
  url: string;
  label: string;
  family: "wikipedia" | "gov" | "chamber" | "crunchbase";
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
  return false;
}

const DNS_TIMEOUT_MS = 3_000;

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
      throw new Error(`blocked private IPv4: ${hostname}`);
    }
    if (net.isIPv6(hostname) && isPrivateOrReservedIPv6(hostname)) {
      throw new Error(`blocked private IPv6: ${hostname}`);
    }
    return;
  }
  const records = await withTimeout(
    dnsPromises.lookup(hostname, { all: true, verbatim: true }),
    DNS_TIMEOUT_MS,
    `dns lookup ${hostname}`,
  );
  if (records.length === 0) throw new Error(`no DNS records for ${hostname}`);
  for (const r of records) {
    if (r.family === 4 && isPrivateOrReservedIPv4(r.address)) {
      throw new Error(`blocked: ${hostname} → private IPv4 ${r.address}`);
    }
    if (r.family === 6 && isPrivateOrReservedIPv6(r.address)) {
      throw new Error(`blocked: ${hostname} → private IPv6 ${r.address}`);
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
      },
    );
  });
}

function cityNameForUrl(cityName: string): string {
  return cityName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function cityNameForWikipedia(cityName: string): string {
  return cityName
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function stateNameForWikipedia(stateName: string | null, stateCode: string): string {
  if (stateName && stateName.trim()) return stateName.trim().replace(/\s+/g, "_");
  return stateCode.toUpperCase();
}

function citySlugCore(slug: string): string {
  const parts = slug.split("-");
  const tail = parts[parts.length - 1];
  if (tail && tail.length === 2) return parts.slice(0, -1).join("-");
  return slug;
}

export function buildCandidateUrls(
  cityName: string,
  stateName: string | null,
  stateCode: string,
  citySlug: string,
): UrlCandidate[] {
  const wiki = `https://en.wikipedia.org/wiki/${cityNameForWikipedia(cityName)},_${stateNameForWikipedia(stateName, stateCode)}`;
  const cityFlat = cityNameForUrl(cityName);
  const cityKebab = citySlugCore(citySlug);
  const stateLower = stateCode.toLowerCase();

  const candidates: UrlCandidate[] = [];

  candidates.push({ url: wiki, label: `Wikipedia — ${cityName}`, family: "wikipedia" });

  candidates.push({ url: `https://www.${cityFlat}.gov`, label: `${cityName} — city.gov`, family: "gov" });
  candidates.push({ url: `https://${cityFlat}.gov`, label: `${cityName} — city.gov`, family: "gov" });
  candidates.push({ url: `https://www.cityof${cityFlat}.org`, label: `${cityName} — city.gov`, family: "gov" });
  candidates.push({ url: `https://www.cityof${cityFlat}.com`, label: `${cityName} — city.gov`, family: "gov" });
  if (cityKebab !== cityFlat) {
    candidates.push({ url: `https://www.${cityKebab}.gov`, label: `${cityName} — city.gov`, family: "gov" });
  }

  candidates.push({ url: `https://www.${cityFlat}chamber.com`, label: `${cityName} Chamber`, family: "chamber" });
  candidates.push({ url: `https://www.${cityFlat}chamber.org`, label: `${cityName} Chamber`, family: "chamber" });
  candidates.push({ url: `https://www.${cityFlat}chamberofcommerce.com`, label: `${cityName} Chamber`, family: "chamber" });

  candidates.push({
    url: `https://www.crunchbase.com/hub/${stateLower}-${cityKebab}-startups`,
    label: `Crunchbase — ${cityName} startups`,
    family: "crunchbase",
  });

  return candidates;
}

interface ProbeResult {
  ok: boolean;
  bytes: number;
  error: string | null;
}

async function probeUrl(url: string): Promise<ProbeResult> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, bytes: 0, error: `unsupported protocol: ${u.protocol}` };
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
      PROBE_TIMEOUT_MS,
      `probe ${url}`,
    );

    if (!res.ok) {
      return { ok: false, bytes: 0, error: `HTTP ${res.status}` };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("xml") && ct !== "") {
      return { ok: false, bytes: 0, error: `non-html content-type: ${ct}` };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { ok: false, bytes: 0, error: "no response body" };
    }
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
      if (total >= MAX_PROBE_BYTES) {
        try {
          await reader.cancel();
        } catch {}
        break;
      }
    }
    if (total < MIN_CONTENT_BYTES) {
      return { ok: false, bytes: total, error: `content too small (${total}b < ${MIN_CONTENT_BYTES}b)` };
    }
    return { ok: true, bytes: total, error: null };
  } catch (err) {
    return {
      ok: false,
      bytes: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Ensure a city has at least some seed URLs in city_research_sources.
 * If it already has enabled rows, this is a no-op (returns immediately).
 * Otherwise, derives URL candidates from city_locations metadata, probes each,
 * and inserts productive URLs into city_research_sources.
 *
 * Junk URL behavior: skips failures and moves on; never stalls. At most one
 * URL per family (wikipedia/gov/chamber/crunchbase) is inserted.
 */
export async function ensureCitySources(citySlug: string): Promise<AutoSeedResult> {
  const [city] = await db
    .select({
      id: cityLocations.id,
      slug: cityLocations.slug,
      cityName: cityLocations.cityName,
      stateCode: cityLocations.stateCode,
      stateName: cityLocations.stateName,
    })
    .from(cityLocations)
    .where(eq(cityLocations.slug, citySlug))
    .limit(1);

  if (!city) throw new Error(`city not found: ${citySlug}`);

  const existing = await db
    .select({ id: cityResearchSources.id })
    .from(cityResearchSources)
    .where(and(eq(cityResearchSources.cityId, city.id), eq(cityResearchSources.enabled, true)));

  if (existing.length > 0) {
    return {
      citySlug,
      alreadyHadEnabled: existing.length,
      added: [],
      failed: [],
      totalEnabledAfter: existing.length,
    };
  }

  const candidates = buildCandidateUrls(city.cityName, city.stateName, city.stateCode, city.slug);

  const added: AutoSeedResult["added"] = [];
  const failed: AutoSeedResult["failed"] = [];

  // Probe every candidate in parallel under a single overall budget. Without
  // this, a city with 0 seeds can spend ~PROBE_TIMEOUT_MS × candidates.length
  // seconds just probing — which blows past the platform proxy timeout before
  // the 5-agent pipeline even starts.
  const probeAll = Promise.all(
    candidates.map(async (c) => ({ candidate: c, result: await probeUrl(c.url) })),
  );
  let probed: Array<{ candidate: UrlCandidate; result: ProbeResult }>;
  try {
    probed = await withTimeout(probeAll, TOTAL_SEEDING_BUDGET_MS, `seed budget for ${citySlug}`);
  } catch (err) {
    // Budget exceeded — skip seeding for this run and let the pipeline proceed
    // with whatever sources already exist (likely zero on first run).
    console.warn(
      `[cityResearchAutoSeeder] ${citySlug} probing exceeded ${TOTAL_SEEDING_BUDGET_MS}ms budget; skipping seed insert this run:`,
      err instanceof Error ? err.message : err,
    );
    return {
      citySlug,
      alreadyHadEnabled: 0,
      added,
      failed: candidates.map((c) => ({ url: c.url, error: "seed budget exceeded" })),
      totalEnabledAfter: 0,
    };
  }

  // Walk in original candidate order and take the first OK probe per family.
  const familiesUsed = new Set<string>();
  for (const { candidate, result } of probed) {
    if (!result.ok) {
      failed.push({ url: candidate.url, error: result.error ?? "unknown" });
      continue;
    }
    if (familiesUsed.has(candidate.family)) continue;
    try {
      await db
        .insert(cityResearchSources)
        .values({
          cityId: city.id,
          url: candidate.url,
          label: candidate.label,
          enabled: true,
          lastFetchedAt: new Date(),
          lastFetchOk: true,
          lastFetchBytes: result.bytes,
          lastFetchError: null,
        })
        .onConflictDoNothing({
          target: [cityResearchSources.cityId, cityResearchSources.url],
        });
      added.push({ url: candidate.url, label: candidate.label, bytes: result.bytes });
      familiesUsed.add(candidate.family);
    } catch (err) {
      failed.push({
        url: candidate.url,
        error: `db insert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cityResearchSources)
    .where(and(eq(cityResearchSources.cityId, city.id), eq(cityResearchSources.enabled, true)));

  return {
    citySlug,
    alreadyHadEnabled: 0,
    added,
    failed,
    totalEnabledAfter: Number(count ?? added.length),
  };
}
