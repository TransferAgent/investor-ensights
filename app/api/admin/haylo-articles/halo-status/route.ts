import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({
      key: tenants.haloDistributionKey,
      lastPulledId: tenants.haloLastPulledId,
      lastPulledAt: tenants.haloLastPulledAt,
    })
    .from(tenants)
    .where(eq(tenants.slug, session.tenantSlug))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  return NextResponse.json({
    keyIsSet: !!(row.key && row.key.length > 0),
    lastPulledId: row.lastPulledId ?? 0,
    lastPulledAt: row.lastPulledAt,
  });
}
