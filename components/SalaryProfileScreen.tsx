import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, { FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { useMemo, useState } from "react";

import { router } from "expo-router";

import { doc, updateDoc } from "firebase/firestore";

import * as Haptics from "expo-haptics";

import { auth, db } from "@/firebase";

import { useExpense } from "@/context/ExpenseContext";

import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const { expenses } = useExpense();

  const { userData, logout } = useAuth();

  const { theme, dark, setDark } = useTheme();

  const [notifications, setNotifications] = useState(true);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [expenses]);

  const remaining = Number(userData?.salary || 0) - totalSpent;

  const totalTransactions = expenses.length;

  const avgExpense =
    totalTransactions > 0 ? Math.round(totalSpent / totalTransactions) : 0;

  const activeDays = new Set(
    expenses.map((item: any) => {
      const rawDate: any = item.createdAt;

      const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

      return date.toDateString();
    }),
  ).size;

  const handleEditSalary = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.prompt(
      "Edit Salary",

      "Enter your monthly salary",

      [
        {
          text: "Cancel",

          style: "cancel",
        },

        {
          text: "Save",

          onPress: async (value: any) => {
            if (!value) return;

            const user = auth.currentUser;

            if (!user) return;

            await updateDoc(doc(db, "users", user.uid), {
              salary: Number(value),
            });
          },
        },
      ],

      "plain-text",

      String(userData?.salary || ""),
    );
  };

  return (
    <ScrollView
      style={{
        flex: 1,

        backgroundColor: theme.background,
      }}
      contentContainerStyle={{
        padding: 20,

        paddingTop: 70,

        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 30,

          fontWeight: "800",

          color: theme.text,

          marginBottom: 28,
        }}
      >
        Profile
      </Text>

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: theme.primary,

          borderRadius: 34,

          padding: 26,

          overflow: "hidden",

          position: "relative",
        }}
      >
        {/* <View
          style={{
            position: "absolute",

            width: 240,

            height: 240,

            borderRadius: 999,

            backgroundColor: theme.border + "22",

            top: -100,

            right: -80,
          }}
        />

        <View
          style={{
            position: "absolute",

            width: 130,

            height: 130,

            borderRadius: 999,

            backgroundColor: theme.border + "05",

            bottom: -40,

            left: -35,
          }}
        /> */}

        <View
          style={{
            flexDirection: "row",

            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 76,

              height: 76,

              borderRadius: 26,

              backgroundColor: "#FFFFFF",

              justifyContent: "center",

              alignItems: "center",

              marginRight: 18,

              borderWidth: 1.5,

              borderColor: "#FFFFFF",
            }}
          >
            <Text
              style={{
                fontSize: 32,
              }}
            >
              👤
            </Text>
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: "#FFFFFF",

                fontSize: 30,

                fontWeight: "800",
              }}
            >
              {userData?.name || "User"}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: "#FFFFFF",

                marginTop: 5,

                fontSize: 14,
              }}
            >
              {userData?.email}
            </Text>

            <View
              style={{
                flexDirection: "row",

                alignItems: "center",

                marginTop: 14,
              }}
            >
              <View
                style={{
                  backgroundColor: "#FFFFFF",

                  paddingHorizontal: 12,

                  paddingVertical: 6,

                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    color: theme.subText,

                    fontSize: 12,

                    fontWeight: "700",
                  }}
                >
                  Salary User
                </Text>
              </View>

              <Text
                style={{
                  color: "#FFFFFF",

                  marginLeft: 12,

                  fontSize: 12,
                }}
              >
                Joined{" "}
                {new Date().toLocaleDateString("en-IN", {
                  month: "short",

                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginTop: 28,

            paddingTop: 22,

            borderTopWidth: 1,

            borderTopColor: "#FFFFFF",
          }}
        >
          <View>
            <Text
              style={{
                color: "#FFFFFF",

                fontSize: 13,
              }}
            >
              Monthly Salary
            </Text>

            <Text
              style={{
                color: "#FFFFFF",

                fontSize: 24,

                fontWeight: "800",

                marginTop: 8,
              }}
            >
              ₹{Number(userData?.salary || 0).toLocaleString()}
            </Text>
          </View>

          {/* <View
            style={{
              alignItems: "flex-end",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.72)",

                fontSize: 13,
              }}
            >
              Transactions
            </Text>

            <Text
              style={{
                color: "white",

                fontSize: 24,

                fontWeight: "800",

                marginTop: 8,
              }}
            >
              {totalTransactions}
            </Text>
          </View> */}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(700)}
        style={{
          backgroundColor: theme.card,

          borderRadius: 30,

          padding: 24,

          marginTop: 24,

          overflow: "hidden",
        }}
      >
        {/* <View
          style={{
            position: "absolute",

            width: 160,

            height: 160,

            borderRadius: 999,

            backgroundColor: theme.primary,

            top: -60,

            right: -40,
          }}
        /> */}

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 20,

                fontWeight: "800",

                color: theme.text,
              }}
            >
              Salary
            </Text>

            <Text
              style={{
                color: theme.text,

                marginTop: 6,

                fontSize: 14,
              }}
            >
              Monthly income settings
            </Text>
          </View>

          <View
            style={{
              width: 54,

              height: 54,

              borderRadius: 18,

              backgroundColor: "#6C63FF15",

              justifyContent: "center",

              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 24,
              }}
            >
              💰
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 28,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 14,
            }}
          >
            Monthly Salary
          </Text>

          <Text
            style={{
              fontSize: 42,

              fontWeight: "800",

              color: theme.text,

              marginTop: 10,
            }}
          >
            ₹{Number(userData?.salary || 0).toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginTop: 28,
          }}
        >
          <View
            style={{
              flex: 1,

              backgroundColor: theme.border,

              borderRadius: 22,

              padding: 18,

              marginRight: 10,
            }}
          >
            <Text
              style={{
                color: theme.subText,

                fontSize: 13,
              }}
            >
              Salary Date
            </Text>

            <Text
              style={{
                color: theme.text,

                fontSize: 20,

                fontWeight: "800",

                marginTop: 8,
              }}
            >
              {userData?.salaryDate}
            </Text>
          </View>

          <View
            style={{
              flex: 1,

              backgroundColor: theme.border,

              borderRadius: 22,

              padding: 18,

              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: theme.subText,

                fontSize: 13,
              }}
            >
              Income Type
            </Text>

            <Text
              style={{
                color: theme.text,

                fontSize: 20,

                fontWeight: "800",

                marginTop: 8,
              }}
            >
              Salary
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",

            marginTop: 26,
          }}
        >
          <TouchableOpacity
            onPress={handleEditSalary}
            activeOpacity={0.85}
            style={{
              flex: 1,

              backgroundColor: theme.primary,

              paddingVertical: 16,

              borderRadius: 20,

              alignItems: "center",

              marginRight: 10,
            }}
          >
            <Text
              style={{
                color: "white",

                fontWeight: "800",

                fontSize: 15,
              }}
            >
              Edit Salary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

              Alert.prompt(
                "Edit Salary Date",

                "Enter salary date (1-31)",

                [
                  {
                    text: "Cancel",

                    style: "cancel",
                  },

                  {
                    text: "Save",

                    onPress: async (value: any) => {
                      if (!value) return;

                      const user = auth.currentUser;

                      if (!user) return;

                      await updateDoc(doc(db, "users", user.uid), {
                        salaryDate: Number(value),
                      });
                    },
                  },
                ],

                "plain-text",

                String(userData?.salaryDate || "1"),
              );
            }}
            style={{
              flex: 1,

              backgroundColor: theme.border,

              paddingVertical: 16,

              borderRadius: 20,

              alignItems: "center",

              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: theme.primary,

                fontWeight: "800",

                fontSize: 15,
              }}
            >
              Edit Date
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(300).duration(700)}
        style={{
          marginTop: 24,

          flexDirection: "row",

          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            backgroundColor: theme.card,

            width: "48%",

            borderRadius: 24,

            padding: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              marginBottom: 10,
            }}
          >
            Total Spent
          </Text>

          <Text
            style={{
              fontSize: 24,

              fontWeight: "800",

              color: theme.text,
            }}
          >
            ₹{totalSpent.toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: theme.card,

            width: "48%",

            borderRadius: 24,

            padding: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              marginBottom: 10,
            }}
          >
            Remaining
          </Text>

          <Text
            style={{
              fontSize: 24,

              fontWeight: "800",

              color: remaining >= 0 ? "#22C55E" : "#EF4444",
            }}
          >
            ₹{remaining.toLocaleString()}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(400).duration(700)}
        style={{
          backgroundColor: theme.card,

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,

            fontWeight: "700",

            color: theme.text,

            marginBottom: 24,
          }}
        >
          Statistics
        </Text>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Total Transactions
          </Text>

          <Text
            style={{
              color: theme.text,

              fontWeight: "700",

              fontSize: 16,
            }}
          >
            {totalTransactions}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Avg Expense
          </Text>

          <Text
            style={{
              color: theme.text,

              fontWeight: "700",

              fontSize: 16,
            }}
          >
            ₹{avgExpense.toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Active Days
          </Text>

          <Text
            style={{
              color: theme.text,

              fontWeight: "700",

              fontSize: 16,
            }}
          >
            {activeDays}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(500).duration(700)}
        style={{
          backgroundColor: theme.card,

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,

            fontWeight: "700",

            color: theme.text,

            marginBottom: 24,
          }}
        >
          Settings
        </Text>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            alignItems: "center",

            marginBottom: 22,
          }}
        >
          <Text
            style={{
              fontSize: 16,

              color: theme.text,
            }}
          >
            Notifications
          </Text>

          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{
              false: theme.card,

              true: theme.primary,
            }}
            thumbColor={dark ? theme.background : "#FFFFFF"}
          />
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 16,

              color: theme.text,
            }}
          >
            Dark Mode
          </Text>

          <Switch
            value={dark}
            onValueChange={async (value) => {
              setDark(value);

              const user = auth.currentUser;

              if (!user) return;

              try {
                await updateDoc(
                  doc(db, "users", user.uid),

                  {
                    darkMode: value,
                  },
                );
              } catch (error) {
                console.log("Theme update error:", error);
              }
            }}
            trackColor={{
              false: theme.border,

              true: theme.primary,
            }}
            thumbColor={theme.background}
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(650).duration(700)}
        style={{
          marginTop: 24,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Alert.alert(
              "Coming Soon",

              "Export feature will be added soon.",
            );
          }}
          style={{
            backgroundColor: theme.primary,

            paddingVertical: 18,

            borderRadius: 22,

            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",

              fontSize: 16,

              fontWeight: "700",
            }}
          >
            Export Data
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(700).duration(700)}
        style={{
          marginTop: 24,

          marginBottom: 40,
        }}
      >
        <TouchableOpacity
          onPress={async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            await logout();

            router.replace("/(auth)/login");
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.primary,

            paddingVertical: 18,

            borderRadius: 22,

            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",

              fontSize: 16,

              fontWeight: "700",
            }}
          >
            Logout
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
