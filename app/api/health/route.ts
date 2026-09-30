import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CheckResult = {
  status: "ok" | "error" | "skipped";
  latencyMs: number;
  message?: string;
};

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("users").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Database unavailable",
    };
  }
}

async function checkGCS(): Promise<CheckResult> {
  const started = Date.now();
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName || !process.env.GOOGLE_CLOUD_PROJECT_ID) {
    return { status: "skipped", latencyMs: Date.now() - started, message: "GCS not configured" };
  }
  try {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\n/g, "\n"),
      },
    });
    // Lightweight bucket metadata check with timeout
    const bucket = storage.bucket(bucketName);
    await Promise.race([
      bucket.exists(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GCS check timeout")), 4000)),
    ]);
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "GCS unavailable",
    };
  }
}

async function checkElevenLabs(): Promise<CheckResult> {
  const started = Date.now();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { status: "skipped", latencyMs: Date.now() - started, message: "ElevenLabs not configured" };
  }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(4000),
    });
    // 401 means key invalid, 200/404 etc means service reachable — treat non-5xx as ok for health
    if (res.status < 500) {
      return { status: "ok", latencyMs: Date.now() - started };
    }
    throw new Error(`ElevenLabs returned ${res.status}`);
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "ElevenLabs unavailable",
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const [database, gcs, elevenlabs] = await Promise.all([
    checkDatabase(),
    checkGCS(),
    checkElevenLabs(),
  ]);

  const hasError = [database, gcs, elevenlabs].some((c) => c.status === "error");
  const hasSkipped = [database, gcs, elevenlabs].some((c) => c.status === "skipped");

  let status: "ok" | "degraded" | "error";
  let httpStatus: number;
  if (hasError) {
    status = "degraded";
    httpStatus = 503;
  } else if (hasSkipped) {
    status = "ok";
    httpStatus = 200;
  } else {
    status = "ok";
    httpStatus = 200;
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        database,
        gcs,
        elevenlabs,
      },
      // legacy flat fields for backwards compat with existing monitors
      database: database.status,
      gcs: gcs.status,
      elevenlabs: elevenlabs.status,
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
