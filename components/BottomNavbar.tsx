import { Pressable, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

type Props = {
  state: any;
  descriptors: any;
  navigation: any;
  openModal: () => void;
};

export default function BottomNavbar({
  state,
  descriptors,
  navigation,
  openModal,
}: Props) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
        height: 85,
        backgroundColor: "white",
        borderRadius: 25,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        elevation: 10,
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;

        const onPress = () => {
          navigation.navigate(route.name);
        };

        const icons: any = {
          index: "home-outline",
          history: "time-outline",
          analytics: "bar-chart-outline",
          profile: "person-outline",
        };

        if (route.name === "add") {
          return (
            <Pressable
              key={route.key}
              onPress={openModal}
              style={{
                width: 65,
                height: 65,
                borderRadius: 40,
                backgroundColor: "#6C63FF",
                justifyContent: "center",
                alignItems: "center",
                top: -28,
              }}
            >
              <Ionicons name="add" size={34} color="white" />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              alignItems: "center",
            }}
          >
            <Ionicons
              name={icons[route.name]}
              size={24}
              color={isFocused ? "#6C63FF" : "#999"}
            />

            <Text
              style={{
                fontSize: 12,
                marginTop: 4,
                color: isFocused ? "#6C63FF" : "#999",
              }}
            >
              {route.name === "index"
                ? "Home"
                : route.name === "add"
                  ? ""
                  : route.name.charAt(0).toUpperCase() + route.name.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
