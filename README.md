# VoxTree

Hear Grandma Read to Your Kids — Every Bedtime.

VoxTree lets parents upload a family member's voice and replaces the narrator in children's educational videos with that cloned voice. Powered by ElevenLabs voice cloning and built on Next.js 14.

## Stack

- **Frontend/API:** Next.js 14 (App Router) on Vercel
- **Database/Auth:** Supabase (Postgres + Auth + Storage)
- **Media Storage:** AWS S3 + CloudFront
- **Voice Cloning:** ElevenLabs v3 API
- **Payments:** Stripe (subscriptions)
- **Styling:** Tailwind CSS + shadcn/ui

## Getting Started

1. Clone the repo and install dependencies:

```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

3. Apply the Supabase migration (`supabase/migrations/001_initial_schema.sql`) to your Supabase project.

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  (auth)/               # Login, signup, OAuth callback
  api/                  # API routes (voices, clips, stripe)
  dashboard/            # Protected dashboard
  browse/               # Content browser
  pricing/              # Pricing page
  onboarding/           # Voice setup wizard
components/ui/          # shadcn/ui components
lib/                    # Shared utilities
  supabase/             # Supabase client (browser + server + middleware)
  aws.ts                # S3 presigned URLs, CloudFront helpers
  elevenlabs.ts         # Voice cloning & TTS
  cache.ts              # Audio caching layer
  limits.ts             # Plan-based usage limits
supabase/migrations/    # Database schema & RLS policies
types/                  # TypeScript type definitions
```

## Plans & Limits

| Feature | Free | Pro ($9.99/mo) | Family ($19.99/mo) |
|---------|------|----------------|-------------------|
| Voice slots | 1 | 3 | 8 |
| Clips/month | 10 | 100 | 500 |
| Content | Basic | All | All |
