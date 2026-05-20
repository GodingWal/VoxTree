# Gemini Omni Face & Body Replacement — Design Doc

**Status:** Draft — design only, no implementation.
**Branch:** `claude/gemini-omni-face-swap-qIyTj`
**Author:** Generated for review.
**Depends on:** Gemini Omni developer API (not yet released — SDK shape below is speculative).

---

## 1. Goal and scope

Extend VoxTree's "swap the narrator's voice with a family member" experience to optionally swap the **on-screen narrator's face and body** with the same family member, producing a video that both *sounds* and *looks* like grandma reading to the child.

The feature targets the existing voice-replacement flow in `app/api/clips/generate` and the dashboard surface in `app/dashboard`. It does **not** introduce a generic deepfake tool — it is restricted to swapping VoxTree's curated `content_library` videos with a verified family-member identity that the uploader has consented to clone.

### In scope

- Capturing and verifying a face/body identity reference per family member.
- Calling the Gemini Omni API (once released) to render a face-and-body replacement on top of an existing curated clip.
- Storing, serving, and rate-limiting the resulting videos using the existing S3 + CloudFront + Supabase plumbing.
- Plan-tier gating and per-month usage limits.
- Moderation, audit, and takedown paths.

### Out of scope (explicitly)

- Uploading user-supplied source videos to swap into. Source video is always from `content_library`.
- Swapping a face onto a *different* person (i.e. cloning anyone other than the verified uploader). This is enforced via the consent flow in §3.
- Voice cloning UX changes — that remains ElevenLabs and is unchanged.
- Real-time / streaming generation. All renders are async batch jobs.

---

## 2. Open questions / things we cannot finalize yet

The Gemini Omni developer API has not shipped. Until it does, the following are **assumed but unverified** and the implementation plan in §6 brackets them behind a provider interface so they can change without touching the rest of the pipeline.

| Assumption | Source | What changes if wrong |
|---|---|---|
| Model name `gemini-omni-flash` and SDK call shape from the writeup. | User-provided writeup. | Provider adapter rewrites; everything else holds. |
| Omni accepts a base video + 1–3 reference images + a text directive in a single `generate_content` call. | User-provided writeup. | If Omni is async-job-based, the worker in §6.3 becomes a poll loop instead of a single call. |
| Output is a video URI / inline blob we can re-upload to S3. | User-provided writeup. | If output is streamed frames, we need ffmpeg stitching in the worker. |
| Per-clip cost is comparable to current per-clip TTS cost. | Unknown. | Plan limits in §7 will need rebalancing; expect face-swap to be the new cost driver. |
| Omni enforces SynthID watermarking and public-figure refusal on its side. | User-provided writeup. | If not, we add a content-moderation pass between Omni and our S3 bucket. |
| 8–10s clip slicing is required for temporal consistency. | User-provided writeup. | The slicer in §6.2 may become unnecessary or may need different boundaries. |

**Action:** before implementation starts, confirm each of these against the published Omni docs and update this section. Do not start coding the provider adapter until at least the call shape and async semantics are confirmed.

---

## 3. Consent & identity verification (selfie + liveness)

Face/body cloning has a fundamentally different abuse surface than voice cloning, especially in a kids'-content app. The verification model below is the gate that has to pass before any face reference is usable.

### 3.1 Principles

1. **Only the account holder can be cloned by their own account.** Other family members can have voice profiles (current behaviour), but a *face/body* profile must match the account holder's verified selfie. Cloning grandma's face requires grandma to log in as the account holder, or for the account to be co-managed (a future feature, not in this scope).
2. **Verification must be active, not declarative.** A checkbox attesting "this is me" is not sufficient. We require a live selfie capture plus a liveness signal, matched against the uploaded reference image.
3. **Re-verification on identity change.** Replacing the reference image triggers re-verification.
4. **Auditable.** Every accepted/rejected verification attempt is logged with timestamp, decision, similarity score, and the moderator (human or system) that approved it.

### 3.2 Flow

