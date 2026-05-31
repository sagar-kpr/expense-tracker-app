import { useTheme } from "@/context/ThemeContext";
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

type Expense = {
  id: string;
  amount: number | string;
  description?: string;
  category?: string;
  createdAt?: string | Date | { toDate?: () => Date };
};

const FILTERS = ["All", "Today", "Yesterday", "Current Cycle"];
const RUPEE = "\u20B9";

const parseExpenseDate = (value: Expense["createdAt"]) => {
  if (!value) {
    return null;
  }

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

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const getExpenseTime = (date: Date | null) => {
  if (!date) {
    return "--:--";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function HistoryScreen() {
  const { expenses, salaryCycleExpenses } = useExpense();
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

  const filteredExpenses = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    return [...(expenses as Expense[])]
      .filter((item) => {
        const date = parseExpenseDate(item.createdAt);
        const text = `${item.description || ""} ${item.category || ""} ${
          item.amount || ""
        }`.toLowerCase();

        const matchesSearch = text.includes(search.trim().toLowerCase());

        let matchesFilter = true;

        if (date && selectedFilter === "Today") {
          matchesFilter = isSameDay(date, today);
        } else if (date && selectedFilter === "Yesterday") {
          matchesFilter = isSameDay(date, yesterday);
        } else if (selectedFilter === "Current Cycle") {
          matchesFilter = salaryCycleExpenses.some(
            (expense) => expense.id === item.id,
          );
        } else if (!date && selectedFilter !== "All") {
          matchesFilter = false;
        }

        const matchesDate =
          !selectedDate || (date ? isSameDay(date, selectedDate) : false);

        return matchesSearch && matchesFilter && matchesDate;
      })
      .sort((left, right) => {
        const leftDate = parseExpenseDate(left.createdAt)?.getTime() || 0;
        const rightDate = parseExpenseDate(right.createdAt)?.getTime() || 0;

        return rightDate - leftDate;
      });
  }, [expenses, search, selectedFilter, selectedDate]);

  const groupedExpenses = useMemo(() => {
    return filteredExpenses.reduce<Record<string, Expense[]>>(
      (groups, item) => {
        const date = parseExpenseDate(item.createdAt);
        const label = date ? getDateLabel(date) : "Unknown Date";

        if (!groups[label]) {
          groups[label] = [];
        }

        groups[label].push(item);

        return groups;
      },
      {},
    );
  }, [filteredExpenses]);

  const totalSpent = useMemo(
    () =>
      filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredExpenses],
  );

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
        <Text style={styles.title}>History</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={25} color={theme.subText} />
          <TextInput
            placeholder="Search expenses..."
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
            <Ionicons name="calendar-outline" size={22} color={theme.subText} />
            <Text style={styles.dateText}>
              {formattedSelectedDate || "Select Date"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={theme.text} />
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

        <View style={styles.totalCard}>
          <View
            style={[
              styles.totalLeft,
              {
                flex: 1,
                minWidth: 0,
                marginRight: 12,
              },
            ]}
          >
            <View style={styles.totalIconBox}>
              <Ionicons name="wallet" size={30} color={theme.primary} />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={[styles.totalLabel]}>Total Spent</Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                ellipsizeMode="tail"
                style={[
                  styles.totalAmount,
                  {
                    width: "100%",
                    flexShrink: 1,
                  },
                ]}
              >
                {RUPEE}
                {totalSpent.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.chartIconBox,
              {
                marginLeft: 8,
              },
            ]}
          >
            <Ionicons name="bar-chart" size={32} color={theme.primary} />
          </View>
        </View>
      </Animated.View>

      {filteredExpenses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={58} color={theme.primary} />
          <Text style={styles.emptyTitle}>No expenses found</Text>
          <Text style={styles.emptyText}>
            Your expense history will appear here once you start tracking.
          </Text>
        </View>
      ) : (
        Object.entries(groupedExpenses).map(([date, items], index) => (
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
              const meta = getCategoryMeta(category);
              const dateValue = parseExpenseDate(item.createdAt);

              return (
                <View key={item.id} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    <View
                      style={[
                        styles.categoryIconBox,
                        {
                          backgroundColor: meta.tint,
                        },
                      ]}
                    >
                      <Ionicons name={meta.icon} size={24} color={meta.color} />
                    </View>

                    <View style={styles.transactionInfo}>
                      <Text numberOfLines={1} style={styles.transactionTitle}>
                        {item.description || category}
                      </Text>

                      <View style={[styles.transactionMeta]}>
                        <View
                          style={[
                            styles.categoryPill,
                            {
                              backgroundColor: `${meta.color}14`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              {
                                color: meta.color,
                              },
                            ]}
                          >
                            {category}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.transactionTime,
                            { fontSize: 12, marginLeft: 7 },
                          ]}
                        >
                          {getExpenseTime(dateValue)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.transactionAmount}>
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
      fontSize: 32,
      fontWeight: "800",
      marginBottom: 24,
    },
    searchBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      elevation: 4,
      flexDirection: "row",
      minHeight: 66,
      paddingHorizontal: 18,
      shadowColor: "#151526",
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    searchInput: {
      color: theme.text,
      flex: 1,
      fontSize: 16,
      marginLeft: 14,
      paddingVertical: 0,
    },
    filterScroll: {
      marginTop: 28,
    },
    filterContent: {
      gap: 12,
      paddingRight: 20,
    },
    filterButton: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderColor: theme.primary,
      borderRadius: 24,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 50,
      paddingHorizontal: 27,
    },
    filterActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    filterText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: "700",
    },
    filterTextActive: {
      color: theme.card,
    },
    dateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 22,
      marginTop: 24,
    },
    dateButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 24,
      borderWidth: 1,
      elevation: 3,
      flexDirection: "row",
      minHeight: 56,
      paddingHorizontal: 18,
      shadowColor: theme.text,
      shadowOffset: {
        width: 0,
        height: 7,
      },
      shadowOpacity: 0.05,
      shadowRadius: 16,
    },
    dateText: {
      color: theme.subText,
      fontSize: 14,
      fontWeight: "700",
      marginHorizontal: 16,
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
    totalCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: 1,
      elevation: 4,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 28,
      minHeight: 104,
      paddingHorizontal: 24,
      shadowColor: theme.text,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.06,
      shadowRadius: 18,
    },
    totalLeft: {
      alignItems: "center",
      flexDirection: "row",
    },
    totalIconBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 20,
      height: 64,
      justifyContent: "center",
      marginRight: 22,
      width: 64,
    },
    totalLabel: {
      color: theme.subText,
      fontSize: 15,
    },
    totalAmount: {
      color: theme.text,
      fontSize: 32,
      fontWeight: "800",
      marginTop: 6,
    },
    chartIconBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 16,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 24,
      marginTop: 28,
      paddingHorizontal: 36,
      paddingVertical: 52,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 16,
    },
    emptyText: {
      color: theme.subText,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 10,
      textAlign: "center",
    },
    group: {
      marginTop: 30,
    },
    groupHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    groupTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "700",
    },
    groupCount: {
      color: theme.subText,
      fontSize: 14,
      fontWeight: "500",
    },
    transactionCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 20,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      minHeight: 90,
      paddingHorizontal: 18,
      shadowColor: theme.text,
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.04,
      shadowRadius: 14,
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
      height: 58,
      justifyContent: "center",
      marginRight: 18,
      width: 58,
    },
    categoryIcon: {
      fontSize: 27,
    },
    transactionInfo: {
      flex: 1,
      minWidth: 0,
    },
    transactionTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
    },
    transactionMeta: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 9,
    },
    categoryPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    categoryText: {
      fontSize: 12,
      fontWeight: "700",
    },
    transactionTime: {
      color: theme.subText,
      fontSize: 13,
      marginLeft: 18,
    },
    transactionAmount: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginLeft: 14,
    },
  });
