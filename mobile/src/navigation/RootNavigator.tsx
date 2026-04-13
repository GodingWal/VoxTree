import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

import { AppStack } from "./AppStack";
import { AuthStack } from "./AuthStack";
import type { AppStackParamList } from "./types";

const RootStack = createNativeStackNavigator<AppStackParamList>();

export function RootNavigator() {
  const { loading, session } = useAuth();
  const { scheme, palette } = useTheme();

  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.foreground,
          border: palette.border,
          primary: palette.primary,
        },
      }}
    >
      {session ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
