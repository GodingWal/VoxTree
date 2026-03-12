"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setEmail(user.email ?? "");

        const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single();
        if (error) {
          console.error("Profile fetch error:", error);
          // Still show the page with defaults from auth user
          setProfile({ plan: "free", role: "user", created_at: new Date().toISOString(), voice_slots_used: 0, clips_used_this_month: 0, videos_used: 0, stories_used: 0 });
          setName(user.user_metadata?.name ?? user.email?.split("@")[0] ?? "");
        } else if (data) {
          setProfile(data);
          setName(data.name ?? "");
        } else {
          // No data and no error — set fallback
          setProfile({ plan: "free", role: "user", created_at: new Date().toISOString(), voice_slots_used: 0, clips_used_this_month: 0, videos_used: 0, stories_used: 0 });
        }
      } catch (err) {
        console.error("Profile load failed:", err);
        setProfile({ plan: "free", role: "user", created_at: new Date().toISOString(), voice_slots_used: 0, clips_used_this_month: 0, videos_used: 0, stories_used: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("users").update({ name }).eq("id", user.id);
    setSaving(false);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated", description: "Your profile has been saved successfully." });
      setIsEditing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getUserInitials = () => {
    if (!name) return "U";
    return name.split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();
  };

  if (loading || !profile) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const plan = (profile.plan as string) ?? "free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav plan={plan} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">My Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Overview */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold">{getUserInitials()}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{name || "User"}</h3>
                    <p className="text-muted-foreground text-sm">{email}</p>
                    <Badge variant="secondary" className="mt-2">
                      {(profile.role as string) === "admin" ? "Administrator" : "Member"}
                    </Badge>
                  </div>
                  {bio && <p className="text-sm text-center text-muted-foreground">{bio}</p>}
                  <div className="w-full space-y-2 text-sm">
                    {location && (
                      <div className="flex items-center justify-center text-muted-foreground">
                        <span>📍 {location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-center text-muted-foreground">
                      <span>📅 Member since {new Date(profile.created_at as string).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between"><span className="text-muted-foreground">Voice Profiles</span><span className="font-medium">{profile.voice_slots_used as number ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Clips This Month</span><span className="font-medium">{profile.clips_used_this_month as number ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Videos Used</span><span className="font-medium">{profile.videos_used as number ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stories Used</span><span className="font-medium">{profile.stories_used as number ?? 0}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </div>
                  <Button variant={isEditing ? "default" : "outline"} onClick={() => { if (isEditing) handleSave(); else setIsEditing(true); }} disabled={saving}>
                    {isEditing ? (saving ? "Saving..." : "Save") : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isEditing} />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} disabled />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" placeholder="Tell us about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} disabled={!isEditing} rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" placeholder="City, Country" value={location} onChange={(e) => setLocation(e.target.value)} disabled={!isEditing} />
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" type="url" placeholder="https://yourwebsite.com" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!isEditing} />
                  </div>
                </div>
                {isEditing && (
                  <div className="flex justify-end space-x-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Your current plan and usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className="capitalize">{plan}</Badge>
                  {plan !== "premium" && <Link href="/pricing" className="text-sm text-primary hover:underline">Upgrade Plan</Link>}
                </div>
              </CardContent>
            </Card>

            <div className="border-t pt-6 flex justify-between">
              <Button variant="outline" onClick={handleSignOut} className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                Sign Out
              </Button>
              <Link href="/settings"><Button variant="outline">Account Settings</Button></Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
