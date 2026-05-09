import { NextResponse } from "next/server";
import { verifySession, type AdminSession } from "./auth";
import { withTenantAsync } from "./tenant/context";

// MT-4: shared admin auth wrapper. Verifies the session cookie, returns 401
// if missing/invalid, otherwise runs the handler inside the session's tenant
// context (so all storage calls inside resolve to the user's tenant schema).
//
// Usage:
//   export async function GET() {
//     return withAdminAuth(async (session) => {
//       const cities = await storage.getCities(false);
//       return NextResponse.json(cities);
//     });
//   }
//
// NOTE: storage methods also auto-enter tenant context via the session-aware
// Proxy in lib/storage.ts, so wrapping with withAdminAuth is redundant for
// storage-only routes. It IS required for routes that talk to `db` directly.
export async function withAdminAuth(
  handler: (session: AdminSession) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return withTenantAsync(session.tenantSlug, () => handler(session));
}
