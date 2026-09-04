"use client";

import Link from "next/link";
import { HeartHandshake } from "lucide-react";

export function InviteGrandmaButton() {
  return (
    <Link
      href="/onboarding?relationship=grandparent"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "13px 20px",
        border: "1px solid rgba(244, 184, 96, 0.28)",
        borderRadius: 99,
        background: "rgba(244, 184, 96, 0.08)",
        color: "var(--lamp-soft)",
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
      }}
      className="hover:bg-white/10 active:scale-95"
    >
      <HeartHandshake size={15} aria-hidden="true" />
      Invite a grandparent
    </Link>
  );
}
