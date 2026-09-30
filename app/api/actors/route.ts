import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase/auth";
import { safeJson } from "@/lib/api-helpers";
import { z } from "zod";
import { consentSchema, newActor } from "@/packages/digital-actor-schema";

export async function GET() {
  const client = await getRouteClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await client.from("digital_actors").select("id, version, status, identity, created_at, updated_at").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load actors" }, { status: 503 });
  return NextResponse.json({ actors: data });
}
export async function POST(request: Request) {
  const client = await getRouteClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await safeJson(request);
  if ("error" in json) return json.error;
  const parsed = z.object({ consent: consentSchema, heightCm: z.number().min(100).max(250) }).strict().safeParse(json.body);
  if (!parsed.success) return NextResponse.json({ error: "Adult self-capture consent and height are required" }, { status: 400 });
  const actor = newActor(randomUUID(), user.id, parsed.data.heightCm);
  const { data, error } = await client.from("digital_actors").insert({ id: actor.id, user_id: user.id, identity: actor,
    consent: { ...parsed.data.consent, timestamp: actor.createdAt, purpose: "digital_actor_enrollment" } }).select("id, version, status, identity").single();
  if (error) return NextResponse.json({ error: "Could not create actor" }, { status: 503 });
  return NextResponse.json({ actor: data }, { status: 201 });
}
