import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";

import { colors, paletteFor, type ColorScheme } from "@/lib/theme";

interface ThemeContextValue {
  scheme: ColorScheme;
  palette: ReturnType<typeof paletteFor>;
  brand: typeof colors.brand;
  setScheme: (scheme: ColorScheme | "system") => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [override, setOverride] = useState<ColorScheme | null>(null);

  const scheme: ColorScheme =
    override ?? (systemScheme === "dark" ? "dark" : "light");

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      palette: paletteFor(scheme),
      brand: colors.brand,
      setScheme: (next) => {
        setOverride(next === "system" ? null : next);
      },
    }),
    [scheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}
