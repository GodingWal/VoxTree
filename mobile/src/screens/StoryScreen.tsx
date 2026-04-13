import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import {
  BookOpen,
  Mic,
  Pause,
  Play,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { radii, spacing, typography } from "@/lib/theme";
import type { AppStackParamList } from "@/navigation/types";
import type { FamilyVoice, GeneratedClip } from "@/types/database";

type Props = NativeStackScreenProps<AppStackParamList, "Story">;

export function StoryScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const { user } = useAuth();
  const { palette, brand } = useTheme();

  const [voices, setVoices] = useState<FamilyVoice[]>([]);
  const [existingClip, setExistingClip] = useState<GeneratedClip | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: item.title });
  }, [navigation, item.title]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [v, c] = await Promise.all([
      supabase
        .from("family_voices")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false }),
      supabase
        .from("generated_clips")
        .select("*")
        .eq("user_id", user.id)
        .eq("content_id", item.id)
        .in("status", ["ready", "queued", "processing"])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const readyVoices = (v.data as FamilyVoice[]) ?? [];
    setVoices(readyVoices);
    const existing = ((c.data as GeneratedClip[]) ?? [])[0] ?? null;
    setExistingClip(existing);

    if (readyVoices.length > 0) {
      setSelectedVoiceId(existing?.voice_id ?? readyVoices[0].id);
    }
    setLoading(false);
  }, [user, item.id]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.id === selectedVoiceId) ?? null,
    [voices, selectedVoiceId]
  );

  async function handleGenerate() {
    if (!selectedVoiceId) return;
    setGenerating(true);
    try {
      const { clipId } = await api.generateClip(item.id, selectedVoiceId);
      setPolling(true);

      // Poll for completion for up to ~60s.
      const started = Date.now();
      while (Date.now() - started < 60_000) {
        await new Promise((r) => setTimeout(r, 2500));
        const { data } = await supabase
          .from("generated_clips")
          .select("*")
          .eq("id", clipId)
          .single();
        const clip = data as GeneratedClip | null;
        if (clip?.status === "ready") {
          setExistingClip(clip);
          break;
        }
        if (clip?.status === "failed") {
          throw new Error("Voice generation failed. Please try again.");
        }
      }
    } catch (e) {
      Alert.alert(
        "Couldn't create the clip",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setGenerating(false);
      setPolling(false);
    }
  }

  async function togglePlay() {
    const audioUrl = existingClip?.output_audio_url;
    if (!audioUrl) return;

    if (playing && soundRef.current) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setPlaying(true);
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: audioUrl },
      { shouldPlay: true }
    );
    soundRef.current = sound;
    setPlaying(true);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        setPlaying(false);
        sound.setPositionAsync(0).catch(() => {});
      }
    });
  }

  return (
    <Screen>
      {/* Hero */}
      <View
        style={[
          styles.hero,
          { backgroundColor: brand.sage + "55" },
        ]}
      >
        <BookOpen size={44} color={brand.green} />
        {item.is_premium ? (
          <View style={{ position: "absolute", top: spacing.md, right: spacing.md }}>
            <Badge tone="gold">Premium</Badge>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.lg, gap: 6 }}>
        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: palette.foreground,
          }}
        >
          {item.title}
        </Text>
        {item.series ? (
          <Text style={{ color: palette.mutedForeground }}>
            {item.series}
            {item.episode_number != null ? ` · Ep. ${item.episode_number}` : ""}
          </Text>
        ) : null}
      </View>

      {/* Voice picker */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Text
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            color: palette.foreground,
          }}
        >
          Choose a voice
        </Text>

        {loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : voices.length === 0 ? (
          <EmptyState
            icon={<Mic size={22} color={brand.green + "AA"} />}
            title="No ready voices"
            description="Add a family voice first, then come back to listen."
            action={
              <Button
                title="Add a voice"
                size="sm"
                fullWidth={false}
                onPress={() => navigation.navigate("AddVoice")}
              />
            }
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {voices.map((v) => {
              const selected = v.id === selectedVoiceId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setSelectedVoiceId(v.id)}
                  style={[
                    styles.voicePill,
                    {
                      backgroundColor: selected
                        ? brand.green
                        : palette.card,
                      borderColor: selected ? brand.green : palette.border,
                    },
                  ]}
                >
                  <Mic size={14} color={selected ? "#fff" : brand.green} />
                  <Text
                    style={{
                      color: selected ? "#fff" : palette.foreground,
                      fontWeight: typography.weights.semibold,
                    }}
                  >
                    {v.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Playback card */}
      {voices.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          {existingClip?.status === "ready" && existingClip.output_audio_url ? (
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <Pressable
                onPress={togglePlay}
                style={[
                  styles.bigPlay,
                  { backgroundColor: brand.green },
                ]}
              >
                {playing ? (
                  <Pause size={34} color="#fff" />
                ) : (
                  <Play size={34} color="#fff" style={{ marginLeft: 3 }} />
                )}
              </Pressable>
              <Text style={{ color: palette.mutedForeground }}>
                Narrated by {selectedVoice?.name}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.pill,
                  backgroundColor: brand.gold + "22",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={28} color={brand.gold} />
              </View>
              <Text
                style={{
                  color: palette.foreground,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.semibold,
                }}
              >
                Create a personalized reading
              </Text>
              <Text
                style={{
                  color: palette.mutedForeground,
                  textAlign: "center",
                }}
              >
                We&apos;ll narrate &quot;{item.title}&quot; in {selectedVoice?.name ?? "your chosen voice"}.
              </Text>
              <Button
                title={
                  polling
                    ? "Working on it…"
                    : generating
                      ? "Starting…"
                      : "Generate clip"
                }
                onPress={handleGenerate}
                loading={generating || polling}
                disabled={!selectedVoiceId}
              />
            </View>
          )}
        </Card>
      ) : null}

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    aspectRatio: 16 / 10,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  voicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  bigPlay: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
