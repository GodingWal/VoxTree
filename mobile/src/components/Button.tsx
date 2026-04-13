import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "gold";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  rightIcon,
  style,
  disabled,
  fullWidth = true,
  ...rest
}: ButtonProps) {
  const { brand, palette } = useTheme();

  const bg =
    variant === "primary"
      ? brand.green
      : variant === "gold"
        ? brand.gold
        : variant === "secondary"
          ? palette.muted
          : "transparent";

  const fg =
    variant === "primary" || variant === "gold"
      ? "#FFFFFF"
      : variant === "secondary"
        ? palette.foreground
        : variant === "outline"
          ? brand.green
          : palette.foreground;

  const borderColor =
    variant === "outline" ? brand.green : "transparent";

  const heightBySize = { sm: 36, md: 44, lg: 52 }[size];
  const fontSize = { sm: 13, md: 15, lg: 16 }[size];

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "outline" ? 1.5 : 0,
          height: heightBySize,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: fullWidth ? spacing.lg : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text
            style={{
              color: fg,
              fontSize,
              fontWeight: typography.weights.semibold,
            }}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: {
    marginHorizontal: 2,
  },
});
