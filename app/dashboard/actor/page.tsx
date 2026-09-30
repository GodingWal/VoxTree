"use client";
import { useEffect, useState } from "react";
import { CONSENT_VERSION } from "@/packages/digital-actor-schema";

type Actor = { id: string; version: number; status: string };
export default function ActorPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [height, setHeight] = useState(170);
  const [consent, setConsent] = useState(false);
  const [retain, setRetain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let active = true;
    fetch("/api/actors").then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) setActors(result.actors); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function enroll() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/actors", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heightCm: height, consent: { version: CONSENT_VERSION, adult: true, selfCapture: true,
          permittedUses: ["preview", "personalized_films"], retainOriginals: retain } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActors(previous => [result.actor, ...previous]);
    } catch (e) { setError(e instanceof Error ? e.message : "Enrollment failed"); }
    finally { setBusy(false); }
  }
  return <main className="container max-w-3xl py-10 space-y-6">
    <h1 className="text-3xl font-bold">Create Your VoxTree Actor</h1>
    <ol className="flex flex-wrap gap-4" aria-label="Enrollment stages">{["Face", "Body", "Voice", "Build Actor", "Preview"].map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol>
    <p>Your actor keeps your identity separate from movie costumes and performances.</p>
    <section className="rounded-xl border p-6 space-y-4">
      <h2 className="text-xl font-semibold">Start enrollment</h2>
      <label className="block">Height in centimeters <input className="border rounded p-2 ml-2" type="number" min={100} max={250} value={height} onChange={e => setHeight(Number(e.target.value))} /></label>
      <label className="flex gap-3"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I am 18 or older, will capture myself, and consent to processing my face, body, and voice to create previews and personalized films.</label>
      <label className="flex gap-3"><input type="checkbox" checked={retain} onChange={e => setRetain(e.target.checked)} />Keep original captures for future rebuilding.</label>
      <button className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50" disabled={!consent || busy || height < 100 || height > 250} onClick={enroll}>{busy ? "Saving…" : "Create actor identity"}</button>
      <p className="text-sm text-muted-foreground">Capture and avatar generation will become available when reconstruction providers are configured. Enrollment currently creates your consented identity record.</p>
    </section>
    {error && <p role="alert">{error}</p>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Your VoxTree actors</h2>
      {actors.map(actor => <article className="border rounded-xl p-4" key={actor.id}><p>Actor version {actor.version}</p><p>Status: {actor.status.replaceAll("_", " ")}</p></article>)}
    </section>
  </main>;
}
