import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

export default async function CloneDetailsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: voice } = await supabase
    .from("family_voices")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!voice) {
    redirect("/dashboard/clones");
  }

  const cloneColor = getColorForName(voice.name);

  return (
    <main className="container py-12 max-w-4xl mx-auto text-white">
      <CloneDetailsTabs voice={voice} cloneColor={cloneColor} userId={user.id} />
    </main>
  );
}
