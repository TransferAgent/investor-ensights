import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const files = await storage.getDataStoreFiles(status, category);
  const filesWithoutData = files.map(({ fileData, ...rest }) => rest);
  return NextResponse.json(filesWithoutData);
}

export async function POST(req: NextRequest) {
  const session = await verifySession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const notes = formData.get("notes") as string | null;
  const category = formData.get("category") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/html",
    "text/markdown",
  ];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed. Supported: PDF, Word (.doc/.docx), TXT, HTML, Markdown" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileData = buffer.toString("base64");
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const stored = await storage.createDataStoreFile({
    filename,
    originalName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    fileData,
    category: category || "general",
    status: "pending",
    notes: notes || undefined,
    uploadedBy: session.username,
  });

  await logAuditEvent({ username: session.username, action: "upload", entityType: "data_store_file", entityId: stored.id });

  const { fileData: _, ...result } = stored;
  return NextResponse.json(result, { status: 201 });
}
