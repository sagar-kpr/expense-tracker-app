import { Pressable, Text, View } from "react-native";

import { router } from "expo-router";

import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function SuccessScreen() {
  const { completeOnboarding } = useOnboardingStore();

  const handleContinue = () => {
    completeOnboarding();

    router.replace("/(tabs)");
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        paddingHorizontal: 28,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 999,
          backgroundColor: "#E9E7FF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 52,
          }}
        >
          🎉
        </Text>
      </View>

      <Text
        style={{
          fontSize: 34,
          fontWeight: "800",
          color: "#111",
          marginTop: 40,
          textAlign: "center",
        }}
      >
        All Set!
      </Text>

      <Text
        style={{
          fontSize: 16,
          color: "#777",
          marginTop: 18,
          lineHeight: 28,
          textAlign: "center",
          paddingHorizontal: 20,
        }}
      >
        Your expense tracker is ready to help you manage money smarter.
      </Text>

      <Pressable
        onPress={handleContinue}
        style={{
          backgroundColor: "#6C63FF",
          paddingVertical: 18,
          borderRadius: 20,
          width: "100%",
          marginTop: 60,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          Continue
        </Text>
      </Pressable>
    </View>
  );
}
