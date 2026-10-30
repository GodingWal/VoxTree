> **ARCHIVED — superseded.** This plan predates the local-stack migration (Supabase/ElevenLabs era). Kept for history only. See docs/CURRENT_STATE.md.

# VoxTree — Improvements Status (October 2026)

Living list of what is done and what remains. Replaces the June 2026 review and
`CODE-REVIEW-RECOMMENDATIONS.md`.

## Done
- CI (type-check, lint, unit, build, audit, e2e, gitleaks) in `.github/workflows/ci.yml`.
- Production fail-fast: `lib/env.ts`, simulation gated by `assertSimulationAllowed`, webhook verification fails closed, Stripe price IDs required.
- DB-backed rate limiting (`check_rate_limit` RPC); first-hop IP keying.
- Consent: shared `requireActiveConsent()` on all biometric routes, webhook/background re-checks, 18+ attestation (migration 016), signed-media export.
- Security fixes found along the way: unsigned LoRA training webhook now verified; `avatar/generate` and `omni-upload` verify voice ownership before admin writes.
- Route tests: Stripe webhook, consent guard (every biometric route), existing route-security suite.
- `sample_audio_url` → `sample_audio_key` (migration 017); ESLint `no-console`; `lib/voice-provider.ts`.

## Remaining
1. **Real age/identity verification** — the 18+ gate is an attestation only. Needed before public avatar launch.
2. **Biometric files in `public/uploads`** — `omni-upload`, `capture`, and avatar routes still write recordings/frames to the web-served `public/uploads`. Move to private GCS with signed URLs (same as `voices/process`).
3. **Durable job queue** — clip/clone/render work runs in route handlers and `async` IIFEs that die with the serverless instance. Move to a queue with idempotent webhooks.
4. **Voice provider** — done: self-hosted Chatterbox is the only implementation behind `VoiceProvider` (`workers/chatterbox/`).
5. **Test coverage** — `clips/generate`, `account/delete`, `account/export`, `revoke-consent` route tests; webhook idempotency for Stripe events.
6. **Cost alerts** — warn at 80% of a user's cap and of the vendor budget.
7. Counsel review of consent/privacy copy (see runbook).
