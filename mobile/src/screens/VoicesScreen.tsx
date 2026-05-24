import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Mic, Plus, Music, User as UserIcon, Activity, AlertTriangle } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View, ScrollView, Pressable, StyleSheet } from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { VoiceCard } from "@/components/VoiceCard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { PLAN_LIMITS, type Plan } from "@/lib/limits";
import { supabase } from "@/lib/supabase";
import { radii, spacing, typography } from "@/lib/theme";
import type { AppStackParamList, TabsParamList } from "@/navigation/types";
import type { FamilyVoice } from "@/types/database";

type Props = BottomTabScreenProps<TabsParamList, "Voices">;

type Tab = "voice" | "singing" | "face" | "body";

export function VoicesScreen(_props: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { palette, brand } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [voices, setVoices] = useState<FamilyVoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("voice");

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("family_voices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setVoices((data as FamilyVoice[]) ?? []);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];
  const used = profile?.voice_slots_used ?? 0;
  const atLimit = limits.voice_slots !== null && used >= limits.voice_slots;

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: spacing.md }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}
    >
      {[
        { id: "voice", label: "Reading", icon: Mic },
        { id: "singing", label: "Singing", icon: Music },
        { id: "face", label: "Face", icon: UserIcon },
        { id: "body", label: "Body", icon: Activity },
      ].map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as Tab)}
            style={[
              styles.tab,
              {
                backgroundColor: isActive ? brand.green : palette.card,
                borderColor: isActive ? brand.green : palette.border,
              },
            ]}
          >
            <Icon size={16} color={isActive ? "#fff" : palette.mutedForeground} />
            <Text
              style={{
                color: isActive ? "#fff" : palette.mutedForeground,
                fontWeight: typography.weights.medium,
                fontSize: 14,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Screen refreshing={refreshing} onRefresh={load} noPaddingX>
      <View style={{ paddingHorizontal: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
                color: palette.foreground,
              }}
            >
              My Clones
            </Text>
            <Text style={{ color: palette.mutedForeground }}>
              Manage your digital likeness
            </Text>
          </View>
        </View>

        {atLimit && plan !== "premium" && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: 12,
              backgroundColor: brand.gold + "15",
              borderColor: brand.gold + "55",
              borderWidth: 1,
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ color: palette.foreground, fontWeight: "600" }}>
              Clone limit reached
            </Text>
            <Text style={{ color: palette.mutedForeground, marginTop: 4 }}>
              Upgrade your plan to unlock more slots.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="See plans"
                variant="gold"
                onPress={() => nav.navigate("Pricing")}
              />
            </View>
          </View>
        )}
      </View>

      {renderTabs()}

      <View style={{ paddingHorizontal: spacing.md }}>
        {activeTab === "voice" && (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ color: palette.mutedForeground, marginBottom: spacing.sm }}>
                {limits.voice_slots === null
                  ? `${used} voice${used !== 1 ? "s" : ""} · Unlimited`
                  : `${used} of ${limits.voice_slots} used`}
              </Text>
              {!atLimit && (
                <Button
                  title="Add a reading voice"
                  leftIcon={<Plus size={16} color="#fff" />}
                  onPress={() => nav.navigate("AddVoice")}
                />
              )}
            </View>

            {voices.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                {voices.map((v) => (
                  <VoiceCard key={v.id} voice={v} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon={<Mic size={26} color={brand.green + "AA"} />}
                title="No clones yet"
                description="Add a family member's voice to start reading stories."
              />
            )}
          </>
        )}

        {activeTab === "singing" && (
          <View style={{ gap: spacing.md }}>
            <View style={{ padding: spacing.md, backgroundColor: brand.gold + "15", borderRadius: radii.md, borderColor: brand.gold + "33", borderWidth: 1 }}>
              <Text style={{ color: palette.foreground, fontWeight: "600", marginBottom: 4 }}>Singing Voices Require a Custom Model</Text>
              <Text style={{ color: palette.mutedForeground, fontSize: 13, lineHeight: 18 }}>
                Unlike reading, true singing requires an advanced model trained on 5 to 10 minutes of clean audio to capture pitch and vibrato.
              </Text>
            </View>

            {voices.length > 0 ? (
              voices.map((v) => (
                <View key={v.id} style={{ padding: spacing.md, backgroundColor: palette.card, borderRadius: radii.md, borderWidth: 1, borderColor: palette.border }}>
                  <Text style={{ fontWeight: "600", color: palette.foreground, marginBottom: spacing.sm }}>{v.name}</Text>
                  
                  {v.rvc_training_status === 'ready' ? (
                    <Text style={{ color: brand.green, fontWeight: "500" }}>✓ Singing Model Ready</Text>
                  ) : v.rvc_training_status === 'processing' ? (
                    <Text style={{ color: brand.gold, fontWeight: "500" }}>Training in progress (~30m)...</Text>
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      <Text style={{ color: palette.mutedForeground, fontSize: 13 }}>Not trained for singing.</Text>
                      {/* Using the website for heavy uploads as per open questions for now */}
                      <Text style={{ color: brand.green, fontSize: 13, fontWeight: "500" }}>Please visit the VoxTree website to upload your 5+ minute singing dataset.</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Music size={26} color={brand.green + "AA"} />}
                title="No clones yet"
                description="Create a standard reading voice first, then train it to sing."
              />
            )}
          </View>
        )}

        {activeTab === "face" && (
          <View style={{ padding: spacing.xl, alignItems: "center", backgroundColor: palette.card, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border }}>
            <UserIcon size={48} color={brand.green} style={{ marginBottom: spacing.md }} />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: palette.foreground, marginBottom: spacing.sm }}>Face Cloning</Text>
            <View style={{ backgroundColor: brand.green + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: spacing.md }}>
              <Text style={{ color: brand.green, fontSize: 10, fontWeight: "bold", textTransform: "uppercase" }}>Coming Soon</Text>
            </View>
            <Text style={{ textAlign: "center", color: palette.mutedForeground, lineHeight: 22 }}>
              We are working hard to bring you the ability to clone your face for an even more immersive educational experience.
            </Text>
          </View>
        )}

        {activeTab === "body" && (
          <View style={{ padding: spacing.xl, alignItems: "center", backgroundColor: palette.card, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border }}>
            <Activity size={48} color={brand.green} style={{ marginBottom: spacing.md }} />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: palette.foreground, marginBottom: spacing.sm }}>Body Cloning</Text>
            <View style={{ backgroundColor: brand.green + "22", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: spacing.md }}>
              <Text style={{ color: brand.green, fontSize: 10, fontWeight: "bold", textTransform: "uppercase" }}>Coming Soon</Text>
            </View>
            <Text style={{ textAlign: "center", color: palette.mutedForeground, lineHeight: 22 }}>
              In the future, you'll be able to create full-body avatars that can move, dance, and interact in our educational videos.
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