```
[Onboarding: "Add face identity"]
        │
        ▼
[ Frontend: upload reference image(s) ]    1–3 still images, jpeg/png, ≥ 720p
        │
        ▼
[ Frontend: live selfie capture ]          getUserMedia, server-issued nonce
   - Random head-pose challenges          drawn overlay: "tilt left", "blink", "say
   - 3–5s clip captured                    the word displayed on screen"
        │
        ▼
[ Backend: /api/face/verify ]
        │
        ├─► Face-match provider           verify(selfie_frames, reference_images)
        │   (AWS Rekognition CompareFaces  →  similarity 0..100
        │    or Azure Face Verify)
        │
        ├─► Liveness provider             AWS Rekognition Face Liveness or
        │                                  equivalent → confidence 0..100
        │
        ├─► Public-figure check           Optional: reverse-image search
        │                                  / known-faces classifier to refuse
        │                                  celebrities, politicians, minors.
        │                                  (Minors check is mandatory — see §8.)
        │
        ▼
[ Decision ]
   - similarity ≥ THRESHOLD_MATCH                 → status='verified'
   - liveness  ≥ THRESHOLD_LIVENESS               (thresholds chosen during
   - no public-figure / minor flag                 calibration; start at
                                                   similarity 90, liveness 80)
        │
        ▼
[ Persist face_identities row ]
   status: 'verified' | 'pending_review' | 'rejected'
   On 'pending_review' (close-but-not-clear scores), queue for manual moderation
   before becoming usable.
```

### 3.3 Failure modes and what we do about them

