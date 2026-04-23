import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { verifySession } from "@/lib/auth";

const CSV_PATH = path.join(process.cwd(), "John", "PR DO NOT TOUCH", "Do not touch B.csv");

export async function GET() {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const text = await fs.readFile(CSV_PATH, "utf-8");
    const urls = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return NextResponse.json({ urls, count: urls.length, source: "John/PR DO NOT TOUCH/Do not touch B.csv" });
  } catch (e: any) {
    return NextResponse.json({ error: "csv_not_found", message: e.message }, { status: 404 });
  }
}
