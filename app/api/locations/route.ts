import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET() {
  const cities = await storage.getCities(true);
  return NextResponse.json(cities);
}
