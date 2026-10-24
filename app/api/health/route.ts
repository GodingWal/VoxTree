import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CheckResult = {
  status: "ok" | "error" | "skipped";
  latencyMs: number;
  message?: string;
};

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1 from users limit 1`);
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
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
    });
    // Lightweight bucket metadata check with timeout
    const bucket = storage.bucket(bucketName);
    const [exists] = await Promise.race([
      bucket.exists(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GCS check timeout")), 4000)),
    ]);
    if (!exists) throw new Error(`GCS bucket "${bucketName}" does not exist`);
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "GCS unavailable",
    };
  }
}

async function checkChatterbox(): Promise<CheckResult> {
  const started = Date.now();
  const serviceUrl = (
    process.env.CHATTERBOX_SERVICE_URL || "http://localhost:8001"
  ).replace(/\/+$/, "");
  try {
    const res = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      return { status: "ok", latencyMs: Date.now() - started };
    }
    throw new Error(`Chatterbox service returned ${res.status}`);
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Chatterbox service unavailable",
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const [database, gcs, chatterbox] = await Promise.all([
    checkDatabase(),
    checkGCS(),
    checkChatterbox(),
  ]);

  const hasError = [database, gcs, chatterbox].some((c) => c.status === "error");
  const hasSkipped = [database, gcs, chatterbox].some((c) => c.status === "skipped");

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
        chatterbox,
      },
      // legacy flat fields for backwards compat with existing monitors
      database: database.status,
      gcs: gcs.status,
      chatterbox: chatterbox.status,
    },
    { status: httpStatus, headers: { "Cache-Control": "no-store" } }
  );
}
