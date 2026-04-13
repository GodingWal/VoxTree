import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronRight, LogOut, Moon, Sparkles, Sun } from "lucide-react-native";
import React from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useProfile } from "@/hooks/useProfile";
import { PLAN_LIMITS, planLabel, type Plan } from "@/lib/limits";
import { radii, spacing, typography } from "@/lib/theme";
import type { AppStackParamList, TabsParamList } from "@/navigation/types";

type Props = BottomTabScreenProps<TabsParamList, "Profile">;

export function ProfileScreen(_props: Props) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { palette, brand, scheme, setScheme } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const plan = (profile?.plan ?? "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  function confirmSignOut() {
    Alert.alert("Sign out?", "You'll need to log in again to access your voices.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  return (
    <Screen>
      <Text
        style={{
          fontSize: typography.sizes.xxl,
          fontWeight: typography.weights.bold,
          color: palette.foreground,
          marginBottom: spacing.lg,
        }}
      >
        Profile
      </Text>

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: brand.sage + "66",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: brand.green,
                fontWeight: "700",
                fontSize: typography.sizes.lg,
              }}
            >
              {(profile?.name || user?.email || "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: palette.foreground,
                fontWeight: typography.weights.semibold,
                fontSize: typography.sizes.md,
              }}
            >
              {profile?.name || user?.email?.split("@")[0] || "Signed in"}
            </Text>
            <Text style={{ color: palette.mutedForeground, fontSize: 13 }}>
              {user?.email}
            </Text>
          </View>
          <Badge tone="green">{planLabel(plan)}</Badge>
        </View>
      </Card>

      {/* Usage */}
      <Card style={{ marginTop: spacing.md }}>
        <Text
          style={{
            color: palette.foreground,
            fontWeight: typography.weights.semibold,
            marginBottom: spacing.sm,
          }}
        >
          Usage this month
        </Text>
        <Row
          label="Voice profiles"
          value={`${profile?.voice_slots_used ?? 0}${
            limits.voice_slots !== null ? ` / ${limits.voice_slots}` : ""
          }`}
        />
        <Row
          label="Videos"
          value={`${profile?.videos_used ?? 0}${
            limits.videos !== null ? ` / ${limits.videos}` : ""
          }`}
        />
        <Row
          label="Stories"
          value={`${profile?.stories_used ?? 0}${
            limits.stories !== null ? ` / ${limits.stories}` : ""
          }`}
        />
      </Card>

      <Pressable
        onPress={() => nav.navigate("Pricing")}
        style={{ marginTop: spacing.md }}
      >
        <Card>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.md,
                backgroundColor: brand.gold + "1A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={18} color={brand.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: palette.foreground,
                  fontWeight: typography.weights.semibold,
                }}
              >
                {plan === "premium" ? "Manage plan" : "Upgrade plan"}
              </Text>
              <Text style={{ color: palette.mutedForeground, fontSize: 13 }}>
                {plan === "premium"
                  ? "You're on Premium"
                  : "More voices, unlimited clips, early access."}
              </Text>
            </View>
            <ChevronRight size={18} color={palette.mutedForeground} />
          </View>
        </Card>
      </Pressable>

      <Pressable
        onPress={() => setScheme(scheme === "dark" ? "light" : "dark")}
        style={{ marginTop: spacing.md }}
      >
        <Card>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.md,
                backgroundColor: palette.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {scheme === "dark" ? (
                <Sun size={18} color={palette.foreground} />
              ) : (
                <Moon size={18} color={palette.foreground} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: palette.foreground,
                  fontWeight: typography.weights.semibold,
                }}
              >
                {scheme === "dark" ? "Light mode" : "Dark mode"}
              </Text>
              <Text style={{ color: palette.mutedForeground, fontSize: 13 }}>
                Tap to switch themes
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>

      <Pressable onPress={confirmSignOut} style={{ marginTop: spacing.md }}>
        <Card>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.md,
                backgroundColor: brand.coral + "1A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut size={18} color={brand.coral} />
            </View>
            <Text
              style={{
                color: brand.coral,
                fontWeight: typography.weights.semibold,
              }}
            >
              Sign out
            </Text>
          </View>
        </Card>
      </Pressable>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: palette.mutedForeground, fontSize: typography.sizes.sm }}>
        {label}
      </Text>
      <Text
        style={{
          color: palette.foreground,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.semibold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
