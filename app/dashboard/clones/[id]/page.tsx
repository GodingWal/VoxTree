import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { toSnakeRow } from "@/lib/db/to-snake";
import { getCurrentUserId } from "@/lib/auth/session";
import { CloneDetailsTabs } from "./tabs-content";

// Deterministic color generation based on name
function getColorForName(name: string) {
  const colors = ["#F4B860", "#7FC4A4", "#E07A5F", "#9D8CA1", "#5C80BC"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default async function CloneDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // RLS owner policy on family_voices scoped the old by-id select to the
  // caller's own voices; keep that predicate explicitly.
  const [voice] = await db
    .select()
    .from(familyVoices)
    .where(and(eq(familyVoices.id, id), eq(familyVoices.userId, userId)))
    .limit(1);

  if (!voice) {
    redirect("/dashboard/clones");
  }

  const cloneColor = getColorForName(voice.name);

  return (
    <main className="container py-12 max-w-4xl mx-auto text-white">
      <CloneDetailsTabs voice={toSnakeRow(voice) as any} cloneColor={cloneColor} userId={userId} />
    </main>
  );
}
