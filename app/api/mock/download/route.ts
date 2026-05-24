import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const tmpDir = os.tmpdir();
  // Sanitize key for filesystem path
  const safeFilename = `voxtree-mock-${key.replace(/[\/\\?%*:|"<>\s]/g, "_")}`;
  const filePath = path.join(tmpDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    console.warn(`[Mock Storage] File not found: ${filePath}`);
    return new NextResponse("File not found", { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[Mock Storage] Download error:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
