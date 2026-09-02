import { getRouteClient } from "@/lib/supabase/auth";
import { checkLimit } from "@/lib/limits";
import { getPresignedUploadUrl, GCP_PATHS } from "@/lib/gcp";
import { checkAbuse } from "@/lib/abuse-detection";
import {
  enforcePaidRateLimit,
  enforceUserRateLimit,
  safeJson,
} from "@/lib/api-helpers";
import { AUDIO_LIMITS } from "@/lib/audio-validation";
import { enqueueJob } from "@/lib/voice-jobs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { trace, SpanStatusCode } from "@opentelemetry/api";

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

const tracer = trace.getTracer("voxtree-api");

export async function POST(request: Request) {
  return tracer.startActiveSpan("POST /api/voices/create", async (span) => {
    try {
      const rateLimited = await enforcePaidRateLimit(request);
      if (rateLimited) {
        span.setAttribute("http.status_code", 429);
        return rateLimited;
      }

      const supabase = await getRouteClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        span.setAttribute("http.status_code", 401);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      span.setAttribute("user.id", user.id);

      const parsedJson = await safeJson(request);
      if ("error" in parsedJson) return parsedJson.error;
      const parsed = createVoiceSchema.safeParse(parsedJson.body);

      if (!parsed.success) {
        span.setAttribute("http.status_code", 400);
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      span.setAttribute("voice.name", parsed.data.name);

      // Abuse fence: celebrity blocklist + voice_owner_name vs auth user
      const abuse = checkAbuse({
        voiceOwnerName: parsed.data.voiceOwnerName,
        voiceName: parsed.data.name,
        authUser: {
          id: user.id,
          email: (user as any).email ?? null,
          displayName: (user as any).user_metadata?.["full_name"] ?? (user as any).user_metadata?.["name"] ?? null,
          user_metadata: (user as any).user_metadata ?? null,
        },
      });
      if (abuse.blocked) {
        span.setAttribute("abuse.blocked", true);
        span.setAttribute("abuse.code", abuse.code ?? "unknown");
        return NextResponse.json({ error: abuse.reason, code: abuse.code }, { status: 403 });
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("consent_verified, consent_notice_version")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.consent_verified) {
        span.setAttribute("http.status_code", 403);
        return NextResponse.json(
          { error: "Verified parental consent is required before creating a voice.", consentRequired: true },
          { status: 403 }
        );
      }

      // Per-user durable cap: at most 5 voice-clone attempts per hour.
      const userLimited = await enforceUserRateLimit({
        userId: user.id,
        bucket: "voice_clone",
        limit: 5,
        windowSeconds: 60 * 60,
      });
      if (userLimited) {
        span.setAttribute("rate_limited", true);
        return userLimited;
      }

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
        span.recordException(insertError ?? new Error("Failed to create voice record"));
        span.setStatus({ code: SpanStatusCode.ERROR, message: "Failed to create voice record" });
        return NextResponse.json(
          { error: "Failed to create voice record" },
          { status: 500 }
        );
      }
      span.setAttribute("voice.id", voice.id);

      const gcpKey = GCP_PATHS.voiceSample(user.id, voice.id);
      const contentType = parsed.data.contentType ?? "audio/mpeg";
      const uploadUrl = await getPresignedUploadUrl(gcpKey, contentType, {
        maxBytes: AUDIO_LIMITS.maxBytes,
      });

      // Auto-enqueue 30-sec sample dub for viral invite loop.
      try {
        await enqueueJob({
          userId: user.id,
          type: "clip_generate",
          payload: {
            voiceId: voice.id,
            voiceName: parsed.data.name,
            durationSeconds: 30,
            text: "Once upon a time, beneath a sky full of stars, a little explorer set out on a kind and curious adventure.",
            source: "voice_create_sample_dub",
          },
          idempotencyKey: `sample-dub-${voice.id}`,
        });
      } catch (e) {
        console.warn("sample dub enqueue failed (non-fatal)", e);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return NextResponse.json({
        voiceId: voice.id,
        uploadUrl,
        gcpKey,
        maxBytes: AUDIO_LIMITS.maxBytes,
        requiredUploadHeaders: {
          "x-goog-content-length-range": `0,${AUDIO_LIMITS.maxBytes}`,
        },
      });
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    } finally {
      span.end();
    }
  });
}
