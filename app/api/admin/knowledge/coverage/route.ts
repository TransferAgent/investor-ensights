import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cityLocations, knowledgeArticles } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cities = await db.select({
    citySlug: cityLocations.slug,
    cityName: cityLocations.cityName,
    state: cityLocations.stateCode,
  }).from(cityLocations).where(eq(cityLocations.isPublished, true));

  const articles = await db.select({
    slug: knowledgeArticles.slug,
    citySlug: knowledgeArticles.citySlug,
    status: knowledgeArticles.status,
    datePublished: knowledgeArticles.datePublished,
    createdAt: knowledgeArticles.createdAt,
  }).from(knowledgeArticles).orderBy(desc(knowledgeArticles.createdAt));

  const coverage = cities.map(city => {
    const cityArticles = articles.filter(a => a.citySlug === city.citySlug);
    const published = cityArticles.filter(a => a.status === "published").sort((a, b) =>
      (b.datePublished?.getTime() || 0) - (a.datePublished?.getTime() || 0)
    )[0];
    const pending = cityArticles.find(a => a.status === "pending");

    let status: string;
    let lastPublished: string | null = null;

    if (published) {
      status = "Published";
      lastPublished = published.datePublished?.toISOString() || null;
    } else if (pending) {
      status = "Pending";
    } else {
      status = "Not Generated";
    }

    return {
      citySlug: city.citySlug,
      cityName: city.cityName,
      state: city.state,
      status,
      lastPublished,
    };
  });

  coverage.sort((a, b) => a.state.localeCompare(b.state) || a.cityName.localeCompare(b.cityName));

  return NextResponse.json(coverage);
}
