// Design tokens mirrored from the Next.js web app's Tailwind config so that the
// mobile app looks and feels like VoxTree on the web.
//
// Web palette lives in `/tailwind.config.ts` under `theme.extend.colors.brand`.

import { Platform } from "react-native";

export const colors = {
  brand: {
    green: "#7FC4A4",     // Moss green (--moss)
    gold: "#F4B860",      // Gold lamp (--lamp)
    cream: "#F4ECDB",     // Warm paper (--paper)
    charcoal: "#0A0E1F",  // Midnight ink (--ink-0)
    coral: "#E8856C",     // Rose (--rose)
    sage: "#BFB6A2",      // Faded paper (--paper-dim)
  },
  // Light-mode tokens (warm paper theme)
  light: {
    background: "#F4ECDB",      // Warm paper
    card: "#FFFFFF",
    foreground: "#0A0E1F",      // Midnight ink text
    mutedForeground: "#7C7763",  // Paper mute
    muted: "#BFB6A2",           // Paper dim
    border: "#E5DCC6",
    primary: "#F4B860",         // Gold lamp
    primaryForeground: "#0A0E1F",
    destructive: "#E8856C",     // Rose
    success: "#7FC4A4",         // Moss
  },
  // Dark-mode tokens (Twilight prototype theme)
  dark: {
    background: "#0A0E1F",      // Midnight ink (--ink-0)
    card: "#11172B",            // Deep blue ink (--ink-1)
    foreground: "#F4ECDB",      // Warm paper (--paper)
    mutedForeground: "#BFB6A2",  // Faded paper (--paper-dim)
    muted: "#1A2240",           // Middle ink (--ink-2)
    border: "#232C50",          // Dark ink border (--ink-3)
    primary: "#F4B860",         // Gold lamp (--lamp)
    primaryForeground: "#0A0E1F",
    destructive: "#E8856C",     // Rose (--rose)
    success: "#7FC4A4",         // Moss (--moss)
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const typography = {
  // System-friendly sans stack. Loading "Inter" is optional — see App.tsx.
  fontFamily: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "System",
  }),
  sizes: {
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export type ColorScheme = "light" | "dark";

export function paletteFor(scheme: ColorScheme) {
  return colors[scheme];
}
