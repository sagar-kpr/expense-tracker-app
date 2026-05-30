import "react-native-get-random-values";

import { Stack, router, useSegments } from "expo-router";

import { useEffect } from "react";

// import * as SplashScreen from "expo-splash-screen";

import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import { ThemeProvider } from "@/context/ThemeContext";
import { ExpenseProvider } from "../context/ExpenseContext";
import { PendingTransactionProvider } from "@/context/PendingTransactionContext";
// SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, userData, loading } = useAuth();

  const segments: any = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments?.[0] === "(auth)";

    const currentScreen = segments?.[1];

    // NO USER
    if (!user) {
      if (!inAuthGroup) {
        router.replace("/(auth)/welcome" as any);
      }

      return;
    }

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
        if (currentScreen !== "user-type") {
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
      }
    }
  }, [user, userData, loading, segments]);

  // IMPORTANT
  // WAIT FOR AUTH RESTORE
  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <ExpenseProvider>
            <PendingTransactionProvider>
              <RootNavigator />
            </PendingTransactionProvider>
          </ExpenseProvider>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
