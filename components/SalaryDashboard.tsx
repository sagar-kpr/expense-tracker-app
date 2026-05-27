import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";

type CategoryMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
};

const categoryMeta: Record<string, CategoryMeta> = {
  Food: { icon: "fast-food", color: "#159665", tint: "#EAF7F0" },
  Travel: { icon: "airplane", color: "#2878E3", tint: "#EAF2FF" },
  Shopping: { icon: "bag", color: "#C98200", tint: "#FFF5DF" },
  Bills: { icon: "bulb", color: "#E5484D", tint: "#FFF0F0" },
  Health: { icon: "medical", color: "#D9468E", tint: "#FFF0F7" },
  Other: { icon: "ellipsis-horizontal", color: "#7152F3", tint: "#F4F0FF" },
};

const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getRelativeDate = (date: string) => {
  const expenseDate = new Date(date);
  const today = new Date();
  const yesterday = new Date();

  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  const compareDate = new Date(expenseDate);
  compareDate.setHours(0, 0, 0, 0);

  if (compareDate.getTime() === today.getTime()) return "Today";
  if (compareDate.getTime() === yesterday.getTime()) return "Yesterday";

  return expenseDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function SalaryDashboard() {
  const router = useRouter();
  const { expenses } = useExpense();
  const { userData } = useAuth();
  const { theme, dark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const salary = Number(userData?.salary || 0);
  const spent = useMemo(
    () =>
      expenses
        .filter((item) => (item.type || "expense") === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses],
  );

  const remaining = salary - spent;
  const usageRatio = salary > 0 ? Math.round((spent / salary) * 100) : 0;
  const cappedRatio = Math.min(usageRatio, remaining < 0 ? 88 : 100);
  const firstName = userData?.name?.trim()?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning ☀️" : hour < 18 ? "Good Afternoon 🌤️" : "Good Evening 🌙";

  const today = new Date();
  const currentDay = today.getDate();
  const salaryDate = Number(userData?.salaryDate || 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft =
    currentDay <= salaryDate
      ? salaryDate - currentDay
      : daysInMonth - currentDay + salaryDate;
  const safeToSpend = daysLeft > 0 ? remaining / daysLeft : remaining;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(cappedRatio, { duration: 1000 });
  }, [cappedRatio, progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  const grouped = useMemo(
    () =>
      expenses
        .filter((item) => (item.type || "expense") === "expense")
        .reduce((acc: Record<string, number>, item) => {
          const category = item.category || "Other";
          acc[category] = (acc[category] || 0) + Number(item.amount);
          return acc;
        }, {}),
    [expenses],
  );

  const categoryData = Object.entries(grouped)
    .map(([key, value]) => ({
      key,
      value,
      percent: spent > 0 ? ((value / spent) * 100).toFixed(1) : "0.0",
      meta: categoryMeta[key] || categoryMeta.Other,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    progress.value = 0;

    setTimeout(() => {
      progress.value = withTiming(cappedRatio, { duration: 1000 });
      setRefreshing(false);
    }, 650);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 20, paddingTop: 70, paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
          progressBackgroundColor={theme.card}
          progressViewOffset={70}
        />
      }
    >
      <Text style={{ color: theme.text, fontSize: 18 }}>
        {firstName ? `${greeting}, ${firstName}` : greeting}
      </Text>
      <Text
        style={{
          color: theme.text,
          fontSize: 42,
          fontWeight: "900",
          marginTop: 6,
          letterSpacing: 0,
        }}
      >
        Dashboard
      </Text>

      <Animated.View entering={FadeInUp.delay(100).duration(650)} style={{ marginTop: 28 }}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <MetricCard
            title="Salary"
            amount={formatMoney(salary)}
            caption="Monthly income"
            icon="card"
            iconColor="#FFFFFF"
            iconBackground="rgba(255,255,255,0.16)"
            backgroundColor={dark ? "#11735E" : "#159B7D"}
          />
          <MetricCard
            title="Spent"
            amount={formatMoney(spent)}
            caption="Total expense"
            icon="arrow-down"
            iconColor="#FB7185"
            iconBackground="rgba(255,255,255,0.11)"
            backgroundColor={dark ? "#172033" : "#202838"}
          />
        </View>

        <View
          style={{
            marginTop: 16,
            minHeight: 168,
            borderRadius: 28,
            padding: 24,
            backgroundColor: dark ? "#2A1D62" : "#37206F",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 28,
                backgroundColor: "rgba(139,92,246,0.28)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="wallet" size={36} color="#9E75FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 19 }}>
                Remaining Balance
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: "#FFFFFF",
                  fontSize: 42,
                  fontWeight: "900",
                  marginTop: 14,
                  letterSpacing: 0,
                }}
              >
                {remaining < 0 ? "-" : ""}
                {formatMoney(Math.abs(remaining))}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 22,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.66)", fontSize: 16, flex: 1 }}>
              Safe daily budget: {formatMoney(Math.max(0, Math.round(safeToSpend)))}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 9,
                backgroundColor:
                  remaining < 0 ? "rgba(248,113,113,0.25)" : "rgba(34,197,94,0.2)",
              }}
            >
              <Ionicons
                name={remaining < 0 ? "warning" : "shield-checkmark"}
                size={18}
                color={remaining < 0 ? "#FF7B7B" : "#86EFAC"}
              />
              <Text
                style={{
                  color: remaining < 0 ? "#FF8F8F" : "#BBF7D0",
                  fontSize: 15,
                  fontWeight: "800",
                  marginLeft: 8,
                }}
              >
                {remaining < 0 ? "Over budget" : "On track"}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 24,
          padding: 24,
          marginTop: 24,
          shadowColor: "#000",
          shadowOpacity: dark ? 0 : 0.06,
          shadowRadius: 16,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "900", flex: 1 }}>
            Monthly Usage
          </Text>
          <View
            style={{
              backgroundColor: remaining < 0 ? "#FEE2E2" : "#DCFCE7",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                color: remaining < 0 ? "#DC2626" : "#159665",
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              {remaining < 0 ? "Limit Crossed" : "Within Limit"}
            </Text>
          </View>
        </View>

        <View
          style={{
            height: 18,
            backgroundColor: dark ? "#2A2F3A" : "#ECEFF2",
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 26,
          }}
        >
          <Animated.View
            style={[
              {
                height: "100%",
                borderRadius: 999,
                backgroundColor: remaining < 0 ? "#F04454" : "#18A66D",
              },
              progressStyle,
            ]}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            gap: 16,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 17 }}>Used: {usageRatio}%</Text>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>
            <Text style={{ color: "#EF4444", fontWeight: "900" }}>{formatMoney(spent)}</Text>{" "}
            of {formatMoney(salary)}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(250).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 24,
          padding: 24,
          marginTop: 24,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 66,
            height: 66,
            borderRadius: 22,
            backgroundColor: remaining < 0 ? "#FEE2E2" : "#EDEAFF",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16,
          }}
        >
          <Ionicons
            name={remaining < 0 ? "alert-circle" : "calendar"}
            size={32}
            color={remaining < 0 ? "#EF4444" : theme.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.subText, fontSize: 15, fontWeight: "700" }}>
            Safe to Spend Today
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: remaining < 0 ? theme.danger : theme.text,
              fontSize: 32,
              fontWeight: "900",
              marginTop: 6,
            }}
          >
            {formatMoney(Math.max(0, Math.round(safeToSpend)))}
            <Text style={{ color: theme.subText, fontSize: 16, fontWeight: "700" }}>/day</Text>
          </Text>
          <Text style={{ color: theme.subText, fontSize: 13, marginTop: 6 }}>
            {daysLeft} days left till next salary.
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(300).duration(650)}
        style={{ backgroundColor: theme.card, borderRadius: 24, padding: 22, marginTop: 24 }}
      >
        <SectionHeader title="By Category" action="See All" onPress={() => router.push("/analytics")} />

        {categoryData.length === 0 ? (
          <EmptyState icon="pie-chart" label="No category data yet" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categoryData.map((item) => (
              <View
                key={item.key}
                style={{
                  width: 108,
                  minHeight: 144,
                  borderRadius: 18,
                  padding: 14,
                  alignItems: "center",
                  backgroundColor: item.meta.tint,
                  marginRight: 12,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: "rgba(255,255,255,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name={item.meta.icon} size={29} color={item.meta.color} />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ color: "#5F6368", fontSize: 14, marginTop: 12, maxWidth: 82 }}
                >
                  {item.key}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: item.meta.color,
                    fontSize: 19,
                    fontWeight: "900",
                    marginTop: 6,
                    maxWidth: 82,
                  }}
                >
                  {formatMoney(item.value)}
                </Text>
                <Text style={{ color: "#6E737A", fontSize: 13, marginTop: 6 }}>
                  {item.percent}%
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(400).duration(650)}
        style={{ backgroundColor: theme.card, borderRadius: 24, padding: 22, marginTop: 24 }}
      >
        <SectionHeader
          title="Recent Transactions"
          action="See All"
          onPress={() => router.push("/history")}
        />

        {expenses.length === 0 ? (
          <EmptyState icon="receipt-outline" label="No transactions yet" />
        ) : (
          expenses.slice(0, 5).map((item, index) => {
            const meta = categoryMeta[item.category || "Other"] || categoryMeta.Other;

            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: index === 0 ? 2 : 16,
                  paddingBottom: 16,
                  borderBottomWidth: index === Math.min(expenses.length, 5) - 1 ? 0 : 1,
                  borderBottomColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 20,
                    backgroundColor: meta.tint,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={meta.icon} size={27} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: theme.text, fontSize: 16, fontWeight: "900" }}
                  >
                    {item.description || item.category || "Other"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
                    <View
                      style={{
                        backgroundColor: "#FEE2E2",
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "800" }}>
                        Expense
                      </Text>
                    </View>
                    <Text style={{ color: theme.subText, fontSize: 13, marginLeft: 10 }}>
                      {getRelativeDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: "#EF4444",
                    fontSize: 22,
                    fontWeight: "900",
                    marginLeft: 10,
                    maxWidth: 116,
                  }}
                >
                  -{formatMoney(Number(item.amount))}
                </Text>
                <Ionicons name="chevron-forward" size={22} color={theme.subText} />
              </View>
            );
          })
        )}
      </Animated.View>
    </ScrollView>
  );
}

function MetricCard({
  title,
  amount,
  caption,
  icon,
  iconColor,
  iconBackground,
  backgroundColor,
}: {
  title: string;
  amount: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  backgroundColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 164,
        borderRadius: 26,
        backgroundColor,
        padding: 22,
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 24,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={30} color={iconColor} />
      </View>
      <Text style={{ color: "rgba(255,255,255,0.86)", fontSize: 18, marginTop: 18 }}>
        {title}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginTop: 10 }}
      >
        {amount}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.66)", fontSize: 14, marginTop: 14 }}>
        {caption}
      </Text>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: "900", flex: 1 }}>
        {title}
      </Text>
      <Text
        onPress={onPress}
        style={{ color: theme.primary, fontSize: 16, fontWeight: "700", marginRight: 6 }}
      >
        {action}
      </Text>
      <Ionicons name="chevron-forward" size={21} color={theme.subText} />
    </View>
  );
}

function EmptyState({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { theme } = useTheme();

  return (
    <View style={{ alignItems: "center", paddingVertical: 26 }}>
      <Ionicons name={icon} size={44} color={theme.primary} />
      <Text style={{ color: theme.subText, fontSize: 15, marginTop: 10 }}>{label}</Text>
    </View>
  );
}
