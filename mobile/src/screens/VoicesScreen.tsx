import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Mic, Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { VoiceCard } from "@/components/VoiceCard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { PLAN_LIMITS, type Plan } from "@/lib/limits";
import { supabase } from "@/lib/supabase";
import { spacing, typography } from "@/lib/theme";
import type { AppStackParamList, TabsParamList } from "@/navigation/types";
import type { FamilyVoice } from "@/types/database";

type Props = BottomTabScreenProps<TabsParamList, "Voices">;

export function VoicesScreen(_props: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { palette, brand } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [voices, setVoices] = useState<FamilyVoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <Screen refreshing={refreshing} onRefresh={load}>
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
            Your voices
          </Text>
          <Text style={{ color: palette.mutedForeground }}>
            {limits.voice_slots === null
              ? `${used} voice${used !== 1 ? "s" : ""} · Unlimited`
              : `${used} of ${limits.voice_slots} used`}
          </Text>
        </View>
      </View>

      {atLimit ? (
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
            You&apos;ve used every voice slot on your plan
          </Text>
          <Text style={{ color: palette.mutedForeground, marginTop: 4 }}>
            Upgrade to add more family members.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="See plans"
              variant="gold"
              onPress={() => nav.navigate("Pricing")}
            />
          </View>
        </View>
      ) : (
        <Button
          title="Add a voice"
          leftIcon={<Plus size={16} color="#fff" />}
          onPress={() => nav.navigate("AddVoice")}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {voices.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          {voices.map((v) => (
            <VoiceCard key={v.id} voice={v} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Mic size={26} color={brand.green + "AA"} />}
          title="No voices yet"
          description="Add a family member's voice to start creating clips."
        />
      )}

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}
