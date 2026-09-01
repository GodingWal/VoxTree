import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BedtimeClient } from "./bedtime-client";
import { isSimulationEnabled } from "@/lib/features";

export const metadata = {
  title: "Bedtime & Background | VoxTree",
  description: "Configure bedtime hours, screen auto-dim, and ambient background sounds.",
};

export default async function BedtimePage() {
  const supabase = await createClient();
  
  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user settings
  let initialTime = "21:00";
  let initialAutodim = true;
  let initialAudio = "soft_rain";
  let dbSimulated = false;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("bedtime_time, bedtime_autodim, default_background_audio")
      .eq("id", user.id)
      .single();

    if (error) {
      if (!isSimulationEnabled()) throw error;
      dbSimulated = true;
    } else if (data) {
      initialTime = data.bedtime_time || "21:00";
      initialAutodim = data.bedtime_autodim !== false;
      initialAudio = data.default_background_audio || "soft_rain";
    }
  } catch (err) {
    if (!isSimulationEnabled()) throw err;
    dbSimulated = true;
  }

  return (
    <BedtimeClient
      userId={user.id}
      initialTime={initialTime}
      initialAutodim={initialAutodim}
      initialAudio={initialAudio}
      dbSimulated={dbSimulated}
    />
  );
}
