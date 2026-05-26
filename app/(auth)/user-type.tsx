import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useState } from "react";

import Animated, { FadeInUp } from "react-native-reanimated";

import { router } from "expo-router";

import { doc, updateDoc } from "firebase/firestore";

import { SafeAreaView } from "react-native-safe-area-context";

import { auth, db } from "@/firebase";

export default function UserTypeScreen() {
  const [loadingType, setLoadingType] = useState("");

  const handleSelect = async (type: string) => {
    try {
      setLoadingType(type);

      const user = auth.currentUser;

      if (!user) return;

      if (type === "salary") {
        await updateDoc(doc(db, "users", user.uid), {
          type,
        });

        router.replace("/(auth)/salary-setup" as any);
      } else {
        await updateDoc(doc(db, "users", user.uid), {
          type,

          onboarding: true,
        });

        router.replace("/(auth)/success" as any);
      }
    } finally {
      setLoadingType("");
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "#F7F7F7",
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,

          paddingTop: 24,

          paddingBottom: 40,
        }}
      >
        <Animated.View entering={FadeInUp.duration(700)}>
          <Text
            style={{
              fontSize: 34,

              fontWeight: "800",

              color: "#111",

              lineHeight: 44,
            }}
          >
            Tell us about{"\n"}
            your income
          </Text>

          <Text
            style={{
              fontSize: 16,

              color: "#777",

              marginTop: 18,

              lineHeight: 28,
            }}
          >
            This helps us build a more personalized expense experience for you.
          </Text>
        </Animated.View>

        <View
          style={{
            marginTop: 40,

            gap: 18,
          }}
        >
          <Animated.View entering={FadeInUp.delay(150).duration(700)}>
            <Pressable
              onPress={() => handleSelect("salary")}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#F5F4FF" : "white",

                borderRadius: 24,

                padding: 20,

                borderWidth: 1.5,

                borderColor: pressed ? "#6C63FF" : "#ECECEC",

                transform: [
                  {
                    scale: pressed ? 0.985 : 1,
                  },
                ],

                shadowColor: "#000",

                shadowOpacity: 0.04,

                shadowRadius: 12,

                shadowOffset: {
                  width: 0,
                  height: 5,
                },

                elevation: 2,
              })}
            >
              <View
                style={{
                  width: 52,

                  height: 52,

                  borderRadius: 999,

                  backgroundColor: "#F7F7FB",

                  justifyContent: "center",

                  alignItems: "center",

                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                  }}
                >
                  💼
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 22,

                  fontWeight: "800",

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
                Fixed monthly income with smart salary cycle tracking.
              </Text>

              {loadingType === "salary" ? (
                <ActivityIndicator
                  style={{
                    marginTop: 16,
                  }}
                  color="#6C63FF"
                />
              ) : (
                <Text
                  style={{
                    marginTop: 16,

                    color: "#6C63FF",

                    fontWeight: "700",
                  }}
                >
                  Continue →
                </Text>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(260).duration(700)}>
            <Pressable
              onPress={() => handleSelect("self-employed")}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#F5F4FF" : "white",

                borderRadius: 24,

                padding: 20,

                borderWidth: 1.5,

                borderColor: pressed ? "#6C63FF" : "#ECECEC",

                transform: [
                  {
                    scale: pressed ? 0.985 : 1,
                  },
                ],

                shadowColor: "#000",

                shadowOpacity: 0.04,

                shadowRadius: 12,

                shadowOffset: {
                  width: 0,
                  height: 5,
                },

                elevation: 2,
              })}
            >
              <View
                style={{
                  width: 52,

                  height: 52,

                  borderRadius: 999,

                  backgroundColor: "#F7F7FB",

                  justifyContent: "center",

                  alignItems: "center",

                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                  }}
                >
                  🚀
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 22,

                  fontWeight: "800",

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
                Flexible income and business expense tracking.
              </Text>

              {loadingType === "self-employed" ? (
                <ActivityIndicator
                  style={{
                    marginTop: 16,
                  }}
                  color="#6C63FF"
                />
              ) : (
                <Text
                  style={{
                    marginTop: 16,

                    color: "#6C63FF",

                    fontWeight: "700",
                  }}
                >
                  Continue →
                </Text>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
