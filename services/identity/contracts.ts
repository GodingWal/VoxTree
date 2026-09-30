import type { AvatarAsset, DigitalActor, JobStage } from "@/packages/digital-actor-schema";

export type CaptureView = { assetId: string; view: string; blurScore: number; lightingScore: number; occlusionScore: number; coverageScore: number };
export type Capture = { views: CaptureView[]; liveCapture: true; heightCm?: number };
export interface ModelProvenance { id: string; provider: string; version: string; enabled: boolean }
export interface FaceReconstructionProvider { model: ModelProvenance; reconstruct(input: Capture, signal: AbortSignal): Promise<DigitalActor["face"]> }
export interface BodyReconstructionProvider { model: ModelProvenance; reconstruct(input: Capture, signal: AbortSignal): Promise<DigitalActor["body"]> }
export interface VoiceConversionProvider {
  model: ModelProvenance;
  createIdentity(input: Capture, signal: AbortSignal): Promise<DigitalActor["voice"]>;
  convert(input: { sourcePerformanceAssetId: string; actorId: string; userId: string }, signal: AbortSignal): Promise<{ audioAssetId: string; durationSeconds: number }>;
}
export interface AvatarBuilderProvider { model: ModelProvenance; build(actor: DigitalActor, signal: AbortSignal): Promise<AvatarAsset> }
export interface AvatarStylizationProvider { model: ModelProvenance; stylize(master: AvatarAsset, style: "voxtree", signal: AbortSignal): Promise<AvatarAsset> }
export interface StageProvider { model: ModelProvenance; run(actor: DigitalActor, signal: AbortSignal): Promise<DigitalActor> }
export class ModelRegistry {
  private providers = new Map<JobStage, StageProvider>();
  register(stage: JobStage, provider: StageProvider) { this.providers.set(stage, provider); }
  resolve(stage: JobStage) {
    const provider = this.providers.get(stage);
    if (!provider?.model.enabled) throw new Error(`Provider unavailable: ${stage}`);
    return provider;
  }
}
