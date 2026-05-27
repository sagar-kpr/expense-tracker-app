import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { getCategoryMeta } from "@/components/categoryMeta";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";

type Transaction = {
  id: string;
  amount: number | string;
  description?: string;
  category?: string;
  type?: "income" | "expense";
  createdAt?: string | Date | { toDate?: () => Date };
};

const FILTERS = ["All", "Income", "Expense", "Today", "This Month"];
const RUPEE = "\u20B9";

const parseTransactionDate = (value: Transaction["createdAt"]) => {
  if (!value) return null;

  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (left: Date, right: Date) =>
  left.toDateString() === right.toDateString();

const getDateLabel = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const getTransactionTime = (date: Date | null) => {
  if (!date) return "--:--";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SelfEmployedHistoryScreen() {
  const { expenses } = useExpense();
  const { theme, dark } = useTheme();
  const styles = getStyles(theme);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);

    setTimeout(() => {
      setRefreshing(false);
    }, 900);
  };

  const filteredTransactions = useMemo(() => {
    const today = new Date();

    return [...(expenses as Transaction[])]
      .filter((item) => {
        const date = parseTransactionDate(item.createdAt);
        const transactionType = item.type || "expense";
        const text = `${item.description || ""} ${item.category || ""} ${
          item.amount || ""
        } ${transactionType}`.toLowerCase();
        const matchesSearch = text.includes(search.trim().toLowerCase());

        let matchesFilter = true;

        if (selectedFilter === "Income") {
          matchesFilter = transactionType === "income";
        } else if (selectedFilter === "Expense") {
          matchesFilter = transactionType === "expense";
        } else if (date && selectedFilter === "Today") {
          matchesFilter = isSameDay(date, today);
        } else if (date && selectedFilter === "This Month") {
          matchesFilter =
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
        } else if (!date && selectedFilter !== "All") {
          matchesFilter = false;
        }

        const matchesDate =
          !selectedDate || (date ? isSameDay(date, selectedDate) : false);

        return matchesSearch && matchesFilter && matchesDate;
      })
      .sort((left, right) => {
        const leftDate = parseTransactionDate(left.createdAt)?.getTime() || 0;
        const rightDate = parseTransactionDate(right.createdAt)?.getTime() || 0;

        return rightDate - leftDate;
      });
  }, [expenses, search, selectedFilter, selectedDate]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce<Record<string, Transaction[]>>(
      (groups, item) => {
        const date = parseTransactionDate(item.createdAt);
        const label = date ? getDateLabel(date) : "Unknown Date";

        if (!groups[label]) groups[label] = [];

        groups[label].push(item);

        return groups;
      },
      {},
    );
  }, [filteredTransactions]);

  const totals = useMemo(
    () =>
      filteredTransactions.reduce(
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
    [filteredTransactions],
  );

  const profit = totals.income - totals.expense;
  const formattedSelectedDate = selectedDate?.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
      <Animated.View entering={FadeInUp.duration(650)}>
        <Text style={styles.title}>Business History</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={22} color={theme.subText} />
          <TextInput
            placeholder="Search transactions..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={theme.subText}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterScroll}
        >
          {FILTERS.map((filter) => {
            const active = selectedFilter === filter;

            return (
              <Pressable
                key={filter}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFilter(filter);
                }}
                style={[styles.filterButton, active && styles.filterActive]}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.dateRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker((value) => !value);
            }}
            style={styles.dateButton}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.subText} />
            <Text style={styles.dateText}>
              {formattedSelectedDate || "Select Date"}
            </Text>
            <Ionicons name="chevron-down" size={17} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedDate(null);
            }}
            hitSlop={10}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={selectedDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              accentColor="#FFFFFF"
              textColor={theme.primary}
              onChange={(_event, date) => {
                if (Platform.OS !== "ios") {
                  setShowDatePicker(false);
                }

                if (date) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDate(date);
                }
              }}
            />
          </View>
        )}

        <View style={styles.summaryRow}>
          <SummaryCard
            color="#159665"
            icon="arrow-up"
            label="Income"
            value={totals.income}
          />
          <SummaryCard
            color="#202838"
            icon="arrow-down"
            label="Expense"
            value={totals.expense}
          />
        </View>

        <View style={styles.profitCard}>
          <View style={styles.profitIconBox}>
            <Ionicons
              name={profit < 0 ? "trending-down" : "trending-up"}
              size={26}
              color={profit < 0 ? "#EF4444" : "#159665"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profitLabel}>Net Profit</Text>
            <Text
              style={[
                styles.profitAmount,
                { color: profit < 0 ? "#EF4444" : theme.text },
              ]}
            >
              {profit < 0 ? "-" : ""}
              {RUPEE}
              {Math.abs(profit).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>
      </Animated.View>

      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={46} color={theme.primary} />
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptyText}>
            Income and business expenses will appear here.
          </Text>
        </View>
      ) : (
        Object.entries(groupedTransactions).map(([date, items], index) => (
          <Animated.View
            key={date}
            entering={FadeInUp.delay(100 + index * 80).duration(650)}
            style={styles.group}
          >
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{date}</Text>
              <Text style={styles.groupCount}>
                {items.length} transaction{items.length > 1 ? "s" : ""}
              </Text>
            </View>

            {items.map((item) => {
              const category = item.category || "Other";
              const isIncome = (item.type || "expense") === "income";
              const meta = getCategoryMeta(category);
              const dateValue = parseTransactionDate(item.createdAt);

              return (
                <View key={item.id} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        {
                          backgroundColor: isIncome ? "#EAF7F0" : meta.tint,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isIncome ? "sparkles" : meta.icon}
                        size={23}
                        color={isIncome ? "#159665" : meta.color}
                      />
                    </View>

                    <View style={styles.transactionInfo}>
                      <Text numberOfLines={1} style={styles.transactionTitle}>
                        {item.description || (isIncome ? "Income" : category)}
                      </Text>

                      <View style={styles.transactionMeta}>
                        <View
                          style={[
                            styles.categoryPill,
                            {
                              backgroundColor: isIncome ? "#DCFCE7" : "#FEE2E2",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                color: isIncome ? "#159665" : "#EF4444",
                              },
                            ]}
                          >
                            {isIncome ? "Income" : "Expense"}
                          </Text>
                        </View>

                        <Text style={styles.transactionTime}>
                          {getTransactionTime(dateValue)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: isIncome ? "#159665" : "#EF4444" },
                    ]}
                  >
                    {isIncome ? "+" : "-"}
                    {RUPEE}
                    {Number(item.amount || 0).toLocaleString("en-IN")}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
        ))
      )}
    </ScrollView>
  );
}

