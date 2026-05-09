import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = process.env.SESSION_SECRET || "dev-secret-change-me";
const ENCODED_KEY = new TextEncoder().encode(SECRET_KEY);
export const COOKIE_NAME = "admin_session";

export interface AdminSession {
  userId: string;
  email: string;
  tenantSlug: string;
  // Back-compat aliases so existing routes that read session.username /
  // session.adminId keep working without per-route edits.
  username: string;
  adminId: string;
}

export async function createSession(opts: { userId: string; email: string; tenantSlug: string }) {
  const token = await new SignJWT({
    userId: opts.userId,
    email: opts.email,
    tenantSlug: opts.tenantSlug,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(ENCODED_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return token;
}

export async function verifySession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, ENCODED_KEY);
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;
    const tenantSlug = payload.tenantSlug as string | undefined;
    if (!userId || !email || !tenantSlug) return null;
    return { userId, email, tenantSlug, username: email, adminId: userId };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Edge/server-only helper for the storage proxy to read tenant from cookie
// without going through the full verifySession (it's already async-safe).
export async function readTenantFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, ENCODED_KEY);
    return (payload.tenantSlug as string | undefined) ?? null;
  } catch {
    return null;
  }
}
