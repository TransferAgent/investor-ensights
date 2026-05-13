// MT-4.13: Conductor (super-tenant) gating for staff-only operations like the
// Persona Wizard. The Conductor's home tenant is configurable via
// CONDUCTOR_TENANT_SLUG (default "tableicity") so we don't hard-code the
// privileged tenant in app code. Non-Conductor sessions get 403 from any
// route that calls requireConductor().
//
// Pragmatic intent: this is a tenant-membership gate, not a role check. It's
// upgradeable to a real `role = 'conductor'` column on tenant_members later
// without changing call sites — only the body of isConductor() changes.

import { NextResponse } from "next/server";
import { verifySession, type AdminSession } from "./auth";

const CONDUCTOR_SLUG = (process.env.CONDUCTOR_TENANT_SLUG || "tableicity").trim();

export function getConductorTenantSlug(): string {
  return CONDUCTOR_SLUG;
}

export function isConductor(session: AdminSession | null | undefined): boolean {
  if (!session) return false;
  return session.tenantSlug === CONDUCTOR_SLUG;
}

/**
 * For API routes: returns either { session } or a 403 NextResponse.
 * Usage:
 *   const guard = await requireConductor();
 *   if ("response" in guard) return guard.response;
 *   const { session } = guard;
 */
export async function requireConductor(): Promise<
  { session: AdminSession } | { response: NextResponse }
> {
  const session = await verifySession();
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isConductor(session)) {
    return {
      response: NextResponse.json(
        { error: "Forbidden: Conductor-only operation" },
        { status: 403 },
      ),
    };
  }
  return { session };
}
