import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles, cityLocations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  indexedUrls: z.array(z.string()).default([]),
});

type ParsedSafeEntry =
  | { kind: "article"; slug: string; raw: string }
  | { kind: "city"; slug: string; raw: string }
  | { kind: "home"; raw: string }
  | { kind: "unknown"; raw: string };

export function parseSafeEntry(input: string): ParsedSafeEntry {
  const raw = input.trim();
  if (!raw) return { kind: "unknown", raw };
  let v = raw.toLowerCase();
  v = v.replace(/^https?:\/\/[^/]+/, "");
  v = v.split("?")[0].split("#")[0];
  v = v.replace(/\/+$/, "");
  if (v === "" || v === "/") return { kind: "home", raw };
  const cityMatch = v.match(/^\/?locations\/([^/]+)$/);
  if (cityMatch) return { kind: "city", slug: cityMatch[1], raw };
  const artMatch = v.match(/^\/?discovery\/knowledge\/([^/]+)$/);
  if (artMatch) return { kind: "article", slug: artMatch[1], raw };
  // bare slug (no path): infer by pattern. City slugs in this app end in 2-letter state code AND don't contain "tableicity-" or "press-release"/"cap-table"/"zkp-noir".
  if (!v.includes("/")) {
    const looksArticle = /(tableicity-|press-release|cap-table|zkp-noir|hash-256)/.test(v);
    if (!looksArticle && /-[a-z]{2}$/.test(v)) return { kind: "city", slug: v, raw };
    return { kind: "article", slug: v, raw };
  }
  return { kind: "unknown", raw };
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = schema.parse(await req.json());

  const parsed = body.indexedUrls.map(parseSafeEntry);
  const articleSlugSafeList = new Set(parsed.filter((p) => p.kind === "article").map((p: any) => p.slug));
  const citySlugSafeList = new Set(parsed.filter((p) => p.kind === "city").map((p: any) => p.slug));
  const homeCount = parsed.filter((p) => p.kind === "home").length;
  const unknownEntries = parsed.filter((p) => p.kind === "unknown").map((p) => p.raw);

  // Articles
  const allArticles = await db
    .select({
      id: knowledgeArticles.id,
      slug: knowledgeArticles.slug,
      title: knowledgeArticles.title,
      robots: knowledgeArticles.robots,
    })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.status, "published"));

  const articlesWillFlip: any[] = [];
  const articlesWillKeep: any[] = [];
  const articlesAlreadyNoindex: any[] = [];
  for (const a of allArticles) {
    const isAlreadyNoindex = (a.robots || "").toLowerCase().includes("noindex");
    if (articleSlugSafeList.has(a.slug)) articlesWillKeep.push(a);
    else if (isAlreadyNoindex) articlesAlreadyNoindex.push(a);
    else articlesWillFlip.push(a);
  }
  const articleSafeListMissing: string[] = [];
  for (const s of articleSlugSafeList) {
    if (!allArticles.some((a) => a.slug === s)) articleSafeListMissing.push(s);
  }

  // Cities (consider only published ones — unpublished are already not crawled)
  const allCities = await db
    .select({
      id: cityLocations.id,
      slug: cityLocations.slug,
      cityName: cityLocations.cityName,
      stateCode: cityLocations.stateCode,
      allowIndexing: cityLocations.allowIndexing,
      isPublished: cityLocations.isPublished,
    })
    .from(cityLocations)
    .where(eq(cityLocations.isPublished, true));

  const citiesWillFlip: any[] = [];
  const citiesWillKeep: any[] = [];
  const citiesAlreadyNoindex: any[] = [];
  for (const c of allCities) {
    if (citySlugSafeList.has(c.slug)) citiesWillKeep.push(c);
    else if (c.allowIndexing === false) citiesAlreadyNoindex.push(c);
    else citiesWillFlip.push(c);
  }
  const citySafeListMissing: string[] = [];
  for (const s of citySlugSafeList) {
    if (!allCities.some((c) => c.slug === s)) citySafeListMissing.push(s);
  }

  return NextResponse.json({
    parsed: {
      articleSafeList: Array.from(articleSlugSafeList),
      citySafeList: Array.from(citySlugSafeList),
      homeCount,
      unknownEntries,
    },
    articles: {
      total: allArticles.length,
      willFlipToNoindex: articlesWillFlip.length,
      willKeepIndexed: articlesWillKeep.length,
      alreadyNoindex: articlesAlreadyNoindex.length,
      safeListMissing: articleSafeListMissing,
      willFlip: articlesWillFlip.map((a) => ({ id: a.id, slug: a.slug, title: a.title })),
      willKeep: articlesWillKeep.map((a) => ({ id: a.id, slug: a.slug, title: a.title })),
    },
    cities: {
      total: allCities.length,
      willFlipToNoindex: citiesWillFlip.length,
      willKeepIndexed: citiesWillKeep.length,
      alreadyNoindex: citiesAlreadyNoindex.length,
      safeListMissing: citySafeListMissing,
      willFlip: citiesWillFlip.map((c) => ({ id: c.id, slug: c.slug, label: `${c.cityName}, ${c.stateCode}` })),
      willKeep: citiesWillKeep.map((c) => ({ id: c.id, slug: c.slug, label: `${c.cityName}, ${c.stateCode}` })),
    },
  });
}
