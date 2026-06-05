import { Stack } from "expo-router";
import "react-native-get-random-values";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "fade",
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen
        name="user-type"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="salary-setup"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="business-setup"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="success"
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
