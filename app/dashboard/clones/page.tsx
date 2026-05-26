import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClonesClient } from "./clones-client";

export default async function ClonesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Map supabase voices to Twilight format
  const clones = voices?.map((v, i) => {
    const colors = ["#E8856C", "#F4B860", "#7FC4A4", "#C58FB8"];
    return {
      id: v.id,
      name: v.name,
      relation: "Family Member",
      recorded: new Date(v.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      status: v.status || "processing",
      lastUsed: "—",
      stories: 0,
      color: colors[i % colors.length],
      avatar_url: v.avatar_url
    };
  }) || [];

  return <ClonesClient clones={clones} />;
}
