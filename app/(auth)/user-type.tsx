import { Pressable, Text, View } from "react-native";

import { router } from "expo-router";

export default function UserTypeScreen() {
  const handleSelect = (type: string) => {
    if (type === "salary") {
      router.push("/(auth)/salary-setup");
    } else {
      router.push("/(auth)/success");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        paddingHorizontal: 24,
        paddingTop: 90,
      }}
    >
      <Text
        style={{
          fontSize: 34,
          fontWeight: "800",
          color: "#111",
          lineHeight: 44,
        }}
      >
        Tell us about{"\n"}your income
      </Text>

      <Text
        style={{
          fontSize: 16,
          color: "#777",
          marginTop: 18,
          lineHeight: 26,
        }}
      >
        This helps us personalize your expense tracking experience.
      </Text>

      <View
        style={{
          marginTop: 50,
          gap: 20,
        }}
      >
        <Pressable
          onPress={() => handleSelect("salary")}
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: "#ECECEC",
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: "#111",
            }}
          >
            Salary
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: "#777",
              marginTop: 10,
              lineHeight: 24,
            }}
          >
            Fixed monthly income with salary cycle tracking.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleSelect("self-employed")}
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: "#ECECEC",
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: "#111",
            }}
          >
            Self-employed
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: "#777",
              marginTop: 10,
              lineHeight: 24,
            }}
          >
            Flexible income and business expense management.
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
