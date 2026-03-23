import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const file = await storage.getDataStoreFileById(id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(file.fileData, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${file.originalName}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
