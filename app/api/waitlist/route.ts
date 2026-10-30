import { NextResponse } from "next/server";
import { z } from "zod";

import { safeJson } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { waitlistSignups } from "@/lib/db/schema";

/**
 * Public founding-family waitlist signup (POST /api/waitlist).
 *
 * Pilot/waitlist capture only: no account is created and no payment is
 * taken. The email column is unique (see waitlist_signups in
 * db/init/01_schema.sql), so a repeat signup returns a friendly
 * duplicate response instead of an error or a second row.
 */

const waitlistSignupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  role: z.enum(["grandparent", "parent", "other"]),
});

const DUPLICATE_MESSAGE =
  "You're already on the list — we'll email you when pilot invitations go out.";

export async function POST(request: Request) {
  const json = await safeJson(request);
  if ("error" in json) return json.error;

  const parsed = waitlistSignupSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide your name, a valid email, and who would star in the videos." },
      { status: 400 },
    );
  }

  const name = parsed.data.name;
  const email = parsed.data.email.toLowerCase();

  try {
    await db.insert(waitlistSignups).values({
      name,
      email,
      cloneRole: parsed.data.role,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Unique violation on email => already signed up (same pattern as
    // the idempotency-key collision handling in lib/voice-jobs.ts).
    const code =
      (error as { code?: string })?.code ??
      (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true, message: DUPLICATE_MESSAGE });
    }
    console.error("Waitlist signup failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
