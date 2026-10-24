import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * GET /api/me/settings
 *
 * The signed-in user's own profile settings that the client TopBar
 * needs (bedtime mode + Pixar avatar). Replaces the browser client
 * reads removed in the Phase 4 migration; the users row is
 * self-only, so the session user is the authorization boundary.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    bedtimeTime: user.bedtimeTime,
    bedtimeAutodim: user.bedtimeAutodim,
    defaultBackgroundAudio: user.defaultBackgroundAudio,
    avatarUrl: user.avatarUrl,
  });
}
