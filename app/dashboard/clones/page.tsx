import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { familyVoices } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { ClonesClient } from "./clones-client";

export default async function ClonesPage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // RLS owner policy: user_id = uid.
  const voices = await db
    .select()
    .from(familyVoices)
    .where(eq(familyVoices.userId, userId))
    .orderBy(desc(familyVoices.createdAt));

  // Map voices to Twilight format
  const clones = voices.map((v, i) => {
    const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8"];
    return {
      id: v.id,
      name: v.name,
      relation: "Family Member",
      recorded: v.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      status: v.status || "processing",
      lastUsed: "—",
      stories: 0,
      color: colors[i % colors.length],
      avatar_url: v.avatarUrl,
      // model_3d_url never existed as a column; it was always null.
      model_3d_url: null as string | null,
    };
  });

  return <ClonesClient clones={clones} />;
}
