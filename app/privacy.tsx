import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/context/ThemeContext";

const sections = [
  {
    title: "What We Store",
    body: "We store your account profile, salary or business setup details, expenses, income entries, and pending transaction reviews you choose to keep in the app.",
  },
  {
    title: "SMS Transaction Detection",
    body: "SMS and notification access is used to detect bank transaction messages. Detected messages wait in review before becoming saved transactions. Normal personal messages are not part of the expense record.",
  },
  {
    title: "Account Privacy",
    body: "Your data is saved under your Firebase account. Firestore rules allow only your signed-in account to read or update your own user, expense, and pending transaction records.",
  },
  {
    title: "Passwords",
    body: "Passwords are handled by Firebase Authentication. The app does not store or display your password in Firestore.",
  },
  {
    title: "How We Use Data",
    body: "Your financial data is used only to show dashboards, analytics, history, and pending transaction review inside the app. We do not sell your salary, income, expense, or transaction data.",
  },
  {
    title: "Your Control",
    body: "You can delete saved transaction data from the profile screen. You can also log out at any time. Account deletion can be added as a separate protected action.",
  },
  {
    title: "Security Limits",
    body: "Firestore encrypts data in transit and at rest, and your database rules restrict user access. This is not yet end-to-end encryption, so project admins with Firebase console access may still see stored database values.",
  },
];

export default function PrivacyScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background, flex: 1 }}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 80,
        paddingTop: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.back()}
        style={{
          alignItems: "center",
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderRadius: 16,
          borderWidth: 1,
          height: 44,
          justifyContent: "center",
          width: 44,
        }}
      >
        <Ionicons name="chevron-back" size={22} color={theme.text} />
      </TouchableOpacity>

      <Text
        style={{
          color: theme.text,
          fontSize: 32,
          fontWeight: "900",
          letterSpacing: 0,
          marginTop: 24,
        }}
      >
        Privacy Policy
      </Text>

      <Text
        style={{
          color: theme.subText,
          fontSize: 14,
          lineHeight: 22,
          marginTop: 10,
        }}
      >
        Last updated: June 8, 2026
      </Text>

      <View style={{ marginTop: 24 }}>
        {sections.map((section) => (
          <View
            key={section.title}
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 22,
              borderWidth: 1,
              marginBottom: 14,
              padding: 18,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 17,
                fontWeight: "900",
              }}
            >
              {section.title}
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 14,
                lineHeight: 22,
                marginTop: 8,
              }}
            >
              {section.body}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
