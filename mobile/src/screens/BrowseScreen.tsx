import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BookOpen } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { StoryCard } from "@/components/StoryCard";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { spacing, typography } from "@/lib/theme";
import type { AppStackParamList, TabsParamList } from "@/navigation/types";
import type { ContentItem } from "@/types/database";

type Props = BottomTabScreenProps<TabsParamList, "Browse">;

export function BrowseScreen(_props: Props) {
  const { palette, brand } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("content_library")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as ContentItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 4, marginBottom: spacing.lg }}>
        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: palette.foreground,
          }}
        >
          Stories & Content
        </Text>
        <Text style={{ color: palette.mutedForeground }}>
          Pick a story and hear it narrated in your family&apos;s voice.
        </Text>
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.id} style={styles.col}>
            <StoryCard
              item={item}
              onPress={() => nav.navigate("Story", { item })}
            />
          </View>
        ))}
      </View>

      {!loading && items.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} color={brand.green + "AA"} />}
          title="No stories yet"
          description="New content is being added all the time — check back soon!"
        />
      ) : null}

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  col: {
    width: "100%",
  },
});
