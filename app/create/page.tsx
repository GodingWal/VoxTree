"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  familyId: z.string().optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

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
  const [activeTab, setActiveTab] = useState("details");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedProvidedVideo, setSelectedProvidedVideo] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Data
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([]);
  const [providedVideos, setProvidedVideos] = useState<TemplateVideo[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const form = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    defaultValues: { title: "", description: "", familyId: "" },
  });

  const watchFamilyId = form.watch("familyId");

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
      } catch {}

      // Fetch template videos for non-admin
      if (!admin) {
        try {
          const res = await fetch("/api/template-videos");
          if (res.ok) setProvidedVideos(await res.json());
        } catch {}
      }

      setLoading(false);
    }
    load();
  }, []);

  /* ── fetch suggestions when family changes ── */
  useEffect(() => {
    if (!watchFamilyId) { setSuggestions([]); return; }
    setSuggestionsLoading(true);
    fetch(`/api/videos/suggestions?familyId=${encodeURIComponent(watchFamilyId)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSuggestions(Array.isArray(data) ? data : []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [watchFamilyId]);

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
    const status = video.metadata?.pipelineStatus ?? "queued";
    if (status !== "completed") {
      toast({ title: "Transcript still processing", description: "We will continue transcription during project processing." });
    }
  };

  /* ── submit ── */
  const onSubmit = async (data: VideoFormData) => {
    if (!isAdmin && !selectedProvidedVideo) {
      toast({ title: "Video selection required", description: "Please select a video to create your project.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      if (isAdmin) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => { if (value) formData.append(key, value); });
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
          body: JSON.stringify({
            templateVideoId: template.id,
            status: "pending",
            metadata: data.description ? { description: data.description } : undefined,
          }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to create project"); }
        const result = await res.json();
        if (result?.id) router.push(`/projects/${result.id}/setup`);
        toast({ title: "Video created!", description: "Your video has been created successfully." });
      }
      form.reset();
      setVideoFile(null);
      setSelectedProvidedVideo(null);
    } catch (err: unknown) {
      toast({ title: "Creation failed", description: err instanceof Error ? err.message : "Failed to create video", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  /* ── AI tools ── */
  const generateScript = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Prompt required", description: "Enter a prompt for AI script generation.", variant: "destructive" });
      return;
    }
    setGeneratingScript(true);
    try {
      const res = await fetch("/api/ai/video-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, familyId: watchFamilyId }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setGeneratedScript(data.script);
      form.setValue("description", data.script);
      toast({ title: "Script generated!", description: "AI has generated a script for your video." });
    } catch {
      toast({ title: "Generation failed", description: "Failed to generate script.", variant: "destructive" });
    } finally {
      setGeneratingScript(false);
    }
  };

  const enhanceDescription = async () => {
    const desc = form.watch("description");
    if (!desc?.trim()) {
      toast({ title: "Description required", description: "Enter a description to enhance.", variant: "destructive" });
      return;
    }
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      if (!res.ok) throw new Error("Enhancement failed");
      const data = await res.json();
      form.setValue("description", data.enhanced);
      toast({ title: "Description enhanced!", description: "AI has improved your video description." });
    } catch {
      toast({ title: "Enhancement failed", description: "Failed to enhance description.", variant: "destructive" });
    } finally {
      setEnhancing(false);
    }
  };

  const applySuggestion = (suggestion: string) => {
    form.setValue("title", suggestion);
    setAiPrompt(suggestion);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav plan={plan} />

      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Create New Video</h1>
            <p className="text-muted-foreground">Bring your family memories to life with AI-powered tools</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* AI Suggestions Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">💡 AI Suggestions</CardTitle>
                  <CardDescription>Creative ideas for your family video</CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestionsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
                    </div>
                  ) : suggestions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => applySuggestion(suggestion)}
                          className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors text-sm"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a family to see personalized suggestions</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Creation Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Video Details</CardTitle>
                  <CardDescription>Set up your video project</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="ai">AI Tools</TabsTrigger>
                      <TabsTrigger value={isAdmin ? "upload" : "select"}>
                        {isAdmin ? "Upload" : "Select Video"}
                      </TabsTrigger>
                    </TabsList>

                    {/* Details Tab */}
                    <TabsContent value="details" className="space-y-4">
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                          <Label htmlFor="title">Video Title</Label>
                          <Input id="title" {...form.register("title")} placeholder="My Amazing Family Adventure" />
                          {form.formState.errors.title && (
                            <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="familyId">Family</Label>
                          <Select value={watchFamilyId} onValueChange={v => form.setValue("familyId", v)}>
                            <SelectTrigger><SelectValue placeholder="Select a family" /></SelectTrigger>
                            <SelectContent>
                              {families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center">
                            <Label htmlFor="description">Description / Script</Label>
                            <Button type="button" variant="outline" size="sm" onClick={enhanceDescription} disabled={enhancing}>
                              {enhancing ? "Enhancing..." : "✨ Enhance with AI"}
                            </Button>
                          </div>
                          <Textarea
                            id="description"
                            {...form.register("description")}
                            placeholder="Describe your video or paste an AI-generated script..."
                            className="min-h-[120px]"
                          />
                        </div>

                        <Button type="submit" className="w-full" disabled={creating}>
                          {creating ? "Creating Video..." : "🎬 Create Video"}
                        </Button>
                      </form>
                    </TabsContent>

                    {/* AI Tools Tab */}
                    <TabsContent value="ai" className="space-y-4">
                      <div>
                        <Label htmlFor="aiPrompt">AI Script Generator</Label>
                        <Textarea
                          id="aiPrompt"
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                          placeholder="Describe the video you want to create... e.g., 'A heartwarming story about our summer vacation'"
                          className="min-h-[100px]"
                        />
                        <Button onClick={generateScript} disabled={generatingScript} className="w-full mt-2">
                          {generatingScript ? "Generating Script..." : "🤖 Generate Script with AI"}
                        </Button>
                      </div>

                      {generatedScript && (
                        <div className="bg-secondary/20 rounded-lg p-4">
                          <h4 className="font-semibold mb-2">Generated Script:</h4>
                          <p className="text-sm whitespace-pre-wrap">{generatedScript}</p>
                        </div>
                      )}
                    </TabsContent>

                    {/* Upload (admin) / Select (user) Tab */}
                    {isAdmin ? (
                      <TabsContent value="upload" className="space-y-4">
                        <div>
                          <Label htmlFor="videoFile">Upload Video File (Required for Admin)</Label>
                          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
                      </TabsContent>
                    ) : (
                      <TabsContent value="select" className="space-y-4">
                        <div>
                          <Label>Select Video to Create Project</Label>
                          <div className="grid gap-4 mt-2">
                            {providedVideos.length > 0 ? (
                              providedVideos.map(video => {
                                const isSelected = String(selectedProvidedVideo) === String(video.id);
                                return (
                                  <Card
                                    key={video.id}
                                    className={cn(
                                      "cursor-pointer transition-colors",
                                      isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-secondary/20"
                                    )}
                                    onClick={() => handleVideoSelect(video)}
                                  >
                                    <CardContent className="p-4 space-y-2">
                                      <div className="flex items-center space-x-4">
                                        <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center">
                                          <span className="text-2xl">🎬</span>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-semibold">{video.title}</h4>
                                            {renderPipelineBadge(video)}
                                          </div>
                                          <p className="text-sm text-muted-foreground line-clamp-2">{video.description}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Duration: {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, "0")}` : "Unknown"}
                                          </p>
                                        </div>
                                        {isSelected && <span className="text-primary text-xl">✓</span>}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <span className="text-4xl block mb-4">🎬</span>
                                <p>No videos available for selection</p>
                                <p className="text-sm">Contact an administrator to add videos</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
