import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, tenants, tenantMembers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      tenantSlug: tenantMembers.tenantSlug,
      personaDisplayName: tenants.personaDisplayName,
    })
    .from(users)
    .innerJoin(tenantMembers, eq(tenantMembers.userId, users.id))
    .innerJoin(tenants, eq(tenants.slug, tenantMembers.tenantSlug))
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: row.id,
    username: row.email, // back-compat for existing UI
    email: row.email,
    displayName: row.displayName,
    tenantSlug: row.tenantSlug,
    tenantDisplayName: row.personaDisplayName,
  });
}
