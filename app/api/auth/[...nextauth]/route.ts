import { handlers } from "@/lib/auth";

/**
 * Auth.js route handler — sign-in/out, OAuth (Google) callback, and
 * session endpoints live under /api/auth/*. Replaces the former hosted-auth
 * /callback exchange route (removed in Phase 3).
 */
export const { GET, POST } = handlers;
