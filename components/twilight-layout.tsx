"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { VoxMark, VoxWordmark } from './voxtree-logo';

export function TwilightShell({ children }: { children: React.ReactNode }) {
  // Ensure the body has the starfield data attribute
  useEffect(() => {
    document.body.dataset.starfield = "on";
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar />
      <div style={{ flex: 1, position: "relative" }}>{children}</div>
      <Footer />
    </div>
  );
}

import { createClient } from "@/lib/supabase/client";

function TopBar() {
  const pathname = usePathname();
  const [initials, setInitials] = React.useState("U");
  const [session, setSession] = React.useState<any>(null);
  const supabase = createClient();

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const email = data.session.user.email || "";
        const name = data.session.user.user_metadata?.full_name || email.split("@")[0] || "User";
        setInitials(name.substring(0, 2).toUpperCase());
      }
    });
  }, []);
  
  const items = [
    { id: "home",    label: "Home", href: "/" },
    { id: "library", label: "Library", href: "/browse" },
    { id: "stories", label: "Stories", href: "/dashboard/stories" },
    { id: "clone",   label: "Clone", href: "/dashboard/clones" },
    { id: "family",  label: "Family", href: "/dashboard/family" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      background: "linear-gradient(180deg, rgba(10,14,31,0.85), rgba(10,14,31,0.55))",
      borderBottom: "1px solid var(--ink-3)",
    }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        <Link href="/" style={{
          background: "none", border: 0, padding: 0, cursor: "pointer", color: "inherit", textDecoration: "none"
        }}>
          <VoxWordmark size={18} animate={false} />
        </Link>

        <nav style={{ display: "flex", gap: 4 }}>
          {items.map(it => {
            const isActive = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
            return (
              <Link key={it.id}
                href={it.href}
                style={{
                  padding: "8px 16px",
                  background: isActive ? "rgba(244,184,96,0.12)" : "transparent",
                  color: isActive ? "var(--lamp-soft)" : "var(--paper-dim)",
                  border: 0, borderRadius: 99,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  transition: "all .2s ease",
                  textDecoration: "none"
                }}>
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {session ? (
            <>
              <button style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px",
                background: "transparent",
                color: "var(--paper-dim)",
                border: "1px solid var(--ink-3)",
                borderRadius: 99, fontSize: 13, cursor: "pointer",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--moss)" }} />
                Connected
              </button>
              <Link href="/dashboard/settings" style={{
                width: 36, height: 36, borderRadius: 99,
                background: "linear-gradient(135deg, var(--rose), var(--lamp))",
                border: 0, color: "var(--ink-0)", fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center",
                textDecoration: "none", fontSize: 13,
              }}>
                {initials}
              </Link>
              <Link href="/dashboard/admin" style={{
                padding: "8px 14px",
                background: "transparent",
                color: "var(--paper-dim)",
                border: "1px solid var(--ink-3)",
                borderRadius: 99, fontSize: 13, textDecoration: "none",
              }}>
                Admin
              </Link>
            </>
          ) : (
            <Link href="/login" style={{
              padding: "8px 16px",
              background: "var(--lamp)",
              color: "var(--ink-0)",
              border: 0, borderRadius: 99, fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--ink-3)",
      padding: "32px 32px 48px",
      marginTop: 64,
      color: "var(--paper-mute)",
      fontSize: 12,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <VoxMark size={22} color="var(--paper-mute)" />
          <span className="serif" style={{ fontSize: 18, color: "var(--paper-dim)" }}>
            Vox<span className="serif-italic">Tree</span>
          </span>
          <span style={{ marginLeft: 12 }}>Carrying clones through generations.</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <span>Privacy</span><span>Consent</span><span>Help</span><span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
