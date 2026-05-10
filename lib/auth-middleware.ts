import { NextResponse } from "next/server";
import { verifySession, type AdminSession } from "./auth";
import { withTenantAsync } from "./tenant/context";

// MT-4 / MT-4.8: shared admin auth wrapper. Verifies the session cookie,
// returns 401 if missing/invalid, otherwise runs the handler inside the
// session's tenant context (so every `db` access inside resolves to the
// user's tenant schema).
//
// THIS IS THE ONLY APPROVED PATTERN for admin routes. Direct
// `verifySession + withTenantAsync` is a code smell — use this helper instead.
//
// Usage:
//   export async function GET(req: Request) {
//     return withAdminAuth(async (session) => {
//       const rows = await db.select().from(...);  // tenant-scoped automatically
//       return NextResponse.json(rows);
//     });
//   }
//
// IMPORTANT: the `db` Proxy in lib/db.ts falls back to TENANT_DEFAULT_SLUG
// ("tableicity") when no ALS context is set — so a missing wrap silently
// reads the wrong schema instead of failing loudly. That's why we centralize
// the wrap here. lib/db.ts emits a dev-mode warning when this fallback is hit.
export async function withAdminAuth(
  handler: (session: AdminSession) => Promise<NextResponse>
): Promise<NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return withTenantAsync(session.tenantSlug, () => handler(session));
}
