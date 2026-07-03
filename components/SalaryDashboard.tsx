import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
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

import { getCategoryMeta } from "@/components/categoryMeta";
import SalaryArrivalModal from "@/components/SalaryArrivalModal";
import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { usePendingTransactions } from "@/context/PendingTransactionContext";
import { useSalary } from "@/context/SalaryContext";
import { useTheme } from "@/context/ThemeContext";
import { useAmountVisibilityStore } from "@/store/useAmountVisibilityStore";

const RUPEE = "\u20B9";
const ACCENT_GREEN = "#2DD4BF"; //34D399
type DashboardExpense = {
  amount?: number | string | null;
  category?: string;
  createdAt?: string | Date | { toDate?: () => Date } | null;
  description?: string;
  id?: string;
  type?: "income" | "expense" | string;
};
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

const formatMaskedMoney = () => `${RUPEE} ••••••`;

// const formatMoney = (value: number) =>
//   `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

const getRelativeDate = (
  value: string | Date | { toDate?: () => Date } | null | undefined,
) => {
  if (!value) {
    return "Unknown date";
  }

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

export default function SalaryDashboard() {
  const router = useRouter();
  const { expenses } = useExpense();
  const { userData } = useAuth();
  const {
    confirmSalaryArrival,
    getCurrentArrivalStatus,
    getCycleExpenses,
    getCycleSummary,
  } = useSalary();
  const { pendingCount } = usePendingTransactions();
  const { theme, dark } = useTheme();
  const hidden = useAmountVisibilityStore((state) => state.hidden);
  const toggleVisibility = useAmountVisibilityStore((state) => state.toggle);
  const styles = useMemo(() => getStyles(theme, dark), [theme, dark]);
  const [refreshing, setRefreshing] = useState(false);
  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [dismissedReminderCycleKey, setDismissedReminderCycleKey] = useState<
    string | null
  >(null);

  const arrivalStatus = getCurrentArrivalStatus();
  const expenseItems = useMemo<DashboardExpense[]>(
    () => getCycleExpenses(arrivalStatus, expenses) as DashboardExpense[],
    [arrivalStatus, expenses, getCycleExpenses],
  );
  const cycleSummary = getCycleSummary(arrivalStatus.start, {
    expectedCycleStart: arrivalStatus.expectedStart,
    preferCurrentProfile: true,
  });
  const salary = Number(cycleSummary.salary || userData?.salary || 0);
  const spent = useMemo(
    () => expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenseItems],
  );
  const remaining = salary - spent;
  const saved = Math.max(remaining, 0);
  const savedPercent = salary > 0 ? Math.round((saved / salary) * 100) : 0;
  const usagePercent = salary > 0 ? (spent / salary) * 100 : 0;
  // const usageLabel = usagePercent > 999 ? "999" : "...";
  const usageLabel =
    spent > 0 && usagePercent < 1
      ? usagePercent.toFixed(2)
      : Math.round(usagePercent).toString();
  const progressWidth = Math.min(
    Math.max(usagePercent, spent > 0 ? 4 : 0),
    100,
  );

  const firstName = userData?.name?.trim()?.split(" ")[0];
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "☀️ Good Morning"
      : hour < 18
        ? "🌤️ Good Afternoon"
        : "🌙 Good Evening";

  const today = new Date();
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (arrivalStatus.end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );
  const safeToSpend = daysLeft > 0 ? remaining / daysLeft : remaining;
  const safeToSpendDisplay = Math.max(0, Math.round(safeToSpend));

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(progressWidth, { duration: 900 });
  }, [progress, progressWidth]);

  useEffect(() => {
    if (
      arrivalStatus.needsConfirmation &&
      dismissedReminderCycleKey !== arrivalStatus.expectedCycleKey
    ) {
      setReminderModalVisible(true);
      return;
    }

    setReminderModalVisible(false);
  }, [
    arrivalStatus.expectedCycleKey,
    arrivalStatus.needsConfirmation,
    dismissedReminderCycleKey,
  ]);

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
        percent: spent > 0 ? (value / spent) * 100 : 0,
        meta: getCategoryMeta(key),
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 10);
  }, [expenseItems, spent]);

  const recentTransactions = useMemo(
    () => expenseItems.slice(0, 5),
    [expenseItems],
  );

  const insightText = useMemo(() => {
    if (pendingCount > 0) {
      return `${pendingCount} transaction${pendingCount > 1 ? "s are" : " is"} waiting for review.`;
    }

    if (remaining < 0) {
      return `Over budget by ${formatMoney(Math.abs(remaining))}`;
    }

    if (categoryData[0]) {
      const percent = categoryData[0].percent;

      if (percent >= 70) {
        return `🚨 ${categoryData[0].key} dominates your spending (${percent.toFixed(1)}%).`;
      }

      if (percent >= 40) {
        return `🔥 ${categoryData[0].key} is your top spend at ${percent.toFixed(1)}%.`;
      }

      return `✨ ${categoryData[0].key} leads your spending at ${percent.toFixed(1)}%.`;
    }

    return "Start adding expenses to unlock cycle insights.";
  }, [categoryData, pendingCount, remaining]);

  const insightSummary = useMemo(() => {
    if (pendingCount > 0) {
      return `⏳ ${pendingCount} transaction${pendingCount > 1 ? "s" : ""} waiting for review`;
    }

    if (remaining < 0) {
      return `⚠️ Over budget by ${formatMoney(Math.abs(remaining))}`;
    }

    if (categoryData[0]) {
      const { key, percent } = categoryData[0];

      if (percent >= 70) {
        return `🔥 ${key} dominates spending (${percent.toFixed(1)}%)`;
      }

      if (percent >= 40) {
        return `📈 ${key} is your top category (${percent.toFixed(1)}%)`;
      }

      return `✨ ${key} leads this cycle (${percent.toFixed(1)}%)`;
    }

    return "💡 Start adding expenses to unlock insights";
  }, [categoryData, pendingCount, remaining]);

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
    <>
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

          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View style={styles.balanceTextWrap}>
                <Text style={styles.balanceLabel}>Remaining Balance</Text>
                <View style={styles.balanceAmountRow}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={styles.balanceAmount}
                  >
                    {hidden
                      ? formatMaskedMoney()
                      : `${remaining < 0 ? "-" : ""}${formatMoney(Math.abs(remaining))}`}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleVisibility();
                    }}
                    style={styles.inlineVisibilityButton}
                  >
                    <Ionicons
                      color="#F3F0FF"
                      name={hidden ? "eye-outline" : "eye-off-outline"}
                      size={18}
                    />
                  </Pressable>
                </View>
                <Text style={styles.balanceMeta}>
                  {hidden
                    ? "Income hidden • Spent hidden"
                    : `Income ${formatMoney(salary)} • Spent ${formatMoney(spent)}`}
                </Text>
              </View>

              <View style={styles.walletIconWrap}>
                <Ionicons name="wallet-outline" size={24} color="#F3F0FF" />
              </View>
            </View>

            <View style={styles.balanceDetailGrid}>
              <View style={styles.detailPanel}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.detailLabel}
                >
                  Safe to Spend Today
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={styles.safeSpendValue}
                >
                  {formatMoney(safeToSpendDisplay)}
                  <Text style={styles.detailUnit}>/day</Text>
                </Text>
                <Text style={styles.detailCaption}>{daysLeft} days left</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailPanel}>
                <Text style={styles.detailLabel}>Monthly Usage</Text>
                <Text style={styles.usageValue}>
                  {usageLabel}
                  {usagePercent > 999 ? "+" : "%"}
                </Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      progressStyle,
                      {
                        backgroundColor:
                          remaining < 0 ? "#F87171" : ACCENT_GREEN,
                      },
                    ]}
                  />
                </View>
                <View style={styles.limitRow}>
                  <Ionicons
                    name={remaining < 0 ? "warning" : "shield-checkmark"}
                    size={14}
                    color={remaining < 0 ? "#FECACA" : "#86EFAC"}
                  />
                  <Text style={styles.limitText}>
                    {remaining < 0 ? "Limit Crossed" : "Within Limit"}
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
              value={hidden ? formatMaskedMoney() : formatMoney(salary)}
              caption="Salary"
              icon="wallet-outline"
              iconColor="#159665"
              iconBackground="#C4F1DE"
              backgroundColor="#ECFCF6"
              borderColor="rgba(21,150,101,0.12)"
            />
            <OverviewCard
              title="Spent"
              value={hidden ? formatMaskedMoney() : formatMoney(spent)}
              caption="Used"
              icon="arrow-down-circle"
              iconColor="#EF4444"
              iconBackground="#FFD9D6"
              backgroundColor="#FFF1F0"
              borderColor="rgba(239,68,68,0.12)"
            />
            <OverviewCard
              title="Daily Budget"
              value={
                hidden ? formatMaskedMoney() : formatMoney(safeToSpendDisplay)
              }
              caption={`${daysLeft} days left`}
              icon="calendar-outline"
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
            <Text style={styles.insightText}>{insightSummary}</Text>
          </View>
          {/* {pendingCount >= 0 ? (
          <Pressable
            hitSlop={8}
            onPress={() => router.push("/pending-transactions" as any)}
          >
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </Pressable>
        ) : (
          ""
          // <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )} */}
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
              const meta = getCategoryMeta(item.category || "Other");

              return (
                <View key={item.id} style={styles.transactionRow}>
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.transactionIconWrap,
                        {
                          backgroundColor: meta.tint,
                        },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={styles.transactionTextWrap}>
                      <Text numberOfLines={1} style={styles.transactionTitle}>
                        {item.description || item.category || "Expense"}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {getRelativeDate(item.createdAt)} {"\u2022"} Expense
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transactionAmount}>
                    -{formatMoney(Number(item.amount || 0))}
                  </Text>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setReminderModalVisible(false)}
        transparent
        visible={reminderModalVisible}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.48)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Animated.View
            entering={FadeInUp.duration(320)}
            style={styles.reminderModal}
          >
            <View style={styles.reminderIconWrap}>
              <Ionicons name="wallet-outline" size={28} color="#159665" />
            </View>
            <Text style={styles.reminderTitle}>Salary day check-in</Text>
            <Text style={styles.reminderText}>
              Has your salary arrived for this cycle?
            </Text>

            <View style={styles.reminderActions}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDismissedReminderCycleKey(arrivalStatus.expectedCycleKey);
                  setReminderModalVisible(false);
                }}
                style={[styles.reminderButton, styles.notYetButton]}
              >
                <Text style={styles.notYetButtonText}>Not yet</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReminderModalVisible(false);
                  setArrivalModalVisible(true);
                }}
                style={[styles.reminderButton, styles.arrivedButton]}
              >
                <Text style={styles.arrivedButtonText}>Arrived</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
      <SalaryArrivalModal
        initialDate={new Date()}
        maximumDate={new Date()}
        minimumDate={new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)}
        onClose={() => setArrivalModalVisible(false)}
        onConfirm={async (arrivedAtMs) => {
          try {
            setConfirmingArrival(true);
            await confirmSalaryArrival({
              arrivedAtMs,
              source: "dashboard",
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setDismissedReminderCycleKey(arrivalStatus.expectedCycleKey);
            setArrivalModalVisible(false);
          } catch (error) {
            console.log("Dashboard salary arrival error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } finally {
            setConfirmingArrival(false);
          }
        }}
        saving={confirmingArrival}
        title="Confirm Salary Arrival"
        visible={arrivalModalVisible}
      />
    </>
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
      paddingTop: 60,
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
      marginTop: 22,
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
    balanceAmountRow: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
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
    inlineVisibilityButton: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 14,
      height: 36,
      justifyContent: "center",
      width: 36,
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
    detailUnit: {
      color: "#BBF7D0",
      fontSize: 11,
      fontWeight: "600",
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
      fontSize: 13,
      fontWeight: "700",
      marginLeft: 6,
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
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    reminderModal: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      paddingHorizontal: 22,
      paddingVertical: 24,
      width: "100%",
    },
    reminderIconWrap: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(21,150,101,0.15)" : "#E7F8F0",
      borderRadius: 28,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    reminderTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 16,
    },
    reminderText: {
      color: theme.subText,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 8,
      textAlign: "center",
    },
    reminderActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
      width: "100%",
    },
    reminderButton: {
      alignItems: "center",
      borderRadius: 16,
      flex: 1,
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    notYetButton: {
      backgroundColor: theme.border,
    },
    notYetButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
    },
    arrivedButton: {
      backgroundColor: "#159665",
    },
    arrivedButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
    arrivalPrompt: {
      alignItems: "center",
      backgroundColor: dark ? "#1A2730" : "#E9F6FF",
      borderColor: dark ? "#244655" : "#C7E7FA",
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 14,
      marginTop: 18,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    arrivalPromptLeft: {
      flex: 1,
      minWidth: 0,
    },
    arrivalPromptTitle: {
      color: dark ? "#F5FBFF" : "#0F2940",
      fontSize: 15,
      fontWeight: "900",
    },
    arrivalPromptText: {
      color: dark ? "#C7D7E2" : "#35556B",
      fontSize: 13,
      lineHeight: 20,
      marginTop: 4,
    },
    arrivalPromptButton: {
      alignItems: "center",
      backgroundColor: "#159665",
      borderRadius: 14,
      flexDirection: "row",
      gap: 6,
      height: 42,
      justifyContent: "center",
      minWidth: 104,
      paddingHorizontal: 14,
    },
    arrivalPromptButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "900",
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
      color: "#EF4444",
      fontSize: 15,
      fontWeight: "800",
      marginLeft: 8,
    },
  });
