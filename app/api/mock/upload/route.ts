import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const tmpDir = os.tmpdir();
  // Sanitize key for filesystem path
  const safeFilename = `voxtree-mock-${key.replace(/[\/\\?%*:|"<>\s]/g, "_")}`;
  const filePath = path.join(tmpDir, safeFilename);

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Ensure parent directory exists (though os.tmpdir() definitely exists)
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    
    fs.writeFileSync(filePath, buffer);
    console.log(`[Mock Storage] Successfully uploaded ${buffer.length} bytes to ${filePath}`);
    
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Mock Storage] Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
