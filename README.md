# VoxTree

**Your family, starring in the lesson.**

VoxTree is building toward a product where an adult family member's face, voice, and body become an avatar that replaces the master actor in stylized educational videos for kids. The intended adult-only avatar policy requires age verification and capture enforcement before launch.

## How it works

The planned avatar experience is:

1. **Capture** — An adult (18+) provides a voice sample and photo reference after authorization and recorded consent.
2. **Clone** — VoxTree builds a cloned voice and a 3D character personalized from the master rig.
3. **Star** — The avatar replaces the master actor in authored, stylized educational scenes.
4. **Render & deliver** — The personalized video is rendered and delivered to the family, subject to consent and data controls.

The master-video model: artist-authored scenes are the canvas; the family's clones are the cast. Authored animation sidesteps the artifacts of fully generative video, so the result looks like a cartoon — not a deepfake filter.

### Safety by design

- Adult-only capture: the consent form requires an 18+ attestation (stored as `consent_records.adult_confirmed_at`) and no longer authorizes processing minors. This is an attestation, not identity/age verification; add that before a public avatar launch.
- Every route that processes a voice, face, or body goes through `requireActiveConsent()` (`lib/consent.ts`); Replicate/LoRA webhooks re-check consent before marking a model ready, and background voice cloning re-checks before persisting. `tests/consent-guard.test.ts` enforces this per route.
- Account data export, deletion, and consent revocation endpoints exist at `/api/account/export`, `/api/account/delete`, and `/api/account/revoke-consent`. Export returns database records plus expiring signed links to stored media (voice samples, clips, consent video).

## Current status

VoxTree is in active development toward a production launch. What's real today:

- **Voice pipeline (working):** voice cloning, text-to-speech narration, audio caching, plan-based usage limits, per-video cost tracking.
- **Avatar pipeline (prototype):** `workers/avatar_pipeline` — offline Blender personalization under a strict contract: bounded identity weights, artist-validated rigs, asset-ID-bound cache keys, preflight validation before any mutation. Synthetic fixtures only; not wired to any public endpoint. No photo fitting, no production base character, and no production lip-sync solver yet.
- **Consent & data lifecycle (partial):** consent records, data-lifecycle requests, database export/delete, and verifiable parental consent; the gaps above remain before avatar launch.
- **App (working):** auth, dashboard, content browser, identity-capture and voice-setup wizards, Stripe subscriptions.

## Stack

- **Frontend/API:** Next.js 16 (App Router) on Vercel, React 19
- **Database/Auth/Storage:** Supabase (Postgres + Auth + Storage)
- **Media storage:** Google Cloud Storage
- **Voice:** ElevenLabs today behind `lib/voice-provider.ts` (select with `VOICE_PROVIDER`; add — F5-TTS / XTTS v2 / Chatterbox as new implementations)
- **Video/render:** Blender avatar pipeline + RenderMan worker (prototype); Hedra / Replicate for hosted rendering
- **Payments:** Stripe (subscriptions)
- **Styling:** Tailwind CSS + shadcn/ui
- **Tests:** Vitest (unit), Playwright (e2e smoke)

## Getting Started

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

3. Apply the Supabase migrations **in order** (`supabase/migrations/` — the schema is broken without 002+).

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful scripts: `npm run type-check`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  (auth)/               # Login, signup, OAuth callback
  api/                  # API routes (voices, clips, account, stripe, health)
  dashboard/            # Protected dashboard
  browse/               # Content browser
  pricing/              # Pricing page
  onboarding/           # Identity capture & voice setup wizard
components/             # UI components (shadcn/ui + product components)
lib/                    # Shared server utilities
  supabase/             # Supabase clients (browser + server + middleware)
  elevenlabs.ts         # Voice cloning & TTS (ElevenLabs)
  hedra.ts              # Hosted video generation (Hedra)
  replicate.ts          # Hosted model inference (Replicate)
  voice-jobs.ts         # Voice job orchestration
  consent.ts            # Consent guard (requireActiveConsent)
  voice-provider.ts     # Provider-neutral voice API (ElevenLabs adapter)
  cost-tracking.ts      # Per-video cost accounting
  cache.ts              # Audio caching layer
  limits.ts             # Plan-based usage limits
  rate-limit.ts retry.ts webhook-signature.ts
workers/
  avatar_pipeline/      # Blender avatar personalization prototype (Python)
supabase/migrations/    # Database schema & RLS policies (run in order)
tests/                  # Vitest suites
types/                  # TypeScript type definitions
```

## Plans & Limits

| Feature | Free | Pro ($9.99/mo) | Family ($19.99/mo) |
|---------|------|----------------|-------------------|
| Voice slots | 1 | 3 | 8 |
| Clips/month | 10 | 100 | 500 |
| Content | Basic | All | All |

## Database migrations

Apply `supabase/migrations/*.sql` **in numeric order** against every environment (`supabase db push`, or run each file in the SQL editor). Migrations are idempotent and are never rolled back with app rollbacks. `tests/migrations-integrity.test.ts` guards ordering and gaps.

## Deploying

1. Set every variable from `.env.local.example` in the Vercel project (`lib/env.ts` fails the boot in production if one is missing; `SIMULATION_MODE` must not be `true`).
2. Apply new migrations first, then deploy (`main` deploys after green CI).
3. Register the Stripe webhook (`/api/stripe/webhook`) and Replicate webhooks (`/api/webhooks/replicate`, `/api/avatar/train/webhook`); both Replicate endpoints verify `REPLICATE_WEBHOOK_SECRET` signatures.
4. Smoke-check `GET /api/health`, then follow `OPERATIONS_RUNBOOK.md`.

## Docs

- `docs/architecture/Voice_Cloning_Architecture.md` — voice pipeline design
- `docs/architecture/Face_Body_Cloning_Architecture.md` and `docs/architecture/VOXTREE_VISUAL_STYLE_GUIDE.md` — avatar architecture and visual style
- `workers/avatar_pipeline/README.md` + `RENDERING_RULES.md` — avatar worker contract and render rules
- `docs/planning/PRODUCTION_LAUNCH_PLAN_30_DAYS.md` — launch checklist and release process (PRs into `main`, green CI required)
- `OPERATIONS_RUNBOOK.md` — operating the service
- `IMPROVEMENTS.md` — known gaps and suggested order of attack
