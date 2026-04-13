import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { radii, spacing, typography } from "@/lib/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { brand, palette } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.brandBlock}>
            <View
              style={[
                styles.logoBadge,
                { backgroundColor: brand.green },
              ]}
            >
              <Sparkles size={22} color="#fff" />
            </View>
            <Text
              style={{
                color: palette.foreground,
                fontSize: typography.sizes.display,
                fontWeight: typography.weights.bold,
              }}
            >
              VoxTree
            </Text>
            <Text
              style={{
                color: palette.mutedForeground,
                fontSize: typography.sizes.md,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Hear grandma read to your kids, every bedtime.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {error ? (
              <Text
                style={{
                  color: palette.destructive,
                  fontSize: typography.sizes.sm,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Button title="Sign in" onPress={onSubmit} loading={loading} />

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
              <Text style={{ color: palette.mutedForeground }}>
                Don&apos;t have an account?
              </Text>
              <Pressable onPress={() => navigation.navigate("Signup")}>
                <Text style={{ color: palette.primary, fontWeight: "600" }}>
                  Sign up
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: palette.foreground,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
        }}
      >
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={palette.mutedForeground}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        keyboardType={props.keyboardType}
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.card,
          color: palette.foreground,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          fontSize: typography.sizes.md,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.xl,
  },
  brandBlock: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
});
