import "react-native-get-random-values";

import { router, Stack, useSegments } from "expo-router";

import { useEffect } from "react";

import * as SplashScreen from "expo-splash-screen";

import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import { ThemeProvider } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

function RootNavigator() {
  const { user, userData, loading } = useAuth();

  const segments: any = useSegments();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const inAuthGroup = segments?.[0] === "(auth)";
  const inTabsGroup = segments?.[0] === "(tabs)";
  const currentScreen = segments?.[1];

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user || !userData) {
      if (!inAuthGroup) {
        router.replace("/(auth)/welcome");
      }
      return;
    }

    if (userData.onboarding) {
      if (!inTabsGroup) {
        router.replace("/(tabs)");
      }
      return;
    }

    if (!userData.type) {
      const allowedWhenTypeMissing = [
        "user-type",
        "salary-setup",
        "business-setup",
        "success",
      ];

      if (!allowedWhenTypeMissing.includes(currentScreen || "")) {
        router.replace("/(auth)/user-type");
      }
      return;
    }

    if (
      userData.type === "salary" &&
      !userData.onboarding &&
      !["salary-setup", "success"].includes(currentScreen || "")
    ) {
      router.replace("/(auth)/salary-setup");
      return;
    }

    if (
      userData.type !== "salary" &&
      !userData.onboarding &&
      !["business-setup", "success"].includes(currentScreen || "")
    ) {
      router.replace("/(auth)/business-setup");
    }
  }, [
    currentScreen,
    inAuthGroup,
    inTabsGroup,
    loading,
    user,
    userData,
  ]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        title: "Expense Tracker",
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
