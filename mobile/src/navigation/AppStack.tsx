import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { AddVoiceScreen } from "@/screens/AddVoiceScreen";
import { PricingScreen } from "@/screens/PricingScreen";
import { StoryScreen } from "@/screens/StoryScreen";

import { TabsNavigator } from "./TabsNavigator";
import type { AppStackParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Tabs"
        component={TabsNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Story"
        component={StoryScreen}
        options={{ title: "Story" }}
      />
      <Stack.Screen
        name="AddVoice"
        component={AddVoiceScreen}
        options={{ title: "Add a voice", presentation: "modal" }}
      />
      <Stack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{ title: "Upgrade" }}
      />
    </Stack.Navigator>
  );
}
