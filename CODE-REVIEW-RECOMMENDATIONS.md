# VoxTree Code Review — Recommended Improvements

## Critical — Schema / Data Mismatch

### 0a. Database Schema Does Not Match Application Code
**Files:** `supabase/migrations/001_initial_schema.sql` vs `lib/limits.ts`, `types/database.ts`

The database schema and the application code expect different columns and values:

| What | Schema says | Code expects |
|------|-------------|--------------|
| Plan values | `'free', 'pro', 'family'` | `'free', 'family', 'premium'` |
| Usage columns | `clips_used_this_month`, `clips_reset_at` | `videos_used`, `stories_used` |

The `limits.ts` queries `videos_used` and `stories_used`, but these columns **do not exist** in the schema. The plan check constraint allows `'pro'` but the code uses `'premium'`. This will cause runtime errors on every limit check.

**Fix:** Add a new migration to align the schema with the code — add the missing columns and update the plan constraint.

### 0b. Missing `increment_voice_slots` RPC Function
**File:** `app/api/voices/create/route.ts:65`

```ts
await supabase.rpc("increment_voice_slots", { user_id: user.id });
```

This function is never defined in the migration. Voice creation will fail with a "function not found" error. Add it as an atomic increment function in a new migration.

### 0c. Missing `content_type` Column in Schema
**File:** `types/database.ts:4` vs `supabase/migrations/001_initial_schema.sql`

`types/database.ts` defines `ContentType = "video" | "story"` and `ContentItem.content_type`, but the `content_library` table has no `content_type` column.

---

## Critical — Security

### 1. Voice Process Endpoint Has No Authentication
**File:** `app/api/voices/process/route.ts`

The `/api/voices/process` endpoint accepts `userId` in the request body and uses a service-role Supabase client — meaning **anyone** can trigger voice processing for any user without being authenticated. This should either:
- Require authentication via `supabase.auth.getUser()` (like the other endpoints), or
- Be protected by a shared secret/API key if it's intended to be called by an internal service or webhook.

### 2. Open Redirect in OAuth Callback
**File:** `app/(auth)/callback/route.ts:7`

```ts
const next = searchParams.get("next") ?? "/dashboard";
```

The `next` parameter is taken directly from the query string and used in a redirect without validation. An attacker could craft a URL like `/callback?code=...&next=https://evil.com` to redirect users after login. Validate that `next` starts with `/` and does not contain `://`.

### 3. Expired Presigned URL Stored as Permanent Data
**File:** `app/api/voices/process/route.ts:63`

```ts
sample_audio_url: downloadUrl, // This is a presigned URL that expires in 1 hour
```

A presigned S3 URL (expires in 1 hour) is being saved to the database as the permanent `sample_audio_url`. After expiry, this URL will return 403 errors. Store the S3 key instead and generate presigned URLs on demand, or use a CloudFront URL.

### 4. Uncaught `request.json()` Errors
**Files:** All API route handlers

If a client sends malformed JSON (or no body), `request.json()` throws an unhandled error that results in a 500 with a stack trace. Wrap it in a try/catch or validate the content-type header first.

---

## High — Correctness Bugs

### 5. `checkLimit` Called with Non-Existent Action
**File:** `app/api/clips/generate/route.ts:33`

```ts
const limitCheck = await checkLimit(user.id, "generate_clip");
```

The `Action` type in `lib/limits.ts` only defines `"add_voice" | "add_video" | "add_story" | "premium_content"`. The action `"generate_clip"` doesn't exist, so `checkLimit` will always fall through to the `default` case and return `{ allowed: false, reason: "Unknown action" }`. This means **clip generation is silently blocked for all users**. Either add `"generate_clip"` to the Action type with proper limit logic, or use `"add_video"` instead.

### 6. Missing `/watch/:id` Route
**File:** `app/browse/page.tsx:33`

Browse page links to `/watch/${item.id}`, but no `app/watch/[id]/page.tsx` route exists. Every "watch" link is a 404.

---

## High — Architecture & Code Quality

### 7. Duplicated Admin Client Creation
**Files:** `lib/cache.ts`, `lib/limits.ts`, `app/api/voices/process/route.ts`, `app/api/stripe/webhook/route.ts`

The pattern of creating a Supabase admin client with service-role key is duplicated in 4 places. Extract a shared `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

### 8. TypeScript Types Not Generated from Supabase Schema
**File:** `types/database.ts`

Types are manually maintained. Use the Supabase CLI to auto-generate types from your schema:

```bash
npx supabase gen types typescript --project-id <id> > types/database.ts
```

This prevents drift between your DB schema and TypeScript types.

### 9. Unsafe Type Assertions in Dashboard
**File:** `app/dashboard/page.tsx:157-162`

```ts
(clip as Record<string, unknown>).content_library
  ? ((clip as Record<string, unknown>).content_library as Record<string, unknown>).title as string
  : "Untitled"
