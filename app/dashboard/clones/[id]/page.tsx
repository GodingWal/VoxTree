import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, Waveform, Pill } from "@/components/twilight-ui";
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
    <main className="container py-12 space-y-12 max-w-4xl mx-auto text-white">
      <Link href="/dashboard/clones" className="inline-flex items-center gap-2 text-sm text-[var(--paper-dim)] hover:text-white transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Voice Tree
      </Link>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[var(--ink-3)] pb-8">
        <div className="flex items-center gap-6">
          <Avatar name={voice.name} color={cloneColor} size={80} ring />
          <div>
            <h1 className="text-5xl font-serif text-[var(--paper)] tracking-tight">
              {voice.name}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <Pill>Family Voice Model</Pill>
              <span className="text-sm text-[var(--paper-dim)] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--moss)]"></div>
                Connected
              </span>
            </div>
          </div>
        </div>
        <div className="w-32 md:w-48 opacity-60">
          <Waveform playing={true} count={24} color={cloneColor} height={40} />
        </div>
      </div>

      <div>
        <CloneDetailsTabs voice={voice} cloneColor={cloneColor} userId={user.id} />
      </div>
    </main>
  );
}
