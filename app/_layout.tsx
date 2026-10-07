import "react-native-get-random-values";
import "@/utils/ensureTextInputFocusCompat";

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
import { PendingTransactionProvider } from "@/context/PendingTransactionContext";

import { ThemeProvider } from "@/context/ThemeContext";
import { useOnboardingStore } from "@/store/useOnboardingStore";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

function RootNavigator() {
  const { user, userData, loading } = useAuth();
  const showSuccess = useOnboardingStore((state) => state.showSuccess);

  const segments: any = useSegments();

  const inAuthGroup = segments?.[0] === "(auth)";
  const inTabsGroup = segments?.[0] === "(tabs)";
  const currentScreen = inAuthGroup || inTabsGroup ? segments?.[1] : segments?.[0];
  const allowedStandaloneScreens = ["privacy", "pending-transactions"];

  useEffect(() => {
    if (loading) {
      return;
    }

<<<<<<< HEAD
    // USER EXISTS
    if (user && userData) {
      // ONBOARDING COMPLETE
      if (userData.onboarding) {
        const blockedScreens = ["welcome", "login", "user-type"];

        if (inAuthGroup && blockedScreens.includes(currentScreen || "")) {
          router.replace("/(tabs)" as any);
        }

        return;
      }

      // ONBOARDING NOT COMPLETE

      // TYPE NOT SELECTED
      if (!userData.type) {
        // Allow users to navigate to the setup screens even if `type` isn't
        // persisted yet (so they can go back). Only block other screens.
        const allowedWhenTypeMissing = [
          "user-type",
          "salary-setup",
          "business-setup",
        ];

        if (!allowedWhenTypeMissing.includes(currentScreen || "")) {
          router.replace("/(auth)/user-type" as any);
        }

        return;
      }

      // TYPE SELECTED
      if (userData.type === "salary") {
        if (currentScreen !== "salary-setup") {
          router.replace("/(auth)/salary-setup" as any);
        }

        return;
      }

      // SELF EMPLOYED
      if (currentScreen !== "business-setup") {
        router.replace("/(auth)/business-setup" as any);
=======
    if (!user || !userData) {
      if (!inAuthGroup) {
        router.replace("/(auth)/welcome");
>>>>>>> new-sms
      }
      return;
    }

    if (userData.onboarding && !showSuccess) {
      if (!inTabsGroup && !allowedStandaloneScreens.includes(currentScreen || "")) {
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
    showSuccess,
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
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Ignore splash-screen state errors in development/native reloads.
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <PendingTransactionProvider>
            <ThemeProvider>
              <RootNavigator />
            </ThemeProvider>
          </PendingTransactionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
