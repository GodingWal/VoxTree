import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import {
  CheckCircle2,
  Clock,
  Mic,
  Pause,
  Play,
  XCircle,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";
import type { FamilyVoice } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { config } from "@/lib/config";

import { Card } from "./Card";

interface VoiceCardProps {
  voice: FamilyVoice;
  onPress?: () => void;
}

export function VoiceCard({ voice, onPress }: VoiceCardProps) {
  const { brand, palette } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handleToggle() {
    if (playing && soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (err) {
        console.warn("Error stopping sound:", err);
      }
      soundRef.current = null;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const baseUrl = config.apiBaseUrl || "http://localhost:3000";

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token || "";

      const localUri = `${FileSystem.documentDirectory}${voice.id}-sample.mp3`;

      // Download the synthesized voice sample (requires POST body)
      const res = await fetch(`${baseUrl}/api/voices/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ voiceId: voice.id })
      });

      if (!res.ok) {
        throw new Error("Failed to generate voice sample");
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.simulated) {
          alert("Simulation Mode: Testing voice requires an active ElevenLabs API Key. (Audio disabled)");
          setLoading(false);
          return;
        }
      }

      // Convert the binary response to base64
      const blob = await res.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            const base64 = reader.result.split(",")[1];
            resolve(base64);
          } else {
            reject(new Error("Failed to convert blob to base64"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      await FileSystem.writeAsStringAsync(localUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setPlaying(true);
      setLoading(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlaying(false);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Error playing mobile voice clone sample:", err);
      setPlaying(false);
      setLoading(false);
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

      {voice.status === "ready" ? (
        <Pressable
          onPress={handleToggle}
          disabled={loading}
          style={[
            styles.sampleBtn,
            {
              backgroundColor: brand.green + "14",
              borderColor: brand.green + "33",
              opacity: loading ? 0.6 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={brand.green} />
          ) : playing ? (
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
            {loading ? "Generating..." : playing ? "Stop sample" : "Listen to sample"}
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
