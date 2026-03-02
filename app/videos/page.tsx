"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Clip {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  output_video_url: string | null;
  content_library: { title: string; thumbnail_url: string | null; duration_seconds: number | null } | null;
  family_voices: { name: string } | null;
}

export default function VideoLibraryPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("users").select("plan").eq("id", user.id).single();
      setPlan(profile?.plan ?? "free");
      const { data } = await supabase
        .from("generated_clips")
        .select("*, content_library(title, thumbnail_url, duration_seconds), family_voices(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setClips((data ?? []) as unknown as Clip[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    const { error } = await supabase.from("generated_clips").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setClips((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Video deleted" });
    }
  };

  const filtered = clips.filter((clip) => {
    const matchesSearch = !searchTerm || clip.content_library?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || clip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusCount = (status: string) => status === "all" ? clips.length : clips.filter((c) => c.status === status).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav plan={plan} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Video Library</h1>
            <p className="text-muted-foreground">Manage and organize your family videos</p>
          </div>
          <Link href="/create"><Button>New Video</Button></Link>
        </div>

        <Card className="mb-8">
          <CardHeader><CardTitle className="text-base">Filters & Search</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Search videos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Videos", count: getStatusCount("all"), icon: "🎬", color: "bg-primary/20" },
            { label: "Ready", count: getStatusCount("ready"), icon: "✅", color: "bg-green-500/20" },
            { label: "Processing", count: getStatusCount("processing"), icon: "⏳", color: "bg-yellow-500/20" },
            { label: "Queued", count: getStatusCount("queued"), icon: "📋", color: "bg-secondary/20" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className={`${stat.color} w-12 h-12 rounded-full flex items-center justify-center`}><span className="text-xl">{stat.icon}</span></div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{stat.count}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="grid" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
            <span className="text-sm text-muted-foreground">{filtered.length} of {clips.length} videos</span>
          </div>

          <TabsContent value="grid">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl h-64 animate-pulse" />)}</div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((clip) => (
                  <Card key={clip.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {clip.content_library?.thumbnail_url ? <img src={clip.content_library.thumbnail_url} alt={clip.content_library?.title} className="w-full h-full object-cover" /> : <span className="text-3xl text-muted-foreground">🎬</span>}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1 truncate">{clip.content_library?.title ?? "Untitled"}</h3>
                      <p className="text-xs text-muted-foreground mb-2">Voice: {clip.family_voices?.name ?? "Unknown"}</p>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clip.status === "ready" ? "bg-green-100 text-green-700" : clip.status === "processing" ? "bg-yellow-100 text-yellow-700" : clip.status === "queued" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{clip.status}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(clip.id)} className="text-destructive hover:text-destructive">Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl block mb-4">🔍</span>
                <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                <p className="text-muted-foreground mb-4">{searchTerm || statusFilter !== "all" ? "Try adjusting your filters" : "Start creating your first family video"}</p>
                {!searchTerm && statusFilter === "all" && <Link href="/create"><Button>Create Your First Video</Button></Link>}
              </div>
            )}
          </TabsContent>

          <TabsContent value="list">
            {loading ? (
              <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="bg-card rounded-xl h-20 animate-pulse" />)}</div>
            ) : filtered.length > 0 ? (
              <div className="space-y-4">
                {filtered.map((clip) => (
                  <Card key={clip.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {clip.content_library?.thumbnail_url ? <img src={clip.content_library.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🎬</span>}
                          </div>
                          <div>
                            <h3 className="font-semibold">{clip.content_library?.title ?? "Untitled"}</h3>
                            <p className="text-xs text-muted-foreground">Voice: {clip.family_voices?.name ?? "Unknown"} &middot; {new Date(clip.updated_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clip.status === "ready" ? "bg-green-100 text-green-700" : clip.status === "processing" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{clip.status}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(clip.id)} className="text-destructive">Delete</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl block mb-4">🔍</span>
                <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                <p className="text-muted-foreground">Try adjusting your filters</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
