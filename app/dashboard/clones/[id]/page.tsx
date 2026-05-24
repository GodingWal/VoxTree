import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Mic, User as UserIcon, Activity, AlertTriangle, Music, ArrowLeft } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";

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

  return (
    <main className="container py-8 space-y-8 max-w-5xl mx-auto text-white">
      <Link href="/dashboard/clones" className="inline-flex items-center gap-2 text-sm text-[var(--paper-dim)] hover:text-white transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Voice Tree
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-[var(--paper)]">
            {voice.name}
          </h1>
          <p className="text-[var(--paper-dim)] mt-1">
            Manage models for this family member.
          </p>
        </div>
      </div>

      <div style={{ background: "var(--ink-1)", borderRadius: 28, padding: 32, border: "1px solid var(--ink-3)" }}>
        {/* Radix UI Tabs for Voice, Face, Body */}
        <Tabs.Root defaultValue="voice" className="flex flex-col">
          <Tabs.List className="flex shrink-0 border-b border-[var(--ink-3)]">
            <Tabs.Trigger
              value="voice"
              className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-[var(--paper-dim)] transition-colors hover:text-white data-[state=active]:text-[var(--moss)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--moss)] outline-none"
            >
              <Mic className="h-4 w-4" />
              Voice
            </Tabs.Trigger>
            <Tabs.Trigger
              value="singing"
              className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-[var(--paper-dim)] transition-colors hover:text-white data-[state=active]:text-[var(--moss)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--moss)] outline-none"
            >
              <Music className="h-4 w-4" />
              Singing
            </Tabs.Trigger>
            <Tabs.Trigger
              value="face"
              className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-[var(--paper-dim)] transition-colors hover:text-white data-[state=active]:text-[var(--moss)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--moss)] outline-none"
            >
              <UserIcon className="h-4 w-4" />
              Face
            </Tabs.Trigger>
            <Tabs.Trigger
              value="body"
              className="flex items-center gap-2 px-5 h-[45px] select-none text-sm font-medium text-[var(--paper-dim)] transition-colors hover:text-white data-[state=active]:text-[var(--moss)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--moss)] outline-none"
            >
              <Activity className="h-4 w-4" />
              Body
            </Tabs.Trigger>
          </Tabs.List>

          {/* VOICE TAB */}
          <Tabs.Content value="voice" className="py-6 outline-none">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--ink-3)] bg-[var(--ink-2)] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--moss)]/10 text-[var(--moss)]">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">Standard Reading Voice</h3>
                    <p className="text-sm text-[var(--paper-dim)]">Used for narrating stories.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--ink-3)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Model Status</span>
                    <span className="rounded-full bg-[var(--moss)]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--moss)] border border-[var(--moss)]/20">
                      Ready
                    </span>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button className="px-4 py-2 text-sm font-medium border border-[var(--ink-3)] rounded-full hover:bg-[var(--ink-3)] text-[var(--paper-dim)] transition-colors">Delete</button>
                    <button className="px-4 py-2 text-sm font-medium bg-[var(--moss)] text-[var(--ink-0)] rounded-full hover:bg-[var(--moss)]/90 transition-colors">Test Voice</button>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* SINGING TAB */}
          <Tabs.Content value="singing" className="py-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--lamp)]/30 bg-[var(--lamp)]/5 p-6">
                <div className="flex gap-4 items-start">
                  <div className="rounded-full bg-[var(--lamp)]/20 p-2 text-[var(--lamp)] mt-1">
                    <Music className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-[var(--paper)]">
                      Why do singing voices require a separate model?
                    </h3>
                    <p className="text-sm text-[var(--paper-dim)] leading-relaxed max-w-3xl">
                      Standard voice cloning is excellent for reading stories, but true singing requires perfectly capturing pitch, vibrato, and melody. To create a Singing Voice, we use an advanced V2V (Voice-to-Voice) model that requires <strong>5 to 10 minutes</strong> of clean audio, compared to the 30 seconds needed for standard reading.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ink-3)] bg-[var(--ink-2)] p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--moss)]/10 text-[var(--moss)]">
                    <Music className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Singing Model</h3>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--ink-3)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Model Status</span>
                    {voice.rvc_training_status === 'ready' ? (
                      <span className="rounded-full bg-[var(--moss)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--moss)]">
                        Ready
                      </span>
                    ) : voice.rvc_training_status === 'processing' ? (
                      <span className="rounded-full bg-[var(--lamp)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--lamp)]">
                        Training...
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--ink-3)] px-2 py-0.5 text-xs font-semibold text-[var(--paper-dim)]">
                        Not Trained
                      </span>
                    )}
                  </div>

                  {!voice.rvc_training_status && (
                    <Link href="/dashboard/clones/singing" className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--lamp)]/50 px-4 py-3 text-sm font-medium text-[var(--lamp)] hover:bg-[var(--lamp)]/5 transition-colors">
                      <Plus className="h-4 w-4" />
                      Train Model
                    </Link>
                  )}
                  {voice.rvc_training_status === 'processing' && (
                    <div className="flex items-center gap-2 text-xs text-[var(--lamp)] bg-[var(--lamp)]/5 p-2 rounded-md border border-[var(--lamp)]/20 mt-4">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Training takes ~30 minutes
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* FACE TAB */}
          <Tabs.Content value="face" className="py-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative overflow-hidden rounded-xl border border-[var(--ink-3)] bg-[var(--ink-2)] p-12 text-center shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--moss)]/10 via-[var(--ink-2)] to-[var(--lamp)]/5 animate-pulse" style={{ animationDuration: '3s' }} />
              
              <div className="relative z-10">
                <div className="mx-auto w-20 h-20 rounded-full bg-[var(--ink-1)] shadow-md flex items-center justify-center mb-6">
                  <UserIcon className="h-10 w-10 text-[var(--moss)]" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Face Cloning <span className="text-[var(--moss)] text-sm align-super font-black uppercase tracking-widest bg-[var(--moss)]/10 px-2 py-0.5 rounded-full ml-2">Coming Soon</span>
                </h2>
                <p className="text-[var(--paper-dim)] max-w-lg mx-auto text-lg">
                  We are working hard to bring you the ability to clone your face for an even more immersive educational experience for your kids. Stay tuned!
                </p>
              </div>
            </div>
          </Tabs.Content>

          {/* BODY TAB */}
          <Tabs.Content value="body" className="py-6 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative overflow-hidden rounded-xl border border-[var(--ink-3)] bg-[var(--ink-2)] p-12 text-center shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--rose)]/10 via-[var(--ink-2)] to-[var(--lamp)]/5 animate-pulse" style={{ animationDuration: '4s' }} />
              
              <div className="relative z-10">
                <div className="mx-auto w-20 h-20 rounded-full bg-[var(--ink-1)] shadow-md flex items-center justify-center mb-6">
                  <Activity className="h-10 w-10 text-[var(--rose)]" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Body Cloning <span className="text-[var(--rose)] text-sm align-super font-black uppercase tracking-widest bg-[var(--rose)]/10 px-2 py-0.5 rounded-full ml-2">Coming Soon</span>
                </h2>
                <p className="text-[var(--paper-dim)] max-w-lg mx-auto text-lg">
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
