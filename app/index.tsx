import { Redirect } from "expo-router";

import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { user, userData, loading } = useAuth();

  if (loading) return null;

  // NO USER
  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // USER EXISTS
  if (user && userData) {
    // ONBOARDING DONE
    if (userData.onboarding) {
      return <Redirect href="/(tabs)" />;
    }

    // TYPE NOT SELECTED
    if (!userData.type) {
      return <Redirect href="/(auth)/user-type" />;
    }

    // TYPE SELECTED
    // SALARY USER
    if (userData.type === "salary") {
      return <Redirect href="/(auth)/salary-setup" />;
    }

    // SELF EMPLOYED
    return <Redirect href="/(auth)/success" />;
  }

  return null;
}
