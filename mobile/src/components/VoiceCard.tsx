import { Audio } from "expo-av";
import {
  CheckCircle2,
  Clock,
  Mic,
  Pause,
  Play,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";
import type { FamilyVoice } from "@/types/database";

import { Card } from "./Card";

interface VoiceCardProps {
  voice: FamilyVoice;
  onPress?: () => void;
}

export function VoiceCard({ voice, onPress }: VoiceCardProps) {
  const { brand, palette } = useTheme();
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handleToggle() {
    if (!voice.sample_audio_url) return;

    if (playing && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlaying(false);
      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: voice.sample_audio_url },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch {
      setPlaying(false);
    }
  }

  const statusMeta =
    voice.status === "ready"
      ? { Icon: CheckCircle2, color: palette.success, label: "Ready" }
      : voice.status === "processing"
        ? { Icon: Clock, color: brand.gold, label: "Processing" }
        : { Icon: XCircle, color: brand.coral, label: "Error" };

  const StatusIcon = statusMeta.Icon;

  return (
    <Card>
      <Pressable onPress={onPress} style={styles.row}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: brand.sage + "66" },
          ]}
        >
          <Mic size={18} color={brand.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: palette.foreground,
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.semibold,
            }}
            numberOfLines={1}
          >
            {voice.name}
          </Text>
          <View style={styles.statusRow}>
            <StatusIcon size={12} color={statusMeta.color} />
            <Text
              style={{
                color: statusMeta.color,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.medium,
              }}
            >
              {statusMeta.label}
            </Text>
          </View>
        </View>
      </Pressable>

      {voice.status === "ready" && voice.sample_audio_url ? (
        <Pressable
          onPress={handleToggle}
          style={[
            styles.sampleBtn,
            {
              backgroundColor: brand.green + "14",
              borderColor: brand.green + "33",
            },
          ]}
        >
          {playing ? (
            <Pause size={14} color={brand.green} />
          ) : (
            <Play size={14} color={brand.green} />
          )}
          <Text
            style={{
              color: brand.green,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.semibold,
            }}
          >
            {playing ? "Stop sample" : "Listen to sample"}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  sampleBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 8,
  },
});
