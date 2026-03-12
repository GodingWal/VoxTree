"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteVoiceButton } from "@/components/ui/DeleteVoiceButton";

interface Voice {
    id: string;
    name: string;
    status: string;
    [key: string]: any;
}

export function FamilyVoicesList({ initialVoices }: { initialVoices: Voice[] }) {
    const [voices, setVoices] = useState<Voice[]>(initialVoices);

    const handleDeleteSuccess = (id: string) => {
        setVoices((prev) => prev.filter((v) => v.id !== id));
    };

    if (voices.length === 0) {
        return (
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur mt-8">
                <CardContent className="p-6 sm:p-8">
                    <div className="text-center space-y-6">
                        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-lg shadow-primary/25">
                            <span className="text-4xl">🎙️</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Start Voice Recording Wizard</h2>
                            <p className="text-muted-foreground">
                                Our 8-phase wizard captures your natural voice, emotions, storytelling style, and conversational tone
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                            {[
                                { label: "8 Phases", desc: "Different speech styles" },
                                { label: "~2 Minutes", desc: "Total recording time" },
                                { label: "AI Enhanced", desc: "Quality processing" },
                                { label: "Emotions", desc: "Joy, sadness, surprise" },
                            ].map((f) => (
                                <div key={f.label} className="p-3 rounded-lg bg-muted/50 text-center">
                                    <p className="font-medium text-sm">{f.label}</p>
                                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 max-w-md mx-auto">
                            <Link href="/clone" className="w-full">
                                <Button className="w-full gap-2 text-lg h-12">
                                    Start Recording
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voices.map((voice) => (
                <div key={voice.id} className="rounded-lg border p-4 space-y-2 flex flex-col justify-between transition-all hover:shadow-md">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">{voice.name}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${voice.status === "ready" ? "bg-green-100 text-green-700" : voice.status === "processing" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {voice.status}
                        </span>
                    </div>
                    <div className="flex justify-end mt-2">
                        <DeleteVoiceButton voiceId={voice.id} voiceName={voice.name} onDeleteSuccess={handleDeleteSuccess} />
                    </div>
                </div>
            ))}
        </div>
    );
}
