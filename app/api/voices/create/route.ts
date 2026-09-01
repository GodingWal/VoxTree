import { getRouteClient } from "@/lib/supabase/auth";
import { checkLimit } from "@/lib/limits";
import { getPresignedUploadUrl, GCP_PATHS } from "@/lib/gcp";
import {
  enforcePaidRateLimit,
  enforceUserRateLimit,
  safeJson,
} from "@/lib/api-helpers";
import { AUDIO_LIMITS } from "@/lib/audio-validation";
import { NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
] as const;

const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  voiceOwnerName: z.string().trim().min(2).max(120),
  voiceOwnerRelationship: z.string().trim().min(2).max(80),
  voiceOwnerAuthorized: z.literal(true),
  contentType: z
    .string()
    .refine((t) => (ALLOWED_AUDIO_TYPES as readonly string[]).includes(t), {
      message: "Unsupported audio content type",
    })
    .optional(),
});

export async function POST(request: Request) {
  const rateLimited = await enforcePaidRateLimit(request);
  if (rateLimited) return rateLimited;

  const supabase = await getRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedJson = await safeJson(request);
  if ("error" in parsedJson) return parsedJson.error;
  const parsed = createVoiceSchema.safeParse(parsedJson.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("consent_verified, consent_notice_version")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.consent_verified) {
    return NextResponse.json(
      { error: "Verified parental consent is required before creating a voice.", consentRequired: true },
      { status: 403 }
    );
  }

  // Per-user durable cap: at most 5 voice-clone attempts per hour. Prevents
  // a single user from exhausting paid quota even across restarts/instances.
  const userLimited = await enforceUserRateLimit({
    userId: user.id,
    bucket: "voice_clone",
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (userLimited) return userLimited;

  // Check voice slot limit
  const limitCheck = await checkLimit(user.id, "add_voice");
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: limitCheck.reason,
        upgradeRequired: true,
        upgradePrompt: limitCheck.upgradePrompt,
      },
      { status: 403 }
    );
  }

  // Create voice record
  const { data: voice, error: insertError } = await supabase
    .from("family_voices")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      status: "processing",
      voice_owner_name: parsed.data.voiceOwnerName,
      voice_owner_relationship: parsed.data.voiceOwnerRelationship,
      voice_owner_authorized_at: new Date().toISOString(),
      authorization_notice_version: profile.consent_notice_version,
    })
    .select()
    .single();

  if (insertError || !voice) {
    return NextResponse.json(
      { error: "Failed to create voice record" },
      { status: 500 }
    );
  }

  // Content-Type, so accept the client's content type when provided.
  const gcpKey = GCP_PATHS.voiceSample(user.id, voice.id);
  const contentType = parsed.data.contentType ?? "audio/mpeg";
  // Bind the presigned URL to the configured audio size cap. The browser
  // must send `x-goog-content-length-range: 0,<maxBytes>` with the PUT.
  const uploadUrl = await getPresignedUploadUrl(gcpKey, contentType, {
    maxBytes: AUDIO_LIMITS.maxBytes,
  });

  // The increment of voice slots is now automatically handled via database trigger on family_voices INSERT

  return NextResponse.json({
    voiceId: voice.id,
    uploadUrl,
    gcpKey,
    maxBytes: AUDIO_LIMITS.maxBytes,
    requiredUploadHeaders: {
      "x-goog-content-length-range": `0,${AUDIO_LIMITS.maxBytes}`,
    },
  });
}
