# VoxTree — Recommended Improvements (June 2026)

A fresh review of the codebase. The earlier `CODE-REVIEW-RECOMMENDATIONS.md` items
have largely been addressed (schema alignment, RPCs, retries, rate limiting,
webhook verification); this document covers what remains and what has emerged since.
Every item below was verified against the current code.

---

## Critical — Production safety

### 1. Simulation-mode fallbacks fail open in production

Several integrations silently degrade to fake behavior when an env var is missing,
instead of failing fast. In development this is convenient; in production a
misconfigured deploy would *appear* to work while corrupting data or skipping
security checks:

| Location | Behavior when env var is missing |
|---|---|
| `lib/elevenlabs.ts:41-47` | Returns `simulated_voice_id_<timestamp>` — fake voice IDs get persisted to the DB |
| `lib/gcp.ts:32-37, 68-74` | Returns `http://localhost:3001/api/mock/...` URLs as "presigned" upload/download URLs |
| `lib/webhook-signature.ts:36-38` | **Webhook signature verification is bypassed entirely** (`{ ok: true, simulated: true }`) |

**Fix:** Gate all simulation fallbacks on `process.env.NODE_ENV !== "production"` (or an
explicit `SIMULATION_MODE=true` flag) and `throw` otherwise. The webhook bypass is the
most important: an attacker who discovers `REPLICATE_WEBHOOK_SECRET` is unset in an
environment can forge job-completion webhooks.

### 2. Stripe checkout falls back to placeholder price IDs

`app/api/stripe/checkout/route.ts:7-16`:

```ts
family_monthly:
  process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID ?? "price_family_monthly",
```

If a price env var is missing, checkout sessions are created with a non-existent
price ID, producing a confusing Stripe API error (or worse, a collision with a real
ID). **Fix:** remove the `??` fallbacks and fail at module load with a clear message.

### 3. No startup validation of required environment variables

`.env.local.example` documents ~16 variables, but nothing verifies they're set. Each
missing var surfaces as a different downstream symptom (items 1–2 above are the
worst cases). **Fix:** add a `lib/env.ts` that validates required vars with a Zod
schema and import it from `middleware.ts` / `lib/supabase/admin.ts`, so a misconfigured
deploy fails immediately and loudly.

---

## High — Process and quality

### 4. No CI pipeline

There is no `.github/workflows` directory. The repo already has the scripts
(`npm run type-check`, `npm run lint`, `npm test`) — they just never run automatically.
**Fix:** add a GitHub Actions workflow that runs all three on every PR. This is the
single highest-leverage change in this list, since it makes every other guarantee
durable.

### 5. API routes have zero test coverage

The 8 Vitest suites in `tests/` cover lib utilities well (retry, rate limiting, cost
tracking, webhook signatures, limits), but none of the 27 API route handlers are
tested — including money-touching paths like `app/api/stripe/webhook/route.ts` and
quota-enforcing paths like `app/api/voices/create/route.ts`. Route handlers are plain
functions taking a `Request`; they can be tested with the same mocking approach
already used in `tests/limits.test.ts`. **Fix:** start with the Stripe webhook handler
(event routing, signature failure) and voice create/delete (slot limits, cleanup-on-failure
saga).

### 6. `components/voxtree-ui.tsx` — 1,492 lines under `@ts-nocheck`

The largest file in the codebase opts out of type checking entirely (line 1), so
`npm run type-check` passes vacuously over it. Several other components are also
oversized (`stories-discovery.tsx` 759 LOC, `omni-capture-modal.tsx` 610 LOC,
`twilight-ui.tsx` 553 LOC). **Fix:** split `voxtree-ui.tsx` into per-screen components,
move the inline demo data to a fixture file, and remove `@ts-nocheck`. Do this before
the file grows further.

### 7. In-memory rate limiter is ineffective on serverless/multi-instance deploys

`lib/rate-limit.ts:6` keeps counts in a per-process `Map`. On Vercel (or any
multi-instance deployment) each instance has its own map, and every cold start
resets it — so the IP-based limits protecting paid ElevenLabs/Replicate calls are
mostly decorative. The per-user limits backed by Supabase are fine. **Fix:** back the
IP limiter with Upstash Redis (or reuse the existing Supabase journal mechanism),
and treat the in-memory map as a dev-only fallback.

---

## Medium — Maintainability

### 8. `sample_audio_url` stores a key, not a URL

`app/api/voices/process/route.ts:154` stores the GCS object key (`gcpKey`) in a column
named `sample_audio_url`. That's the correct behavior (presigned URLs expire), but
the name and the `types/database.ts` typing say "URL", which invites a future bug
where someone fetches it directly. **Fix:** rename the column to `sample_audio_key`
in a migration, or at minimum document the convention in the type definition.

### 9. ESLint config is minimal

`.eslintrc.json` is just `{"extends": ["next/core-web-vitals"]}`. With strict
TypeScript already enabled, the cheap win is adding `next/typescript` and
`@typescript-eslint` recommended rules, plus `no-console` (the codebase has
`lib/logger.ts` but raw `console.warn` still appears in `lib/gcp.ts` and
`lib/elevenlabs.ts`).

### 10. Raw `<img>` tags bypass Next.js image optimization

Five files still use `<img>` instead of `next/image`:
`app/dashboard/clones/[id]/tabs-content.tsx`, `components/visual-clone-capture.tsx`,
`components/twilight-ui.tsx`, `components/twilight-layout.tsx`,
`components/lora-references-uploader.tsx`. (Blob/object-URL previews can stay as
`<img>`; remote images should migrate.)

### 11. Failed-payment notification is still a TODO

`app/api/stripe/webhook/route.ts:91` — `invoice.payment_failed` is handled but the
user is never notified. Pair this with Stripe's built-in dunning emails or a
transactional email provider (Resend is the lightest fit for this stack).

---

## Low — Housekeeping

### 12. Stale and stray files

- `test.js` at the repo root contains only `console.log("Just verifying fixes")` — delete it.
- `CODE-REVIEW-RECOMMENDATIONS.md` is now mostly stale (its items were completed in
  PR #21 and later); archive it or replace it with this document to avoid misleading
  future reviews.
- `Voice_Cloning_Architecture.pdf` (33 KB binary) duplicates the `.md` next to it;
  the markdown alone is enough in-repo.

### 13. README gaps

`README.md` covers setup but not: how to apply the `supabase/migrations/` (and that
they must run in order — the schema is broken without 002+), deployment steps, or a
pointer to `Voice_Cloning_Architecture.md`. A short "Deploying" and "Database
migrations" section would prevent the class of schema-drift bugs the old review
caught.

---

## Suggested order of attack

1. **CI workflow** (#4) — makes everything else stick.
2. **Fail-fast on missing env vars + remove production simulation fallbacks** (#1–3) — small diffs, large risk reduction; the webhook-verification bypass first.
3. **Stripe webhook + voice route tests** (#5) — protects the money paths.
4. **Distributed rate limiting** (#7) — before traffic grows.
5. **Split `voxtree-ui.tsx`** (#6) — before it gets bigger.
6. Remaining medium/low items opportunistically.
