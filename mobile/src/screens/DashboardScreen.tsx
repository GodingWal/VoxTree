import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowUpRight,
  BookOpen,
  Mic,
  Play,
  Plus,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { VoiceCard } from "@/components/VoiceCard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { PLAN_LIMITS, planLabel, type Plan } from "@/lib/limits";
import { supabase } from "@/lib/supabase";
import { radii, spacing, typography } from "@/lib/theme";
import type { AppStackParamList, TabsParamList } from "@/navigation/types";
import type { FamilyVoice, GeneratedClip } from "@/types/database";

type Props = BottomTabScreenProps<TabsParamList, "Home">;

type ClipWithJoins = GeneratedClip & {
  content_library?: { title: string | null; thumbnail_url: string | null } | null;
  family_voices?: { name: string } | null;
};

export function DashboardScreen({ navigation: tabNav }: Props) {
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const { brand, palette } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [voices, setVoices] = useState<FamilyVoice[]>([]);
  const [clips, setClips] = useState<ClipWithJoins[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [v, c] = await Promise.all([
        supabase
          .from("family_voices")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("generated_clips")
          .select("*, content_library(title,thumbnail_url), family_voices(name)")
          .eq("user_id", user.id)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      setVoices((v.data as FamilyVoice[]) ?? []);
      setClips((c.data as ClipWithJoins[]) ?? []);
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [user, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];
  const voiceSlotsUsed = profile?.voice_slots_used ?? 0;
  const atVoiceLimit =
    limits.voice_slots !== null && voiceSlotsUsed >= limits.voice_slots;
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  return (
    <Screen refreshing={refreshing} onRefresh={load}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={[
              styles.logo,
              { backgroundColor: brand.green },
            ]}
          >
            <Sparkles size={14} color="#fff" />
          </View>
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.bold,
              color: palette.foreground,
            }}
          >
            VoxTree
          </Text>
        </View>
        <Badge tone="green">{planLabel(plan)} Plan</Badge>
      </View>

      {/* Welcome */}
      <View style={{ gap: 4, marginTop: spacing.lg }}>
        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: palette.foreground,
          }}
        >
          Welcome back, {firstName}
        </Text>
        <Text style={{ color: palette.mutedForeground }}>
          {voices.length === 0
            ? "Get started by adding your first family voice."
            : `You have ${voices.length} voice${voices.length !== 1 ? "s" : ""} and ${clips.length} clip${clips.length !== 1 ? "s" : ""} ready.`}
        </Text>
      </View>

      {/* Upsell banner */}
      {atVoiceLimit && plan !== "premium" ? (
        <Pressable
          onPress={() => nav.navigate("Pricing")}
          style={[
            styles.upsell,
            {
              borderColor: brand.gold + "55",
              backgroundColor: brand.gold + "15",
            },
          ]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: palette.foreground,
                fontWeight: typography.weights.semibold,
              }}
            >
              Voice profile limit reached
            </Text>
            <Text
              style={{ color: palette.mutedForeground, fontSize: typography.sizes.sm }}
            >
              {plan === "free"
                ? "Upgrade to Family for 2 voices, or Premium for unlimited."
                : "Upgrade to Premium for unlimited voice profiles."}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: spacing.md,
              paddingVertical: 8,
              backgroundColor: brand.gold,
              borderRadius: radii.md,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Upgrade</Text>
            <ArrowUpRight size={14} color="#fff" />
          </View>
        </Pressable>
      ) : null}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          icon={<Mic size={18} color={brand.green} />}
          tone={brand.green}
          value={voices.length}
          label={`Voice${voices.length !== 1 ? "s" : ""} added`}
        />
        <StatCard
          icon={<Play size={18} color={brand.coral} />}
          tone={brand.coral}
          value={clips.length}
          label={`Clip${clips.length !== 1 ? "s" : ""} ready`}
        />
        <StatCard
          icon={<Sparkles size={18} color={brand.gold} />}
          tone={brand.gold}
          value={planLabel(plan)}
          label="Plan"
        />
      </View>

      {/* Voices section */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: palette.foreground,
            }}
          >
            Family voices
          </Text>
          {!atVoiceLimit ? (
            <Button
              title="Add voice"
              size="sm"
              fullWidth={false}
              leftIcon={<Plus size={14} color="#fff" />}
              onPress={() => nav.navigate("AddVoice")}
            />
          ) : null}
        </View>

        {voices.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {voices.map((v) => (
              <VoiceCard key={v.id} voice={v} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={<Mic size={22} color={brand.green + "AA"} />}
            title="No voices yet"
            description="Add a family member's voice to get started."
            action={
              <Button
                title="Add your first voice"
                size="sm"
                fullWidth={false}
                leftIcon={<Plus size={14} color="#fff" />}
                onPress={() => nav.navigate("AddVoice")}
              />
            }
          />
        )}
      </View>

      {/* Continue listening */}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Text
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            color: palette.foreground,
          }}
        >
          Continue listening
        </Text>
        {clips.length > 0 ? (
          clips.map((clip) => (
            <Card key={clip.id}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <View
                  style={[
                    styles.clipThumb,
                    { backgroundColor: brand.sage + "55" },
                  ]}
                >
                  <Play size={18} color={brand.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: palette.foreground,
                      fontWeight: typography.weights.semibold,
                    }}
                  >
                    {clip.content_library?.title ?? "Untitled"}
                  </Text>
                  {clip.family_voices ? (
                    <Text
                      style={{
                        color: palette.mutedForeground,
                        fontSize: typography.sizes.sm,
                      }}
                    >
                      Narrated by {clip.family_voices.name}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<Play size={22} color={brand.coral + "AA"} />}
            title="No clips yet"
            description="Browse stories to create your first personalized clip."
          />
        )}
      </View>

      {/* Browse CTA */}
      <View style={{ marginTop: spacing.xl }}>
        <Pressable
          onPress={() => tabNav.navigate("Browse")}
          style={[
            styles.browseCta,
            { backgroundColor: brand.green },
          ]}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.lg,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BookOpen size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#fff",
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
              }}
            >
              Discover stories
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>
              Browse our library and hear it in your family&apos;s voice.
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string | number;
  label: string;
}) {
  const { palette } = useTheme();
  return (
    <Card style={{ flex: 1, padding: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.md,
            backgroundColor: tone + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.bold,
              color: palette.foreground,
            }}
            numberOfLines={1}
          >
            {value}
          </Text>
          <Text
            style={{ fontSize: 11, color: palette.mutedForeground }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  upsell: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  clipThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  browseCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
});
