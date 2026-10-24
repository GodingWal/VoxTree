import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { BedtimeClient } from "./bedtime-client";
import { isSimulationEnabled } from "@/lib/features";

export const metadata = {
  title: "Bedtime & Background | VoxTree",
  description: "Configure bedtime hours, screen auto-dim, and ambient background sounds.",
};

export default async function BedtimePage() {
  // Get authenticated user
  const userId = await getCurrentUserId();

  if (!userId) {
    redirect("/login");
  }

  // Fetch user settings (RLS: users row is self-only)
  let initialTime = "21:00";
  let initialAutodim = true;
  let initialAudio = "soft_rain";
  let dbSimulated = false;

  try {
    const [data] = await db
      .select({
        bedtimeTime: users.bedtimeTime,
        bedtimeAutodim: users.bedtimeAutodim,
        defaultBackgroundAudio: users.defaultBackgroundAudio,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (data) {
      initialTime = data.bedtimeTime || "21:00";
      initialAutodim = data.bedtimeAutodim !== false;
      initialAudio = data.defaultBackgroundAudio || "soft_rain";
    }
  } catch (err) {
    if (!isSimulationEnabled()) throw err;
    dbSimulated = true;
  }

  return (
    <BedtimeClient
      userId={userId}
      initialTime={initialTime}
      initialAutodim={initialAutodim}
      initialAudio={initialAudio}
      dbSimulated={dbSimulated}
    />
  );
}
