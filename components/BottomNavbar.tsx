import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { useTheme } from "@/context/ThemeContext";
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
  const { theme, dark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 390 || fontScale > 1.05;

  const getLabel = (routeName: string) => {
    if (routeName === "index") return "Home";
    if (routeName === "history") return "History";
    if (routeName === "analytics") return "Analytics";
    if (routeName === "profile") return "Profile";
    return "";
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: compact ? 10 : 20,
        left: compact ? 8 : 20,
        right: compact ? 8 : 20,
        height: compact ? 82 : 85,
        backgroundColor: theme.card,
        borderRadius: 25,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        paddingHorizontal: compact ? 10 : 0,
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
                backgroundColor: theme.primary,
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
              size={compact ? 22 : 24}
              color={isFocused ? theme.primary : theme.text}
            />

            <Text
              style={{
                fontSize: compact ? 9 : 12,
                marginTop: 4,
                color: isFocused ? theme.primary : theme.text,
                maxWidth: compact ? 72 : 82,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {route.name === "add" ? "" : getLabel(route.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
