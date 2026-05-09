import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { asc } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

// MT-4: list of tenants for the admin user-create form's tenant picker.
export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      slug: tenants.slug,
      personaDisplayName: tenants.personaDisplayName,
      publisherName: tenants.publisherName,
      authorName: tenants.authorName,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(asc(tenants.createdAt));

  return NextResponse.json({ tenants: rows });
}
