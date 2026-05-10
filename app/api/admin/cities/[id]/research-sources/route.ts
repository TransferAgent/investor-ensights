import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { cityLocations, cityResearchSources } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withAdminAuth } from "@/lib/auth-middleware";

const addSourceSchema = z.object({
  url: z.string().url().max(2000),
  label: z.string().max(200).optional(),
  enabled: z.boolean().optional().default(true),
});

async function loadCityById(id: string) {
  const [city] = await db
    .select({ id: cityLocations.id, slug: cityLocations.slug, cityName: cityLocations.cityName })
    .from(cityLocations)
    .where(eq(cityLocations.id, id))
    .limit(1);
  return city ?? null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdminAuth(async (session) => {

  const { id } = await ctx.params;
  const city = await loadCityById(id);
  if (!city) return NextResponse.json({ error: "city not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(cityResearchSources)
    .where(eq(cityResearchSources.cityId, city.id));

  return NextResponse.json({ city, sources: rows });
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdminAuth(async (session) => {

  const { id } = await ctx.params;
  const city = await loadCityById(id);
  if (!city) return NextResponse.json({ error: "city not found" }, { status: 404 });

  let body: z.infer<typeof addSourceSchema>;
  try {
    body = addSourceSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  try {
    const [inserted] = await db
      .insert(cityResearchSources)
      .values({ cityId: city.id, url: body.url, label: body.label ?? null, enabled: body.enabled })
      .returning();

    await logAuditEvent({
      username: session.username,
      action: "city_research_source_create",
      entityType: "city_research_sources",
      entityId: inserted.id,
      details: { citySlug: city.slug, url: body.url, label: body.label ?? null },
    });

    return NextResponse.json({ source: inserted }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("city_research_sources_city_url_unq") || msg.includes("duplicate key")) {
      return NextResponse.json({ error: "url already added for this city" }, { status: 409 });
    }
    console.error("[research-sources POST] failed:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAdminAuth(async (session) => {

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const sourceId = url.searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

  const deleted = await db
    .delete(cityResearchSources)
    .where(and(eq(cityResearchSources.cityId, id), eq(cityResearchSources.id, sourceId)))
    .returning({ id: cityResearchSources.id, url: cityResearchSources.url });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  await logAuditEvent({
    username: session.username,
    action: "city_research_source_delete",
    entityType: "city_research_sources",
    entityId: sourceId,
    details: { cityId: id, url: deleted[0].url },
  });

  return NextResponse.json({ deleted: deleted[0] });
  });
}
