import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";

type Tone = "green" | "gold" | "coral" | "sage" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  style?: ViewStyle;
}

export function Badge({ children, tone = "green", style }: BadgeProps) {
  const { brand, palette } = useTheme();

  const tones: Record<Tone, { bg: string; fg: string }> = {
    green: { bg: brand.green + "1A", fg: brand.green },
    gold: { bg: brand.gold + "1A", fg: brand.gold },
    coral: { bg: brand.coral + "1A", fg: brand.coral },
    sage: { bg: brand.sage + "55", fg: brand.green },
    muted: { bg: palette.muted, fg: palette.mutedForeground },
  };

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: tones[tone].bg },
        style,
      ]}
    >
      <Text
        style={{
          color: tones[tone].fg,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
});
