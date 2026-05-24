"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { addContent, deleteContent } from "./actions";
import type { ContentItem } from "@/types/database";

export function ContentActions({ contentId }: { contentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this content? This action cannot be undone.")) return;
    
    setIsDeleting(true);
    const result = await deleteContent(contentId);
    setIsDeleting(false);

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={handleDelete}
        disabled={isDeleting || deleteSuccess}
        title="Delete Content"
        className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : deleteSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-brand-green" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function AddContentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // Parse tags from comma separated string
    const tagsStr = formData.get("tags") as string;
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

    const data: Omit<ContentItem, "id" | "created_at"> = {
      title: formData.get("title") as string,
      content_type: formData.get("content_type") as "story" | "video",
      series: (formData.get("series") as string) || null,
      episode_number: formData.get("episode_number") ? parseInt(formData.get("episode_number") as string) : null,
      original_video_url: formData.get("original_video_url") as string,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      duration_seconds: formData.get("duration_seconds") ? parseInt(formData.get("duration_seconds") as string) : null,
      age_range: (formData.get("age_range") as string) || null,
      tags: tags,
      is_premium: formData.get("is_premium") === "on",
      content_mode: 'tts',
      text_script: null,
      isolated_vocals_url: null,
      instrumental_url: null,
    };

    const result = await addContent(data);
    
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Content
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-card rounded-2xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Add New Content</h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input required name="title" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type *</label>
                  <select required name="content_type" className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="story">Story</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Premium</label>
                  <label className="flex items-center mt-2 cursor-pointer">
                    <input type="checkbox" name="is_premium" className="mr-2" />
                    <span className="text-sm">Premium Content</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Series</label>
                  <input name="series" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Episode #</label>
                  <input type="number" name="episode_number" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Media URL *</label>
                <input required name="original_video_url" type="url" placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Direct link to audio or video file</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
                <input name="thumbnail_url" type="url" placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (sec)</label>
                  <input type="number" name="duration_seconds" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age Range</label>
                  <input name="age_range" placeholder="e.g. 3-5" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                <input name="tags" placeholder="bedtime, animals" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Content
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
