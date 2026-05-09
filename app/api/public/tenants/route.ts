import { NextResponse } from "next/server";
import pg from "pg";

// MT-4.1: public list of tenants for the homepage "You are signing into" picker.
// Intentionally PUBLIC (no auth) — the Conductor's internal workshop surfaces
// the tenant catalog on the landing page so users know which publication they
// are signing into. Returns only the public-facing fields (slug + display +
// company name); no email, no member info.
//
// Uses a dedicated pg.Pool to bypass the storage proxy entirely. This endpoint
// must read public.tenants directly with no tenant context applied.
export const dynamic = "force-dynamic";

let cached: { at: number; data: any[] } | null = null;
const TTL_MS = 30_000;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ tenants: cached.data });
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query(
      `SELECT slug, persona_display_name AS "personaDisplayName",
              company_name AS "companyName"
       FROM public.tenants
       ORDER BY created_at ASC`
    );
    cached = { at: Date.now(), data: r.rows };
    return NextResponse.json({ tenants: r.rows });
  } finally {
    await pool.end();
  }
}
