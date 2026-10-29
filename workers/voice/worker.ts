/**
 * Voice-job queue worker entrypoint.
 *
 * Run with: npm run worker:voice   (tsx; see package.json)
 *
 * Environment:
 * - DATABASE_URL / AUTH_SECRET — validated up front via lib/env.ts;
 *   in production validateEnv() fails closed on missing config.
 * - VOICE_WORKER_ID — worker id stamped on leased jobs
 *   (default: voice-worker-<pid>).
 * - VOICE_WORKER_POLL_MS — idle poll interval (default 5000).
 * - CHATTERBOX_SERVICE_URL — the Chatterbox service the voice
 *   provider calls (default http://localhost:8001).
 *
 * The loop lives in lib/voice-worker.ts (runVoiceWorker): lease ->
 * dispatch -> complete/fail, polling when empty, and SIGINT/SIGTERM
 * stop it gracefully between jobs.
 */
import { validateEnv } from "../../lib/env";
import { logger } from "../../lib/logger";
import { runVoiceWorker } from "../../lib/voice-worker";

validateEnv();

runVoiceWorker().catch((err) => {
  logger.error("voice_worker_fatal", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
