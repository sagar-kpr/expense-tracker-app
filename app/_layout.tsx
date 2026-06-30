import "react-native-get-random-values";

import { Redirect, Stack, useSegments } from "expo-router";

import { useEffect } from "react";

import * as SplashScreen from "expo-splash-screen";

import "react-native-reanimated";

import { Image, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/context/AuthContext";

import { PendingTransactionProvider } from "@/context/PendingTransactionContext";
import { SalaryProvider } from "@/context/SalaryContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ExpenseProvider } from "../context/ExpenseContext";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

function LoadingSplash() {
  return (
    <View style={styles.splashContainer}>
      <Image
        source={require("../assets/images/newicon.png")}
        resizeMode="contain"
        style={styles.splashImage}
      />
    </View>
  );
}

function RootNavigator() {
  const { user, userData, loading } = useAuth();

  const segments: any = useSegments();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    if (Platform.OS === "web") {
      return <LoadingSplash />;
    }

    return null;
  }

  const inAuthGroup = segments?.[0] === "(auth)";
  const inTabsGroup = segments?.[0] === "(tabs)";
  const atRoot = !segments?.[0];
  const currentScreen = segments?.[1];

  if (!user && !inAuthGroup) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user && userData) {
    if (userData.onboarding) {
      const blockedScreens = ["welcome", "login", "user-type"];

      if (
        atRoot ||
        (inAuthGroup && blockedScreens.includes(currentScreen || ""))
      ) {
        return <Redirect href="/(tabs)" />;
      }
    } else if (!userData.type) {
      const allowedWhenTypeMissing = [
        "user-type",
        "salary-setup",
        "business-setup",
      ];

      if (!allowedWhenTypeMissing.includes(currentScreen || "")) {
        return <Redirect href="/(auth)/user-type" />;
      }
    } else if (userData.type === "salary") {
      if (currentScreen !== "salary-setup") {
        return <Redirect href="/(auth)/salary-setup" />;
      }
    } else if (currentScreen !== "business-setup") {
      return <Redirect href="/(auth)/business-setup" />;
    }
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        title: "Expense Tracker",
      }}
    />
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    flex: 1,
    justifyContent: "center",
  },
  splashImage: {
    height: 220,
    width: 220,
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <ThemeProvider>
            <ExpenseProvider>
              <SalaryProvider>
                <PendingTransactionProvider>
                  <RootNavigator />
                </PendingTransactionProvider>
              </SalaryProvider>
            </ExpenseProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
