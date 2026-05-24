import { Pressable, Text, View } from "react-native";

import { router } from "expo-router";

export default function WelcomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
        paddingHorizontal: 28,
        justifyContent: "center",
      }}
    >
      <View>
        <Text
          style={{
            fontSize: 44,
            fontWeight: "800",
            color: "#111",
            lineHeight: 52,
          }}
        >
          Expense{"\n"}
          <Text
            style={{
              color: "#6C63FF",
            }}
          >
            Tracker
          </Text>
        </Text>

        <Text
          style={{
            fontSize: 18,
            color: "#666",
            marginTop: 18,
            lineHeight: 28,
          }}
        >
          Track Simply, Live Freely
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: "#888",
            marginTop: 30,
            lineHeight: 24,
          }}
        >
          A minimal and smart expense tracker for salary and self-employed
          people.
        </Text>

        <View
          style={{
            marginTop: 35,
            gap: 18,
          }}
        >
          {[
            "Quick Add Expense",
            "Smart Categories",
            "Salary Cycle View",
            "Beautiful Analytics",
          ].map((item) => (
            <View
              key={item}
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: "#6C63FF",
                  marginRight: 12,
                }}
              />

              <Text
                style={{
                  fontSize: 15,
                  color: "#444",
                  fontWeight: "500",
                }}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => router.push("/(auth)/user-type")}
        style={{
          backgroundColor: "#6C63FF",
          paddingVertical: 18,
          borderRadius: 20,
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
          Get Started
        </Text>
      </Pressable>
    </View>
  );
}
