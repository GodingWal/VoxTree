"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TemplateVideo {
  id: string;
  title: string;
  description: string;
  duration: number | null;
  metadata?: { pipelineStatus?: string };
}

export default function CreatePage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedProvidedVideo, setSelectedProvidedVideo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Data
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([]);
  const [providedVideos, setProvidedVideos] = useState<TemplateVideo[]>([]);

  /* ── initial load ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase.from("users").select("plan, role").eq("id", user.id).single();
      setPlan(profile?.plan ?? "free");
      const admin = profile?.role === "admin";
      setIsAdmin(admin);

      // Fetch families
      try {
        const res = await fetch("/api/families");
        if (res.ok) setFamilies(await res.json());
      } catch { }

      // Fetch template videos for non-admin
      if (!admin) {
        try {
          const res = await fetch("/api/template-videos");
          if (res.ok) setProvidedVideos(await res.json());
        } catch { }
      }

      setLoading(false);
    }
    load();
  }, []);

  const renderPipelineBadge = (video: TemplateVideo) => {
    const status = video.metadata?.pipelineStatus ?? "queued";
    switch (status) {
      case "completed": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ready</Badge>;
      case "processing":
      case "queued": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Processing</Badge>;
      case "error": return <Badge variant="destructive">Needs attention</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleVideoSelect = (video: TemplateVideo) => {
    setSelectedProvidedVideo(String(video.id));
    // Auto-fill title from the video if title is empty
    if (!title.trim()) setTitle(video.title);
    const status = video.metadata?.pipelineStatus ?? "queued";
    if (status !== "completed") {
      toast({ title: "Transcript still processing", description: "We will continue transcription during project processing." });
    }
  };

  /* ── submit ── */
  const onSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title for your video.", variant: "destructive" });
      return;
    }
    if (!isAdmin && !selectedProvidedVideo) {
      toast({ title: "Video selection required", description: "Please select a video to create your project.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      if (isAdmin) {
        const formData = new FormData();
        formData.append("title", title);
        if (familyId) formData.append("familyId", familyId);
        if (videoFile) formData.append("video", videoFile);
        const res = await fetch("/api/admin/videos", { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to create video"); }
        toast({ title: "Video created!", description: "Your video has been created successfully." });
      } else {
        const template = providedVideos.find(v => String(v.id) === String(selectedProvidedVideo));
        if (!template) throw new Error("Please select a video template.");
        const res = await fetch("/api/video-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateVideoId: template.id, status: "pending" }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to create project"); }
        const result = await res.json();
        if (result?.id) router.push(`/projects/${result.id}/setup`);
        toast({ title: "Video created!", description: "Your video has been created successfully." });
      }
      setTitle("");
      setFamilyId("");
      setVideoFile(null);
      setSelectedProvidedVideo(null);
    } catch (err: unknown) {
      toast({ title: "Creation failed", description: err instanceof Error ? err.message : "Failed to create video", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const selectedVideo = providedVideos.find(v => String(v.id) === String(selectedProvidedVideo));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 text-foreground">
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              🎬 Create Video
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Create New Video</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose a video from our library and personalize it for your family
            </p>
          </div>

          {/* ── Admin Upload Flow ── */}
          {isAdmin ? (
            <div className="space-y-6">
              <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Admin: Upload New Video</CardTitle>
                  <CardDescription>Upload a video file to add to the content library</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Video Title</Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter a title for your video" />
                  </div>

                  <div>
                    <Label htmlFor="familyId">Family (Optional)</Label>
                    <Select value={familyId} onValueChange={setFamilyId}>
                      <SelectTrigger><SelectValue placeholder="Select a family" /></SelectTrigger>
                      <SelectContent>
                        {families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="videoFile">Upload Video File</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mt-1">
                      <input type="file" id="videoFile" accept="video/*" onChange={e => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }} className="hidden" />
                      <label htmlFor="videoFile" className="cursor-pointer">
                        <span className="text-4xl block mb-4">☁️</span>
                        <p className="text-muted-foreground mb-2">{videoFile ? videoFile.name : "Click to upload video file"}</p>
                        <p className="text-sm text-muted-foreground">Supports MP4, MOV, AVI (Max 50MB)</p>
                      </label>
                    </div>
                  </div>

                  {videoFile && (
                    <div className="bg-secondary/20 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{videoFile.name}</p>
                          <p className="text-sm text-muted-foreground">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setVideoFile(null)}>✕</Button>
                      </div>
                    </div>
                  )}

                  <Button onClick={onSubmit} className="w-full" size="lg" disabled={creating || !title.trim()}>
                    {creating ? "Creating..." : "🎬 Create Video"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ── User Video Selection Flow ── */
            <div className="space-y-6">

              {/* Step 1: Select a video */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
                  Choose a Video
                </h2>
                <div className="grid gap-3">
                  {providedVideos.length > 0 ? (
                    providedVideos.map(video => {
                      const isSelected = String(selectedProvidedVideo) === String(video.id);
                      return (
                        <Card
                          key={video.id}
                          className={cn(
                            "cursor-pointer transition-all",
                            isSelected
                              ? "ring-2 ring-primary bg-primary/5 shadow-lg"
                              : "hover:bg-secondary/20 hover:shadow-md"
                          )}
                          onClick={() => handleVideoSelect(video)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                isSelected ? "bg-primary/20" : "bg-secondary"
                              )}>
                                <span className="text-2xl">🎬</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-semibold truncate">{video.title}</h4>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {renderPipelineBadge(video)}
                                    {isSelected && (
                                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                        <span className="text-white text-xs">✓</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{video.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Duration: {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, "0")}` : "Unknown"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center">
                        <span className="text-4xl block mb-4">🎬</span>
                        <p className="font-medium text-foreground">No videos available yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Check back soon — new content is being added regularly</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Step 2: Name your video */}
              {selectedProvidedVideo && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
                    Name Your Video
                  </h2>
                  <Card className="border-0 shadow-xl bg-card/50 backdrop-blur">
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <Label htmlFor="title">Video Title</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder="Give your video a name"
                          className="mt-1"
                        />
                      </div>

                      {families.length > 0 && (
                        <div>
                          <Label htmlFor="familyId">Family (Optional)</Label>
                          <Select value={familyId} onValueChange={setFamilyId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select a family" /></SelectTrigger>
                            <SelectContent>
                              {families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Selected video summary */}
                      {selectedVideo && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                          <span className="text-lg">🎬</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{selectedVideo.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedVideo.duration ? `${Math.floor(selectedVideo.duration / 60)}:${(selectedVideo.duration % 60).toString().padStart(2, "0")}` : "Video selected"}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedProvidedVideo(null)} className="text-muted-foreground">
                            Change
                          </Button>
                        </div>
                      )}

                      <Button onClick={onSubmit} className="w-full" size="lg" disabled={creating || !title.trim()}>
                        {creating ? "Creating Video..." : "🎬 Create Video"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
