import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

async function requireAdminRole() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;

  return { user, admin: adminClient };
}

const contentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  content_type: z.enum(["video", "story"]).default("video"),
  series: z.string().optional(),
  episode_number: z.number().int().optional(),
  original_video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number().int().optional(),
  age_range: z.string().optional(),
  tags: z.array(z.string()).default([]),
  is_premium: z.boolean().default(false),
});

export async function GET() {
  const ctx = await requireAdminRole();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: content, error } = await ctx.admin
    .from("content_library")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch content" }, { status: 500 });
  }

  return NextResponse.json({ content });
}

export async function POST(request: Request) {
  const ctx = await requireAdminRole();
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = contentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: item, error } = await ctx.admin
    .from("content_library")
    .insert(parsed.data)
    .select()
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Failed to create content" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
}
