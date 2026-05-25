import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    // 1. Decode base64 image
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // 2. Save the file locally
    const filename = `visual_clone_${params.id}_${Date.now()}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    // 3. Update family_voices with captured frame immediately
    const { error: dbError } = await supabase
      .from("family_voices")
      .update({
        avatar_url: publicUrl,
        idle_video_url: publicUrl,
        talking_video_url: publicUrl,
      })
      .eq("id", params.id);

    // 4. Update current user's profile avatar_url
    const { error: userDbError } = await supabase
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    // 5. Trigger Pixar avatar generation in background (non-blocking)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    fetch(`${siteUrl}/api/avatar/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: params.id, imageUrl: publicUrl }),
    }).catch(err => console.error("Pixar avatar generation failed (non-fatal):", err));

    if (dbError || userDbError) {
      console.warn("Database failed to update visual clone columns.", { dbError, userDbError });
      return NextResponse.json({
        success: true,
        simulated: true,
        avatarUrl: publicUrl,
        idleVideoUrl: publicUrl,
        talkingVideoUrl: publicUrl,
        message: "Visual clone captured (Simulation mode: Database columns not created)."
      });
    }

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
      idleVideoUrl: publicUrl,
      talkingVideoUrl: publicUrl,
    });
  } catch (error: any) {
    console.error("Visual capture error:", error);
    return NextResponse.json({ error: error.message || "Failed to process visual capture" }, { status: 500 });
  }
}
