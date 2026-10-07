import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import IphoneAutomationSetupCard from "@/components/IphoneAutomationSetupCard";
import PrivacyDataSection from "@/components/PrivacyDataSection";
import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/firebase";
import { saveProfile, setProfileSyncMode } from "@/repositories/profileRepository";

const RUPEE = "\u20B9";

const formatMoney = (value: number) =>
  `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

export default function SelfEmployedProfileScreen() {
  const { expenses } = useExpense();
  const { userData, logout } = useAuth();
  const { theme, dark, setDark } = useTheme();
  const [syncSaving, setSyncSaving] = useState(false);
  const syncEnabled = userData?.syncMode === "sync_enabled";

  const totals = useMemo(
    () =>
      expenses.reduce(
        (acc, item) => {
          const amount = Number(item.amount || 0);

          if ((item.type || "expense") === "income") {
            acc.income += amount;
          } else {
            acc.expense += amount;
          }

          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [expenses],
  );

  const netProfit = totals.income - totals.expense;
  const totalTransactions = expenses.length;
  const incomeTransactions = expenses.filter(
    (item) => (item.type || "expense") === "income",
  ).length;
  const expenseTransactions = totalTransactions - incomeTransactions;
  const activeDays = new Set(
    expenses.map((item: any) => {
      const rawDate: any = item.createdAt;
      const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

      return date.toDateString();
    }),
  ).size;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 60,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: "900",
          color: theme.text,
          marginBottom: 28,
        }}
      >
        Profile
      </Text>

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: "#371872",

          borderRadius: 34,

          padding: 26,

          overflow: "hidden",

          position: "relative",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 26,
              backgroundColor: "#FFFFFF",
              borderColor: "#FFFFFF",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 16,
              borderWidth: 1.5,
            }}
          >
            {/* <Ionicons name="briefcase" size={30} color="#FFFFFF" /> */}
            <Text
              style={{
                fontSize: 32,
              }}
            >
              👤
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}
            >
              {userData?.name}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(255,255,255,0.78)",
                marginTop: 5,
                fontSize: 12,
              }}
            >
              {userData?.businessName || "My Business"}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: "rgba(255,255,255,0.78)",
                marginTop: 5,
                fontSize: 12,
              }}
            >
              {userData?.email}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 13,
              }}
            >
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.16)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}
                >
                  Self Employed
                </Text>
              </View>
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  marginLeft: 10,
                  fontSize: 12,
                }}
              >
                Business profile
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
            borderTopColor: "rgba(255,255,255,0.22)",
          }}
        >
          <ProfileHeaderStat
            label="Income"
            value={formatMoney(totals.income)}
          />
          <ProfileHeaderStat
            label="Expense"
            value={formatMoney(totals.expense)}
            alignRight
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(700)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 28,
          padding: 22,
          marginTop: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: theme.text }}
            >
              Business Overview
            </Text>
            <Text style={{ color: theme.subText, marginTop: 6, fontSize: 14 }}>
              Income and spending summary
            </Text>
          </View>

          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: "#15966515",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="stats-chart" size={25} color="#159665" />
          </View>
        </View>

        <View style={{ marginTop: 26 }}>
          <Text style={{ color: theme.subText, fontSize: 14 }}>Net Profit</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            ellipsizeMode="tail"
            style={{
              fontSize: 38,
              fontWeight: "900",
              color: netProfit >= 0 ? theme.text : theme.danger,
              marginTop: 8,
              width: "100%",
              flexShrink: 1,
              textAlign: "left",
            }}
          >
            {netProfit < 0
              ? `${RUPEE} -${Math.abs(netProfit).toLocaleString("en-IN")}`
              : formatMoney(Math.abs(netProfit))}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 26,
          }}
        >
          <MiniStat label="Income Entries" value={String(incomeTransactions)} />
          <MiniStat
            label="Expense Entries"
            value={String(expenseTransactions)}
          />
        </View>

        {/* <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleEditBusinessName}
          style={{
            backgroundColor: theme.primary,
            paddingVertical: 16,
            borderRadius: 20,
            alignItems: "center",
            marginTop: 24,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>
            Edit Business Name
          </Text>
        </TouchableOpacity> */}
      </Animated.View>

      {/* <Animated.View
        entering={FadeInUp.delay(300).duration(700)}
        style={{
          marginTop: 24,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <StatCard
          label="Total Income"
          value={formatMoney(totals.income)}
          color="#159665"
        />
        <StatCard
          label="Total Expense"
          value={formatMoney(totals.expense)}
          color="#EF4444"
        />
      </Animated.View> */}

      <Animated.View
        entering={FadeInUp.delay(400).duration(700)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 28,
          padding: 22,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: theme.text,
            marginBottom: 22,
          }}
        >
          Business Insights
        </Text>

        <SettingsRow
          label="Total Transactions"
          value={String(totalTransactions)}
        />

        <SettingsRow
          label="Business Status"
          value={netProfit < 0 ? "Running Loss" : "Profit Running"}
          last
        />
      </Animated.View>

      <SettingsSection
        dark={dark}
        setDark={setDark}
        syncEnabled={syncEnabled}
        syncSaving={syncSaving}
        setSyncSaving={setSyncSaving}
        theme={theme}
      />

      {Platform.OS !== "android" && <IphoneAutomationSetupCard />}

      <PrivacyDataSection />

      <Animated.View
        entering={FadeInUp.delay(700).duration(700)}
        style={{ marginTop: 24, marginBottom: 40 }}
      >
        <TouchableOpacity
          onPress={async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await logout();
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.primary,
            paddingVertical: 18,
            borderRadius: 22,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
            Logout
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

function ProfileHeaderStat({
  label,
  value,
  alignRight,
}: {
  label: string;
  value: string;
  alignRight?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: alignRight ? "flex-end" : "flex-start",
        flex: 1,
        paddingHorizontal: 6,
      }}
    >
      <Text style={{ color: "rgba(255,255,255,0.74)", fontSize: 13 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        ellipsizeMode="tail"
        style={{
          color: "#FFFFFF",
          fontSize: 21,
          fontWeight: "900",
          marginTop: 7,
          width: "100%",
          flexShrink: 1,
          textAlign: alignRight ? "right" : "left",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.border,
        borderRadius: 20,
        padding: 16,
        marginRight: label === "Income Entries" ? 10 : 0,
        marginLeft: label === "Expense Entries" ? 10 : 0,
      }}
    >
      <Text style={{ color: theme.subText, fontSize: 13 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        ellipsizeMode="tail"
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "900",
          marginTop: 7,
          width: "100%",
          flexShrink: 1,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        width: "48%",
        borderRadius: 24,
        padding: 18,
      }}
    >
      <Text style={{ color: theme.subText, marginBottom: 9, fontSize: 13 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontSize: 22, fontWeight: "900", color }}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: last ? 0 : 18,
        gap: 16,
      }}
    >
      <Text style={{ color: theme.subText, fontSize: 15 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: theme.text,
          fontWeight: "800",
          fontSize: 15,
          maxWidth: 150,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SettingsSection({
  dark,
  setDark,
  syncEnabled,
  syncSaving,
  setSyncSaving,
  theme,
}: {
  dark: boolean;
  setDark: (value: boolean) => void;
  syncEnabled: boolean;
  syncSaving: boolean;
  setSyncSaving: (value: boolean) => void;
  theme: any;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(500).duration(700)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 28,
        padding: 22,
        marginTop: 24,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "900",
          color: theme.text,
          marginBottom: 22,
        }}
      >
        Settings
      </Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, color: theme.text }}>Dark Mode</Text>
        <Switch
          value={dark}
          onValueChange={async (value) => {
            setDark(value);

            const user = auth.currentUser;
            if (!user?.uid) return;

            try {
              await saveProfile(user.uid, {
                darkMode: value,
              });
            } catch (error) {
              console.log("Theme update error:", error);
            }
          }}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={dark ? theme.background : "#FFFFFF"}
        />
      </View>

      {Platform.OS !== "web" && (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 18,
            }}
          >
            <Text style={{ fontSize: 16, color: theme.text }}>Cloud Sync</Text>
            <Switch
              value={syncEnabled}
              onValueChange={async (value) => {
                const user = auth.currentUser;

                if (!user?.uid || syncSaving) {
                  return;
                }

                try {
                  setSyncSaving(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await setProfileSyncMode(
                    user.uid,
                    value ? "sync_enabled" : "local_only",
                  );
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                } catch (error) {
                  console.log("Cloud sync toggle error:", error);
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                  );
                } finally {
                  setSyncSaving(false);
                }
              }}
              disabled={syncSaving}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={syncEnabled ? theme.background : "#FFFFFF"}
            />
          </View>

          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 8,
            }}
          >
            Turn it on to back up business data to Firestore. Turn it off to
            stay local only.
          </Text>
        </>
      )}
    </Animated.View>
  );
}
