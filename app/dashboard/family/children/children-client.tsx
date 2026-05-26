"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TwilightShell } from "@/components/twilight-layout";
import { Section } from "@/components/twilight-ui";
import { addChild, deleteChild } from "./actions";
import { Loader2, Plus, Trash2, Users, ArrowLeft, AlertCircle } from "lucide-react";

interface Child {
  id: string;
  name: string;
  age: number;
}

interface ChildrenClientProps {
  dbChildren: Child[];
  userId: string;
  dbSimulated: boolean;
}

export function ChildrenClient({ dbChildren, userId, dbSimulated }: ChildrenClientProps) {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState(6);
  const [loading, setLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(dbSimulated);

  // Initialize list
  useEffect(() => {
    // If running in simulation or if database yielded no rows, try reading from localStorage
    const localKey = `sim_children_user_${userId}`;
    const stored = localStorage.getItem(localKey);
    
    if (stored) {
      setChildren(JSON.parse(stored));
      setIsSimulating(true);
    } else if (dbChildren.length > 0) {
      setChildren(dbChildren);
    } else {
      // Default mock children
      const defaults = [
        { id: "mock-1", name: "Yusuf", age: 5 },
        { id: "mock-2", name: "Aisha", age: 7 }
      ];
      setChildren(defaults);
      localStorage.setItem(localKey, JSON.stringify(defaults));
      setIsSimulating(true);
    }
  }, [dbChildren, userId]);

  const saveSimulationData = (newList: Child[]) => {
    const localKey = `sim_children_user_${userId}`;
    localStorage.setItem(localKey, JSON.stringify(newList));
    setChildren(newList);
  };

  const handleAddChild = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    if (isSimulating) {
      // Simulation mode: add to state & localStorage
      const newChild: Child = {
        id: `sim-${Date.now()}`,
        name: name.trim(),
        age: age
      };
      const updated = [...children, newChild];
      saveSimulationData(updated);
      setName("");
      setLoading(false);
      router.refresh();
      return;
    }

    // Database mode
    const formData = new FormData(e.currentTarget);
    try {
      const res = await addChild(formData);
      if (res.success) {
        setName("");
        // Reload page to fetch updated database rows
        router.refresh();
        // Optimistically reload list or query again
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("family_children")
          .select("*")
          .eq("user_id", userId)
          .order("name", { ascending: true });
        if (data) setChildren(data);
      } else {
        setError(res.error || "Failed to add child.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChild = async (id: string) => {
    if (!confirm("Are you sure you want to remove this reader?")) return;

    setDeleteLoadingId(id);
    setError(null);

    if (isSimulating || id.startsWith("sim-") || id.startsWith("mock-")) {
      // Simulation mode
      const updated = children.filter(c => c.id !== id);
      saveSimulationData(updated);
      setDeleteLoadingId(null);
      router.refresh();
      return;
    }

    // Database mode
    try {
      const res = await deleteChild(id);
      if (res.success) {
        setChildren(prev => prev.filter(c => c.id !== id));
        router.refresh();
      } else {
        setError(res.error || "Failed to delete reader.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // Helper to resolve avatar color based on name initials
  const getAvatarStyle = (childName: string) => {
    const colors = ["var(--rose)", "var(--lamp-soft)", "var(--moss)", "var(--plum)"];
    const hash = childName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const color = colors[hash % colors.length];
    return {
      width: 48,
      height: 48,
      borderRadius: "50%",
      background: `rgba(${color === "var(--rose)" ? "232,133,108" : color === "var(--moss)" ? "127,196,164" : color === "var(--plum)" ? "197,143,184" : "244,184,96"}, 0.12)`,
      color: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 600,
      fontSize: 16,
      border: `1px solid rgba(${color === "var(--rose)" ? "232,133,108" : color === "var(--moss)" ? "127,196,164" : color === "var(--plum)" ? "197,143,184" : "244,184,96"}, 0.2)`
    };
  };

  return (
    <TwilightShell>
      <div style={{ maxWidth: 1040, margin: "48px auto 96px", padding: "0 24px" }}>
        
        {/* Back Link */}
        <Link
          href="/dashboard/family"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--paper-dim)",
            textDecoration: "none",
            fontSize: 14,
            marginBottom: 32,
            transition: "color 0.2s"
          }}
          className="hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Family Tree
        </Link>

        {/* Page Header */}
        <div style={{ marginBottom: 48 }} className="fadeUp">
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lamp)", marginBottom: 12 }}>
            Family settings
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "0 0 12px 0", color: "var(--paper)", letterSpacing: "-0.02em" }}>
            Little <span className="serif-italic">Readers</span>
          </h1>
          <p style={{ color: "var(--paper-dim)", fontSize: 15, maxWidth: 540, lineHeight: 1.5, margin: 0 }}>
            Configure profiles for your children. They will be listed under narrations to personalize stories.
          </p>
        </div>

        {isSimulating && (
          <div style={{
            background: "rgba(244, 184, 96, 0.06)", border: "1px solid rgba(244, 184, 96, 0.18)",
            borderRadius: 16, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start",
            marginBottom: 36, color: "var(--lamp-soft)", fontSize: 13, lineHeight: 1.5
          }} className="fadeUp">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Simulation Mode:</strong> The `family_children` database table is not active. Changes are stored locally in your browser's session storage. Apply migration `006_children_and_bedtime.sql` to connect DB tables.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(232,133,108,0.08)", border: "1px solid rgba(232,133,108,0.25)",
            borderRadius: 16, padding: 16, color: "var(--rose)", fontSize: 14,
            marginBottom: 32
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Two Column Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 56, alignItems: "start" }} className="fadeUp">
          
          {/* Left Column: Children list */}
          <Section eyebrow="ACTIVE READERS" title={<>Your <span className="serif-italic">Children</span></>}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {children.map(child => (
                <div
                  key={child.id}
                  style={{
                    background: "var(--ink-2)", border: "1px solid var(--ink-3)",
                    borderRadius: 20, padding: 20, display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 16
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={getAvatarStyle(child.name)}>
                      {child.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: "var(--paper)", fontWeight: 600, fontSize: 16 }}>
                        {child.name}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>
                        Age {child.age}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteChild(child.id)}
                    disabled={deleteLoadingId === child.id}
                    style={{
                      background: "transparent", border: "none", color: "var(--rose)",
                      padding: 10, borderRadius: 8, cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", transition: "background 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(232, 133, 108, 0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    title="Delete profile"
                  >
                    {deleteLoadingId === child.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              ))}

              {children.length === 0 && (
                <div style={{
                  background: "var(--ink-2)", border: "1px solid var(--ink-3)", borderRadius: 20,
                  padding: 40, textAlign: "center", color: "var(--paper-mute)"
                }}>
                  <Users size={32} style={{ marginBottom: 12, color: "var(--paper-mute)" }} />
                  <div>No reader profiles created yet.</div>
                </div>
              )}
            </div>
          </Section>

          {/* Right Column: Add child form */}
          <Section eyebrow="ADD A PROFILE" title={<>New <span className="serif-italic">Reader</span></>}>
            <div style={{
              background: "var(--ink-2)", border: "1px solid var(--ink-3)",
              borderRadius: 24, padding: 32
            }}>
              <form onSubmit={handleAddChild} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Child Name */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Child's Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Yusuf"
                    style={{
                      width: "100%", background: "var(--ink-1)", border: "1px solid var(--ink-3)",
                      borderRadius: 12, padding: "14px 16px", color: "var(--paper)", fontSize: 15, outline: "none"
                    }}
                  />
                </div>

                {/* Child Age */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <label className="mono" style={{ fontSize: 10, color: "var(--paper-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Child's Age
                    </label>
                    <span style={{ fontSize: 14, color: "var(--lamp-soft)", fontWeight: 600 }}>
                      {age} years old
                    </span>
                  </div>
                  <input
                    type="range"
                    name="age"
                    min="0"
                    max="18"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                    style={{
                      width: "100%", background: "var(--ink-3)", outline: "none", cursor: "pointer",
                      accentColor: "var(--lamp)"
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--paper-mute)" }} className="mono">
                    <span>Baby (0)</span>
                    <span>Toddler (4)</span>
                    <span>Kid (8)</span>
                    <span>Teen (18)</span>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "14px", background: "var(--lamp)", color: "var(--ink-0)",
                    border: "none", borderRadius: 99, fontWeight: 600, fontSize: 14,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    marginTop: 12
                  }}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      Add Profile
                    </>
                  )}
                </button>

              </form>
            </div>
          </Section>

        </div>

      </div>
    </TwilightShell>
  );
}
