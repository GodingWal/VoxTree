import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { spacing } from "@/lib/theme";

interface ScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  padded = true,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  ...rest
}: ScreenProps) {
  const { palette } = useTheme();

  const inner = (
    <View
      style={[
        padded ? styles.padded : null,
        { flexGrow: 1 },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: palette.background }}
    >
      {scroll ? (
        <ScrollView
          {...rest}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ flexGrow: 1 }, rest.contentContainerStyle]}
          refreshControl={
            onRefresh !== undefined ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={palette.primary}
              />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  padded: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