| Failure | Response |
|---|---|
| Reference image is of a child. | Hard reject. We do not clone minors. (Even the uploader's own child.) |
| Reference image is a known public figure. | Hard reject. |
| Selfie does not match reference. | Reject with retry-allowed, surface "the photo and the selfie don't appear to be the same person". |
| Liveness signal fails (still photo held up to camera, video replay, etc.). | Reject with retry-allowed. |
| Borderline scores. | `pending_review`; manual moderation queue; user gets an in-app status. |
| Reference image contains multiple faces. | Reject; ask for a single-subject photo. |

### 3.4 Why not a softer model

The "click-through consent only" option in the prompt was explicitly rejected because:
- The product targets children's content; identity confusion has higher harm.
- Without active liveness, a single uploaded image plus a checkbox is indistinguishable from a non-consensual deepfake workflow.
- Stripe / app store policy and likely future regulation will require this anyway.

---

## 4. Data model changes

All changes go in a new migration `supabase/migrations/003_face_swap.sql`. Nothing in the existing schema is modified destructively.

### 4.1 New tables

```sql
-- One row per verified face/body identity owned by a user.
-- An account holder may have at most N (plan-gated) — initially N=1 for everyone
-- until we have a co-managed-account model.
create table public.face_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'verified', 'rejected', 'revoked')),
  reference_image_urls text[] not null default '{}',     -- S3 URIs, 1..3
  similarity_score numeric(5,2),                          -- 0..100, from face-match
  liveness_score   numeric(5,2),                          -- 0..100, from liveness
  verified_at timestamptz,
  verified_by text,                                       -- 'auto' | moderator id
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only audit log of every verification attempt and every job that
-- consumes an identity. Required for takedown, dispute, and abuse review.
create table public.face_identity_events (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid references public.face_identities(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in (
    'verify_attempt', 'verify_accept', 'verify_reject',
    'manual_review_accept', 'manual_review_reject',
    'identity_revoked', 'render_started', 'render_completed', 'render_failed',
    'takedown_requested', 'takedown_completed'
  )),
  payload jsonb not null default '{}'::jsonb,             -- scores, provider ids, etc.
  created_at timestamptz not null default now()
);

create index idx_face_identities_user_id on public.face_identities(user_id);
create index idx_face_identity_events_identity_id on public.face_identity_events(identity_id);
create index idx_face_identity_events_user_id on public.face_identity_events(user_id);
```

### 4.2 Modifications to existing tables

```sql
-- Allow generated_clips to optionally reference a face identity. NULL means
-- voice-only swap (current behaviour, unchanged).
alter table public.generated_clips
  add column face_identity_id uuid references public.face_identities(id) on delete set null,
  add column face_swap_status text
    check (face_swap_status in ('not_requested','queued','processing','ready','failed')),
  add column face_swap_provider_job_id text;
```

Note: the cache lookup index `idx_generated_clips_cache_lookup` currently keys on `(content_id, voice_id, status)`. The cache layer in `lib/cache.ts` will need a follow-up to include `face_identity_id` in the cache key — otherwise a voice-only clip and a voice+face clip for the same content+voice would collide. This is a `cache.ts` change, not a schema change (the column is already part of the row).

### 4.3 Row-Level Security

```sql
alter table public.face_identities enable row level security;
alter table public.face_identity_events enable row level security;

create policy "Users read own identities"
  on public.face_identities for select using (auth.uid() = user_id);
create policy "Users insert own identities"
  on public.face_identities for insert with check (auth.uid() = user_id);
create policy "Users update own identities"
  on public.face_identities for update using (auth.uid() = user_id);
-- No client-side delete: revocation happens through a server route so we log it.

create policy "Users read own identity events"
  on public.face_identity_events for select using (auth.uid() = user_id);
-- Insert is server-side only (service role); no client insert policy.
```

---

## 5. Storage layout (S3)

Reuse the existing AWS bucket. New prefixes:

```
face-identities/{user_id}/{identity_id}/reference-{n}.jpg     # reference stills
face-identities/{user_id}/{identity_id}/verify-{ts}.webm      # selfie capture (TTL'd)
face-swap-renders/{user_id}/{clip_id}/segment-{n}.mp4         # per-slice Omni output
face-swap-renders/{user_id}/{clip_id}/final.mp4               # stitched final
```

Lifecycle rules:
- `verify-*.webm` selfie captures expire after 30 days. We only keep the scores, not the footage, by default.
- Reference images persist while the identity is active and are deleted on revocation.
- Final renders inherit existing `generated_clips` retention.

CloudFront serving is unchanged — the existing signed-URL helper in `lib/aws.ts` covers the new prefixes.

---

## 6. Pipeline architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                     │
│  1. Pick content from /browse                                               │
│  2. Pick a family voice (existing)                                          │
│  3. (NEW) Optionally pick a verified face_identity                          │
│  4. POST /api/clips/generate { content_id, voice_id, face_identity_id? }    │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ /api/clips/generate (existing route, extended)                              │
│  - Enforce plan limits (limits.ts: new action 'add_face_swap_clip')         │
│  - Verify face_identity belongs to user AND status='verified'               │
│  - Cache lookup (content_id, voice_id, face_identity_id)                    │
│  - If miss: enqueue render job                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Render worker (background; runs on Vercel queue, Inngest, or similar)       │
│                                                                             │
│  Step 1 — Voice replacement (existing ElevenLabs pipeline). Produces        │
│           a re-narrated video with original visuals.                        │
│                                                                             │
│  Step 2 — (NEW) Face/body replacement                                       │
│           ├─ Slice the voice-replaced video into ≤10s segments              │
│           │  (assumption from §2; revisit when Omni docs land)              │
│           ├─ For each segment: provider.swapFaceAndBody({                   │
│           │     baseVideoUri, referenceImageUris,                           │
│           │     directive: <built from segment context>                     │
│           │   })                                                            │
│           ├─ Download / collect each segment's output                       │
│           └─ Stitch with ffmpeg, preserving the Omni-generated audio        │
│             (if applicable) or re-muxing the ElevenLabs audio               │
│                                                                             │
│  Step 3 — Upload final.mp4 to S3, update generated_clips row, mark ready.   │
│                                                                             │
│  On any failure: face_swap_status='failed', log to face_identity_events,    │
│  notify the user (no partial-output exposure).                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Provider abstraction

Even though we're only planning to ship Omni, the worker should not call the Gemini SDK directly. A thin interface lets us swap providers and lets the worker run against a mock in tests:

```ts
// lib/face-swap/provider.ts  (NOT IMPLEMENTED YET — design only)
export interface FaceSwapProvider {
  swapFaceAndBody(input: {
    baseVideoUri: string;
    referenceImageUris: string[];
    directive: string;
    // Provider-specific knobs go in a typed extension, not here.
  }): Promise<{
    outputUri: string;
    providerJobId: string;
    durationMs: number;
    watermark: 'synthid' | 'none' | 'unknown';
  }>;
}
```

Implementations:
- `lib/face-swap/providers/gemini-omni.ts` — real call, gated behind `FACE_SWAP_PROVIDER=gemini-omni` env var. Stubbed until the SDK ships.
- `lib/face-swap/providers/mock.ts` — returns the input video unchanged, used in dev/test.

### 6.2 Segment slicing

If §2's assumption holds, the worker slices on silence boundaries (using the ElevenLabs alignment metadata we already have) so segment cuts don't fall mid-word. Hard ceiling of 10s per segment; if a sentence is longer than 10s, cut on the nearest pause.

### 6.3 Prompt construction

The directive sent to Omni is constructed server-side from a template, not from user input. This is deliberate:
- Removes a prompt-injection surface (a user can't ask the model to swap an arbitrary identity by typing into a text box).
- Lets us tune the prompt centrally as we learn what Omni responds to.

Template (subject to tuning):

> "Track the on-screen narrator's facial movements, expressions, body language, and clothing in this clip. Replace the narrator's face and physical features with the identity provided in the reference images. Match the existing scene lighting, shadows, and camera angle. Preserve all environmental occlusions — if the narrator passes behind an object, the replacement must respect the same occlusion. Do not change the background, other people, the audio, or any object the narrator interacts with."

The user never sees or edits this string in v1.

---

## 7. API surface

New routes (all under `app/api/`):

| Route | Method | Purpose |
|---|---|---|
| `face/identities` | `GET` | List the user's face identities and their statuses. |
| `face/identities` | `POST` | Create a draft identity row, return upload URLs for reference images. |
| `face/identities/[id]` | `DELETE` | Revoke an identity (server-side; cascades to log + S3 delete). |
| `face/verify` | `POST` | Submit selfie capture; runs face-match + liveness; returns decision. |
| `face/verify/nonce` | `GET` | Issue a one-time nonce embedded in the liveness challenge. |

Modified routes:

| Route | Change |
|---|---|
| `app/api/clips/generate` | Accepts optional `face_identity_id`; validates ownership + `status='verified'`; enqueues the face-swap step. |

No changes to the Stripe webhook or voices routes.

---

## 8. Moderation, safety, abuse response

- **Pre-render gate.** A render with a `face_identity_id` only proceeds if `status='verified'`. Revoked identities cannot render even if their id is referenced.
- **Per-user rate ceiling.** Separate from plan limits, every account has a hard ceiling on face-swap renders per day to limit blast radius if a single account is compromised. Suggested starting value: 20/day.
- **Manual review queue.** All borderline verifications and a random sample (suggested 5%) of accepted verifications go to a human reviewer dashboard (out of scope for this doc but flagged here).
- **Takedown path.** A `/report` flow on every shared clip lets external viewers flag a clip; flagged clips can be force-revoked, which deletes the S3 object and writes a `takedown_completed` event.
- **Public-figure / minor refusal.** The verification stage already refuses these; the prompt template additionally instructs Omni not to modify other people in frame. Both belt and suspenders because we're in a kids'-content product.
- **Watermarking.** We rely on Omni's SynthID. We do not strip or re-encode in a way that would destroy it. If we later need a visible watermark for shared clips, that's an additional ffmpeg overlay step.
- **Audit retention.** `face_identity_events` rows are kept for at least 1 year, separately from the user's right-to-delete on `users` (legal-hold pattern: deletion anonymizes `user_id` but preserves the event row).

---

## 9. Plan limits & billing

Add a new dimension to `lib/limits.ts`:

```ts
// Sketch only — do not commit until cost model is known.
free:    { face_identities: 0,  face_swap_clips_per_month: 0 },
family:  { face_identities: 1,  face_swap_clips_per_month: 10 },
premium: { face_identities: 1,  face_swap_clips_per_month: 50 },
```

Free tier deliberately has zero — face-swap is the expensive feature and should not be a customer acquisition channel. Numbers above are placeholders until we have Omni's per-render price.

New `Action` enum entries: `verify_face_identity`, `add_face_swap_clip`.

---

## 10. Rollout

1. **Land migration `003_face_swap.sql`** (additive only — safe to apply without code).
2. **Build the verification flow first**, behind a feature flag (`NEXT_PUBLIC_FACE_SWAP_ENABLED`). Verification can ship and be tested even without Omni — the face-match and liveness providers are independent of Omni.
3. **Wire the mock provider** into the render worker. Verify the end-to-end pipeline (DB rows, S3 layout, cache key, UI state machine) produces a "face-swapped" clip that is actually just the original.
4. **Swap in the real Omni adapter** once the SDK is available and §2's assumptions are confirmed.
5. **Internal dogfood**, then **closed beta** to a small group of paid users, then GA.

Kill switch: a single env var disables `face_identity_id` on `/api/clips/generate` (renders fall back to voice-only) and hides the face-identity UI. This must be reversible in under 5 minutes without a deploy — implement as a runtime config flag, not a build-time constant.

---

## 11. Non-goals for v1

- Letting users edit the directive prompt.
- Swapping identities mid-clip (e.g. "grandma reads the first half, grandpa reads the second").
- Swapping non-narrator characters in the scene.
- Live / real-time generation.
- User-uploaded source videos.
- Co-managed accounts where a second adult can verify their own identity inside one account. (This is the right path eventually but it's its own design.)

---

## 12. Review checklist before this becomes implementation

- [ ] Gemini Omni docs published; §2 table re-confirmed.
- [ ] Face-match provider chosen (Rekognition vs Azure vs other); thresholds calibrated on a labelled internal set.
- [ ] Liveness provider chosen; bypass tested with photo, screen-replay, and silicone-mask attacks.
- [ ] Cost per render measured; §9 limits set accordingly.
- [ ] Legal review on cloning consent language, minor refusal, and retention of `face_identity_events`.
- [ ] Takedown SLA agreed (suggested ≤24h).
- [ ] Kill-switch verified in staging.
