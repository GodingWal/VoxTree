import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
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

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { palette } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    const { error: err } = await signUp(email.trim(), password, name.trim());
    if (err) {
      setError(err);
    } else {
      setOk(true);
    }
    setLoading(false);
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <ChevronLeft size={18} color={palette.mutedForeground} />
            <Text style={{ color: palette.mutedForeground }}>Back</Text>
          </Pressable>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                color: palette.foreground,
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
              }}
            >
              Create your account
            </Text>
            <Text style={{ color: palette.mutedForeground }}>
              Start free — add one family voice and hear 4 stories.
            </Text>
          </View>

          {ok ? (
            <View
              style={{
                backgroundColor: palette.card,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: radii.md,
                padding: spacing.lg,
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: palette.foreground,
                  fontSize: typography.sizes.md,
                  fontWeight: typography.weights.semibold,
                }}
              >
                Check your email
              </Text>
              <Text style={{ color: palette.mutedForeground }}>
                We sent a confirmation link to {email}. Once you verify, come
                back and sign in.
              </Text>
              <Button
                title="Back to sign in"
                variant="outline"
                onPress={() => navigation.navigate("Login")}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Jane Parent"
              />
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
                placeholder="At least 8 characters"
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

              <Button title="Create account" loading={loading} onPress={onSubmit} />
            </View>
          )}
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
    gap: spacing.xl,
    justifyContent: "center",
  },
});
