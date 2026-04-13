import { BookOpen, Clock, Play } from "lucide-react-native";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, shadows, spacing, typography } from "@/lib/theme";
import type { ContentItem } from "@/types/database";

import { Badge } from "./Badge";

interface StoryCardProps {
  item: ContentItem;
  onPress?: () => void;
}

export function StoryCard({ item, onPress }: StoryCardProps) {
  const { brand, palette } = useTheme();
  const minutes = item.duration_seconds
    ? Math.ceil(item.duration_seconds / 60)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.thumb,
          { backgroundColor: brand.sage + "55" },
        ]}
      >
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.thumbImg}
            resizeMode="cover"
          />
        ) : (
          <BookOpen size={42} color={brand.green + "55"} />
        )}

        <View style={styles.playOverlay}>
          <View style={styles.playPill}>
            <Play size={16} color={brand.green} />
          </View>
        </View>

        <View style={styles.topRow}>
          {item.is_premium ? (
            <View
              style={[
                styles.premiumPill,
                { backgroundColor: brand.gold },
              ]}
            >
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          ) : null}
        </View>

        {minutes ? (
          <View style={styles.durationPill}>
            <Clock size={10} color="#fff" />
            <Text style={styles.durationText}>{minutes} min</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={{
            color: palette.foreground,
            fontSize: typography.sizes.md,
            fontWeight: typography.weights.semibold,
          }}
        >
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          {item.series ? (
            <Text
              style={{
                color: palette.mutedForeground,
                fontSize: typography.sizes.xs,
              }}
              numberOfLines={1}
            >
              {item.series}
              {item.episode_number != null
                ? ` · Ep. ${item.episode_number}`
                : ""}
            </Text>
          ) : null}
          {item.age_range ? <Badge tone="sage">Ages {item.age_range}</Badge> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumb: {
    aspectRatio: 16 / 10,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playPill: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  premiumPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  premiumText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  durationPill: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  body: {
    padding: spacing.md,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
});
