import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeArticles } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  indexedSlugs: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = schema.parse(await req.json());
  const indexedSet = new Set(body.indexedSlugs.map((s) => s.trim()).filter(Boolean));

  const all = await db
    .select({
      id: knowledgeArticles.id,
      slug: knowledgeArticles.slug,
      title: knowledgeArticles.title,
      status: knowledgeArticles.status,
      robots: knowledgeArticles.robots,
    })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.status, "published"));

  const willFlip: typeof all = [];
  const willKeep: typeof all = [];
  const alreadyNoindex: typeof all = [];
  const safeListMatched: string[] = [];
  const safeListMissing: string[] = [];

  for (const a of all) {
    const isAlreadyNoindex = (a.robots || "").toLowerCase().includes("noindex");
    if (indexedSet.has(a.slug)) {
      willKeep.push(a);
      safeListMatched.push(a.slug);
    } else if (isAlreadyNoindex) {
      alreadyNoindex.push(a);
    } else {
      willFlip.push(a);
    }
  }

  for (const slug of indexedSet) {
    if (!safeListMatched.includes(slug)) safeListMissing.push(slug);
  }

  return NextResponse.json({
    totals: {
      published: all.length,
      willFlipToNoindex: willFlip.length,
      willKeepIndexed: willKeep.length,
      alreadyNoindex: alreadyNoindex.length,
      safeListSize: indexedSet.size,
      safeListMissing: safeListMissing.length,
    },
    willFlip: willFlip.map((a) => ({ id: a.id, slug: a.slug, title: a.title })),
    willKeep: willKeep.map((a) => ({ id: a.id, slug: a.slug, title: a.title })),
    alreadyNoindex: alreadyNoindex.map((a) => ({ id: a.id, slug: a.slug, title: a.title })),
    safeListMissing,
  });
}
