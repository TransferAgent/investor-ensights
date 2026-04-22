import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { ensureDefaultAgents } from "@/lib/newsroom";

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agents = await ensureDefaultAgents();
  return NextResponse.json(agents);
}
