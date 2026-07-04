import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Polyline } from "react-native-svg";

import { getCategoryMeta } from "@/components/categoryMeta";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RUPEE = "\u20B9";
const GREEN = "#159665";
const PURPLE_DARK = "#371872";
const RED = "#EF4444";
const BLUE = "#2563EB";
const GOLD = "#F59E0B";
const PURPLE = "#6E3CFF";

type Transaction = {
  id: string;
  amount: number | string;
  category?: string;
  description?: string;
  type?: "income" | "expense";
  createdAt?: string | Date | { toDate?: () => Date };
};

type TimelineMonth = {
  end: Date;
  label: string;
  shortLabel: string;
  start: Date;
};

type HeroMode = "balanced" | "incomeOnly" | "expenseOnly" | "empty";

const parseDate = (value: Transaction["createdAt"]) => {
  if (!value) return null;

  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMonthRange = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

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

const formatCompactMoney = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) < 1000) return formatMoney(amount);

  const thousands = amount / 1000;
  return `${RUPEE}${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
};

const getMonthStart = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getMonthEnd = (start: Date) => {
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return end;
};

const getMonthTimeline = () => {
  const currentStart = getMonthStart(new Date());

  return Array.from({ length: 12 }, (_value, index) => {
    const monthOffset = index - 8;
    const start = getMonthStart(
      new Date(
        currentStart.getFullYear(),
        currentStart.getMonth() + monthOffset,
        1,
      ),
    );
    const end = getMonthEnd(start);

    return {
      end,
      label: formatMonthRange(start),
      shortLabel:
        start.getTime() === currentStart.getTime()
          ? "This Month"
          : start.toLocaleDateString("en-IN", {
              month: "short",
              year: "2-digit",
            }),
      start,
    } satisfies TimelineMonth;
  });
};

const getCurrentTimelineMonth = (months: TimelineMonth[]) =>
  months.find((month) => month.shortLabel === "This Month") ||
  months[Math.max(0, months.length - 1)] || {
    end: getMonthEnd(getMonthStart(new Date())),
    label: formatMonthRange(getMonthStart(new Date())),
    shortLabel: "This Month",
    start: getMonthStart(new Date()),
  };

const categoryColor = (category: string, index: number) => {
  const metaColor = getCategoryMeta(category).color;
  const fallback = [GREEN, RED, BLUE, GOLD, "#7C3AED"][index % 5];
  return metaColor || fallback;
};

const getVisualArcShares = ({
  donutExpenseShare,
  heroMode,
  donutIncomeShare,
  minimumShare = 5,
}: {
  donutExpenseShare: number;
  heroMode: HeroMode;
  donutIncomeShare: number;
  minimumShare?: number;
}) => {
  if (heroMode !== "balanced") {
    return {
      expense: heroMode === "expenseOnly" ? 100 : donutExpenseShare,
      income: heroMode === "incomeOnly" ? 100 : donutIncomeShare,
    };
  }

  if (donutIncomeShare <= 0 || donutExpenseShare <= 0) {
    return {
      expense: donutExpenseShare,
      income: donutIncomeShare,
    };
  }

  if (donutIncomeShare < minimumShare) {
    return {
      expense: 100 - minimumShare,
      income: minimumShare,
    };
  }

  if (donutExpenseShare < minimumShare) {
    return {
      expense: minimumShare,
      income: 100 - minimumShare,
    };
  }

  return {
    expense: donutExpenseShare,
    income: donutIncomeShare,
  };
};

type DonutProgressProps = {
  circumference: number;
  expenseShare: number;
  progress: SharedValue<number>;
  radius: number;
  strokeWidth: number;
};

function DonutProgress({
  circumference,
  expenseShare,
  progress,
  radius,
  strokeWidth,
}: DonutProgressProps) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [
      circumference * (expenseShare / 100) * progress.value,
      circumference,
    ],
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx="90"
      cy="90"
      fill="none"
      r={radius}
      stroke="#F97316"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      strokeOpacity={0.95}
      transform="rotate(-90 90 90)"
    />
  );
}

function IncomeProgress({
  circumference,
  incomeShare,
  progress,
  radius,
  strokeWidth,
}: {
  circumference: number;
  incomeShare: number;
  progress: SharedValue<number>;
  radius: number;
  strokeWidth: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [
      circumference * (incomeShare / 100) * progress.value,
      circumference,
    ],
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      cx="90"
      cy="90"
      fill="none"
      r={radius}
      stroke="#34D399"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      strokeOpacity={0.95}
      transform="rotate(-90 90 90)"
    />
  );
}

export default function SelfEmployedAnalyticsScreen() {
  const { expenses } = useExpense();
  const { theme, dark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const compact = width < 422 || fontScale > 1.05;
  const progress = useSharedValue(0);

  const styles = useMemo(
    () => getStyles(theme, dark, compact),
    [compact, dark, theme],
  );

  const months = useMemo(() => getMonthTimeline(), []);
  const currentTimelineMonth = useMemo(
    () => getCurrentTimelineMonth(months),
    [months],
  );
  const [selectedDate, setSelectedDate] = useState(
    () => currentTimelineMonth.start,
  );

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200 });
  }, [progress, selectedDate]);

  const selectedMonth = useMemo(
    () =>
      months.find(
        (month) => month.start.getTime() === selectedDate.getTime(),
      ) || months[months.length - 1],
    [months, selectedDate],
  );

  useEffect(() => {
    if (!selectedMonth) {
      setSelectedDate(currentTimelineMonth.start);
    }
  }, [currentTimelineMonth.start, selectedMonth]);

  const filteredTransactions = useMemo(
    () =>
      (expenses as Transaction[]).filter((item) => {
        const date = parseDate(item.createdAt);

        return (
          !!date && date >= selectedMonth.start && date < selectedMonth.end
        );
      }),
    [expenses, selectedMonth],
  );

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
  const totalExpense = totals.expense;
  const heroMode: HeroMode =
    totals.income > 0 && totals.expense > 0
      ? "balanced"
      : totals.income > 0
        ? "incomeOnly"
        : totals.expense > 0
          ? "expenseOnly"
          : "empty";
  const expenseShare =
    totals.income > 0
      ? Math.min((totals.expense / totals.income) * 100, 100)
      : totals.expense > 0
        ? 100
        : 0;
  const donutIncomeShare =
    totals.income + totals.expense > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (totals.income / (totals.income + totals.expense)) * 100,
          ),
        )
      : 0;
  const donutExpenseShare =
    totals.income + totals.expense > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (totals.expense / (totals.income + totals.expense)) * 100,
          ),
        )
      : 0;
  const expenseShareLabel =
    totals.expense > 0 && expenseShare < 1
      ? expenseShare.toFixed(1)
      : String(Math.round(expenseShare));
  const visualArcShares = getVisualArcShares({
    donutExpenseShare,
    heroMode,
    donutIncomeShare,
  });
  const profitMargin =
    totals.income > 0 ? Math.round((profit / totals.income) * 100) : 0;
  const isLoss = profit < 0;
  const heroCenterTitle =
    heroMode === "expenseOnly"
      ? "Expense Only"
      : isLoss
        ? "Net Loss"
        : "Net Profit";
  const heroCenterValue =
    heroMode === "expenseOnly"
      ? formatMoney(totalExpense)
      : `${profit < 0 ? "-" : ""}${formatMoney(Math.abs(profit))}`;
  const heroCenterSubtitle =
    heroMode === "balanced"
      ? isLoss
        ? "Expense Ratio"
        : "Profit Margin"
      : heroMode === "incomeOnly"
        ? "No expense yet"
        : heroMode === "expenseOnly"
          ? "No income yet"
          : "No activity yet";
  const heroLeadLabel = "Expense Ratio";
  const heroLeadValue = expenseShareLabel;
  const heroLeadAmount =
    heroMode === "incomeOnly"
      ? `${formatMoney(totalExpense)} of ${formatMoney(totals.income)}`
      : heroMode === "expenseOnly"
        ? `${formatMoney(totalExpense)} of ${formatMoney(0)}`
        : heroMode === "empty"
          ? `${formatMoney(0)} of ${formatMoney(0)}`
          : `${formatMoney(totalExpense)} of ${formatMoney(totals.income)}`;

  const groupedExpenseCategories = useMemo(
    () =>
      filteredTransactions
        .filter((item) => (item.type || "expense") === "expense")
        .reduce((acc: Record<string, number>, item) => {
          const category = item.category || "Other";
          acc[category] = (acc[category] || 0) + Number(item.amount || 0);
          return acc;
        }, {}),
    [filteredTransactions],
  );

  const categoryRows = useMemo(
    () =>
      Object.entries(groupedExpenseCategories).sort(
        (left, right) => right[1] - left[1],
      ) as [string, number][],
    [groupedExpenseCategories],
  );

  const displayRows = categoryRows.slice(0, 6);
  const topCategory = categoryRows[0];
  const monthTrend = useMemo(() => {
    const now = new Date();
    const monthEnd =
      now >= selectedMonth.start && now < selectedMonth.end
        ? new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            0,
            0,
            0,
            0,
          )
        : selectedMonth.end;
    const totalDays = Math.max(
      1,
      Math.ceil(
        (monthEnd.getTime() - selectedMonth.start.getTime()) / MS_PER_DAY,
      ),
    );
    const bucketCount = Math.min(6, totalDays);
    const buckets = Array.from({ length: bucketCount }, (_value, index) => {
      const dayOffset = Math.floor((index * totalDays) / bucketCount);
      const bucketDate = new Date(
        selectedMonth.start.getTime() + dayOffset * MS_PER_DAY,
      );

      return {
        label: formatShortDate(bucketDate),
        value: 0,
      };
    });

    filteredTransactions.forEach((item) => {
      const date = parseDate(item.createdAt);

      if (!date) return;

      const amount = Number(item.amount || 0);
      const signedAmount =
        (item.type || "expense") === "income" ? amount : -amount;
      const dayOffset = Math.max(
        0,
        Math.floor(
          (date.getTime() - selectedMonth.start.getTime()) / MS_PER_DAY,
        ),
      );
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((dayOffset * bucketCount) / totalDays),
      );
      buckets[bucketIndex].value += signedAmount;
    });

    let cumulativeNet = 0;

    return buckets.map((bucket) => {
      cumulativeNet += bucket.value;
      return {
        ...bucket,
        value: cumulativeNet,
      };
    });
  }, [filteredTransactions, selectedMonth]);

  const showTrend = monthTrend.some((item) => item.value !== 0);
  const previousMonth = useMemo(() => {
    const selectedIndex = months.findIndex(
      (month) => month.start.getTime() === selectedMonth.start.getTime(),
    );

    return selectedIndex > 0 ? months[selectedIndex - 1] : null;
  }, [months, selectedMonth]);

  const previousProfit = useMemo(() => {
    if (!previousMonth) {
      return 0;
    }

    return (expenses as Transaction[]).reduce((sum, item) => {
      const date = parseDate(item.createdAt);

      if (!date || date < previousMonth.start || date >= previousMonth.end) {
        return sum;
      }

      const amount = Number(item.amount || 0);

      return (item.type || "expense") === "income"
        ? sum + amount
        : sum - amount;
    }, 0);
  }, [expenses, previousMonth]);

  const hasPreviousMonth = previousMonth !== null;
  const comparisonPercent =
    previousProfit !== 0
      ? Math.round(((profit - previousProfit) / Math.abs(previousProfit)) * 100)
      : 0;
  const comparisonUp = comparisonPercent >= 0;

  const selectAdjacentMonth = (offset: number) => {
    const selectedIndex = months.findIndex(
      (month) => month.start.getTime() === selectedMonth.start.getTime(),
    );
    const nextMonth = months[selectedIndex + offset];

    if (!nextMonth) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(nextMonth.start);
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setSelectedDate(currentTimelineMonth.start);
    setTimeout(() => setRefreshing(false), 700);
  };

  const donutRadius = 74;
  const donutStrokeWidth = 10;
  const donutCircumference = 2 * Math.PI * donutRadius;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[GREEN]}
          onRefresh={onRefresh}
          progressBackgroundColor={theme.card}
          progressViewOffset={70}
          refreshing={refreshing}
          tintColor={GREEN}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <Animated.View entering={FadeInUp.duration(500)} style={styles.headerRow}>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.monthSelector}>
          <Pressable
            accessibilityLabel="Previous business month"
            disabled={!previousMonth}
            hitSlop={8}
            onPress={() => selectAdjacentMonth(-1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={!previousMonth ? theme.border : theme.subText}
              name="chevron-back"
              size={17}
            />
          </Pressable>
          <View style={styles.monthButton}>
            <Ionicons
              color={GREEN}
              name="calendar-clear-outline"
              size={compact ? 17 : 19}
            />
            <Text numberOfLines={1} style={styles.monthButtonTextActive}>
              {selectedMonth?.shortLabel ?? "This Month"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Next business month"
            disabled={
              selectedMonth.start.getTime() ===
              months[months.length - 1]?.start.getTime()
            }
            hitSlop={8}
            onPress={() => selectAdjacentMonth(1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={
                selectedMonth.start.getTime() ===
                months[months.length - 1]?.start.getTime()
                  ? theme.border
                  : theme.subText
              }
              name="chevron-forward"
              size={17}
            />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(80).duration(550)}
        style={styles.overviewCard}
      >
        <View style={styles.overviewLeft}>
          <View style={styles.cardTitleRow}>
            <Ionicons
              color="rgba(255,255,255,0.86)"
              name="stats-chart-outline"
              size={compact ? 20 : 24}
            />
            <Text style={styles.overviewTitle}>Business Overview</Text>
          </View>

          <Text style={styles.overviewLabel}>{heroLeadLabel}</Text>
          <Text style={styles.usedPercent}>
            {heroMode === "empty" ? "0%" : `${heroLeadValue}%`}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={styles.usedAmount}
          >
            {heroLeadAmount}
          </Text>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: "#34D399" }]} />
            <Text style={styles.legendText}>Income</Text>
            <Text style={styles.legendAmount}>
              {formatMoney(totals.income)}
            </Text>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: "#F97316" }]} />
            <Text style={styles.legendText}>Expense</Text>
            <Text style={styles.legendAmount}>{formatMoney(totalExpense)}</Text>
          </View>

          <View style={styles.comparisonPill}>
            <Ionicons
              color={comparisonUp ? "#11D86E" : "#FF7474"}
              name={comparisonUp ? "arrow-up" : "arrow-down"}
              size={22}
            />
            <Text style={styles.comparisonText}>
              {hasPreviousMonth
                ? `${Math.abs(comparisonPercent)}% vs Last Month`
                : "First Month"}
            </Text>
          </View>
        </View>

        <View style={styles.donutBox}>
          <Svg width={155} height={155} viewBox="0 0 180 180">
            <Circle
              cx="90"
              cy="90"
              fill="none"
              r={donutRadius}
              stroke="#F3F4F1"
              strokeWidth={donutStrokeWidth}
            />
            {(heroMode === "balanced" || heroMode === "incomeOnly") && (
              <IncomeProgress
                circumference={donutCircumference}
                incomeShare={visualArcShares.income}
                progress={progress}
                radius={donutRadius}
                strokeWidth={donutStrokeWidth}
              />
            )}
            {(heroMode === "balanced" || heroMode === "expenseOnly") && (
              <DonutProgress
                circumference={donutCircumference}
                expenseShare={visualArcShares.expense}
                progress={progress}
                radius={donutRadius}
                strokeWidth={donutStrokeWidth}
              />
            )}
          </Svg>
          <View style={styles.donutCenter}>
            <View style={styles.walletIcon}>
              <Ionicons color={PURPLE} name="briefcase-outline" size={21} />
            </View>
            <Text style={styles.donutLabel}>{heroCenterTitle}</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              style={[
                styles.donutAmount,
                {
                  color: heroMode === "expenseOnly" || isLoss ? RED : "#0B102B",
                },
              ]}
            >
              {heroMode === "empty" ? formatMoney(0) : heroCenterValue}
            </Text>
            {/* <Text style={styles.donutMeta}>{heroCenterSubtitle}</Text> */}
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(140).duration(550)}
        style={styles.insightCard}
      >
        <View style={styles.insightIcon}>
          <Ionicons color={GREEN} name="bulb" size={25} />
        </View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>Insight</Text>
          <Text style={styles.insightText}>
            {topCategory ? (
              <>
                {topCategory[0]} is your highest business spend{" "}
                <Text style={styles.insightStrong}>
                  {totalExpense > 0
                    ? Math.round((topCategory[1] / totalExpense) * 100)
                    : 0}
                  %
                </Text>{" "}
                this month.
              </>
            ) : (
              "Add business income and expenses to unlock insights this month."
            )}
          </Text>
        </View>
        {/* <Ionicons color={GREEN} name="chevron-forward" size={25} /> */}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(550)}
        style={styles.sectionCard}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Expense Categories</Text>
        </View>

        {displayRows.length === 0 ? (
          <Text style={styles.emptyTrendText}>
            No business expenses recorded this month.
          </Text>
        ) : (
          displayRows.map(([category, value], index) => {
            const percent = totalExpense > 0 ? (value / totalExpense) * 100 : 0;
            const color = categoryColor(category, index);
            const meta = getCategoryMeta(category);

            return (
              <View key={category} style={styles.categoryRow}>
                <View
                  style={[styles.categoryIcon, { backgroundColor: meta.tint }]}
                >
                  <Ionicons color={color} name={meta.icon} size={18} />
                </View>

                <View style={styles.categoryContent}>
                  <View style={styles.categoryTopRow}>
                    <View style={styles.categoryTextGroup}>
                      <Text numberOfLines={1} style={styles.categoryName}>
                        {category}
                      </Text>
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        numberOfLines={1}
                        style={[styles.categoryAmount, { color }]}
                      >
                        {formatMoney(value)}
                      </Text>
                    </View>

                    <Text style={styles.categoryPercent}>
                      {percent.toFixed(1)}%
                    </Text>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: color,
                          width: `${Math.max(percent, value > 0 ? 3 : 0)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(260).duration(550)}
        style={styles.sectionCard}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Business Progress</Text>
          <View style={styles.trendPill}>
            <Ionicons color={GREEN} name="calendar-clear-outline" size={15} />
            <Text numberOfLines={1} style={styles.trendPillText}>
              {selectedMonth?.shortLabel ?? "This Month"}
            </Text>
          </View>
        </View>

        {showTrend ? (
          <TrendChart data={monthTrend} styles={styles} />
        ) : (
          <Text style={styles.emptyTrendText}>
            No cash flow recorded for {selectedMonth?.label ?? "this month"}.
          </Text>
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(320).duration(550)}
        style={styles.savingsCard}
      >
        <View style={styles.savingsLeft}>
          <View style={styles.savingsIcon}>
            <Ionicons color={GREEN} name="shield-checkmark-outline" size={31} />
          </View>
          <View>
            <Text style={styles.savingsLabel}>Profit Margin</Text>
            <Text
              style={[styles.savingsPercent, { color: isLoss ? RED : GREEN }]}
            >
              {profitMargin}%
            </Text>
            <Text style={styles.savingsCaption}>
              {totals.income + totalExpense === 0
                ? "No business activity recorded this month."
                : totalExpense === 0
                  ? "No business spending recorded this month."
                  : isLoss
                    ? `Loss of ${formatMoney(Math.abs(profit))}`
                    : profitMargin >= 30
                      ? "Excellent business margin."
                      : profitMargin >= 10
                        ? "Healthy business performance."
                        : "Watch the biggest spend categories closely."}
            </Text>
          </View>
        </View>

        <View style={styles.savingsDivider} />

        <View style={styles.savingsRight}>
          <View style={styles.savingsBarRow}>
            <View style={styles.savingsTrack}>
              <View
                style={[
                  styles.savingsFill,
                  {
                    backgroundColor: isLoss ? RED : GREEN,
                    width: `${Math.min(Math.max(Math.abs(profitMargin), 0), 100)}%`,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.savingsSmallPercent,
                { color: isLoss ? RED : GREEN },
              ]}
            >
              {profitMargin}%
            </Text>
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={2}
            style={styles.savingsAmount}
          >
            {isLoss
              ? `${formatMoney(Math.abs(profit))} loss`
              : `${formatMoney(profit)} profit`}
          </Text>
          <Text numberOfLines={1} style={styles.cycleLabel}>
            {selectedMonth?.label}
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

function TrendChart({
  data,
  styles,
}: {
  data: { label: string; value: number }[];
  styles: ReturnType<typeof getStyles>;
}) {
  const chartWidth = 300;
  const chartHeight = 160;
  const left = 38;
  const right = 10;
  const top = 12;
  const bottom = 32;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const lowestValue = Math.min(0, ...data.map((item) => item.value));
  const highestValue = Math.max(1, ...data.map((item) => item.value));
  const range = highestValue - lowestValue || 1;
  const maxValue = highestValue;
  const minValue = lowestValue;
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map(
    (ratio) => maxValue - range * (1 - ratio),
  );

  const formatAxisValue = (value: number) => {
    const absolute = Math.abs(value);
    const prefix = value < 0 ? "-" : "";
    if (absolute === 0) return `${RUPEE}0`;
    if (absolute < 1000) return `${prefix}${RUPEE}${Math.round(absolute)}`;

    const thousands = absolute / 1000;
    return `${prefix}${RUPEE}${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  };

  const points = data.map((item, index) => {
    const x = left + (plotWidth / Math.max(data.length - 1, 1)) * index;
    const y = top + plotHeight - ((item.value - minValue) / range) * plotHeight;
    return { ...item, x, y };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length
    ? `M ${points[0].x} ${plotHeight + top} L ${points
        .map((point) => `${point.x} ${point.y}`)
        .join(" L ")} L ${points[points.length - 1].x} ${plotHeight + top} Z`
    : "";

  return (
    <View style={styles.trendChart}>
      <Svg
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
      >
        {yTicks.map((tick) => {
          const y = top + plotHeight - ((tick - minValue) / range) * plotHeight;
          return (
            <React.Fragment key={tick}>
              <Path
                d={`M ${left} ${y} H ${chartWidth - right}`}
                opacity={tick === 0 ? 0.9 : 0.55}
                stroke="#D6DAE2"
                strokeWidth="1"
              />
            </React.Fragment>
          );
        })}
        <Path
          d={`M ${left} ${top} V ${top + plotHeight} H ${chartWidth - right}`}
          fill="none"
          stroke="#D6DAE2"
          strokeWidth="1.2"
        />
        {areaPath ? <Path d={areaPath} fill="rgba(21,150,101,0.14)" /> : null}
        <Polyline
          fill="none"
          points={linePoints}
          stroke={GREEN}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.2"
        />
        {points.map((point) => (
          <Circle
            key={`${point.label}-${point.x}`}
            cx={point.x}
            cy={point.y}
            fill={point.value >= 0 ? GREEN : RED}
            r="7"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        ))}
      </Svg>

      {points.length > 0 && points[points.length - 1].value !== 0 ? (
        <Text
          style={[
            styles.pointLabel,
            {
              color: points[points.length - 1].value >= 0 ? GREEN : RED,
              left: `${Math.min(
                84,
                Math.max(
                  8,
                  ((points[points.length - 1].x - 30) / chartWidth) * 100,
                ),
              )}%`,
              top: Math.max(0, points[points.length - 1].y - 24),
            },
          ]}
        >
          {formatCompactMoney(points[points.length - 1].value)}
        </Text>
      ) : null}

      <View style={styles.yAxisLabels}>
        {yTicks.map((tick) => (
          <Text key={tick} style={styles.axisText}>
            {formatAxisValue(tick)}
          </Text>
        ))}
      </View>

      <View style={styles.xAxisLabels}>
        {data.map((item) => (
          <Text
            adjustsFontSizeToFit
            key={item.label}
            minimumFontScale={0.72}
            numberOfLines={1}
            style={styles.monthLabel}
          >
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const getStyles = (theme: any, dark: boolean, compact: boolean) =>
  StyleSheet.create({
    screen: {
      backgroundColor: dark ? "#101216" : "#F8F9FB",
      flex: 1,
    },
    content: {
      paddingBottom: 138,
      paddingHorizontal: compact ? 10 : 14,
      paddingTop: 60,
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: compact ? 8 : 12,
      justifyContent: "space-between",
    },
    title: {
      color: dark ? "#FFFFFF" : "#070E2D",
      flexShrink: 0,
      fontSize: compact ? 30 : 33,
      fontWeight: "900",
    },
    monthSelector: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: dark ? "#2D3240" : "#D9DDE8",
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      maxWidth: compact ? 176 : 196,
      minWidth: 0,
      paddingHorizontal: 4,
    },
    monthArrow: {
      alignItems: "center",
      height: 46,
      justifyContent: "center",
      width: 26,
    },
    monthButton: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: compact ? 5 : 7,
      height: 48,
      justifyContent: "center",
      minWidth: 0,
    },
    monthButtonTextActive: {
      color: GREEN,
      flexShrink: 1,
      fontSize: compact ? 12 : 14,
      fontWeight: "800",
    },
    overviewCard: {
      backgroundColor: PURPLE_DARK,
      borderRadius: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 24,
      minHeight: 250,
      overflow: "hidden",
      padding: compact ? 16 : 18,
    },
    overviewLeft: {
      flex: 0.9,
      minWidth: 0,
      paddingRight: compact ? 8 : 8,
      zIndex: 1,
    },
    cardTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
      marginBottom: 12,
    },
    overviewTitle: {
      color: "rgba(255,255,255,0.86)",
      fontSize: compact ? 14 : 16,
      fontWeight: "600",
    },
    overviewLabel: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 8,
    },
    usedPercent: {
      color: "#FFFFFF",
      fontSize: compact ? 26 : 34,
      fontWeight: "800",
      lineHeight: 28,
    },
    usedAmount: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
      marginBottom: compact ? 14 : 20,
    },
    legendRow: {
      alignItems: "center",
      flexDirection: "row",
      marginTop: compact ? 8 : 11,
    },
    legendDot: {
      borderRadius: 9,
      height: 15,
      marginRight: compact ? 8 : 12,
      width: 15,
    },
    legendText: {
      color: "#FFFFFF",
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
    },
    legendAmount: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    comparisonPill: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "rgba(5, 36, 26, 0.45)",
      borderRadius: 9,
      flexDirection: "row",
      gap: 8,
      marginTop: compact ? 18 : 23,
      paddingHorizontal: compact ? 8 : 8,
      paddingVertical: compact ? 6 : 6,
    },
    comparisonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },
    donutBox: {
      alignItems: "center",
      flex: 1,
      alignSelf: "flex-start",
      justifyContent: "center",
      marginRight: 0,
      marginTop: 8,
      width: compact ? 150 : 170,
      height: compact ? 150 : 170,
    },
    donutCenter: {
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      width: 96,
      height: 96,
      borderRadius: 50,
      justifyContent: "center",
      position: "absolute",
    },
    walletIcon: {
      alignItems: "center",
      backgroundColor: "#DCFCE7",
      borderRadius: 18,
      height: 36,
      justifyContent: "center",
      marginBottom: 5,
      width: 36,
    },
    donutLabel: {
      color: "#5A6174",
      fontSize: 10,
      fontWeight: "800",
    },
    donutAmount: {
      color: "#0B102B",
      fontSize: 12,
      fontWeight: "900",
      marginTop: 4,
      maxWidth: compact ? 82 : 94,
    },
    donutMeta: {
      color: "#5A6174",
      fontSize: 9,
      fontWeight: "800",
      marginTop: 4,
      textAlign: "center",
    },
    insightCard: {
      alignItems: "center",
      backgroundColor: dark ? "#13201B" : "#F7FFFB",
      borderColor: dark ? "#224D3B" : "#CDEBDD",
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: compact ? 11 : 15,
      marginTop: 22,
      minHeight: 92,
      paddingHorizontal: compact ? 14 : 18,
      paddingVertical: 16,
    },
    insightIcon: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(15,155,88,0.17)" : "#E2F6EB",
      borderRadius: 32,
      height: 45,
      justifyContent: "center",
      width: 45,
    },
    insightCopy: {
      flex: 1,
      minWidth: 0,
    },
    insightTitle: {
      color: GREEN,
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 6,
    },
    insightText: {
      color: dark ? "#E8EDF2" : "#1C2338",
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 22,
    },
    insightStrong: {
      color: GREEN,
      fontWeight: "900",
    },
    sectionCard: {
      backgroundColor: theme.card,
      borderColor: dark ? "#252A35" : "#EAEDF3",
      borderRadius: 22,
      borderWidth: 1,
      elevation: 2,
      marginTop: 22,
      padding: compact ? 16 : 18,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.18 : 0.05,
      shadowRadius: 18,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    sectionTitle: {
      color: dark ? "#FFFFFF" : "#080D27",
      fontSize: compact ? 17 : 18,
      fontWeight: "900",
    },
    categoryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: compact ? 9 : 13,
      marginTop: 14,
    },
    categoryIcon: {
      alignItems: "center",
      borderRadius: 13,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    categoryContent: {
      flex: 1,
      minWidth: 0,
    },
    categoryTopRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    categoryTextGroup: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
    },
    categoryName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
    },
    progressTrack: {
      backgroundColor: dark ? "#303541" : "#E4E6EC",
      borderRadius: 999,
      height: 6,
      overflow: "hidden",
    },
    progressFill: {
      borderRadius: 999,
      height: "100%",
    },
    categoryPercent: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 10,
    },
    categoryAmount: {
      fontSize: compact ? 12 : 14,
      fontWeight: "800",
      marginTop: 3,
    },
    trendPill: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(15,155,88,0.13)" : "#F1FAF6",
      borderColor: dark ? "#28543F" : "#C9E9DA",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      maxWidth: compact ? 132 : 150,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    trendPillText: {
      color: GREEN,
      flexShrink: 1,
      fontSize: 11,
      fontWeight: "900",
    },
    trendChart: {
      height: 190,
      marginTop: 2,
      position: "relative",
    },
    yAxisLabels: {
      height: 122,
      justifyContent: "space-between",
      left: 0,
      position: "absolute",
      top: 9,
      width: 38,
    },
    axisText: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "left",
    },
    xAxisLabels: {
      bottom: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      left: 44,
      position: "absolute",
      right: 5,
    },
    monthLabel: {
      color: theme.subText,
      fontSize: compact ? 9 : 10,
      fontWeight: "900",
      textAlign: "center",
      width: compact ? 40 : 44,
    },
    pointLabel: {
      backgroundColor: theme.card,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: "900",
      minWidth: 56,
      paddingHorizontal: 4,
      paddingVertical: 2,
      position: "absolute",
      textAlign: "center",
      zIndex: 2,
    },
    emptyTrendText: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 21,
    },
    savingsCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: dark ? "#252A35" : "#EAEDF3",
      borderRadius: 22,
      borderWidth: 1,
      elevation: 2,
      flexDirection: "column",
      gap: 14,
      marginTop: 22,
      minHeight: 124,
      padding: 16,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.18 : 0.05,
      shadowRadius: 18,
    },
    savingsLeft: {
      alignItems: "center",
      flex: undefined,
      flexDirection: "row",
      gap: 14,
      minWidth: 0,
      width: "100%",
    },
    savingsIcon: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(15,155,88,0.15)" : "#EAF8F1",
      borderRadius: 28,
      height: 52,
      justifyContent: "center",
      width: 52,
    },
    savingsLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
    },
    savingsPercent: {
      color: GREEN,
      fontSize: 20,
      fontWeight: "900",
      lineHeight: 30,
      marginTop: 3,
    },
    savingsCaption: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "700",
      maxWidth: 170,
    },
    savingsDivider: {
      alignSelf: "stretch",
      backgroundColor: dark ? "#2A2F3B" : "#E5E7EF",
      height: 1,
      width: undefined,
    },
    savingsRight: {
      flex: undefined,
      minWidth: 0,
      width: "100%",
    },
    savingsBarRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },
    savingsTrack: {
      backgroundColor: dark ? "#303541" : "#E1E4EA",
      borderRadius: 999,
      flex: 1,
      height: 12,
      overflow: "hidden",
    },
    savingsFill: {
      borderRadius: 999,
      height: "100%",
    },
    savingsSmallPercent: {
      color: GREEN,
      fontSize: 12,
      fontWeight: "900",
    },
    savingsAmount: {
      color: theme.subText,
      fontSize: compact ? 12 : 12,
      fontWeight: "800",
      lineHeight: 20,
    },
    cycleLabel: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 5,
    },
  });
