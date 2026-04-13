import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, shadows, spacing } from "@/lib/theme";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({
  children,
  padded = true,
  elevated = true,
  style,
  ...rest
}: CardProps) {
  const { palette } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          padding: padded ? spacing.lg : 0,
        },
        elevated ? shadows.sm : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
