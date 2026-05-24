import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Only allow same-origin paths in `next` to avoid an open-redirect: must
 * start with `/`, must not be protocol-relative (`//evil.com`), and must
 * not contain a scheme (`https://...`).
 */
function safeNext(raw: string | null): string {
  const fallback = "/";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("://")) return fallback;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // OAuth flow failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
