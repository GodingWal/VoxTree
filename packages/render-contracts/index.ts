import type { DigitalActor } from "@/packages/digital-actor-schema";
export const SKELETON_VERSION = "voxtree-v1";
export const SKELETON = ["root", "pelvis", "spine", "chest", "neck", "head", "jaw", "leftEye", "rightEye",
  ...["left", "right"].flatMap(side => ["Clavicle", "UpperArm", "Forearm", "Hand", "Thigh", "Calf", "Foot", "Toes",
    ...["Thumb", "Index", "Middle", "Ring", "Pinky"].flatMap(f => [1, 2, 3].map(n => `${f}${n}`))].map(j => `${side}${j}`))];
export const FACIAL_CONTROLS = ["jawOpen", "smileLeft", "smileRight", "blinkLeft", "blinkRight", "browUp", "mouthPucker", "mouthWide"];
export type MovieCharacter = { id: string; skeletonVersion: string; costumeAssetId: string; animationAssetId: string; propAssetIds: string[]; role: string };
export function injectIdentity(actor: DigitalActor, character: MovieCharacter, userId: string, mode: "face_only" | "face_body" | "full_actor") {
  if (actor.userId !== userId) throw new Error("Actor not found");
  if (actor.status !== "ready" || !actor.stylizedAvatar) throw new Error("Actor is not ready");
  if (character.skeletonVersion !== SKELETON_VERSION) throw new Error("Skeleton mapping required");
  return { character: { ...character }, actorId: actor.id, actorVersion: actor.version, identityAssetId: actor.stylizedAvatar.assetId,
    voice: { ...actor.voice }, mode, bodyDeformationLimit: mode === "face_only" ? 0 : 0.15 };
}
