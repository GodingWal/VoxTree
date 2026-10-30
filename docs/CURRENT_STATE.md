# VoxTree — Current State

**Purpose:** the single, current description of what VoxTree is, what is
actually built, and what still gates a public launch. It supersedes the
pre-migration planning docs, which are archived under
`docs/archive/planning/` and kept for history only.

**Product in one line:** an adult family member's face, voice, and body
become an avatar that replaces the master actor in stylized,
artist-authored educational videos for kids — the master video is the
canvas, the family's clones are the cast.

## Architecture

- **App:** Next.js 16 (App Router), React 19, TypeScript (strict, with
  `noUnusedLocals` / `noUnusedParameters` enabled in `tsconfig.json`).
- **Database:** PostgreSQL 16 (local, `docker-compose.yml`) via Drizzle
  ORM. The ORM schema is `lib/db/schema.ts`; the database connection is
  `lib/db/index.ts`, driven by `DATABASE_URL`.
- **Auth:** Auth.js (NextAuth v5) with the Drizzle adapter —
  credentials + Google OAuth. Session helpers live in `lib/auth/`.
- **Database provisioning:** `db/init/01_schema.sql` is canonical.
  See README.md, "Database schema: init SQL is canonical", before
  touching schema — drizzle-kit is Studio/inspection only, and
  `db/migrations` does not exist by design.
- **Media:** user media lives on disk in `data/uploads` (gitignored,
  outside the web root) and is reachable only through the
  authenticated `/uploads` route (`app/uploads/[...path]/route.ts`),
  which requires a session and enforces per-file ownership; unknown
  or foreign files return 404. The one exception is a short-lived
  HMAC-signed token for the external LoRA trainer's dataset fetch.
- **Payments:** Stripe subscriptions (checkout, webhook, plan limits
  in `lib/limits.ts`, per-video cost tracking in
  `lib/cost-tracking.ts`).

## Voice pipeline

- **Engine: self-hosted Chatterbox only.** The Python service in
  `workers/chatterbox/` is the sole voice engine — clone and TTS.
  There is no hosted voice provider and no fallback engine.
- **Access path:** app code goes through the provider-neutral API in
  `lib/voice-provider.ts` (its only implementation is Chatterbox),
  which calls the service at `CHATTERBOX_SERVICE_URL`
  (default `http://localhost:8001`) via `lib/chatterbox.ts`.
- **Queue:** voice work is enqueued as rows in the `voice_jobs` table
  (`lib/voice-jobs.ts`, leased via the `lease_voice_job` SQL function)
  and consumed by the queue worker:

  ```bash
  npm run worker:voice   # tsx workers/voice/worker.ts
  ```

  The loop lives in `lib/voice-worker.ts`: lease → dispatch →
  complete/fail, polling when empty, graceful stop on SIGINT/SIGTERM.
- **Dispatch reality:** `clip_generate` is the only job type with a
  real handler (Chatterbox speech generation). `singing_train`,
  `lora_train`, and `talking_video` have no worker-side handler and
  fail permanently with a "not implemented" error instead of
  retrying forever — those flows still run inline through their own
  routes/webhooks, not through this queue.

## Consent and data model

- **Adults-only, self-consent only.** Capture is for the consenting
  adult's own voice/face/body. The consent form requires an 18+
  attestation, stored as `consent_records.adult_confirmed_at`;
  accounts that consented before the attestation existed must
  re-consent. This is an attestation, not identity/age verification.
- **Enforcement:** every route that processes a voice, face, or body
  goes through `requireActiveConsent()` in `lib/consent.ts`, which
  requires `users.consent_verified` plus an unrevoked consent record
  carrying the attestation, and fails closed on error. Webhooks and
  background cloning re-check consent before persisting results.
