import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Users, BookOpen, BarChart3 } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await isAdmin(user.email);
  if (!admin) redirect("/");

  const navItems = [
    { href: "/dashboard/admin", label: "Overview", icon: Shield },
    { href: "/dashboard/admin/users", label: "Users", icon: Users },
    { href: "/dashboard/admin/content", label: "Content", icon: BookOpen },
    { href: "/dashboard/admin/analytics", label: "KPIs", icon: BarChart3 },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 32px 24px" }}>
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 24, borderBottom: "1px solid var(--ink-3)", paddingBottom: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--plum)", marginBottom: 12 }}>
            Admin Console
          </div>
          <h1 className="serif" style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: 0, letterSpacing: "-0.02em" }}>
            Platform Management
          </h1>
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px",
                background: "transparent", color: "var(--paper-dim)",
                border: "1px solid var(--ink-3)", borderRadius: 99,
                fontSize: 13, textDecoration: "none", transition: "all 0.2s"
              }}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
