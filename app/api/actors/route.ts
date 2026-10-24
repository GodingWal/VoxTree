import { randomUUID } from "node:crypto";

import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeJson } from "@/lib/api-helpers";
import { getCurrentUserId } from "@/lib/auth/session";
import { actorOwnedBy } from "@/lib/authz";
import { db } from "@/lib/db";
import { digitalActors } from "@/lib/db/schema";
import { consentSchema, newActor } from "@/packages/digital-actor-schema";

/**
 * Response rows keep the snake_case keys PostgREST returned
 * (created_at / updated_at as ISO strings) so the API shape is unchanged.
 */
function actorJson(row: {
  id: string;
  version: number;
  status: string;
  identity: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const out: Record<string, unknown> = {
    id: row.id,
    version: row.version,
    status: row.status,
    identity: row.identity,
  };
  if (row.createdAt) out.created_at = row.createdAt.toISOString();
  if (row.updatedAt) out.updated_at = row.updatedAt.toISOString();
  return out;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db
      .select({
        id: digitalActors.id,
        version: digitalActors.version,
        status: digitalActors.status,
        identity: digitalActors.identity,
        createdAt: digitalActors.createdAt,
        updatedAt: digitalActors.updatedAt,
      })
      .from(digitalActors)
      .where(actorOwnedBy(userId))
      .orderBy(desc(digitalActors.createdAt));
    return NextResponse.json({ actors: rows.map(actorJson) });
  } catch {
    return NextResponse.json({ error: "Could not load actors" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await safeJson(request);
  if ("error" in json) return json.error;
  const parsed = z.object({ consent: consentSchema, heightCm: z.number().min(100).max(250) }).strict().safeParse(json.body);
  if (!parsed.success) return NextResponse.json({ error: "Adult self-capture consent and height are required" }, { status: 400 });
  const actor = newActor(randomUUID(), userId, parsed.data.heightCm);
  try {
    const [row] = await db
      .insert(digitalActors)
      .values({
        id: actor.id,
        userId,
        identity: actor,
        consent: { ...parsed.data.consent, timestamp: actor.createdAt, purpose: "digital_actor_enrollment" },
      })
      .returning({
        id: digitalActors.id,
        version: digitalActors.version,
        status: digitalActors.status,
        identity: digitalActors.identity,
      });
    return NextResponse.json({ actor: actorJson(row) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create actor" }, { status: 503 });
  }
}
