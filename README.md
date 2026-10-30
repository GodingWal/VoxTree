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
- **Database/Auth:** PostgreSQL 16 (local, `docker-compose.yml`) via Drizzle ORM; Auth.js (NextAuth v5) — credentials + Google OAuth
- **Local media:** `data/uploads`, served only through the authenticated `/uploads` route
- **Media storage:** Google Cloud Storage
- **Voice:** Self-hosted [Chatterbox](https://github.com/resemble-ai/chatterbox) service (`workers/chatterbox/`, the only voice engine) behind `lib/voice-provider.ts`; the app reaches it at `CHATTERBOX_SERVICE_URL` (default `http://localhost:8001`)
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

3. Start local Postgres — the schema applies automatically on a fresh volume:

```bash
docker compose up -d db
```

4. Start the Chatterbox voice service (voice cloning/TTS runs locally; see
   `workers/chatterbox/README.md` for env vars and hardware notes — a GPU is
   strongly recommended, CPU works slowly):

```bash
python3 -m venv workers/chatterbox/.venv
workers/chatterbox/.venv/bin/pip install -r workers/chatterbox/requirements.txt
workers/chatterbox/.venv/bin/python workers/chatterbox/server.py
```

5. Start the dev server:

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
  auth/                 # Auth.js setup, session helpers, password reset
  db/                   # Drizzle schema + Postgres connection
  authz.ts              # App-level authorization predicates (former RLS)
  chatterbox.ts         # Voice cloning & TTS client (self-hosted Chatterbox service)
  hedra.ts              # Hosted video generation (Hedra)
  replicate.ts          # Hosted model inference (Replicate)
  voice-jobs.ts         # Voice job orchestration
  consent.ts            # Consent guard (requireActiveConsent)
  voice-provider.ts     # Provider-neutral voice API (Chatterbox implementation)
  cost-tracking.ts      # Per-video cost accounting
  cache.ts              # Audio caching layer
  limits.ts             # Plan-based usage limits
  rate-limit.ts retry.ts webhook-signature.ts
workers/
  avatar_pipeline/      # Blender avatar personalization prototype (Python)
  chatterbox/           # Self-hosted Chatterbox voice service (Python)
db/init/                # Local Postgres schema (single ported file, auto-applied by compose)
tests/                  # Vitest suites
types/                  # TypeScript type definitions
```

## Plans & Limits

| Feature | Free | Pro ($9.99/mo) | Family ($19.99/mo) |
|---------|------|----------------|-------------------|
| Voice slots | 1 | 3 | 8 |
| Clips/month | 10 | 100 | 500 |
| Content | Basic | All | All |

## Database

The schema ships as a single file, `db/init/01_schema.sql` (ported from the former hosted migrations 001–018), and docker-compose applies it automatically on a fresh volume. The row-level-security policies the hosted schema enforced are re-expressed as application-level predicates in `lib/authz.ts` (full inventory in `db/rls-policy-map.md`). The DDL is idempotent and is never rolled back with app rollbacks. `tests/migrations-integrity.test.ts` guards schema completeness and the consent semantics of the port.

### Database schema: init SQL is canonical

- **`db/init/01_schema.sql` is the single source of truth for a fresh database.** It is the file docker-compose applies at compose init (`db/init/` is mounted as `/docker-entrypoint-initdb.d`), and `tests/migrations-integrity.test.ts` pins its contents.
- **drizzle-kit is used for Studio/inspection against `lib/db/schema.ts` only** (e.g. `npm run db:studio`). `lib/db/schema.ts` is the Drizzle ORM view of the same schema the app queries through — it does not provision anything.
- **Do NOT run `npm run db:generate` expecting migrations to be the provisioning path.** `drizzle.config.ts` points `out` at `./db/migrations`, but that directory does not exist by design, and no `db:migrate` run creates a fresh VoxTree database. The `db:generate` / `db:migrate` scripts in `package.json` are not the schema workflow.
- **Making a schema change:** edit `db/init/01_schema.sql` AND `lib/db/schema.ts` together, in the same change, and update `tests/migrations-integrity.test.ts` to pin the new shape. A change to only one of the two files leaves the provisioned database and the ORM schema describing different databases.

## Deploying

1. Set every variable from `.env.local.example` in the Vercel project (`lib/env.ts` fails the boot in production if one is missing; `SIMULATION_MODE` must not be `true`).
2. Apply schema changes first, then deploy (`main` deploys after green CI).
3. Register the Stripe webhook (`/api/stripe/webhook`) and Replicate webhooks (`/api/webhooks/replicate`, `/api/avatar/train/webhook`); both Replicate endpoints verify `REPLICATE_WEBHOOK_SECRET` signatures.
4. Smoke-check `GET /api/health`, then follow `OPERATIONS_RUNBOOK.md`.

## Docs

- `docs/architecture/Voice_Cloning_Architecture.md` — voice pipeline design
- `docs/architecture/Face_Body_Cloning_Architecture.md` and `docs/architecture/VOXTREE_VISUAL_STYLE_GUIDE.md` — avatar architecture and visual style
- `workers/avatar_pipeline/README.md` + `RENDERING_RULES.md` — avatar worker contract and render rules
- `docs/CURRENT_STATE.md` — current architecture, what is done, and the remaining launch gates
- `OPERATIONS_RUNBOOK.md` — operating the service
- `docs/archive/planning/PRODUCTION_LAUNCH_PLAN_30_DAYS.md` and `docs/archive/planning/IMPROVEMENTS.md` — archived, superseded pre-migration planning docs (history only)
