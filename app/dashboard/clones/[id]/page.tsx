import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Mic, User as UserIcon, Activity, Music, ArrowLeft, Trash2 } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { TrainSingingButton } from "@/components/train-singing-button";
import { DeleteCloneButton } from "@/components/delete-clone-button";
import { TestVoiceButton } from "@/components/test-voice-button";
import { Avatar, Waveform, Pill } from "@/components/twilight-ui";

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
        {/* Radix UI Tabs for Voice, Face, Body */}
        <Tabs.Root defaultValue="voice" className="flex flex-col gap-8">
          <Tabs.List className="flex shrink-0 gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Tabs.Trigger
              value="voice"
              className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
            >
              <Mic className="h-4 w-4" />
              Standard Voice
            </Tabs.Trigger>
            <Tabs.Trigger
              value="singing"
              className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap"
            >
              <Music className="h-4 w-4" />
              Singing Voice
            </Tabs.Trigger>
            <Tabs.Trigger
              value="face"
              className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap opacity-60 hover:opacity-100"
            >
              <UserIcon className="h-4 w-4" />
              Visual Avatar
            </Tabs.Trigger>
            <Tabs.Trigger
              value="body"
              className="flex items-center gap-2 px-6 h-[40px] rounded-full text-sm font-medium text-[var(--paper-dim)] bg-transparent border border-transparent transition-all hover:bg-[var(--ink-2)] data-[state=active]:bg-[var(--ink-2)] data-[state=active]:text-white data-[state=active]:border-[var(--ink-3)] outline-none whitespace-nowrap opacity-60 hover:opacity-100"
            >
              <Activity className="h-4 w-4" />
              Full Body
            </Tabs.Trigger>
          </Tabs.List>

          {/* VOICE TAB */}
          <Tabs.Content value="voice" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--moss)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
                <div className="space-y-4 max-w-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--moss)]/15 text-[var(--moss)] border border-[var(--moss)]/30">
                      <Mic className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[var(--moss)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--moss)] border border-[var(--moss)]/30">
                      Model Ready
                    </span>
                  </div>
                  <h3 className="font-serif text-3xl text-white">Standard Reading Voice</h3>
                  <p className="text-lg text-[var(--paper-dim)] leading-relaxed">
                    This is the foundational voice clone used for reading bedtime stories, daily narrations, and custom text. It requires only 30 seconds of audio to maintain a high-quality likeness.
                  </p>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <TestVoiceButton voiceId={voice.id} />
                  <div className="w-full">
                    <DeleteCloneButton voiceId={voice.id} />
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* SINGING TAB */}
          <Tabs.Content value="singing" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="rounded-2xl border border-[var(--lamp)]/20 bg-gradient-to-r from-[var(--lamp)]/10 to-transparent p-6 flex gap-4 items-start">
                <div className="rounded-full bg-[var(--lamp)]/20 p-2 text-[var(--lamp)] shrink-0">
                  <Music className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--paper)] mb-1">
                    Advanced Voice-to-Voice (V2V) Model
                  </h3>
                  <p className="text-sm text-[var(--paper-dim)] leading-relaxed">
                    Standard cloning is excellent for reading, but true singing requires perfectly capturing pitch, vibrato, and melody. To create a Singing Voice, we use an advanced V2V model that requires <strong>5 to 10 minutes</strong> of clean audio.
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[var(--lamp)]/10 to-transparent blur-3xl rounded-full pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-8">
                  <div className="space-y-4 max-w-xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink-2)] text-white border border-[var(--ink-3)]">
                        <Music className="h-5 w-5" />
                      </div>
                      {voice.rvc_training_status === 'ready' ? (
                        <span className="rounded-full bg-[var(--moss)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--moss)] border border-[var(--moss)]/30">
                          Model Ready
                        </span>
                      ) : voice.rvc_training_status === 'processing' ? (
                        <span className="rounded-full bg-[var(--lamp)]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--lamp)] border border-[var(--lamp)]/30">
                          Training...
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--ink-2)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[var(--paper-dim)] border border-[var(--ink-3)]">
                          Not Trained
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-3xl text-white">Singing Model</h3>
                    <p className="text-lg text-[var(--paper-dim)] leading-relaxed">
                      Train this model to allow this family member to sing along to lullabies, nursery rhymes, and customized family songs.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[200px] justify-center pt-2">
                    {!voice.rvc_training_status && (
                      <TrainSingingButton voiceId={voice.id} initialStatus={voice.rvc_training_status} trainingId={voice.rvc_model_id} />
                    )}
                    {voice.rvc_training_status === 'processing' && (
                      <TrainSingingButton voiceId={voice.id} initialStatus={voice.rvc_training_status} trainingId={voice.rvc_model_id} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* FACE TAB */}
          <Tabs.Content value="face" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--ink-2)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-[var(--ink-2)] border border-[var(--ink-3)] flex items-center justify-center mb-6 text-[var(--paper-dim)]">
                  <UserIcon className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl text-white mb-4">
                  Visual Avatar <span className="ml-3 inline-block align-middle text-[0.65rem] font-black uppercase tracking-widest bg-[var(--ink-3)] text-[var(--paper-dim)] px-2 py-1 rounded-full">Coming Soon</span>
                </h3>
                <p className="text-[var(--paper-dim)] text-lg">
                  We are working hard to bring you the ability to clone your face for an even more immersive educational experience for your kids. Stay tuned!
                </p>
              </div>
            </div>
          </Tabs.Content>

          {/* BODY TAB */}
          <Tabs.Content value="body" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-[2rem] border border-[var(--ink-3)] bg-[var(--ink-1)] p-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--ink-2)] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-full bg-[var(--ink-2)] border border-[var(--ink-3)] flex items-center justify-center mb-6 text-[var(--paper-dim)]">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl text-white mb-4">
                  Full Body <span className="ml-3 inline-block align-middle text-[0.65rem] font-black uppercase tracking-widest bg-[var(--ink-3)] text-[var(--paper-dim)] px-2 py-1 rounded-full">Coming Soon</span>
                </h3>
                <p className="text-[var(--paper-dim)] text-lg">
                  In the future, you&apos;ll be able to create full-body avatars that can move, dance, and interact in our educational videos.
                </p>
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </main>
  );
}
