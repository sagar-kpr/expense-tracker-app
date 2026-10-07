import { ActivityIndicator, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        flex: 1,
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color="#159B7D" />
    </View>
  );
}