function SummaryCard({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  const { theme } = useTheme();

  return (
    <View style={[getStyles(theme).summaryCard, { backgroundColor: color }]}>
      <View style={getStyles(theme).summaryIconBox}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={getStyles(theme).summaryLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={getStyles(theme).summaryAmount}
      >
        {RUPEE}
        {value.toLocaleString("en-IN")}
      </Text>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 64,
      paddingBottom: 140,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "900",
      marginBottom: 22,
    },
    searchBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 60,
      paddingHorizontal: 18,
    },
    searchInput: {
      color: theme.text,
      flex: 1,
      fontSize: 15,
      marginLeft: 12,
      paddingVertical: 0,
    },
    filterScroll: {
      marginTop: 24,
    },
    filterContent: {
      gap: 10,
      paddingRight: 20,
    },
    filterButton: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: theme.primary,
      borderRadius: 22,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: 22,
    },
    filterActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      shadowColor: theme.primary,
    },
    filterText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    filterTextActive: {
      color: theme.card,
    },
    dateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 20,
      marginTop: 22,
    },
    dateButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    dateText: {
      color: theme.subText,
      fontSize: 14,
      fontWeight: "700",
      marginHorizontal: 14,
    },
    clearText: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: "700",
    },
    datePickerBox: {
      backgroundColor: theme.primary,
      borderRadius: 22,
      marginTop: 16,
      overflow: "hidden",
    },
    summaryRow: {
      flexDirection: "row",
      gap: 14,
      marginTop: 26,
    },
    summaryCard: {
      borderRadius: 24,
      flex: 1,
      minHeight: 138,
      padding: 18,
    },
    summaryIconBox: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      borderRadius: 18,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    summaryLabel: {
      color: "rgba(255,255,255,0.82)",
      fontSize: 15,
      marginTop: 14,
    },
    summaryAmount: {
      color: "#FFFFFF",
      fontSize: 25,
      fontWeight: "900",
      marginTop: 8,
    },
    profitCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: 16,
      minHeight: 90,
      paddingHorizontal: 18,
    },
    profitIconBox: {
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 18,
      height: 52,
      justifyContent: "center",
      marginRight: 14,
      width: 52,
    },
    profitLabel: {
      color: theme.subText,
      fontSize: 14,
      fontWeight: "700",
    },
    profitAmount: {
      fontSize: 28,
      fontWeight: "900",
      marginTop: 5,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 24,
      marginTop: 28,
      paddingHorizontal: 36,
      paddingVertical: 46,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 14,
    },
    emptyText: {
      color: theme.subText,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      textAlign: "center",
    },
    group: {
      marginTop: 28,
    },
    groupHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    groupTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "800",
    },
    groupCount: {
      color: theme.subText,
      fontSize: 13,
      fontWeight: "500",
    },
    transactionCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      minHeight: 86,
      paddingHorizontal: 16,
    },
    transactionLeft: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      minWidth: 0,
    },
    categoryIconBox: {
      alignItems: "center",
      borderRadius: 16,
      height: 48,
      justifyContent: "center",
      marginRight: 14,
      width: 48,
    },
    transactionInfo: {
      flex: 1,
      minWidth: 0,
    },
    transactionTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
    },
    transactionMeta: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 8,
    },
    categoryPill: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: "800",
    },
    transactionTime: {
      color: theme.subText,
      fontSize: 13,
      marginLeft: 12,
    },
    transactionAmount: {
      fontSize: 18,
      fontWeight: "900",
      marginLeft: 12,
    },
  });
