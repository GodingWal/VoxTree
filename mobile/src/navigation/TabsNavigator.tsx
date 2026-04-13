import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BookOpen, Home, Mic, User } from "lucide-react-native";
import React from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { BrowseScreen } from "@/screens/BrowseScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { VoicesScreen } from "@/screens/VoicesScreen";

import type { TabsParamList } from "./types";

const Tab = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  const { palette } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.mutedForeground,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: palette.border,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Browse"
        component={BrowseScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Voices"
        component={VoicesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Mic color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
