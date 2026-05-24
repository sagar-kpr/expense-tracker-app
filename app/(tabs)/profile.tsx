import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Animated, { FadeInUp } from "react-native-reanimated";

import { useMemo, useState } from "react";

import { useExpense } from "@/context/ExpenseContext";

import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function ProfileScreen() {
  const { expenses } = useExpense();

  const { salary, setSalary } = useOnboardingStore();

  const [notifications, setNotifications] = useState(true);

  const [darkMode, setDarkMode] = useState(false);

  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  }, [expenses]);

  const remaining = Number(salary || 0) - totalSpent;

  const totalTransactions = expenses.length;

  const handleEditSalary = () => {
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

          onPress: (value: any) => {
            if (!value) return;

            setSalary(value);
          },
        },
      ],
      "plain-text",
      salary,
    );
  };

  const handleReset = () => {
    Alert.alert("Reset App", "This feature will come soon.");
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#F7F7F7",
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
          color: "#111",
          marginBottom: 28,
        }}
      >
        Profile
      </Text>

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: "#6C63FF",
          borderRadius: 30,
          padding: 24,
        }}
      >
        <View
          style={{
            width: 70,
            height: 70,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.2)",

            justifyContent: "center",

            alignItems: "center",

            marginBottom: 18,
          }}
        >
          <Text
            style={{
              fontSize: 28,
            }}
          >
            👤
          </Text>
        </View>

        <Text
          style={{
            color: "white",
            fontSize: 28,
            fontWeight: "800",
          }}
        >
          Sagar Kapoor
        </Text>

        <Text
          style={{
            color: "rgba(255,255,255,0.8)",

            marginTop: 8,
            fontSize: 16,
          }}
        >
          Monthly Expense Tracker
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(700)}
        style={{
          backgroundColor: "white",

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#111",
            marginBottom: 22,
          }}
        >
          Salary
        </Text>

        <Text
          style={{
            color: "#777",
            marginBottom: 8,
          }}
        >
          Monthly Salary
        </Text>

        <Text
          style={{
            fontSize: 34,
            fontWeight: "800",
            color: "#111",
          }}
        >
          ₹{Number(salary || 0).toLocaleString()}
        </Text>

        <TouchableOpacity
          onPress={handleEditSalary}
          activeOpacity={0.8}
          style={{
            marginTop: 22,
            backgroundColor: "#6C63FF",

            paddingVertical: 14,

            borderRadius: 18,

            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Edit Salary
          </Text>
        </TouchableOpacity>
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
            backgroundColor: "white",

            width: "48%",

            borderRadius: 24,

            padding: 20,
          }}
        >
          <Text
            style={{
              color: "#777",
              marginBottom: 10,
            }}
          >
            Total Spent
          </Text>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: "#111",
            }}
          >
            ₹{totalSpent.toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "white",

            width: "48%",

            borderRadius: 24,

            padding: 20,
          }}
        >
          <Text
            style={{
              color: "#777",
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
          backgroundColor: "white",

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#111",
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
              color: "#666",
              fontSize: 16,
            }}
          >
            Total Transactions
          </Text>

          <Text
            style={{
              color: "#111",
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
          }}
        >
          <Text
            style={{
              color: "#666",
              fontSize: 16,
            }}
          >
            Avg Expense
          </Text>

          <Text
            style={{
              color: "#111",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            ₹
            {totalTransactions > 0
              ? Math.round(totalSpent / totalTransactions).toLocaleString()
              : 0}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(500).duration(700)}
        style={{
          backgroundColor: "white",

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#111",
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
              color: "#111",
            }}
          >
            Notifications
          </Text>

          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{
              true: "#6C63FF",
            }}
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
              color: "#111",
            }}
          >
            Dark Mode
          </Text>

          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{
              true: "#6C63FF",
            }}
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(600).duration(700)}
        style={{
          backgroundColor: "white",

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#111",
            marginBottom: 24,
          }}
        >
          Data
        </Text>

        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.8}
          style={{
            backgroundColor: "#EF4444",

            paddingVertical: 16,

            borderRadius: 18,

            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            Reset App
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}
