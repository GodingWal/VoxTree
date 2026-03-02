import Link from "next/link";

interface NavProps {
  plan?: string;
  showBack?: boolean;
}

const planLabels: Record<string, string> = {
  free: "Free",
  family: "Family",
  pro: "Pro",
  premium: "Premium",
};

export function Nav({ plan, showBack }: NavProps) {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          )}
          <Link href="/dashboard" className="text-xl font-bold text-brand-green">
            VoxTree
          </Link>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground">
            Browse
          </Link>
          <Link href="/videos" className="text-sm text-muted-foreground hover:text-foreground">
            My Videos
          </Link>
          <Link href="/stories" className="text-sm text-muted-foreground hover:text-foreground">
            Stories
          </Link>
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
            Profile
          </Link>
          {plan && (
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {planLabels[plan] ?? plan}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}

export function AdminNav() {
  return (
    <header className="border-b bg-card">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-brand-green">
            VoxTree
          </Link>
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            Admin
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/admin/content" className="text-sm text-muted-foreground hover:text-foreground">
            Content
          </Link>
          <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
            Users
          </Link>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Exit Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
