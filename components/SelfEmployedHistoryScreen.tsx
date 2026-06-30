import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { createElement, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { getCategoryMeta } from "@/components/categoryMeta";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";

type Expense = {
  id: string;
  amount: number | string;
  description?: string;
  category?: string;
  type?: "income" | "expense";
  createdAt?: string | Date | { toDate?: () => Date };
};

type Filter = "All" | "Today" | "Yesterday" | "This Week" | "This Month";
type TransactionFilter = "All" | "Income" | "Expense";

const FILTERS: Filter[] = [
  "All",
  "Today",
  "Yesterday",
  "This Week",
  "This Month",
];
const TRANSACTION_FILTERS: TransactionFilter[] = ["All", "Income", "Expense"];
const RUPEE = "\u20B9";
const GREEN = "#169B6B";
const GREEN_DARK = "#0C7A53";
const RED = "#E64B55";

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

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const isSameDay = (left: Date, right: Date) =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

const getWeekStart = (date: Date) => {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
};

const getDateLabel = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateInputValue = (date: Date | null) => {
  if (!date) return "";

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const webDateInputStyle = (color: string, borderColor: string) => ({
  backgroundColor: "transparent",
  border: `1px solid ${borderColor}`,
  borderRadius: 10,
  color,
  fontSize: 15,
  fontWeight: 600,
  minHeight: 46,
  outline: "none",
  padding: "0 12px",
  width: "100%",
});

const formatMoney = (value: number) =>
  `${RUPEE}${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function SelfEmployedHistoryScreen() {
  const { width } = useWindowDimensions();
  const { expenses, deleteExpense } = useExpense();
  const { theme, dark } = useTheme();
  const styles = useMemo(() => getStyles(theme, dark), [theme, dark]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<Filter>("All");
  const [selectedTransactionFilter, setSelectedTransactionFilter] =
    useState<TransactionFilter>("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [datePickerStep, setDatePickerStep] = useState<"start" | "end">(
    "start",
  );
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Expense | null>(null);

  const compactLayout = width < 422;

  const expenseItems = useMemo(() => expenses as Expense[], [expenses]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(expenseItems.map((item) => item.category || "Other")),
      ).sort(),
    ],
    [expenseItems],
  );

  const filteredExpenses = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = getWeekStart(today);
    const query = search.trim().toLowerCase();

    return [...expenseItems]
      .filter((item) => {
        const date = parseExpenseDate(item.createdAt);
        const searchableText =
          `${item.description || ""} ${item.category || ""} ${item.amount || ""}`.toLowerCase();
        const matchesSearch = !query || searchableText.includes(query);
        const matchesCategory =
          selectedCategory === "All" ||
          (item.category || "Other") === selectedCategory;

        let matchesFilter = selectedFilter === "All";

        if (date && selectedFilter === "Today") {
          matchesFilter = isSameDay(date, today);
        } else if (date && selectedFilter === "Yesterday") {
          matchesFilter = isSameDay(date, yesterday);
        } else if (date && selectedFilter === "This Week") {
          matchesFilter = date >= weekStart && date <= today;
        } else if (date && selectedFilter === "This Month") {
          matchesFilter =
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
        }

        const expenseDay = date ? startOfDay(date) : null;
        const rangeStart = selectedStartDate
          ? startOfDay(selectedStartDate)
          : null;
        const rangeEnd = selectedEndDate ? startOfDay(selectedEndDate) : null;
        const matchesDateRange =
          !rangeStart ||
          Boolean(
            expenseDay &&
            expenseDay >= rangeStart &&
            (!rangeEnd || expenseDay <= rangeEnd),
          );

        return (
          matchesSearch && matchesCategory && matchesFilter && matchesDateRange
        );
      })
      .sort((left, right) => {
        const leftDate = parseExpenseDate(left.createdAt)?.getTime() || 0;
        const rightDate = parseExpenseDate(right.createdAt)?.getTime() || 0;
        return rightDate - leftDate;
      });
  }, [
    expenseItems,
    search,
    selectedCategory,
    selectedEndDate,
    selectedFilter,
    selectedStartDate,
  ]);

  const visibleTransactions = useMemo(
    () =>
      filteredExpenses.filter((item) => {
        if (selectedTransactionFilter === "All") return true;
        const itemType = item.type || "expense";
        return itemType === selectedTransactionFilter.toLowerCase();
      }),
    [filteredExpenses, selectedTransactionFilter],
  );

  const groupedExpenses = useMemo(
    () =>
      visibleTransactions.reduce<Record<string, Expense[]>>((groups, item) => {
        const date = parseExpenseDate(item.createdAt);
        const label = date ? getDateLabel(date) : "Unknown Date";
        groups[label] = groups[label] || [];
        groups[label].push(item);
        return groups;
      }, {}),
    [visibleTransactions],
  );

  const filteredTotals = useMemo(
    () =>
      filteredExpenses.reduce(
        (totals, item) => {
          const amount = Number(item.amount || 0);
          if ((item.type || "expense") === "income") totals.income += amount;
          else totals.expense += amount;
          return totals;
        },
        { expense: 0, income: 0 },
      ),
    [filteredExpenses],
  );
  const businessNet = filteredTotals.income - filteredTotals.expense;
  const businessInsight = useMemo(() => {
    if (filteredExpenses.length === 0) {
      return {
        color: GREEN,
        text: "Add income and expenses to unlock business insights.",
      };
    }

    if (filteredTotals.income === 0) {
      return {
        color: RED,
        text: `${formatMoney(filteredTotals.expense)} in expenses is not covered by recorded income.`,
      };
    }

    if (filteredTotals.expense === 0) {
      return {
        color: GREEN,
        text: "Income is recorded with no expenses in this view.",
      };
    }

    if (businessNet < 0) {
      return {
        color: RED,
        text: `Expenses exceed income by ${formatMoney(Math.abs(businessNet))}.`,
      };
    }

    const retainedPercent = Math.round(
      (businessNet / filteredTotals.income) * 100,
    );
    return {
      color: GREEN,
      text:
        businessNet === 0
          ? "Income and expenses are at break-even in this view."
          : `You retained ${retainedPercent}% of income after expenses.`,
    };
  }, [businessNet, filteredExpenses.length, filteredTotals]);

  const dateButtonLabel = useMemo(() => {
    if (selectedStartDate && selectedEndDate) {
      return `${formatShortDate(selectedStartDate)} - ${selectedEndDate.toLocaleDateString(
        "en-IN",
        { day: "2-digit", month: "short", year: "numeric" },
      )}`;
    }

    if (selectedStartDate) {
      return `From ${formatShortDate(selectedStartDate)}`;
    }

    if (selectedFilter === "All") return "All dates";
    if (selectedFilter === "Today" || selectedFilter === "Yesterday") {
      return selectedFilter;
    }

    const today = new Date();
    if (selectedFilter === "This Week") {
      const start = getWeekStart(today);
      return `${start.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })} - ${today.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;
    }

    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return `${first.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    })} - ${last.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }, [selectedEndDate, selectedFilter, selectedStartDate]);

  const openDateRangePicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDatePickerStep("start");
    setShowDatePicker(true);
  };

  const closeDateRangePicker = () => {
    setShowDatePicker(false);
    if (selectedStartDate && !selectedEndDate) {
      setSelectedStartDate(null);
    }
  };

  const selectRangeDate = (date: Date) => {
    if (datePickerStep === "start") {
      setSelectedStartDate(startOfDay(date));
      setSelectedEndDate(null);
      setSelectedFilter("All");
      setDatePickerStep("end");
      return;
    }

    const start = selectedStartDate || startOfDay(date);
    const end = startOfDay(date);
    setSelectedStartDate(end < start ? end : start);
    setSelectedEndDate(end < start ? start : end);
    setSelectedFilter("All");
    setShowDatePicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const handleExport = async () => {
    if (visibleTransactions.length === 0) {
      Alert.alert("Nothing to export", "No transactions match these filters.");
      return;
    }

    const rows = visibleTransactions
      .map((item) => {
        const date = parseExpenseDate(item.createdAt);
        const isIncome = (item.type || "expense") === "income";
        return `
          <tr>
            <td>${escapeHtml(
              date?.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              }) || "Unknown date",
            )}</td>
            <td>${escapeHtml(
              item.description ||
                item.category ||
                (isIncome ? "Income" : "Expense"),
            )}</td>
            <td>${escapeHtml(
              `${isIncome ? "Income" : "Expense"} - ${item.category || "Other"}`,
            )}</td>
            <td style="text-align:right">${escapeHtml(
              `${isIncome ? "+" : "-"}${formatMoney(Number(item.amount || 0))}`,
            )}</td>
          </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { margin: 28px; }
            body { color: #161616; font-family: Arial, sans-serif; padding: 10px; }
            h1 { font-size: 26px; margin-bottom: 4px; }
            p { color: #666; margin: 0 0 24px; }
            .summary { background: #eefaf5; border: 1px solid #b9e4d2; border-radius: 12px; margin-bottom: 24px; padding: 16px; }
            .summary strong { color: #0c7a53; font-size: 22px; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #169b6b; color: white; font-size: 12px; padding: 10px; text-align: left; }
            td { border-bottom: 1px solid #e8e8e8; font-size: 12px; padding: 11px 10px; }
          </style>
        </head>
        <body>
          <h1>Business History</h1>
          <p>${escapeHtml(dateButtonLabel)} · ${visibleTransactions.length} transactions</p>
          <div class="summary">Income: <strong>${escapeHtml(
            formatMoney(filteredTotals.income),
          )}</strong><br />Expense: <strong>${escapeHtml(
            formatMoney(filteredTotals.expense),
          )}</strong></div>
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`;

    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (Platform.OS === "web") {
        await Print.printToFileAsync({ html });
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        Alert.alert(
          "PDF created",
          "Sharing is not available on this device right now.",
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "Export business history",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log("History export error:", error);
      Alert.alert("Export failed", "The history report could not be created.");
    } finally {
      setExporting(false);
    }
  };

  const dateFilterActive = showDatePicker || Boolean(selectedStartDate);

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
            tintColor={GREEN}
            colors={[GREEN]}
            progressBackgroundColor={theme.card}
            progressViewOffset={70}
          />
        }
      >
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>History</Text>
            <Pressable
              disabled={exporting}
              onPress={handleExport}
              style={({ pressed }) => [
                styles.exportButton,
                pressed && styles.pressed,
              ]}
            >
              {exporting ? (
                <ActivityIndicator color={GREEN_DARK} size="small" />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={GREEN_DARK}
                />
              )}
              <Text style={styles.exportText}>
                {exporting ? "Preparing" : "Export"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={25} color={theme.subText} />
            <TextInput
              placeholder="Search expenses..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={theme.subText}
              style={styles.searchInput}
            />
            <Pressable
              hitSlop={8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCategoryFilters((value) => !value);
              }}
              style={[
                styles.filterIconButton,
                showCategoryFilters && styles.filterIconButtonActive,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={23}
                color={showCategoryFilters ? "#FFFFFF" : GREEN}
              />
            </Pressable>
          </View>

          {showCategoryFilters && (
            <Animated.View entering={FadeInUp.duration(250)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFilterContent}
              >
                {categories.map((category) => {
                  const active = category === selectedCategory;

                  const meta =
                    category === "All"
                      ? {
                          icon: "apps-outline",
                          color: active ? "#FFFFFF" : GREEN,
                        }
                      : getCategoryMeta(category);

                  return (
                    <Pressable
                      key={category}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCategory(category);
                      }}
                      style={[
                        styles.categoryFilter,
                        active && styles.categoryFilterActive,
                      ]}
                    >
                      <Ionicons
                        name={meta.icon as any}
                        size={14}
                        color={active ? "#FFFFFF" : meta.color}
                      />

                      <Text
                        style={[
                          styles.categoryFilterText,
                          active && styles.categoryFilterTextActive,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeFilterContent}
            style={styles.typeFilterScroll}
          >
            {TRANSACTION_FILTERS.map((filter) => {
              const active = selectedTransactionFilter === filter;
              const color = filter === "Expense" ? RED : GREEN;

              return (
                <Pressable
                  key={filter}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTransactionFilter(filter);
                  }}
                  style={[
                    styles.typeFilterButton,
                    { borderColor: color },
                    active && { backgroundColor: color },
                  ]}
                >
                  {filter !== "All" && (
                    <Ionicons
                      name={filter === "Income" ? "arrow-up" : "arrow-down"}
                      size={19}
                      color={active ? "#FFFFFF" : color}
                    />
                  )}
                  <Text
                    style={[
                      styles.typeFilterText,
                      { color: active ? "#FFFFFF" : color },
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            style={styles.filterScroll}
          >
            {FILTERS.map((filter) => {
              const hasDateRange = Boolean(selectedStartDate);
              const active =
                selectedFilter === filter && !hasDateRange && !showDatePicker;

              return (
                <Pressable
                  key={filter}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedStartDate(null);
                    setSelectedEndDate(null);
                    setShowDatePicker(false);
                    setSelectedFilter(filter);
                  }}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              accessibilityLabel="Select a date range"
              onPress={openDateRangePicker}
              style={[
                styles.calendarButton,
                dateFilterActive && styles.calendarButtonSelected,
                selectedStartDate &&
                  selectedEndDate &&
                  styles.calendarButtonWithRange,
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={21}
                color={dateFilterActive ? "#FFFFFF" : GREEN_DARK}
              />
              {selectedStartDate && selectedEndDate && (
                <Text numberOfLines={1} style={styles.calendarRangeText}>
                  {formatShortDate(selectedStartDate)} -{" "}
                  {formatShortDate(selectedEndDate)}
                </Text>
              )}
            </Pressable>
          </ScrollView>

          {showDatePicker && (
            <View style={styles.datePickerBox}>
              <View style={styles.datePickerHeader}>
                <View>
                  <Text style={styles.datePickerTitle}>Select date range</Text>
                  <Text style={styles.datePickerHint}>
                    Choose From, then choose To
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close date range picker"
                  hitSlop={10}
                  onPress={closeDateRangePicker}
                  style={styles.datePickerClose}
                >
                  <Ionicons name="close" size={20} color={theme.subText} />
                </Pressable>
              </View>

              <View style={styles.rangeFields}>
                <Pressable
                  onPress={() => setDatePickerStep("start")}
                  style={[
                    styles.rangeField,
                    datePickerStep === "start" && styles.rangeFieldActive,
                  ]}
                >
                  <Text style={styles.rangeFieldLabel}>From</Text>
                  <Text style={styles.rangeFieldValue}>
                    {selectedStartDate
                      ? formatShortDate(selectedStartDate)
                      : "Select date"}
                  </Text>
                </Pressable>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={theme.subText}
                />
                <Pressable
                  onPress={() => selectedStartDate && setDatePickerStep("end")}
                  style={[
                    styles.rangeField,
                    datePickerStep === "end" && styles.rangeFieldActive,
                  ]}
                >
                  <Text style={styles.rangeFieldLabel}>To</Text>
                  <Text style={styles.rangeFieldValue}>
                    {selectedEndDate
                      ? formatShortDate(selectedEndDate)
                      : "Select date"}
                  </Text>
                </Pressable>
              </View>

              {Platform.OS === "web" ? (
                <View style={styles.webDateInputs}>
                  {createElement("input", {
                    type: "date",
                    "aria-label": "From date",
                    value: formatDateInputValue(selectedStartDate),
                    onChange: (event: any) => {
                      const value = event.target.value;
                      if (!value) return;
                      setSelectedStartDate(
                        startOfDay(new Date(`${value}T00:00:00`)),
                      );
                      setSelectedEndDate(null);
                      setSelectedFilter("All");
                      setDatePickerStep("end");
                    },
                    style: webDateInputStyle(theme.text, theme.border),
                  })}
                  {createElement("input", {
                    type: "date",
                    "aria-label": "To date",
                    min: formatDateInputValue(selectedStartDate),
                    disabled: !selectedStartDate,
                    value: formatDateInputValue(selectedEndDate),
                    onChange: (event: any) => {
                      const value = event.target.value;
                      if (value) selectRangeDate(new Date(`${value}T00:00:00`));
                    },
                    style: webDateInputStyle(theme.text, theme.border),
                  })}
                </View>
              ) : (
                <DateTimePicker
                  key={datePickerStep}
                  value={
                    datePickerStep === "start"
                      ? selectedStartDate || new Date()
                      : selectedEndDate || selectedStartDate || new Date()
                  }
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={
                    datePickerStep === "end"
                      ? selectedStartDate || undefined
                      : undefined
                  }
                  accentColor={GREEN}
                  textColor={theme.text}
                  onChange={(event, date) => {
                    if (event.type === "dismissed") {
                      closeDateRangePicker();
                      return;
                    }
                    if (date) selectRangeDate(date);
                  }}
                />
              )}
            </View>
          )}

          <View
            style={[
              styles.summaryCard,
              compactLayout && styles.summaryCardCompact,
            ]}
          >
            <View
              style={[
                styles.summaryIconBox,
                compactLayout && styles.summaryIconBoxCompact,
              ]}
            >
              <Ionicons
                name={businessNet < 0 ? "trending-down" : "trending-up"}
                size={30}
                color={businessNet < 0 ? RED : GREEN}
              />
            </View>

            <View style={styles.netSummaryContent}>
              <Text style={styles.netSummaryLabel}>Net Profit</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={[
                  styles.netSummaryAmount,
                  businessNet < 0 && styles.netSummaryAmountNegative,
                ]}
              >
                {businessNet < 0 ? "-" : ""}
                {formatMoney(Math.abs(businessNet))}
              </Text>

              <View style={styles.netBreakdownRow}>
                <Text style={styles.netIncomeText}>
                  Income {formatMoney(filteredTotals.income)}
                </Text>
                <Text style={styles.netBreakdownDot}>{"\u2022"}</Text>
                <Text style={styles.netExpenseText}>
                  Expense {formatMoney(filteredTotals.expense)}
                </Text>
              </View>

              <View style={styles.transactionCountPill}>
                <Text style={styles.transactionCountText}>
                  {filteredExpenses.length} Entr
                  {filteredExpenses.length === 1 ? "y" : "ies"}
                </Text>
              </View>
            </View>
          </View>

          <Animated.View
            entering={FadeInUp.delay(250).duration(500)}
            style={styles.insightBanner}
          >
            <View
              style={[
                styles.insightIcon,
                { backgroundColor: businessInsight.color },
              ]}
            >
              <Ionicons name="bulb-outline" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.insightCopy}>
              <Text style={styles.insightTitle}>Business Insight</Text>
              <Text style={styles.insightText}>{businessInsight.text}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {visibleTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="receipt-outline" size={28} color={GREEN} />
            </View>
            <Text style={styles.emptyTitle}>
              No transactions match your filters
            </Text>
            <Text style={styles.emptyText}>
              Try another date, category, or search term.
            </Text>
          </View>
        ) : (
          Object.entries(groupedExpenses).map(([date, items], groupIndex) => (
            <Animated.View
              key={date}
              entering={FadeInUp.delay(100 + groupIndex * 70).duration(500)}
              style={styles.group}
            >
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{date}</Text>
                <Text style={styles.groupCount}>
                  {items.length} transaction{items.length === 1 ? "" : "s"}
                </Text>
              </View>

              {items.map((item) => {
                const category = item.category || "Other";
                const isIncome = (item.type || "expense") === "income";
                const meta = getCategoryMeta(category);
                const dateValue = parseExpenseDate(item.createdAt);
                return (
                  <View key={item.id} style={styles.transactionCard}>
                    <View style={styles.transactionLeft}>
                      <View
                        style={[
                          styles.categoryIconBox,
                          {
                            backgroundColor: isIncome ? "#E7F7F0" : meta.tint,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isIncome ? "cash-outline" : meta.icon}
                          size={23}
                          color={isIncome ? GREEN : meta.color}
                        />
                      </View>

                      <View style={styles.transactionInfo}>
                        <Text numberOfLines={1} style={styles.transactionTitle}>
                          {item.description || category}
                        </Text>
                        <View style={styles.transactionMetaRow}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.transactionCategory,
                              {
                                color: isIncome ? GREEN : meta.color,
                              },
                            ]}
                          >
                            {category}
                          </Text>
                          <Text style={styles.metaDot}>{"\u2022"}</Text>
                          <Text
                            numberOfLines={1}
                            style={styles.transactionDate}
                          >
                            {dateValue
                              ? dateValue.toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Unknown time"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.transactionRight}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[
                          styles.transactionAmount,
                          isIncome
                            ? styles.incomeTransactionAmount
                            : styles.expenseTransactionAmount,
                        ]}
                      >
                        {isIncome ? "+" : "-"}
                        {formatMoney(Number(item.amount || 0))}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityLabel="Transaction options"
                      hitSlop={9}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setDeleteItem(item);
                        setShowDeleteModal(true);
                      }}
                      style={styles.moreButton}
                    >
                      <Ionicons
                        name="ellipsis-vertical"
                        size={20}
                        color={theme.text}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteItem(null);
        }}
        transparent
        visible={showDeleteModal}
      >
        <Pressable
          onPress={() => {
            setShowDeleteModal(false);
            setDeleteItem(null);
          }}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={() => undefined} style={styles.deleteModal}>
            <View style={styles.deleteIconBox}>
              <Ionicons name="trash-outline" size={28} color={RED} />
            </View>
            <Text style={styles.deleteTitle}>Delete transaction?</Text>
            <Text style={styles.deleteText}>
              This expense will be permanently removed from your history.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                }}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!deleteItem) return;

                  try {
                    await deleteExpense(deleteItem.id);
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    setShowDeleteModal(false);
                    setDeleteItem(null);
                  } catch (error) {
                    console.log("Delete expense error:", error);
                    Alert.alert(
                      "Could not delete",
                      "Please try deleting this transaction again.",
                    );
                  }
                }}
                style={[styles.modalButton, styles.deleteButton]}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const getStyles = (theme: any, dark: boolean) =>
  StyleSheet.create({
    screen: {
      backgroundColor: dark ? "#111316" : "#FBFCFB",
      flex: 1,
    },
    content: {
      paddingBottom: 140,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    title: {
      color: theme.text,
      fontSize: 34,
      fontWeight: "900",
    },
    exportButton: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(22,155,107,0.16)" : "#EDF8F4",
      borderRadius: 14,
      flexDirection: "row",
      gap: 7,
      height: 44,
      justifyContent: "center",
      minWidth: 108,
      paddingHorizontal: 14,
    },
    exportText: {
      color: dark ? "#72D6B2" : GREEN_DARK,
      fontSize: 15,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.72,
      transform: [{ scale: 0.98 }],
    },
    searchBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      elevation: 3,
      flexDirection: "row",
      marginTop: 26,
      minHeight: 64,
      paddingHorizontal: 17,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.14 : 0.05,
      shadowRadius: 16,
    },
    searchInput: {
      color: theme.text,
      flex: 1,
      fontSize: 15,
      marginLeft: 12,
      minWidth: 0,
      paddingVertical: 0,
    },
    filterIconButton: {
      alignItems: "center",
      borderRadius: 12,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    filterIconButtonActive: {
      backgroundColor: GREEN,
    },
    categoryFilterContent: {
      gap: 8,
      paddingRight: 20,
      paddingTop: 14,
    },
    categoryFilter: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    categoryFilterActive: {
      backgroundColor: GREEN,
      borderColor: GREEN,
    },
    categoryFilterText: {
      color: theme.subText,
      fontSize: 13,
      fontWeight: "700",
    },
    categoryFilterTextActive: {
      color: "#FFFFFF",
    },
    typeFilterScroll: {
      marginTop: 22,
    },
    typeFilterContent: {
      gap: 10,
      paddingRight: 20,
    },
    typeFilterButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      height: 48,
      justifyContent: "center",
      minWidth: 104,
      paddingHorizontal: 20,
    },
    typeFilterText: {
      fontSize: 14,
      fontWeight: "800",
    },
    filterScroll: {
      marginTop: 26,
    },
    filterContent: {
      gap: 10,
      paddingRight: 20,
    },
    filterButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: dark ? "#3B5149" : "#7CB9A2",
      borderRadius: 18,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 23,
    },
    filterButtonActive: {
      backgroundColor: GREEN,
      borderColor: GREEN,
    },
    filterText: {
      color: dark ? "#8ED5BA" : GREEN_DARK,
      fontSize: 14,
      fontWeight: "700",
    },
    filterTextActive: {
      color: "#FFFFFF",
    },
    calendarButton: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: dark ? "#3B5149" : "#7CB9A2",
      borderRadius: 18,
      borderWidth: 1,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    calendarButtonSelected: {
      backgroundColor: GREEN,
      borderColor: GREEN,
    },
    calendarButtonWithRange: {
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 14,
      width: "auto",
    },
    calendarRangeText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    datePickerBox: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 14,
      overflow: "hidden",
      padding: 14,
    },
    datePickerHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    datePickerTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
    },
    datePickerHint: {
      color: theme.subText,
      fontSize: 12,
      marginTop: 3,
    },
    datePickerClose: {
      alignItems: "center",
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    rangeFields: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    rangeField: {
      backgroundColor: dark ? "#202A27" : "#F7F9F8",
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      flex: 1,
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rangeFieldActive: {
      borderColor: GREEN,
      borderWidth: 2,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    rangeFieldLabel: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "600",
    },
    rangeFieldValue: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 4,
    },
    webDateInputs: {
      flexDirection: "column",
      gap: 10,
    },
    summaryCard: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(22,155,107,0.10)" : "#F3FBF8",
      borderColor: dark ? "rgba(98,211,169,0.38)" : "#A7D6C4",
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: 26,
      minHeight: 146,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
    summaryCardCompact: {
      paddingHorizontal: 12,
    },
    summaryIconBox: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 16,
      elevation: 2,
      height: 54,
      justifyContent: "center",
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: dark ? 0.15 : 0.05,
      shadowRadius: 10,
      width: 54,
    },
    summaryIconBoxCompact: {
      height: 48,
      width: 48,
    },
    netSummaryContent: {
      flex: 1,
      marginLeft: 18,
      minWidth: 0,
    },
    netSummaryLabel: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
    },
    netSummaryAmount: {
      color: dark ? "#72D6B2" : GREEN_DARK,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 7,
    },
    netSummaryAmountNegative: {
      color: RED,
    },
    netBreakdownRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    netIncomeText: {
      color: dark ? "#72D6B2" : GREEN_DARK,
      fontSize: 11,
      fontWeight: "700",
    },
    netBreakdownDot: {
      color: theme.subText,
      fontSize: 11,
      marginHorizontal: 7,
    },
    netExpenseText: {
      color: RED,
      fontSize: 11,
      fontWeight: "700",
    },
    summaryMetrics: {
      flex: 1,
      flexDirection: "row",
      marginHorizontal: 13,
      minWidth: 0,
    },
    summaryMetricsCompact: {
      marginLeft: 8,
      marginRight: 0,
    },
    summaryMetric: {
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
      paddingHorizontal: 8,
    },
    summaryDivider: {
      alignSelf: "stretch",
      backgroundColor: dark ? "#315249" : "#DCEBE5",
      width: 1,
    },
    summaryLabel: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "500",
    },
    summaryAmount: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      marginTop: 8,
    },
    incomeAmount: {
      color: dark ? "#72D6B2" : GREEN_DARK,
    },
    expenseAmount: {
      color: RED,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 8,
    },
    businessNet: {
      color: dark ? "#8ED5BA" : GREEN_DARK,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 11,
    },
    businessNetNegative: {
      color: RED,
    },
    transactionCountPill: {
      alignSelf: "flex-start",
      backgroundColor: dark ? "rgba(22,155,107,0.18)" : "#E7F7F0",
      borderRadius: 12,
      marginTop: 9,
      paddingHorizontal: 12,
      paddingVertical: 5,
      minWidth: 80,
    },
    transactionCountText: {
      color: dark ? "#8ED5BA" : GREEN_DARK,
      fontSize: 10,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      paddingHorizontal: 30,
      paddingVertical: 54,
    },
    emptyIconBox: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(22,155,107,0.14)" : "#EAF8F2",
      borderRadius: 18,
      height: 58,
      justifyContent: "center",
      width: 58,
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
      marginTop: 8,
      textAlign: "center",
    },
    group: {
      marginTop: 30,
    },
    groupHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    groupTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
    },
    groupCount: {
      color: theme.subText,
      fontSize: 13,
    },
    transactionCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderRadius: 18,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "row",
      marginBottom: 11,
      minHeight: 88,
      paddingHorizontal: 13,
      paddingVertical: 13,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: dark ? 0.16 : 0.035,
      shadowRadius: 12,
    },
    transactionLeft: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      minWidth: 0,
    },
    categoryIconBox: {
      alignItems: "center",
      borderRadius: 14,
      height: 48,
      justifyContent: "center",
      marginRight: 12,
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
    transactionMetaRow: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: 7,
      minWidth: 0,
    },
    transactionCategory: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: "700",
    },
    metaDot: {
      color: theme.subText,
      fontSize: 11,
      marginHorizontal: 6,
    },
    transactionDate: {
      color: theme.subText,
      flexShrink: 1,
      fontSize: 11,
    },
    transactionRight: {
      alignItems: "flex-end",
      marginLeft: 8,
      maxWidth: 104,
      minWidth: 72,
    },
    transactionAmount: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
      textAlign: "right",
    },
    incomeTransactionAmount: {
      color: dark ? "#72D6B2" : GREEN_DARK,
    },
    expenseTransactionAmount: {
      color: RED,
    },
    moreButton: {
      alignItems: "center",
      height: 36,
      justifyContent: "center",
      marginLeft: 4,
      width: 28,
    },
    insightBanner: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(22,155,107,0.13)" : "#F1FAF7",
      borderColor: dark ? "rgba(98,211,169,0.28)" : "#C5E4D8",
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      marginTop: 26,
      minHeight: 82,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    insightIcon: {
      alignItems: "center",
      backgroundColor: GREEN,
      borderRadius: 18,
      height: 42,
      justifyContent: "center",
      marginRight: 12,
      width: 42,
    },
    insightCopy: {
      flex: 1,
      minWidth: 0,
    },
    insightTitle: {
      color: dark ? "#9CE2C8" : GREEN_DARK,
      fontSize: 13,
      fontWeight: "800",
    },
    insightText: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 5,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.48)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      paddingHorizontal: 24,
      position: "absolute",
      right: 0,
      top: 0,
    },
    deleteModal: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 24,
      maxWidth: 420,
      padding: 24,
      width: "100%",
    },
    deleteIconBox: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(230,75,85,0.14)" : "#FDECEE",
      borderRadius: 18,
      height: 58,
      justifyContent: "center",
      width: 58,
    },
    deleteTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      marginTop: 18,
    },
    deleteText: {
      color: theme.subText,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 9,
      textAlign: "center",
    },
    modalActions: {
      flexDirection: "row",
      gap: 11,
      marginTop: 24,
      width: "100%",
    },
    modalButton: {
      alignItems: "center",
      borderRadius: 15,
      flex: 1,
      height: 50,
      justifyContent: "center",
    },
    cancelButton: {
      backgroundColor: theme.background,
    },
    deleteButton: {
      backgroundColor: RED,
    },
    cancelButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "800",
    },
    deleteButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
  });
