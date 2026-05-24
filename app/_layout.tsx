import { Stack } from "expo-router";
import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ExpenseProvider } from "../context/ExpenseContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ExpenseProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </ExpenseProvider>
    </GestureHandlerRootView>
  );
}
