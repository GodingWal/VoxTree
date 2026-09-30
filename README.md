# VoxTree

**Your family, starring in the lesson.**

VoxTree clones an adult family member — face, voice, and body — into an avatar that replaces the master actor in Pixar-style educational videos for kids. A child doesn't just hear a story; they learn math, reading, and science from a cartoon version of mom, dad, grandma, an aunt or uncle — anyone 18 or older the family authorizes.

## How it works

1. **Capture** — An adult (18+) provides a voice sample and photo reference, and grants explicit, recorded consent.
2. **Clone** — VoxTree builds their personal avatar: a cloned voice plus a 3D character personalized from the master rig.
3. **Star** — The avatar replaces the master actor in authored, Pixar-style educational scenes.
4. **Render & deliver** — The personalized video is rendered and delivered to the family, with every asset governed by consent: export, revoke, and delete on demand.

The master-video model: artist-authored scenes are the canvas; the family's clones are the cast. Authored animation sidesteps the artifacts of fully generative video, so the result looks like a cartoon — not a deepfake filter.

### Safety by design

- Only adults (18+) can be cloned — no minor voice or face cloning, ever.
- Consent is recorded and checked at every stage: before capture, before rendering, before publishing.
- Families can export or delete their data at any time: `/api/account/export`, `/api/account/delete`, `/api/account/revoke-consent`.

## Current status

VoxTree is in active development toward a production launch. What's real today:

- **Voice pipeline (working):** voice cloning, text-to-speech narration, audio caching, plan-based usage limits, per-video cost tracking.
- **Avatar pipeline (prototype):** `workers/avatar_pipeline` — offline Blender personalization under a strict contract: bounded identity weights, artist-validated rigs, asset-ID-bound cache keys, preflight validation before any mutation. Synthetic fixtures only; not wired to any public endpoint. No photo fitting, no production base character, and no production lip-sync solver yet.
- **Consent & data lifecycle (working):** consent records, data-lifecycle requests, export/delete, verifiable parental consent.
- **App (working):** auth, dashboard, content browser, identity-capture and voice-setup wizards, Stripe subscriptions.

## Stack

- **Frontend/API:** Next.js 16 (App Router) on Vercel, React 19
- **Database/Auth/Storage:** Supabase (Postgres + Auth + Storage)
- **Media storage:** Google Cloud Storage
- **Voice:** ElevenLabs today (provider abstraction planned — F5-TTS / XTTS v2 / Chatterbox candidates)
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
  consent.ts            # Consent helpers
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

## Docs

- `Voice_Cloning_Architecture.md` — voice pipeline design
- `workers/avatar_pipeline/README.md` + `RENDERING_RULES.md` — avatar worker contract and render rules
- `PRODUCTION_LAUNCH_PLAN_30_DAYS.md` — launch checklist and release process (PRs into `main`, green CI required)
- `OPERATIONS_RUNBOOK.md` — operating the service
- `IMPROVEMENTS.md` — known gaps and suggested order of attack
