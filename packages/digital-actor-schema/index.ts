import { z } from "zod";

const score = z.number().finite().min(0).max(1);
const parameters = z.array(z.number().finite()).max(1024);
const assetId = z.string().uuid();
export const CONSENT_VERSION = "digital-actor-2026-09-v1";
export const consentSchema = z.object({
  version: z.literal(CONSENT_VERSION), adult: z.literal(true),
  selfCapture: z.literal(true), permittedUses: z.array(z.enum(["preview", "personalized_films"])).min(1),
  retainOriginals: z.boolean(),
}).strict();
export const avatarAssetSchema = z.object({
  assetId, format: z.enum(["usd", "glb"]), version: z.number().int().positive(),
  modelId: z.string().min(1), modelVersion: z.string().min(1),
  dependencies: z.array(assetId), skeletonVersion: z.literal("voxtree-v1"),
});
export const digitalActorSchema = z.object({
  id: assetId, userId: assetId, version: z.number().int().positive(),
  status: z.enum(["capture_required", "processing", "ready", "failed"]),
  face: z.object({ modelType: z.string(), shapeParameters: parameters, expressionNeutral: parameters,
    landmarkData: z.array(z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])),
    geometryAssetId: assetId.optional(), textureAssetId: assetId.optional(), reconstructionConfidence: score }),
  body: z.object({ heightCm: z.number().min(100).max(250).optional(), bodyParameters: parameters,
    shoulderWidth: z.number().positive().optional(), torsoLength: z.number().positive().optional(),
    armLength: z.number().positive().optional(), legLength: z.number().positive().optional(),
    hipWidth: z.number().positive().optional(), handScale: z.number().positive().optional(),
    geometryAssetId: assetId.optional(), reconstructionConfidence: score }),
  hair: z.object({ type: z.string(), color: z.string(), lengthClass: z.string().optional(),
    geometryAssetId: assetId.optional(), groomAssetId: assetId.optional(), confidence: score }),
  skin: z.object({ tone: z.string(), roughness: score, melanin: score, subsurface: score, textureAssetId: assetId.optional() }),
  voice: z.object({ provider: z.string(), referenceAudioAssetIds: z.array(assetId), embeddingId: z.string().optional(),
    qualityScore: score.optional(), consentVersion: z.string() }),
  realisticAvatar: avatarAssetSchema.optional(), stylizedAvatar: avatarAssetSchema.optional(),
  previewAvatar: z.object({ realistic: z.array(avatarAssetSchema), stylized: z.array(avatarAssetSchema) }).optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).superRefine((actor, ctx) => {
  if (actor.status === "ready" && (!actor.realisticAvatar || !actor.stylizedAvatar || !actor.previewAvatar))
    ctx.addIssue({ code: "custom", message: "Ready actors require both masters and preview assets" });
});
export type DigitalActor = z.infer<typeof digitalActorSchema>;
export type AvatarAsset = z.infer<typeof avatarAssetSchema>;
export const JOB_STAGES = ["CAPTURE_PROCESS", "FACE_RECONSTRUCT", "BODY_RECONSTRUCT", "AVATAR_BUILD", "AVATAR_STYLIZE", "PREVIEW_GENERATE", "RENDER_PACKAGE_GENERATE"] as const;
export type JobStage = typeof JOB_STAGES[number];
export function newActor(id: string, userId: string, heightCm?: number): DigitalActor {
  const now = new Date().toISOString();
  return digitalActorSchema.parse({ id, userId, version: 1, status: "capture_required",
    face: { modelType: "unconfigured", shapeParameters: [], expressionNeutral: [], landmarkData: [], reconstructionConfidence: 0 },
    body: { heightCm, bodyParameters: [], reconstructionConfidence: 0 }, hair: { type: "unselected", color: "unknown", confidence: 0 },
    skin: { tone: "unknown", roughness: 0.5, melanin: 0, subsurface: 0.5 },
    voice: { provider: "unconfigured", referenceAudioAssetIds: [], consentVersion: CONSENT_VERSION }, createdAt: now, updatedAt: now });
}
