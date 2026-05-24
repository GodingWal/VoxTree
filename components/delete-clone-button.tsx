"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function DeleteCloneButton({ voiceId }: { voiceId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    const confirm = window.confirm(
      "Are you sure you want to delete this clone? All stories generated using this voice will also be deleted. This action cannot be undone."
    );

    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch("/api/voices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete voice");
      }

      router.push("/dashboard/clones");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Error deleting clone. Please try again.");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="w-full justify-center px-4 py-3 text-sm font-medium border border-[var(--ink-3)] rounded-full hover:bg-[var(--ink-2)] text-[var(--paper-dim)] transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
