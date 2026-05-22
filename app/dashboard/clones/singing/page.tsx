import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Mic2, Music, UploadCloud, AlertCircle } from "lucide-react";

export default async function SingingClonesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch voices to show their singing model status
  const { data: voices } = await supabase
    .from("family_voices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-brand-charcoal dark:text-foreground">
          Singing Voices
        </h1>
        <p className="text-muted-foreground mt-1">
          Train an advanced voice model capable of singing lullabies and educational songs.
        </p>
      </div>

      <div className="rounded-xl border border-brand-gold/50 bg-brand-gold/5 p-6">
        <div className="flex gap-4 items-start">
          <div className="rounded-full bg-brand-gold/20 p-2 text-brand-gold mt-1">
            <Music className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-brand-charcoal dark:text-foreground">
              Why do singing voices require a separate model?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Standard voice cloning is excellent for reading stories, but true singing requires perfectly capturing pitch, vibrato, and melody. To create a Singing Voice, we use an advanced V2V (Voice-to-Voice) model that requires <strong>5 to 10 minutes</strong> of clean audio, compared to the 30 seconds needed for standard reading.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {voices?.map((voice) => (
          <div key={voice.id} className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                <Mic2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{voice.name}</h3>
                <p className="text-xs text-muted-foreground">Reading Model: {voice.status === 'ready' ? 'Active' : 'Pending'}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Singing Model</span>
                {voice.rvc_training_status === 'ready' ? (
                  <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-semibold text-brand-green">
                    Ready
                  </span>
                ) : voice.rvc_training_status === 'processing' ? (
                  <span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-xs font-semibold text-brand-gold">
                    Training...
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    Not Trained
                  </span>
                )}
              </div>

              {!voice.rvc_training_status && (
                <button className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-brand-sage/50 px-4 py-3 text-sm font-medium text-brand-green hover:bg-brand-green/5 transition-colors">
                  <UploadCloud className="h-4 w-4" />
                  Upload 5+ Min Audio
                </button>
              )}
              {voice.rvc_training_status === 'processing' && (
                <div className="flex items-center gap-2 text-xs text-brand-gold bg-brand-gold/5 p-2 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Training takes ~30 minutes
                </div>
              )}
            </div>
          </div>
        ))}

        {(!voices || voices.length === 0) && (
          <div className="col-span-full rounded-xl border border-dashed p-12 text-center flex flex-col items-center">
            <Mic2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No voices created yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create a standard voice clone first before training a singing model.</p>
          </div>
        )}
      </div>
    </div>
  );
}
