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
import { getCategoryMeta } from "@/components/categoryMeta";


const formatMoney = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

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

export default function SelfEmployedDashboard() {
  const router = useRouter();
  const { expenses } = useExpense();
  const { userData } = useAuth();
  const { theme, dark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const income = useMemo(
    () =>
      expenses
        .filter((item) => (item.type || "expense") === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses],
  );

  const expense = useMemo(
    () =>
      expenses
        .filter((item) => (item.type || "expense") === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses],
  );

  const netProfit = income - expense;
  const ratio = income > 0 ? Math.round((expense / income) * 100) : 0;
  const cappedRatio = Math.min(ratio, netProfit < 0 ? 85 : 100);
  const firstName = userData?.name?.trim()?.split(" ")[0];

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good Morning ☀️"
      : hour < 18
        ? "Good Afternoon 🌤️"
        : "Good Evening 🌙";

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
      percent: expense > 0 ? ((value / expense) * 100).toFixed(1) : "0.0",
      meta: getCategoryMeta(key),
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
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 130,
      }}
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
      <Text style={{ color: theme.text, fontSize: 16 }}>
        {firstName ? `${greeting}, ${firstName}` : greeting}
      </Text>

      <Text
        style={{
          color: theme.text,
          fontSize: 36,
          fontWeight: "900",
          marginTop: 6,
          letterSpacing: 0,
        }}
      >
        Dashboard
      </Text>

      <Animated.View
        entering={FadeInUp.delay(100).duration(650)}
        style={{ marginTop: 28 }}
      >
        <View style={{ flexDirection: "row", gap: 14 }}>
          <MetricCard
            title="Income"
            amount={formatMoney(income)}
            caption="Total earnings"
            icon="wallet"
            iconColor="#FFFFFF"
            iconBackground="rgba(255,255,255,0.16)"
            backgroundColor={dark ? "#11735E" : "#159B7D"}
          />
          <MetricCard
            title="Expense"
            amount={formatMoney(expense)}
            caption="Business spending"
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
            overflow: "hidden",
            backgroundColor: dark ? "#2A1D62" : "#37206F",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                backgroundColor: "rgba(139,92,246,0.28)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="stats-chart" size={29} color="#9E75FF" />
            </View>
            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 17 }}>
                Net Profit
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: "#FFFFFF",
                  fontSize: 36,
                  fontWeight: "900",
                  marginTop: 14,
                  letterSpacing: 0,
                }}
              >
                {netProfit < 0 ? "-" : ""}
                {formatMoney(Math.abs(netProfit))}
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
            <Text
              style={{ color: "rgba(255,255,255,0.66)", fontSize: 16, flex: 1 }}
            >
              Income after all expenses
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 9,
                backgroundColor:
                  netProfit < 0
                    ? "rgba(248,113,113,0.25)"
                    : "rgba(34,197,94,0.2)",
              }}
            >
              <Ionicons
                name={netProfit < 0 ? "trending-down" : "trending-up"}
                size={16}
                color={netProfit < 0 ? "#FF7B7B" : "#86EFAC"}
              />
              <Text
                style={{
                  color: netProfit < 0 ? "#FF8F8F" : "#BBF7D0",
                  fontSize: 13,
                  fontWeight: "800",
                  marginLeft: 8,
                }}
              >
                {netProfit < 0 ? "Running at loss" : "Profit running"}
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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 21,
              fontWeight: "900",
              flex: 1,
            }}
          >
            Monthly Cash Flow
          </Text>
          <View
            style={{
              backgroundColor: netProfit < 0 ? "#FEE2E2" : "#DCFCE7",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                color: netProfit < 0 ? "#DC2626" : "#159665",
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              {netProfit < 0 ? "Loss Running" : "Profit Running"}
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
                backgroundColor: netProfit < 0 ? "#F04454" : "#18A66D",
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
          <Text style={{ color: theme.text, fontSize: 15 }}>
            Expense Ratio: {ratio}%
          </Text>
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}>
            <Text style={{ color: "#EF4444", fontWeight: "900" }}>
              {formatMoney(expense)}
            </Text>{" "}
            of {formatMoney(income)}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(300).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 24,
          padding: 22,
          marginTop: 24,
        }}
      >
        <SectionHeader
          title="By Category"
          action="See All"
          onPress={() => router.push("/analytics")}
        />

        {categoryData.length === 0 ? (
          <EmptyState icon="pie-chart" label="No category data yet" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categoryData.map((item) => (
              <View
                key={item.key}
                style={{
                  width: 100,
                  minHeight: 134,
                  borderRadius: 18,
                  padding: 14,
                  alignItems: "center",
                  backgroundColor: item.meta.tint,
                  marginRight: 12,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.55)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={item.meta.icon}
                    size={24}
                    color={item.meta.color}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#5F6368",
                    fontSize: 14,
                    marginTop: 12,
                    maxWidth: 82,
                  }}
                >
                  {item.key}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: item.meta.color,
                    fontSize: 17,
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
        style={{
          backgroundColor: theme.card,
          borderRadius: 24,
          padding: 22,
          marginTop: 24,
        }}
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
            const isIncome = (item.type || "expense") === "income";
            const meta = isIncome
              ? getCategoryMeta(item.category || "Freelance")
              : getCategoryMeta(item.category || "Other");

            return (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: index === 0 ? 2 : 16,
                  paddingBottom: 16,
                  borderBottomWidth:
                    index === Math.min(expenses.length, 5) - 1 ? 0 : 1,
                  borderBottomColor: theme.border,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 18,
                    backgroundColor: meta.tint,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons
                    name={isIncome ? "sparkles" : meta.icon}
                    size={23}
                    color={isIncome ? "#159665" : meta.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.text,
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    {item.description ||
                      (isIncome ? "From customer" : item.category || "Other")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 7,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isIncome ? "#DCFCE7" : "#FEE2E2",
                        borderRadius: 999,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: isIncome ? "#159665" : "#EF4444",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {isIncome ? "Income" : "Expense"}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: theme.subText,
                        fontSize: 13,
                        marginLeft: 10,
                      }}
                    >
                      {getRelativeDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    color: isIncome ? "#159665" : "#EF4444",
                    fontSize: 18,
                    fontWeight: "900",
                    marginLeft: 10,
                    maxWidth: 116,
                  }}
                >
                  {isIncome ? "+" : "-"}
                  {formatMoney(Number(item.amount))}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.subText}
                />
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
        minHeight: 150,
        borderRadius: 26,
        backgroundColor,
        padding: 20,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 20,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={25} color={iconColor} />
      </View>
      <Text
        style={{ color: "rgba(255,255,255,0.86)", fontSize: 16, marginTop: 16 }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: "#FFFFFF",
          fontSize: 28,
          fontWeight: "900",
          marginTop: 8,
        }}
      >
        {amount}
      </Text>
      <Text
        style={{ color: "rgba(255,255,255,0.66)", fontSize: 13, marginTop: 12 }}
      >
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
      <Text
        style={{ color: theme.text, fontSize: 21, fontWeight: "900", flex: 1 }}
      >
        {title}
      </Text>
      <Text
        onPress={onPress}
        style={{
          color: theme.primary,
          fontSize: 15,
          fontWeight: "700",
          marginRight: 6,
        }}
      >
        {action}
      </Text>
      <Ionicons name="chevron-forward" size={19} color={theme.subText} />
    </View>
  );
}

function EmptyState({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={{ alignItems: "center", paddingVertical: 26 }}>
      <Ionicons name={icon} size={38} color={theme.primary} />
      <Text style={{ color: theme.subText, fontSize: 15, marginTop: 10 }}>
        {label}
      </Text>
    </View>
  );
}
