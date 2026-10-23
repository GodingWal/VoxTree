# VoxTree Operations Runbook

## Production gates

- `npm ci`, lint, type-check, unit tests, end-to-end smoke tests, build, dependency audit, and secret scan must pass.
- `SIMULATION_MODE` must be absent or `false`.
- Visual cloning, singing voice, and talking video stay disabled until separately approved.
- Apply every Supabase migration through the latest file in `supabase/migrations/` (currently `018`) before enabling signups.
- Qualified counsel must approve consent copy, privacy notice, retention, vendor terms, and launch geography.

## Health and alerts

- Monitor `GET /api/health`; alert after two consecutive non-200 responses.
- Set `ALERT_WEBHOOK_URL` for voice-generation, clip-generation, and payment-failure alerts.
- Suggested alert thresholds (Sentry/Datadog): 5xx rate > 2% for 5 min; any `replicate_webhook_rejected` / `lora_webhook_rejected` burst (> 10 in 5 min, possible forgery); `stripe_payment_failed` or `revoke_consent_purge_failed` (any occurrence pages); generation success < 90% for 15 min; vendor spend > 80% of the monthly budget.
- Per-user monthly caps live in `lib/cost-tracking.ts`; raise them only with a matching vendor-budget review.
- Logs are structured JSON. Correlate failures using user, voice, clip, content, and Stripe event identifiers; never add raw recordings or signed URLs to logs.

## Immediate pause triggers

- Suspected cross-family access, child/voice/face data exposure, invalid consent, or deletion failure.
- Payment entitlements do not match Stripe.
- Generation success falls below 90% for 15 minutes or vendor spend becomes unbounded.

Disable generation by turning off the relevant feature flag. If the core voice path is affected, pause signups and generation at the deployment layer.

## Data requests

- Export, revocation, and deletion are available in Profile & Billing settings.
- Failed deletion attempts create an auditable lifecycle record and an operational error log. Investigate external ElevenLabs and GCS cleanup before marking resolved.
- Account deletion is complete only when authentication, database rows, private storage, and vendor voice resources are gone.

## Recovery

- Roll back application code to the last green release without rolling database migrations backward.
- Restore the database into a separate project first and verify row counts and RLS before cutover.
- Rotate affected vendor and service-role credentials after any suspected exposure.
