# VoxTree Mobile

Expo React Native client for VoxTree. Shares the same Supabase backend as the
Next.js web app at the repository root, and calls the Next.js API routes for
operations that require a privileged server (voice creation, clip generation,
and Stripe checkout).

## Stack

- **Expo SDK 51** (React Native 0.74)
- **React Navigation 6** (native stack + bottom tabs)
- **Supabase JS** with `AsyncStorage` session persistence
- **expo-av** for recording and playback
- **expo-file-system** for streaming uploads to S3 presigned URLs
- **lucide-react-native** for icons

## Setup

```bash
cd mobile
npm install
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
# and EXPO_PUBLIC_API_BASE_URL (your Next.js app URL).

npm run start      # Expo dev server
npm run ios        # Open iOS simulator
npm run android    # Open Android emulator
```

## Architecture

```
mobile/
├── App.tsx                    # providers + navigator root
├── index.ts                   # entry point
├── app.json                   # Expo config, permissions, bundle ids
├── src/
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client (AsyncStorage persistence)
│   │   ├── api.ts             # Bearer-token wrapper over Next.js API
│   │   ├── theme.ts           # design tokens mirrored from Tailwind config
│   │   ├── limits.ts          # PLAN_LIMITS mirrored from /lib/limits.ts
│   │   └── config.ts          # env/app.json resolution
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Supabase session + signIn/signUp/signOut
│   │   └── ThemeContext.tsx   # light/dark palette + manual override
│   ├── components/            # Button, Card, Badge, VoiceCard, StoryCard…
│   ├── hooks/useProfile.ts    # loads the current user's profile row
│   ├── navigation/            # Auth / App stacks + bottom tabs
│   └── screens/               # Login, Signup, Dashboard, Browse, Story,
│                              # Voices, AddVoice, Pricing, Profile
```

### Auth

`AuthContext` subscribes to `supabase.auth.onAuthStateChange` and toggles
between `AuthStack` (Login/Signup) and `AppStack` (tabs + modal screens). On
successful sign-in the navigator re-renders automatically.

### Data access

Simple reads (dashboards, browse, voice list) hit Supabase directly using the
user's JWT; row-level security restricts them to the signed-in user. Writes
that need server-side validation or external service calls route through the
Next.js API with the access token forwarded as `Authorization: Bearer <jwt>`:

- `POST /api/voices/create` → creates a voice row + S3 presigned upload URL
- `POST /api/voices/process` → kicks off ElevenLabs voice cloning
- `POST /api/clips/generate` → generates a narration clip
- `POST /api/stripe/checkout` → starts a Stripe checkout session

### Voice recording flow

`AddVoiceScreen` implements a 3-step wizard:

1. **Name** — posts to `/api/voices/create`, which returns `{ voiceId, uploadUrl }`.
2. **Sample** — user records via `expo-av` or picks via `expo-document-picker`.
   The local file is streamed to S3 using `FileSystem.uploadAsync` with the
   presigned PUT URL (no buffering the whole file into memory).
3. **Process** — calls `/api/voices/process` and polls the returned status.

### Pricing / checkout

Because Stripe Checkout requires a web view, `PricingScreen` opens the hosted
checkout URL via `expo-web-browser`. Stripe's mobile-optimized page handles
Apple Pay / Google Pay automatically.

## Keeping parity with the web app

Several constants are duplicated between the web and mobile apps intentionally,
because React Native cannot directly import from the root (the bundler's module
graph is rooted at `mobile/`):

| Mobile path | Source of truth |
|---|---|
| `src/types/database.ts` | `/types/database.ts` |
| `src/lib/limits.ts` | `/lib/limits.ts` |
| `src/lib/theme.ts` (brand colors) | `/tailwind.config.ts` |

When you change the web versions, update the mobile copies to match.

## Known follow-ups

- [ ] Google OAuth sign-in (needs `expo-auth-session` + Supabase OAuth redirect URL)
- [ ] Offline downloads for Premium plan (Expo FileSystem + download queue)
- [ ] Push notifications when a clip finishes rendering
- [ ] App Store / Play Store icon and splash art (placeholders currently in `src/assets`)
