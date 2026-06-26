import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AppUpdateCard from "@/components/AppUpdateCard";
import { getCategoryMeta } from "@/components/categoryMeta";
import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { usePendingTransactions } from "@/context/PendingTransactionContext";
import { useTheme } from "@/context/ThemeContext";

const RUPEE = "\u20B9";
const ACCENT_GREEN = "#2DD4BF";

const formatMoney = (value: number) => {
  const amount = Number(value || 0);

  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `${RUPEE}${Number(cr.toFixed(1))} Cr`;
  }

  if (amount >= 1000000) {
    const lakh = amount / 100000;
    return `${RUPEE}${Number(lakh.toFixed(1))} L`;
  }

  return `${RUPEE}${amount.toLocaleString("en-IN")}`;
};

const getRelativeDate = (value: string | Date | { toDate?: () => Date }) => {
  const expenseDate =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  if (Number.isNaN(expenseDate.getTime())) {
    return "Unknown date";
  }

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
  });
};

export default function SelfEmployedDashboard() {
  const router = useRouter();
  const { currentMonthExpenses } = useExpense();
  const { userData } = useAuth();
  const { pendingCount } = usePendingTransactions();
  const { theme, dark } = useTheme();
  const styles = useMemo(() => getStyles(theme, dark), [theme, dark]);
  const [refreshing, setRefreshing] = useState(false);

  const incomeItems = useMemo(
    () =>
      currentMonthExpenses.filter(
        (item) => (item.type || "expense") === "income",
      ),
    [currentMonthExpenses],
  );

  const expenseItems = useMemo(
    () =>
      currentMonthExpenses.filter(
        (item) => (item.type || "expense") === "expense",
      ),
    [currentMonthExpenses],
  );

  const income = useMemo(
    () => incomeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [incomeItems],
  );

  const expense = useMemo(
    () => expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenseItems],
  );

  const netProfit = income - expense;
  const saved = Math.max(netProfit, 0);
  const profitMargin = income > 0 ? (saved / income) * 100 : 0;
  const expenseRatio = income > 0 ? (expense / income) * 100 : 0;
  const ratioLabel =
    expenseRatio > 999
      ? "999%+"
      : expense > 0 && expenseRatio < 1
        ? `${expenseRatio.toFixed(2)}%`
        : `${Math.round(expenseRatio)}%`;
  const progressWidth = Math.min(
    Math.max(expenseRatio, expense > 0 ? 4 : 0),
    100,
  );

  const avgSale =
    incomeItems.length > 0 ? Math.round(income / incomeItems.length) : 0;
  const avgSpend =
    expenseItems.length > 0 ? Math.round(expense / expenseItems.length) : 0;

  const firstName = userData?.name?.trim()?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(progressWidth, { duration: 900 });
  }, [progress, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  const categoryData = useMemo(() => {
    const grouped = expenseItems.reduce<Record<string, number>>((acc, item) => {
      const category = item.category || "Other";

      acc[category] = (acc[category] || 0) + Number(item.amount || 0);

      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([key, value]) => ({
        key,
        value,
        percent: expense > 0 ? (value / expense) * 100 : 0,
        meta: getCategoryMeta(key),
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 10);
  }, [expense, expenseItems]);

  const recentTransactions = useMemo(
    () => currentMonthExpenses.slice(0, 5),
    [currentMonthExpenses],
  );

  const largestExpense = useMemo(() => {
    if (expenseItems.length === 0) return null;

    return expenseItems.reduce((largest, current) =>
      Number(current.amount || 0) > Number(largest.amount || 0)
        ? current
        : largest,
    );
  }, [expenseItems]);

  const insightText = useMemo(() => {
    if (pendingCount > 0) {
      return `${pendingCount} transaction${pendingCount > 1 ? "s are" : " is"} waiting for review.`;
    }

    if (netProfit < 0) {
      return `📉 Running at a loss of ${formatMoney(Math.abs(netProfit))}`;
    }
    if (largestExpense) {
      return `💸 Largest expense: ${
        largestExpense.category || "Other"
      } ${formatMoney(Number(largestExpense.amount || 0))}`;
    }
    if (categoryData[0]) {
      const percent = categoryData[0].percent;

      if (percent >= 70) {
        return `🔥 ${categoryData[0].key} dominates spending (${percent.toFixed(1)}%)`;
      }

      if (percent >= 40) {
        return `📈 ${categoryData[0].key} is your top category (${percent.toFixed(1)}%)`;
      }

      return `✨ ${categoryData[0].key} leads this month (${percent.toFixed(1)}%)`;
    }

    if (income > 0) {
      return `📈 Profit margin is ${Math.round(profitMargin)}% this month`;
    }

    return "Start logging income and expenses to unlock insights.";
  }, [categoryData, income, netProfit, pendingCount, profitMargin]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    progress.value = 0;

    setTimeout(() => {
      progress.value = withTiming(progressWidth, { duration: 900 });
      setRefreshing(false);
    }, 650);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
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
      <Animated.View entering={FadeInUp.duration(500)}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>

          <Pressable
            hitSlop={10}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (pendingCount > 0) {
                router.push("/pending-transactions" as any);
              }
            }}
            style={styles.notificationButton}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.text}
            />
            {pendingCount > 0 && (
              <View style={styles.notificationDot}>
                <Text style={styles.notificationCount}>
                  {pendingCount > 9 ? "9+" : pendingCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <AppUpdateCard />

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTextWrap}>
              <Text style={styles.balanceLabel}>Profit This Month</Text>{" "}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={styles.balanceAmount}
              >
                {netProfit < 0 ? "-" : ""}
                {formatMoney(Math.abs(netProfit))}
              </Text>
              <Text style={styles.balanceMeta}>
                Income {formatMoney(income)} {"\u2022"} Expense{" "}
                {formatMoney(expense)}
              </Text>
            </View>

            <View style={styles.walletIconWrap}>
              <Ionicons name="stats-chart-outline" size={24} color="#F3F0FF" />
            </View>
          </View>

          <View style={styles.balanceDetailGrid}>
            <View style={styles.detailPanel}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.detailLabel}
              >
                Avg Sale
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={styles.safeSpendValue}
              >
                {formatMoney(avgSale)}
              </Text>
              <Text style={styles.detailCaption}>
                {incomeItems.length} income record
                {incomeItems.length === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailPanel}>
              <Text style={styles.detailLabel}>Expense Ratio</Text>
              <Text style={styles.usageValue}>{ratioLabel}</Text>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    progressStyle,
                    {
                      backgroundColor: netProfit < 0 ? "#F87171" : ACCENT_GREEN,
                    },
                  ]}
                />
              </View>
              <View style={styles.limitRow}>
                <Ionicons
                  name={netProfit < 0 ? "warning" : "trending-up"}
                  size={14}
                  color={netProfit < 0 ? "#FECACA" : "#86EFAC"}
                />
                <Text style={styles.limitText}>
                  {netProfit < 0 ? "In Loss" : "Profitable"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(80).duration(500)}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Quick Overview</Text>

        <View style={styles.overviewRow}>
          <OverviewCard
            title="Income"
            value={formatMoney(income)}
            caption="This month"
            icon="wallet-outline"
            iconColor="#159665"
            iconBackground="#C4F1DE"
            backgroundColor="#ECFCF6"
            borderColor="rgba(21,150,101,0.12)"
          />
          <OverviewCard
            title="Expense"
            value={formatMoney(expense)}
            caption="Spent"
            icon="arrow-down-circle"
            iconColor="#EF4444"
            iconBackground="#FFD9D6"
            backgroundColor="#FFF1F0"
            borderColor="rgba(239,68,68,0.12)"
          />
          <OverviewCard
            title="Profit Margin"
            value={netProfit < 0 ? "Loss" : `${Math.round(profitMargin)}%`}
            caption={netProfit < 0 ? "Negative" : "Healthy"}
            icon="trending-up-outline"
            iconColor="#7C3AED"
            iconBackground="#E4D5FF"
            backgroundColor="#F6F1FF"
            borderColor="rgba(124,58,237,0.12)"
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(140).duration(500)}
        style={styles.insightCard}
      >
        <View style={styles.insightHeader}>
          <View style={styles.insightIconWrap}>
            <Animated.View entering={FadeInUp.delay(300).duration(600)}>
              <Ionicons name="sparkles" size={22} color="#10B981" />
            </Animated.View>
          </View>
          <Text style={styles.insightTitle}>Insight</Text>
        </View>
        <View style={styles.insightBody}>
          <Text style={styles.insightText}>{insightText}</Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        style={styles.section}
      >
        <SectionHeader
          title="By Category"
          action="See All"
          onPress={() => router.push("/analytics")}
        />

        {categoryData.length === 0 ? (
          <EmptyState label="No category data yet" />
        ) : (
          categoryData.map((item) => (
            <View key={item.key} style={styles.categoryRow}>
              <View style={styles.categoryLeft}>
                <View
                  style={[
                    styles.categoryIconWrap,
                    {
                      backgroundColor: item.meta.tint,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.meta.icon}
                    size={18}
                    color={item.meta.color}
                  />
                </View>

                <View style={styles.categoryContent}>
                  <View style={styles.categoryTopRow}>
                    <View>
                      <Text style={styles.categoryName}>{item.key}</Text>

                      <Text
                        style={[
                          styles.categoryAmount,
                          { color: item.meta.color },
                        ]}
                      >
                        {formatMoney(item.value)}
                      </Text>
                    </View>

                    <Text style={styles.categoryPercent}>
                      {item.percent.toFixed(1)}%
                    </Text>
                  </View>

                  <View style={styles.categoryTrack}>
                    <View
                      style={[
                        styles.categoryFill,
                        {
                          width: `${Math.min(item.percent, 100)}%`,
                          backgroundColor: item.meta.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(260).duration(500)}
        style={styles.section}
      >
        <SectionHeader
          title="Recent Transactions"
          action="See All"
          onPress={() => router.push("/history")}
        />

        {recentTransactions.length === 0 ? (
          <EmptyState label="No transactions yet" />
        ) : (
          recentTransactions.map((item) => {
            const isIncome = (item.type || "expense") === "income";
            const meta = isIncome
              ? getCategoryMeta(item.category || "Freelance")
              : getCategoryMeta(item.category || "Other");

            return (
              <View key={item.id} style={styles.transactionRow}>
                <View style={styles.transactionLeft}>
                  <View
                    style={[
                      styles.transactionIconWrap,
                      {
                        backgroundColor: isIncome ? "#EAF7F0" : meta.tint,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isIncome ? "sparkles" : meta.icon}
                      size={20}
                      color={isIncome ? "#159665" : meta.color}
                    />
                  </View>
                  <View style={styles.transactionTextWrap}>
                    <Text numberOfLines={1} style={styles.transactionTitle}>
                      {item.description ||
                        (isIncome
                          ? "Customer payment"
                          : item.category || "Expense")}
                    </Text>
                    <Text style={styles.transactionMeta}>
                      {getRelativeDate(item.createdAt)} {"\u2022"}{" "}
                      {isIncome ? "Income" : "Expense"}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.transactionAmount,
                    { color: isIncome ? "#159665" : "#EF4444" },
                  ]}
                >
                  {isIncome ? "+" : "-"}
                  {formatMoney(Number(item.amount || 0))}
                </Text>
              </View>
            );
          })
        )}
      </Animated.View>
    </ScrollView>
  );
}

function OverviewCard({
  title,
  value,
  caption,
  icon,
  iconColor,
  iconBackground,
  backgroundColor,
  borderColor,
}: {
  title: string;
  value: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  backgroundColor: string;
  borderColor: string;
}) {
  return (
    <View style={[stylesShared.overviewCard, { backgroundColor, borderColor }]}>
      <View
        style={[
          stylesShared.overviewIconWrap,
          { backgroundColor: iconBackground },
        ]}
      >
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={stylesShared.overviewTitle}>{title}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={stylesShared.overviewValue}
      >
        {value}
      </Text>
      <Text style={stylesShared.overviewCaption}>{caption}</Text>
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
    <View style={stylesShared.sectionHeader}>
      <Text style={[stylesShared.sectionHeaderTitle, { color: theme.text }]}>
        {title}
      </Text>
      <Pressable hitSlop={8} onPress={onPress}>
        <Text style={stylesShared.sectionHeaderAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  const { theme } = useTheme();

  return (
    <View style={stylesShared.emptyState}>
      <Ionicons name="receipt-outline" size={24} color={theme.subText} />
      <Text style={[stylesShared.emptyLabel, { color: theme.subText }]}>
        {label}
      </Text>
    </View>
  );
}

const stylesShared = StyleSheet.create({
  overviewCard: {
    borderWidth: 1,
    borderRadius: 20,
    flex: 1,
    minHeight: 112,
    padding: 14,
    shadowColor: "#050303",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.015,
    shadowRadius: 8,
    elevation: 1,
  },
  overviewIconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  overviewTitle: {
    color: "#3F3F46",
    fontSize: 12,
    marginTop: 16,
    fontWeight: "500",
    opacity: 0.8,
  },
  overviewValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
  },
  overviewCaption: {
    color: "#52525B",
    fontSize: 13,
    marginTop: 6,
    opacity: 0.75,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  sectionHeaderAction: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyLabel: {
    fontSize: 14,
    marginTop: 10,
  },
});

const getStyles = (theme: any, dark: boolean) =>
  StyleSheet.create({
    screen: {
      backgroundColor: dark ? "#111316" : "#FAFAFA",
      flex: 1,
    },
    content: {
      paddingBottom: 130,
      paddingHorizontal: 20,
      paddingTop: 62,
    },
    headerRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    headerTextWrap: {
      flex: 1,
      paddingRight: 16,
    },
    greeting: {
      color: theme.text,
      fontSize: 16,
      opacity: 0.92,
    },
    title: {
      color: theme.text,
      fontSize: 34,
      letterSpacing: -1,
      fontWeight: "900",
      marginTop: 8,
    },
    notificationButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 16,
      height: 44,
      justifyContent: "center",
      marginTop: 4,
      width: 44,
    },
    notificationDot: {
      alignItems: "center",
      backgroundColor: "#EF4444",
      borderColor: theme.card,
      borderRadius: 999,
      borderWidth: 2,
      height: 20,
      justifyContent: "center",
      minWidth: 20,
      paddingHorizontal: 4,
      position: "absolute",
      right: -2,
      top: -2,
    },
    notificationCount: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
    },
    balanceCard: {
      backgroundColor: "#371872",
      borderRadius: 28,
      marginTop: 18,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    balanceTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingRight: 16,
    },
    balanceLabel: {
      color: "rgba(255,255,255,0.86)",
      fontSize: 16,
      fontWeight: "600",
    },
    balanceAmount: {
      color: "#FFFFFF",
      fontSize: 34,
      fontWeight: "900",
      marginTop: 4,
      letterSpacing: -1,
    },
    balanceMeta: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 14,
      marginTop: 10,
    },
    walletIconWrap: {
      alignItems: "center",
      backgroundColor: "#6D4BCF",
      borderRadius: 20,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    balanceDetailGrid: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderRadius: 22,
      flexDirection: "row",
      marginTop: 22,
      overflow: "hidden",
    },
    detailPanel: {
      flex: 1,
      padding: 16,
    },
    detailDivider: {
      width: 1,
      height: 72,
      alignSelf: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    detailLabel: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 13,
      fontWeight: "500",
    },
    safeSpendValue: {
      color: ACCENT_GREEN,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 12,
    },
    usageValue: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "800",
      marginTop: 8,
    },
    detailCaption: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 13,
      marginTop: 10,
    },
    progressTrack: {
      backgroundColor: "rgba(255,255,255,0.28)",
      borderRadius: 999,
      height: 8,
      marginTop: 12,
      overflow: "hidden",
    },
    progressFill: {
      borderRadius: 999,
      height: "100%",
    },
    limitRow: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 10,
    },
    limitText: {
      color: "#D1FAE5",
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 6,
      flexShrink: 1,
    },
    section: {
      marginTop: 28,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 16,
    },
    overviewRow: {
      flexDirection: "row",
      gap: 10,
    },
    insightCard: {
      alignItems: "stretch",
      backgroundColor: dark ? "rgba(52,211,153,0.15)" : "#DCFCE7",
      borderWidth: 1,
      borderColor: dark ? "rgba(52,211,153,0.20)" : "#BBF7D0",
      borderRadius: 18,
      flexDirection: "column",
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    insightHeader: {
      alignItems: "center",
      flexDirection: "row",
    },
    insightIconWrap: {
      alignItems: "center",
      backgroundColor: "#CFF8E7",
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      marginRight: 12,
      width: 36,
    },
    insightBody: {
      marginTop: 4,
    },
    insightTitle: {
      color: dark ? "#A7F3D0" : "#059669",
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 0,
    },
    insightText: {
      color: dark ? "#D1FAE5" : "#166534",
      fontSize: 14,
      lineHeight: 21,
      marginTop: 2,
    },
    categoryRow: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    categoryLeft: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      marginRight: 12,
      minWidth: 0,
    },
    categoryIconWrap: {
      alignItems: "center",
      borderRadius: 14,
      height: 42,
      justifyContent: "center",
      marginRight: 14,
      width: 42,
    },
    categoryContent: {
      flex: 1,
      minWidth: 0,
    },
    categoryTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    categoryName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    categoryPercent: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "600",
      marginLeft: 12,
    },
    categoryTrack: {
      backgroundColor: dark ? "#272B31" : "#ECECEC",
      borderRadius: 999,
      height: 6,
      overflow: "hidden",
    },
    categoryFill: {
      borderRadius: 999,
      height: "100%",
    },
    categoryAmount: {
      marginTop: 3,
      fontSize: 14,
      fontWeight: "800",
    },
    transactionRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.card,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: dark ? 0.15 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    transactionLeft: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      marginRight: 12,
      minWidth: 0,
    },
    transactionIconWrap: {
      alignItems: "center",
      borderRadius: 16,
      height: 46,
      justifyContent: "center",
      marginRight: 12,
      width: 46,
    },
    transactionTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    transactionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "700",
    },
    transactionMeta: {
      color: theme.subText,
      fontSize: 12,
      marginTop: 4,
    },
    transactionAmount: {
      fontSize: 15,
      fontWeight: "800",
      marginLeft: 8,
    },
  });
