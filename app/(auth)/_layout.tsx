import { Stack } from "expo-router";
import "react-native-get-random-values";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
