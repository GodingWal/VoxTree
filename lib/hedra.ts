/**
 * Thin client for Hedra Character-3 audio-driven talking-head generation.
 *
 * Hedra's flow is: upload an audio asset, upload an image asset (the Pixar
 * still), then create a generation that targets `character-3` with the two
 * asset IDs. The generation runs async, so callers poll the status endpoint
 * until it resolves to a video URL.
 *
 * Endpoint paths and auth conform to Hedra's public web API. Configure with
 * HEDRA_API_KEY and (optionally) HEDRA_API_BASE. Without a key the helpers
 * simulate so dev flows still work.
 */

const DEFAULT_BASE = "https://api.hedra.com";

function config() {
  return {
    apiKey: process.env.HEDRA_API_KEY || null,
    base: process.env.HEDRA_API_BASE || DEFAULT_BASE,
  };
}

export function isHedraConfigured(): boolean {
  return !!process.env.HEDRA_API_KEY;
}

async function hedraFetch(path: string, init: RequestInit, apiKey: string) {
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${config().base}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hedra ${path} failed: ${res.status} ${text}`);
  }
  return res;
}

/**
 * Upload a buffer to Hedra as an asset (audio or image). Returns the asset ID
 * Hedra assigns. We send a single multipart request — Hedra's public API
 * accepts the file plus a `type` discriminator on the same call.
 */
export async function uploadAsset(
  data: Buffer,
  type: "audio" | "image",
  filename: string,
  contentType: string
): Promise<string> {
  const { apiKey } = config();
  if (!apiKey) {
    console.warn("HEDRA_API_KEY missing — simulating asset upload.");
    return `simulated_${type}_${Date.now()}`;
  }

  const form = new FormData();
  form.append("type", type);
  form.append(
    "file",
    new Blob([new Uint8Array(data)], { type: contentType }),
    filename
  );

  const res = await hedraFetch(
    "/web-app/public/assets",
    { method: "POST", body: form },
    apiKey
  );
  const json = (await res.json()) as { id?: string; asset_id?: string };
  const id = json.id ?? json.asset_id;
  if (!id) throw new Error("Hedra asset upload returned no id");
  return id;
}

export interface TalkingVideoGenerationResult {
  generationId: string;
  status: "queued" | "processing" | "complete" | "error";
  videoUrl?: string;
}

/**
 * Kick off a Character-3 talking-head generation. The generation runs async;
 * callers should poll {@link getTalkingVideoStatus} until status === "complete".
 */
export async function createTalkingVideo(params: {
  imageAssetId: string;
  audioAssetId: string;
  aspectRatio?: "1:1" | "16:9" | "9:16";
  resolution?: "540p" | "720p";
}): Promise<TalkingVideoGenerationResult> {
  const { apiKey } = config();
  if (!apiKey) {
    console.warn("HEDRA_API_KEY missing — simulating talking video generation.");
    return {
      generationId: `simulated_hedra_${Date.now()}`,
      status: "queued",
    };
  }

  const res = await hedraFetch(
    "/web-app/public/generations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "video",
        ai_model_id: "character-3",
        start_keyframe_id: params.imageAssetId,
        audio_id: params.audioAssetId,
        generated_video_inputs: {
          aspect_ratio: params.aspectRatio ?? "9:16",
          resolution: params.resolution ?? "720p",
        },
      }),
    },
    apiKey
  );

  const json = (await res.json()) as {
    id?: string;
    generation_id?: string;
    status?: string;
  };
  const generationId = json.id ?? json.generation_id;
  if (!generationId) {
    throw new Error("Hedra generation create returned no id");
  }
  return {
    generationId,
    status: (json.status as TalkingVideoGenerationResult["status"]) ?? "queued",
  };
}

/**
 * Poll a generation for completion. Returns the current status and, once
 * ready, the playable video URL.
 */
export async function getTalkingVideoStatus(
  generationId: string
): Promise<TalkingVideoGenerationResult> {
  if (generationId.startsWith("simulated_hedra_")) {
    const startedAt = parseInt(generationId.split("_").pop() || "0", 10);
    const elapsed = Date.now() - startedAt;
    if (elapsed > 8_000) {
      return {
        generationId,
        status: "complete",
        videoUrl: "/uploads/simulated_talking.mp4",
      };
    }
    return { generationId, status: "processing" };
  }

  const { apiKey } = config();
  if (!apiKey) return { generationId, status: "error" };

  const res = await hedraFetch(
    `/web-app/public/generations/${encodeURIComponent(generationId)}/status`,
    { method: "GET" },
    apiKey
  );
  const json = (await res.json()) as {
    status?: string;
    url?: string;
    asset?: { url?: string };
  };

  const status = (json.status as TalkingVideoGenerationResult["status"]) ?? "processing";
  return {
    generationId,
    status,
    videoUrl: json.url ?? json.asset?.url,
  };
}
