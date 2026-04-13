import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { Check, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { radii, shadows, spacing, typography } from "@/lib/theme";
import type { AppStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "Pricing">;
type Billing = "monthly" | "annual";

const PLANS = [
  {
    name: "Free",
    plan: null,
    monthly: "$0",
    annual: "$0",
    annualMonthly: undefined,
    period: "forever",
    features: ["1 voice profile", "2 videos", "4 stories", "No time expiration"],
    highlighted: false,
  },
  {
    name: "Family",
    plan: "family" as const,
    monthly: "$12.99",
    annual: "$99",
    annualMonthly: "$8.25",
    period: "/month",
    features: [
      "2 voice profiles",
      "Full content library",
      "Unlimited videos & stories",
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    plan: "premium" as const,
    monthly: "$22.99",
    annual: "$179",
    annualMonthly: "$14.92",
    period: "/month",
    features: [
      "Unlimited voice profiles",
      "Full content library",
      "Unlimited videos & stories",
      "Priority processing",
      "Early access to new content",
      "Offline downloads",
    ],
    highlighted: false,
  },
];

export function PricingScreen(_props: Props) {
  const { palette, brand } = useTheme();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  async function upgrade(plan: "family" | "premium") {
    setLoading(plan);
    try {
      const { url } = await api.createCheckout(plan, billing);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert(
        "Couldn't start checkout",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radii.lg,
            backgroundColor: brand.green + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={22} color={brand.green} />
        </View>
        <Text
          style={{
            fontSize: typography.sizes.xxl,
            fontWeight: typography.weights.bold,
            color: palette.foreground,
            textAlign: "center",
          }}
        >
          Simple, transparent pricing
        </Text>
        <Text
          style={{
            color: palette.mutedForeground,
            textAlign: "center",
          }}
        >
          Start free and upgrade as your family grows.
        </Text>
      </View>

      {/* Billing toggle */}
      <View
        style={[
          styles.toggle,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {(["monthly", "annual"] as const).map((b) => {
          const active = billing === b;
          return (
            <Pressable
              key={b}
              onPress={() => setBilling(b)}
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: active ? brand.green : "transparent",
                },
              ]}
            >
              <Text
                style={{
                  color: active ? "#fff" : palette.mutedForeground,
                  fontWeight: typography.weights.semibold,
                }}
              >
                {b === "monthly" ? "Monthly" : "Annual"}
              </Text>
              {b === "annual" && !active ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: brand.green,
                    fontWeight: "700",
                  }}
                >
                  Save 36%
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {PLANS.map((p) => (
          <View
            key={p.name}
            style={[
              styles.planCard,
              shadows.sm,
              {
                backgroundColor: palette.card,
                borderColor: p.highlighted ? brand.green : palette.border,
                borderWidth: p.highlighted ? 2 : 1,
              },
            ]}
          >
            {p.highlighted ? (
              <View
                style={[
                  styles.popularPill,
                  { backgroundColor: brand.green },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>
                  Most Popular
                </Text>
              </View>
            ) : null}

            <Text
              style={{
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold,
                color: palette.foreground,
              }}
            >
              {p.name}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text
                style={{
                  fontSize: typography.sizes.xxl,
                  fontWeight: typography.weights.bold,
                  color: palette.foreground,
                }}
              >
                {p.plan === null
                  ? p.monthly
                  : billing === "monthly"
                    ? p.monthly
                    : p.annual}
              </Text>
              <Text style={{ color: palette.mutedForeground }}>
                {p.plan === null
                  ? p.period
                  : billing === "monthly"
                    ? p.period
                    : "/year"}
              </Text>
            </View>
            {p.plan !== null && billing === "annual" && p.annualMonthly ? (
              <Text style={{ color: palette.mutedForeground, fontSize: 12 }}>
                ({p.annualMonthly}/mo)
              </Text>
            ) : null}

            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {p.features.map((f) => (
                <View
                  key={f}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Check size={14} color={brand.green} />
                  <Text style={{ color: palette.foreground }}>{f}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: spacing.md }}>
              {p.plan === null ? (
                <Button title="You're on Free" variant="outline" disabled />
              ) : (
                <Button
                  title={`Upgrade to ${p.name}`}
                  variant={p.highlighted ? "primary" : "outline"}
                  loading={loading === p.plan}
                  onPress={() => upgrade(p.plan!)}
                />
              )}
            </View>
          </View>
        ))}
      </View>

      <Text
        style={{
          color: palette.mutedForeground,
          textAlign: "center",
          fontSize: 12,
          marginTop: spacing.lg,
        }}
      >
        Payments are securely processed by Stripe. Manage or cancel anytime.
      </Text>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  planCard: {
    position: "relative",
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  popularPill: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
});
