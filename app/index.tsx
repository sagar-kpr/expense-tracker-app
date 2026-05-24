import { Redirect } from "expo-router";

import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function App() {
  const { onboardingCompleted } = useOnboardingStore();

  if (onboardingCompleted) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
