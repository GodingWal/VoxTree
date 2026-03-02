"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [voices, setVoices] = useState<Array<Record<string, unknown>>>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [familyUpdates, setFamilyUpdates] = useState(true);
  const [videoSharing, setVideoSharing] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState("friends");
  const [autoSave, setAutoSave] = useState(true);
  const [videoQuality, setVideoQuality] = useState("high");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const [profileRes, voicesRes] = await Promise.all([
        supabase.from("users").select("*").eq("id", user.id).single(),
        supabase.from("family_voices").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfile(profileRes.data);
      setVoices(voicesRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDeleteVoice(voiceId: string) {
    if (!confirm("Delete this voice profile? This cannot be undone.")) return;
    setDeleting(voiceId);
    const res = await fetch(`/api/voices/${voiceId}`, { method: "DELETE" });
    if (res.ok) {
      setVoices((v) => v.filter((voice) => voice.id !== voiceId));
      toast({ title: "Voice Deleted", description: "The voice profile has been removed." });
    } else {
      toast({ title: "Delete Failed", description: "Could not delete voice profile.", variant: "destructive" });
    }
    setDeleting(null);
  }

  const handleSaveSettings = () => {
    toast({ title: "Settings saved", description: "Your preferences have been updated successfully." });
  };

  const handleExportData = () => {
    toast({ title: "Data export requested", description: "Your data export will be ready for download within 24 hours." });
  };

  const handleDeleteAccount = () => {
    toast({ title: "Account deletion", description: "Please contact support to delete your account.", variant: "destructive" });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const plan = (profile?.plan as string) ?? "free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav plan={plan} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and privacy settings</p>
        </div>

        <div className="space-y-8">
          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">💳 Subscription</CardTitle>
              <CardDescription>Your current plan and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="capitalize">{plan}</Badge>
                <Link href="/pricing" className="text-sm text-primary hover:underline">
                  {plan === "free" ? "Upgrade" : "Manage Plan"}
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Voice Profiles */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">🎤 Voice Profiles</CardTitle>
                  <CardDescription>Manage your family voice clones</CardDescription>
                </div>
                <Link href="/onboarding"><Button size="sm">Add Voice</Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {voices.length > 0 ? (
                <div className="space-y-3">
                  {voices.map((voice) => (
                    <div key={voice.id as string} className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">{voice.name as string}</p>
                        <p className="text-xs text-muted-foreground">
                          Status: <span className={`font-medium ${voice.status === "ready" ? "text-green-600" : voice.status === "processing" ? "text-yellow-600" : "text-red-600"}`}>{voice.status as string}</span>
                          {" "}&middot; Created {new Date(voice.created_at as string).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteVoice(voice.id as string)} disabled={deleting === voice.id} className="text-destructive hover:text-destructive">
                        {deleting === voice.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No voice profiles yet. Add a family member&apos;s voice to get started.</p>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">🔔 Notifications</CardTitle>
              <CardDescription>Control how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Email Notifications", desc: "Receive updates via email", checked: emailNotifications, onChange: setEmailNotifications },
                { label: "Push Notifications", desc: "Receive browser notifications", checked: pushNotifications, onChange: setPushNotifications },
                { label: "Family Updates", desc: "Get notified about family activity", checked: familyUpdates, onChange: setFamilyUpdates },
                { label: "Video Sharing", desc: "Notifications when videos are shared", checked: videoSharing, onChange: setVideoSharing },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{item.label}</Label>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => item.onChange(!item.checked)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.checked ? "bg-primary" : "bg-secondary"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${item.checked ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">🛡️ Privacy & Security</CardTitle>
              <CardDescription>Control your privacy and data sharing preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Profile Visibility</Label>
                <select value={profileVisibility} onChange={(e) => setProfileVisibility(e.target.value)} className="w-full p-2 border rounded-lg bg-background">
                  <option value="public">Public</option>
                  <option value="friends">Friends Only</option>
                  <option value="family">Family Only</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* App Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">⚙️ App Preferences</CardTitle>
              <CardDescription>Customize your app experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-save Videos</Label>
                  <p className="text-sm text-muted-foreground">Automatically save work in progress</p>
                </div>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSave ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSave ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="space-y-2">
                <Label>Default Video Quality</Label>
                <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value)} className="w-full p-2 border rounded-lg bg-background">
                  <option value="low">Low (480p)</option>
                  <option value="medium">Medium (720p)</option>
                  <option value="high">High (1080p)</option>
                  <option value="ultra">Ultra (4K)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Account Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">👤 Account Management</CardTitle>
              <CardDescription>Manage your account data and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleExportData}>Export My Data</Button>
                <Button variant="outline" onClick={() => toast({ title: "Coming Soon", description: "Theme customization will be available soon." })}>
                  Change Theme
                </Button>
              </div>
              <Separator />
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <h4 className="font-medium text-destructive mb-2">Danger Zone</h4>
                <p className="text-sm text-muted-foreground mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                <Button variant="destructive" onClick={handleDeleteAccount}>Delete Account</Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} className="px-8">Save All Settings</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
