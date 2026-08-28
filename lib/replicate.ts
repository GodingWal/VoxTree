import Replicate from "replicate";
import { withRetry } from "./retry";

export const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null;

function requireReplicate(): Replicate {
  if (!replicate) {
    throw new Error("REPLICATE_API_TOKEN is required. Set REPLICATE_API_TOKEN in your environment.");
  }
  return replicate;
}

/**
 * Cancel a Replicate training. Safe to call on already-finished jobs
 * (returns false instead of throwing).
 */
export async function cancelTraining(trainingId: string): Promise<boolean> {
  const r = requireReplicate();
  try {
    await withRetry(() => r.trainings.cancel(trainingId), {
      attempts: 3,
      baseDelayMs: 1000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers a Replicate training job for an RVC (Singing) model.
 */
export async function trainSingingModel(datasetUrl: string, webhookUrl: string) {
  const r = requireReplicate();
  const training = await withRetry(
    () =>
      r.trainings.create(
        "zsxkib",
        "realistic-voice-cloning",
        "0a9c7c558af4c0f20667c1bd1260ce32a2879944a0b9e44e1398660c077b1550",
        {
          destination: "voxtree-internal/temp-model",
          input: { dataset: datasetUrl, epochs: 200, batch_size: 7 },
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
        }
      ),
    { attempts: 3, baseDelayMs: 1500 }
  );
  return training;
}

/**
 * Checks the status of a training job. Useful for polling when Webhooks aren't available.
 */
export async function checkTrainingStatus(trainingId: string) {
  const r = requireReplicate();
  return await r.trainings.get(trainingId);
}

/**
 * Train a personalized Flux LoRA on a user's reference photos for the
 * truest-possible Pixar character clone. Uses `ostris/flux-dev-lora-trainer`.
 *
 * The trainer destination is configured via REPLICATE_LORA_DESTINATION
 * (e.g. "voxtree/family-character-loras"). The API key must own this model.
 */
export async function trainCharacterLora(params: {
  inputImagesUrl: string;
  triggerWord: string;
  webhookUrl: string;
  steps?: number;
}) {
  const destination = process.env.REPLICATE_LORA_DESTINATION;
  if (!destination) {
    throw new Error("REPLICATE_LORA_DESTINATION is required. Set it to \"owner/name\".");
  }
  const r = requireReplicate();
  const [owner, name] = destination.split("/");
  if (!owner || !name) {
    throw new Error(
      `REPLICATE_LORA_DESTINATION must be in "owner/name" form, got: ${destination}`
    );
  }

  const training = await r.trainings.create(
    "ostris",
    "flux-dev-lora-trainer",
    "4ffd32160efd92e956d39c5338a9b8fbafca58e03f791f6d8011f3e20e8ea6fa",
    {
      destination: destination as `${string}/${string}`,
      input: {
        input_images: params.inputImagesUrl,
        trigger_word: params.triggerWord,
        steps: params.steps ?? 1000,
        learning_rate: 0.0004,
        batch_size: 1,
        resolution: "512,768,1024",
        autocaption: true,
        lora_rank: 16,
      },
      webhook: params.webhookUrl,
      webhook_events_filter: ["completed"],
    }
  );

  return { ...training, destination };
}

export async function checkLoraTrainingStatus(trainingId: string) {
  const r = requireReplicate();
  return await r.trainings.get(trainingId);
}

/**
 * Generate a Pixar-style portrait using a user's trained LoRA stacked with
 * a Pixar/Disney style LoRA. The trained model is callable directly by its
 * destination+version, so identity is preserved with very high fidelity.
 *
 * Returns the output URL from Replicate.
 */
export async function runPixarLoraInference(params: {
  destination: string;
  version: string;
  triggerWord: string;
  prompt?: string;
  styleLora?: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
}): Promise<string> {
  const r = requireReplicate();
  const stylePrompt =
    params.prompt ??
    `${params.triggerWord} as a pixar disney 3d animated movie character, big glossy round expressive eyes, smooth plastic-like skin, exaggerated cute proportions, vibrant cinematic lighting, pixar movie still, toy story style, inside out style, coco style, rendered in unreal engine, studio portrait`;

  const ref = `${params.destination}:${params.version}` as `${string}/${string}:${string}`;

  const output = (await r.run(ref, {
    input: {
      prompt: stylePrompt,
      aspect_ratio: params.aspectRatio ?? "1:1",
      num_inference_steps: 32,
      guidance_scale: 3.5,
      lora_scale: 1.0,
      extra_lora: params.styleLora ?? "alvdansen/pixar-style",
      extra_lora_scale: 0.85,
      output_format: "png",
      output_quality: 95,
      disable_safety_checker: false,
    },
  })) as unknown;

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof (first as any).url === "function") return (first as any).url();
    return String(first);
  }
  if (typeof output === "string") return output;
  if (output && typeof (output as any).url === "function") return (output as any).url();
  throw new Error("Replicate Pixar LoRA inference returned no usable output");
}

/**
 * Generates a singing voice (V2V) using a trained RVC model.
 */
export async function generateSingingVoice(modelId: string, songUrl: string) {
  const r = requireReplicate();
  const output = await r.run(
    "zsxkib/realistic-voice-cloning:0a9c7c558af4c0f20667c1bd1260ce32a2879944a0b9e44e1398660c077b1550",
    {
      input: {
        song_input: songUrl,
        rvc_model: "CUSTOM",
        protect: 0.33,
      },
    }
  );
  
  return output;
}
