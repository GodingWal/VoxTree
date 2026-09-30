import { describe, expect, it } from "vitest";
import { consentSchema, CONSENT_VERSION, digitalActorSchema, newActor } from "@/packages/digital-actor-schema";
import { assessCapture, FACE_VIEWS } from "@/services/identity/capture-quality";
import { injectIdentity, SKELETON_VERSION } from "@/packages/render-contracts";
import { ModelRegistry } from "@/services/identity/contracts";
const id = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
describe("Digital Actor standard", () => {
  it("requires adult self-capture consent", () => {
    const consent = { version: CONSENT_VERSION, adult: true, selfCapture: true, permittedUses: ["preview"], retainOriginals: false };
    expect(consentSchema.safeParse(consent).success).toBe(true);
    expect(consentSchema.safeParse({ ...consent, adult: false }).success).toBe(false);
    expect(consentSchema.safeParse({ ...consent, selfCapture: false }).success).toBe(false);
  });
  it("never marks partial actors ready", () => {
    expect(digitalActorSchema.safeParse({ ...newActor(id, owner), status: "ready" }).success).toBe(false);
    expect(digitalActorSchema.safeParse({ ...newActor(id, owner), version: 0 }).success).toBe(false);
  });
  it("rejects missing, blurry, and non-live capture views before reconstruction", () => {
    const capture = { liveCapture: true as const, views: FACE_VIEWS.map(view => ({ view, assetId: id, blurScore: 1, lightingScore: 1, coverageScore: 1, occlusionScore: 0 })) };
    expect(assessCapture(capture, "face").passed).toBe(true);
    expect(assessCapture({ ...capture, views: capture.views.slice(1) }, "face").missingViews).toContain("front");
    expect(assessCapture({ ...capture, views: capture.views.map(v => ({ ...v, blurScore: 0 })) }, "face").passed).toBe(false);
    expect(assessCapture({ ...capture, heightCm: 90 }, "body").passed).toBe(false);
  });
  it("blocks cross-user and unfinished character assignments", () => {
    const actor = newActor(id, owner);
    const character = { id, skeletonVersion: SKELETON_VERSION, costumeAssetId: id, animationAssetId: id, propAssetIds: [], role: "astronaut" };
    expect(() => injectIdentity(actor, character, id, "full_actor")).toThrow("Actor not found");
    expect(() => injectIdentity(actor, character, owner, "full_actor")).toThrow("not ready");
  });
  it("fails closed when a model has not been configured", () => {
    expect(() => new ModelRegistry().resolve("FACE_RECONSTRUCT")).toThrow("Provider unavailable");
  });
});
