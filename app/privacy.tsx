import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/context/ThemeContext";

const sections = [
  {
    title: "How Storage Works",
    body: "We use Firebase Authentication for email and password sign-in. After login, your app data is stored locally on your device in SQLite. Firestore is used only for your account record and, if you turn on cloud sync, for syncing your saved app data between devices.",
  },
  {
    title: "What We Store",
    body: "By default, we store your salary setup, business setup, expenses, income, budgets, categories, analytics data, and pending transaction reviews in SQLite on your device. Firestore stores only your Firebase account details unless cloud sync is enabled.",
  },
  {
    title: "Cloud Sync",
    body: "Cloud sync is optional. When you enable it, the app uploads your saved SQLite data to Firestore so you can restore it on another device. If cloud sync is off, your financial data stays on the device only.",
  },
  {
    title: "Account Privacy",
    body: "Your Firebase account protects access to your data. We keep your sign-in identity in Firebase Authentication, and Firestore rules are meant to allow only your signed-in account to read or update its own records.",
  },
  {
    title: "Passwords",
    body: "Passwords are handled by Firebase Authentication. The app does not store or display your password in Firestore or SQLite.",
  },
  {
    title: "How We Use Data",
    body: "Your financial data is used only to power dashboards, analytics, history, and transaction review inside the app. We do not sell your salary, income, expense, or transaction data.",
  },
  {
    title: "Your Control",
    body: "You can delete saved transaction data from the profile screen. You can also log out at any time. Turning off cloud sync keeps new data local to your device.",
  },
  {
    title: "Security Limits",
    body: "Firestore encrypts data in transit and at rest, and your database rules restrict user access. This is not yet end-to-end encryption, so project admins with Firebase console access may still see stored database values.",
  },
  {
    title: "SMS Transaction Detection",
    body: "SMS and notification access is used to detect bank transaction messages. Detected messages wait in review before becoming saved transactions. Normal personal messages are not part of the expense record.",
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
        paddingTop: 60,
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
