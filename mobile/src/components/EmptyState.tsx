import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { borderColor: palette.border, backgroundColor: "transparent" },
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={{
          color: palette.foreground,
          fontSize: typography.sizes.md,
          fontWeight: typography.weights.semibold,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            color: palette.mutedForeground,
            fontSize: typography.sizes.sm,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  icon: {
    marginBottom: spacing.sm,
  },
});