- **Revoke = delete.** `POST /api/account/revoke-consent` stamps
  `revoked_at`, clears `consent_verified`, logs a completed
  data-lifecycle request, and purges: provider-side voice clones are
  deleted, voice rows are neutralised, and voice media, clips, and
  consent-video proofs are deleted (best-effort per step; failures
  are logged, and the auditable `revoked_at` is the source of truth).
- **Consent-hash salt is fail-closed.** Audit digests are keyed by
  `getConsentHashSalt()` (`CONSENT_HASH_SALT`, falling back to
  `AUTH_SECRET`); in production, having neither throws instead of
  using the old public fallback. `AUTH_SECRET` itself is a required,
  ≥32-character variable in `lib/env.ts` and fails the boot in
  production when missing or short.

## What is done

- **Supabase fully removed.** Postgres + Drizzle + Auth.js replaced
  it at every call site (PR #38); the hosted migrations are gone and
  the schema lives in `db/init/01_schema.sql`. Former row-level
  security is re-expressed as application predicates in
  `lib/authz.ts`.
- **ElevenLabs fully removed.** Chatterbox is the only voice engine;
  no ElevenLabs (or other hosted voice) code path remains.
- **Dead-code cleanup merged** (PR #39): dead files, exports,
  dependencies, and unused imports/locals removed; the two remaining
  idiomatic framework parameters are underscore-prefixed so the
  `noUnusedLocals` / `noUnusedParameters` guards can stay on.
- **Hardening:**
  - Proprietary `LICENSE` added (All Rights Reserved).
  - Env validation fail-closed: `DATABASE_URL` / `AUTH_*` are in the
    `lib/env.ts` schema; `AUTH_SECRET` ≥32 chars required, and the
    consent-hash salt fallback was fixed at its real call site.
  - Voice-job queue consumer built (`lib/voice-worker.ts` +
    `workers/voice/worker.ts`, `npm run worker:voice`).
- **Avatar pipeline (prototype only):** `workers/avatar_pipeline/` —
  offline Blender personalization under a strict contract, synthetic
  fixtures only, not wired to any public endpoint. No production
  base character, photo fitting, or production lip-sync yet.
- **App surface (working):** auth, dashboard, content browser,
  identity-capture and voice-setup wizards, account export / delete /
  revoke-consent endpoints, Stripe subscriptions.

## Remaining launch gates

None of the following are done. Do not describe VoxTree as
launch-ready until each is closed or explicitly waived by the founder.

1. **First real Chatterbox clone + TTS pass on GPU hardware.**
   Real Chatterbox inference has never yet run end-to-end; it waits
   on the RTX 5090 laptop. Unit tests mock the service.
2. **Scoped legal review before public face capture** — COPPA and
   biometric-consent exposure must be reviewed for the public
   avatar/capture flow specifically (the 18+ attestation is not a
   substitute for this review or for age/identity verification).
3. **Voice worker end-to-end against live Postgres.** The queue
   consumer is built and unit-tested, but has not yet been run
   against a live database with real jobs flowing through it.
4. **Concierge pilot not yet started.** The planned first cohort is
   20–50 families, run manually/concierge-style before any public
   self-serve launch.
5. **Founder decisions still pending:** the future of simulation
   mode, and pricing confirmation. Until pricing is confirmed, the
   plan table in README.md is a draft, not a commitment.

## Running it locally

```bash
npm install
cp .env.local.example .env.local   # fill in credentials
docker compose up -d db            # Postgres 16; schema auto-applies
npm run dev                        # app on http://localhost:3000
npm run worker:voice               # voice-job queue consumer (separate shell)
```

Chatterbox runs as its own Python service — see
`workers/chatterbox/README.md` for setup and hardware notes.

## Pointers

- `README.md` — setup, stack, plans, and the canonical database
  schema decision.
- `OPERATIONS_RUNBOOK.md` — operating the service.
- `docs/architecture/` — voice and face/body cloning design docs.
- `docs/archive/planning/` — superseded pre-migration plans
  (history only; do not plan from these).
