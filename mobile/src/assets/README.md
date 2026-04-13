# Assets

Placeholder directory. Before shipping to the App Store / Play Store, drop in:

- `icon.png` — 1024×1024 app icon (iOS + web fallback)
- `adaptive-icon.png` — 1024×1024 foreground for Android adaptive icon
- `splash.png` — 1284×2778 splash artwork
- `favicon.png` — 48×48 web favicon

Expo's `app.json` already references these paths; the bundler will warn if any
are missing. Use a tool like `npx expo-optimize` once real art is in place.
