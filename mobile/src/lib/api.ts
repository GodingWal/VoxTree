import { config } from "./config";
import { supabase } from "./supabase";

type JsonBody = Record<string, unknown>;

/**
 * Call VoxTree's Next.js API with the Supabase access token attached. The web
 * API uses cookie-based auth, but we fall back to a Bearer token so the same
 * routes work from React Native.
 */
async function request<T>(
  path: string,
  init: RequestInit & { json?: JsonBody } = {}
): Promise<T> {
  if (!config.apiBaseUrl) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not configured. " +
        "Add it to .env to enable server-side voice & clip endpoints."
    );
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status}`;
    try {
      const err = (await res.json()) as {
        error?: string;
        upgradeRequired?: boolean;
        upgradePrompt?: string;
      };
      if (err.error) errorMessage = err.error;
      throw Object.assign(new Error(errorMessage), {
        status: res.status,
        upgradeRequired: err.upgradeRequired,
        upgradePrompt: err.upgradePrompt,
      });
    } catch (e) {
      if (e instanceof Error && "status" in e) throw e;
      throw new Error(errorMessage);
    }
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  createVoice: (name: string) =>
    request<{ voiceId: string; uploadUrl: string; s3Key: string }>(
      "/api/voices/create",
      { method: "POST", json: { name } }
    ),

  processVoice: async (voiceId: string) => {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) throw new Error("Not signed in");
    return request<{ status: "ready" | "processing" | "failed" }>(
      "/api/voices/process",
      { method: "POST", json: { voiceId, userId } }
    );
  },

  generateClip: (contentId: string, voiceId: string) =>
    request<{ clipId: string; status: string }>(
      "/api/clips/generate",
      { method: "POST", json: { contentId, voiceId } }
    ),

  createCheckout: (plan: "family" | "premium", billing: "monthly" | "annual") =>
    request<{ url: string }>(
      "/api/stripe/checkout",
      { method: "POST", json: { plan, billing } }
    ),
};

export class ApiError extends Error {
  status: number;
  upgradeRequired?: boolean;
  upgradePrompt?: string;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
