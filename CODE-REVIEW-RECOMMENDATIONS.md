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

This function is never defined in the migration. Voice creation will fail with a "function not found" error. Add it as an atomic increment function in a new migration.

### 0c. Missing `content_type` Column in Schema
**File:** `types/database.ts:4` vs `supabase/migrations/001_initial_schema.sql`

`types/database.ts` defines `ContentType = "video" | "story"` and `ContentItem.content_type`, but the `content_library` table has no `content_type` column.

---

## Critical — Security

### 1. Expired Presigned URL Stored as Permanent Data
**File:** `app/api/voices/process/route.ts:63`

A presigned S3 URL (expires in 1 hour) is being saved to the database as the permanent `sample_audio_url`. After expiry, this URL will return 403 errors. Store the S3 key instead and generate presigned URLs on demand, or use a CloudFront URL.

### 2. Uncaught `request.json()` Errors
**Files:** All API route handlers

If a client sends malformed JSON (or no body), `request.json()` throws an unhandled error that results in a 500 with a stack trace. Wrap it in a try/catch or validate the content-type header first.

### 3. Missing Rate Limiting on API Routes
API routes like `/api/voices/create` and `/api/clips/generate` call paid external services (ElevenLabs, S3). Without rate limiting, a single user could exhaust your API quota.

---

## High — UI/UX Bugs

### 4. Missing Error Feedback on Checkout
**File:** `app/pricing/page.tsx`
Checkout errors are silently swallowed. If the API returns an error, no feedback is given to the user.

---

## High — Architecture & Code Quality

### 5. Duplicated Admin Client Code
**Files:** multiple locations in `app/api` and `lib`

The admin client setup is duplicated. Create a single `createAdminClient` utility.

### 6. Use Next.js `<Image>` Instead of `<img>`
**File:** `app/browse/page.tsx`, `components/story-player.tsx`

Raw `<img>` tags bypass Next.js image optimization (lazy loading, responsive sizing, WebP conversion). Use `next/image` with proper `width`/`height` or `fill` props.

---

## Medium — Robustness

### 7. No Retry Logic for External API Calls
**Files:** `lib/elevenlabs.ts`, `lib/aws.ts`

Calls to ElevenLabs and S3 can fail transiently. A single failure currently surfaces as a 500 error. Add simple retry logic.

### 8. Stripe Webhook Missing Important Events
**File:** `app/api/stripe/webhook/route.ts`

Only three events are handled. Consider also handling `customer.subscription.updated` and `invoice.paid`.