```

This chain of `as` casts is fragile and hard to read. Define a proper type for the joined query result and use it instead.

### 10. Duplicated Page Layout / Header
**Files:** `app/dashboard/page.tsx`, `app/browse/page.tsx`, `app/pricing/page.tsx`

The header with VoxTree branding is copied across every page. Extract a shared layout component (e.g., `app/(app)/layout.tsx`) using Next.js route groups so authenticated pages share the same shell.

### 11. Use Next.js `<Image>` Instead of `<img>`
**File:** `app/browse/page.tsx:40`

Raw `<img>` tags bypass Next.js image optimization (lazy loading, responsive sizing, WebP conversion). Use `next/image` with proper `width`/`height` or `fill` props.

---

## Medium — Missing Infrastructure

### 12. Zero Tests
No test files exist anywhere in the project. At minimum, add:
- **Unit tests** for `lib/limits.ts` (pure logic, easy to test)
- **API route tests** for the Stripe webhook signature verification
- **Integration tests** for the checkout flow

Add a test framework (Vitest or Jest) and a `test` script to `package.json`.

### 13. No CI/CD Pipeline
No `.github/workflows` directory exists. Set up at minimum:
- `npm run lint` + `npm run type-check` on every PR
- `npm run build` to catch build errors
- `npm test` once tests exist

### 14. No Rate Limiting on API Routes
API routes like `/api/voices/create` and `/api/clips/generate` call paid external services (ElevenLabs, S3). Without rate limiting, a single user could exhaust your API quota or run up costs. Consider using Vercel's rate limiting, Upstash, or middleware-based throttling.

### 15. No Error Monitoring / Logging
There's no Sentry, LogRocket, or structured logging. When the ElevenLabs API fails or a Stripe webhook is malformed, you have no visibility. The git history mentions Sentry integration in Day 1 of a 30-day plan, but it's not present in the code.

---

## Medium — Robustness

### 16. No Retry Logic for External API Calls
**Files:** `lib/elevenlabs.ts`, `lib/aws.ts`

Calls to ElevenLabs and S3 can fail transiently. A single failure currently surfaces as a 500 error. Add simple retry logic (1-2 retries with exponential backoff) for these external calls.

### 17. Stripe Webhook Missing Important Events
**File:** `app/api/stripe/webhook/route.ts`

Only three events are handled. Consider also handling:
- `customer.subscription.updated` (plan changes, renewals)
- `checkout.session.expired` (abandoned checkouts for analytics)
- `invoice.paid` (confirm successful renewal)

The `invoice.payment_failed` handler is a TODO with no implementation.

### 18. Non-Null Assertions for Environment Variables
**Files:** Throughout `lib/` and API routes

Every env var access uses `!` (e.g., `process.env.STRIPE_SECRET_KEY!`). If any are missing, you get a cryptic runtime crash. Validate all required env vars at startup and fail fast with a clear message. A simple `lib/env.ts` module with `z.object(...)` (you already have Zod) would solve this.

---

## Low — Polish

### 19. Pricing Page Checkout Errors Are Silently Swallowed
**File:** `app/pricing/page.tsx:66-78`

If the checkout API returns an error, `data.url` will be undefined and nothing happens — the user sees the button reset with no feedback. Show an error toast or message.

### 20. Browse Page Fetches All Content Without Pagination
**File:** `app/browse/page.tsx:7-10`

`select("*")` with no `.range()` will fetch every row. As the content library grows, this will cause slow page loads and high bandwidth. Add pagination or infinite scroll.

### 21. `select("*")` Used Where Specific Columns Would Suffice
**Files:** `app/dashboard/page.tsx:18`, `app/browse/page.tsx:9`

Selecting all columns transfers unnecessary data. Select only the columns you actually use in the UI.

---

## Summary — Priority Order

| # | Severity | Issue |
|---|----------|-------|
| 0a | Critical | DB schema mismatches code (wrong plan values, missing columns) |
| 0b | Critical | Missing `increment_voice_slots` RPC function |
| 0c | Critical | Missing `content_type` column in content_library |
| 1 | Critical | Unauthenticated voice process endpoint |
| 2 | Critical | Open redirect in OAuth callback |
| 5 | High | `generate_clip` action doesn't exist — clips always blocked |
| 6 | High | Missing `/watch/:id` route — 404s from browse |
| 3 | Critical | Expired presigned URL stored permanently |
| 4 | Critical | Unhandled JSON parse errors in API routes |
| 12 | High | No tests at all |
| 13 | High | No CI/CD pipeline |
| 18 | Medium | Env vars crash without useful errors |
| 7 | Medium | Duplicated admin client |
| 14 | Medium | No rate limiting on paid API calls |
| 15 | Medium | No error monitoring |
| 17 | Medium | Incomplete Stripe webhook handling |
| 9-11 | Low | Type safety, shared layouts, Image component |
| 19-21 | Low | Error feedback, pagination, select optimization |
