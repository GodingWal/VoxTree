"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, Edit } from "lucide-react";
import { addContent, deleteContent, updateContent } from "./actions";
import type { ContentItem } from "@/types/database";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--paper-mute)",
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--ink-0)",
  border: "1px solid var(--ink-3)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  color: "var(--paper)",
  outline: "none",
  transition: "border-color 0.2s",
};

export function ContentActions({ content }: { content: ContentItem }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this content? This action cannot be undone.")) return;
    
    setIsDeleting(true);
    const result = await deleteContent(content.id);
    setIsDeleting(false);

    if (result.error) {
      alert(`Error: ${result.error}`);
    } else {
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    const tagsStr = formData.get("tags") as string;
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

    const data: Partial<Omit<ContentItem, "id" | "created_at">> = {
      title: formData.get("title") as string,
      content_type: formData.get("content_type") as "story" | "video",
      content_mode: formData.get("content_mode") as "tts" | "v2v",
      series: (formData.get("series") as string) || null,
      episode_number: formData.get("episode_number") ? parseInt(formData.get("episode_number") as string) : null,
      original_video_url: formData.get("original_video_url") as string,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      duration_seconds: formData.get("duration_seconds") ? parseInt(formData.get("duration_seconds") as string) : null,
      age_range: (formData.get("age_range") as string) || null,
      tags: tags,
      is_premium: formData.get("is_premium") === "on",
      text_script: (formData.get("text_script") as string) || null,
      isolated_vocals_url: (formData.get("isolated_vocals_url") as string) || null,
      instrumental_url: (formData.get("instrumental_url") as string) || null,
    };

    const result = await updateContent(content.id, data);
    
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsEditOpen(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button
        onClick={() => setIsEditOpen(true)}
        title="Edit Content"
        style={{
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: "var(--paper-dim)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--ink-2)";
          e.currentTarget.style.color = "var(--lamp)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--paper-dim)";
        }}
      >
        <Edit className="h-4 w-4" />
      </button>

      <button
        onClick={handleDelete}
        disabled={isDeleting || deleteSuccess}
        title="Delete Content"
        style={{
          padding: 8,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: "var(--rose)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(232,133,108,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : deleteSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>

      {isEditOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10, 14, 31, 0.82)",
          backdropFilter: "blur(4px)",
          padding: 16,
        }}>
          <div style={{
            backgroundColor: "var(--ink-1)",
            border: "1px solid var(--ink-3)",
            borderRadius: 20,
            maxWidth: 640,
            width: "100%",
            padding: 28,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            maxHeight: "90vh",
            overflowY: "auto",
            textAlign: "left",
          }} className="fadeUp">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>
                Edit <span className="serif-italic">Content</span>
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--paper-dim)",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                ✕
              </button>
            </div>
            
            {error && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: "rgba(232,133,108,0.1)",
                border: "1px solid var(--rose)",
                color: "var(--rose)",
                borderRadius: 8,
                fontSize: 14,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input required name="title" defaultValue={content.title} style={inputStyle} />
              </div>
              
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Type *</label>
                  <select required name="content_type" defaultValue={content.content_type} style={inputStyle}>
                    <option value="story">Story</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Mode *</label>
                  <select required name="content_mode" defaultValue={content.content_mode} style={inputStyle}>
                    <option value="tts">TTS (Text-to-Speech)</option>
                    <option value="v2v">V2V (Voice-to-Voice)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  id={`edit-premium-${content.id}`}
                  name="is_premium"
                  defaultChecked={content.is_premium}
                  style={{ width: 16, height: 16, accentColor: "var(--lamp)", cursor: "pointer" }}
                />
                <label htmlFor={`edit-premium-${content.id}`} style={{ fontSize: 13, color: "var(--paper)", cursor: "pointer" }}>
                  Premium Content (Requires family/premium plan)
                </label>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Series</label>
                  <input name="series" defaultValue={content.series || ""} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Episode #</label>
                  <input type="number" name="episode_number" defaultValue={content.episode_number || ""} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Media URL *</label>
                <input required name="original_video_url" type="url" defaultValue={content.original_video_url} style={inputStyle} />
                <p style={{ fontSize: 11, color: "var(--paper-mute)", margin: "4px 0 0" }}>
                  Direct link to audio or video file
                </p>
              </div>

              <div>
                <label style={labelStyle}>Thumbnail URL</label>
                <input name="thumbnail_url" type="url" defaultValue={content.thumbnail_url || ""} style={inputStyle} />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Duration (seconds)</label>
                  <input type="number" name="duration_seconds" defaultValue={content.duration_seconds || ""} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Age Range</label>
                  <input name="age_range" placeholder="e.g. 3-5" defaultValue={content.age_range || ""} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tags (comma separated)</label>
                <input name="tags" placeholder="bedtime, animals" defaultValue={content.tags?.join(", ") || ""} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Text Script (Story Text)</label>
                <textarea
                  name="text_script"
                  defaultValue={content.text_script || ""}
                  placeholder="Enter the full text script for this story..."
                  className="mono"
                  style={{
                    ...inputStyle,
                    height: 160,
                    resize: "vertical",
                    lineHeight: "1.5",
                    fontSize: 12,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Isolated Vocals URL</label>
                  <input name="isolated_vocals_url" type="url" defaultValue={content.isolated_vocals_url || ""} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Instrumental URL</label>
                  <input name="instrumental_url" type="url" defaultValue={content.instrumental_url || ""} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 16px",
                    color: "var(--paper-dim)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "var(--lamp)",
                    color: "var(--ink-0)",
                    border: "none",
                    borderRadius: 99,
                    padding: "8px 24px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
      content_mode: formData.get("content_mode") as "tts" | "v2v",
      series: (formData.get("series") as string) || null,
      episode_number: formData.get("episode_number") ? parseInt(formData.get("episode_number") as string) : null,
      original_video_url: formData.get("original_video_url") as string,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      duration_seconds: formData.get("duration_seconds") ? parseInt(formData.get("duration_seconds") as string) : null,
      age_range: (formData.get("age_range") as string) || null,
      tags: tags,
      is_premium: formData.get("is_premium") === "on",
      text_script: (formData.get("text_script") as string) || null,
      isolated_vocals_url: (formData.get("isolated_vocals_url") as string) || null,
      instrumental_url: (formData.get("instrumental_url") as string) || null,
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
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 99,
          backgroundColor: "rgba(127,196,164,0.12)", // Moss soft background
          border: "1px solid rgba(127,196,164,0.35)",
          padding: "8px 20px",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--moss)",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(127,196,164,0.22)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(127,196,164,0.12)";
        }}
      >
        <Plus className="h-4 w-4" />
        Add Content
      </button>

      {isOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(10, 14, 31, 0.82)",
          backdropFilter: "blur(4px)",
          padding: 16,
        }}>
          <div style={{
            backgroundColor: "var(--ink-1)",
            border: "1px solid var(--ink-3)",
            borderRadius: 20,
            maxWidth: 640,
            width: "100%",
            padding: 28,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            maxHeight: "90vh",
            overflowY: "auto",
            textAlign: "left",
          }} className="fadeUp">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 className="serif" style={{ fontSize: 24, margin: 0 }}>
                Add New <span className="serif-italic">Content</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--paper-dim)",
                  cursor: "pointer",
                  fontSize: 20,
                }}
              >
                ✕
              </button>
            </div>
            
            {error && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: "rgba(232,133,108,0.1)",
                border: "1px solid var(--rose)",
                color: "var(--rose)",
                borderRadius: 8,
                fontSize: 14,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input required name="title" placeholder="Enter content title" style={inputStyle} />
              </div>
              
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Type *</label>
                  <select required name="content_type" defaultValue="story" style={inputStyle}>
                    <option value="story">Story</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Mode *</label>
                  <select required name="content_mode" defaultValue="tts" style={inputStyle}>
                    <option value="tts">TTS (Text-to-Speech)</option>
                    <option value="v2v">V2V (Voice-to-Voice)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  id="add-premium"
                  name="is_premium"
                  style={{ width: 16, height: 16, accentColor: "var(--moss)", cursor: "pointer" }}
                />
                <label htmlFor="add-premium" style={{ fontSize: 13, color: "var(--paper)", cursor: "pointer" }}>
                  Premium Content (Requires family/premium plan)
                </label>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Series</label>
                  <input name="series" placeholder="e.g. Bedtime Adventures" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Episode #</label>
                  <input type="number" name="episode_number" placeholder="e.g. 1" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Media URL *</label>
                <input required name="original_video_url" type="url" placeholder="https://..." style={inputStyle} />
                <p style={{ fontSize: 11, color: "var(--paper-mute)", margin: "4px 0 0" }}>
                  Direct link to audio or video file
                </p>
              </div>

              <div>
                <label style={labelStyle}>Thumbnail URL</label>
                <input name="thumbnail_url" type="url" placeholder="https://..." style={inputStyle} />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Duration (seconds)</label>
                  <input type="number" name="duration_seconds" placeholder="e.g. 120" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Age Range</label>
                  <input name="age_range" placeholder="e.g. 3-5" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tags (comma separated)</label>
                <input name="tags" placeholder="bedtime, animals" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Text Script (Story Text)</label>
                <textarea
                  name="text_script"
                  placeholder="Enter the full text script for this story..."
                  className="mono"
                  style={{
                    ...inputStyle,
                    height: 160,
                    resize: "vertical",
                    lineHeight: "1.5",
                    fontSize: 12,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Isolated Vocals URL</label>
                  <input name="isolated_vocals_url" type="url" placeholder="https://..." style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Instrumental URL</label>
                  <input name="instrumental_url" type="url" placeholder="https://..." style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 16px",
                    color: "var(--paper-dim)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "var(--moss)",
                    color: "var(--ink-0)",
                    border: "none",
                    borderRadius: 99,
                    padding: "8px 24px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
