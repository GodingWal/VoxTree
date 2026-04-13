// Design tokens mirrored from the Next.js web app's Tailwind config so that the
// mobile app looks and feels like VoxTree on the web.
//
// Web palette lives in `/tailwind.config.ts` under `theme.extend.colors.brand`.

import { Platform } from "react-native";

export const colors = {
  brand: {
    green: "#2D8B70",
    gold: "#F5A623",
    cream: "#FFF8F0",
    charcoal: "#2A2A2A",
    coral: "#E8735A",
    sage: "#A8D5BA",
  },
  // Light-mode tokens
  light: {
    background: "#FFF8F0",
    card: "#FFFFFF",
    foreground: "#2A2A2A",
    mutedForeground: "#6B7280",
    muted: "#F3F4F6",
    border: "#E5E7EB",
    primary: "#2D8B70",
    primaryForeground: "#FFFFFF",
    destructive: "#DC2626",
    success: "#16A34A",
  },
  // Dark-mode tokens
  dark: {
    background: "#0F1613",
    card: "#18211D",
    foreground: "#F5F5F5",
    mutedForeground: "#9CA3AF",
    muted: "#232B28",
    border: "#2A3431",
    primary: "#3FA98A",
    primaryForeground: "#0F1613",
    destructive: "#F87171",
    success: "#22C55E",
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
