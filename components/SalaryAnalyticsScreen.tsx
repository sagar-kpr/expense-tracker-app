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
import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { useSalary } from "@/context/SalaryContext";
import { useTheme } from "@/context/ThemeContext";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RUPEE = "\u20B9";
const PURPLE = "#6E3CFF";
const PURPLE_DARK = "#371872"; //"#35108E";
const GREEN = "#0F9B58";
const BLUE = "#1877F2";
const ORANGE = "#F97316";

const formatCycleDate = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const getExpenseDate = (value: any) => {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

const formatCompactMoney = (value: number) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) < 1000) return formatMoney(amount);

  const thousands = amount / 1000;
  return `${RUPEE}${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`;
};

const categoryColor = (category: string, index: number) => {
  const metaColor = getCategoryMeta(category).color;
  const fallback = [PURPLE, "#FF202A", GREEN, BLUE, ORANGE][index % 5];
  return metaColor || fallback;
};

type DonutProgressProps = {
  circumference: number;
  progress: SharedValue<number>;
  radius: number;
  salaryUsed: number;
  strokeWidth: number;
};

function DonutProgress({
  circumference,
  progress,
  radius,
  salaryUsed,
  strokeWidth,
}: DonutProgressProps) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [
      circumference * (salaryUsed / 100) * progress.value,
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
      stroke="#7B61FF"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      strokeOpacity={0.95}
      transform="rotate(-90 90 90)"
    />
  );
}

export default function SalaryAnalyticsScreen() {
  const { expenses } = useExpense();
  const { theme, dark } = useTheme();
  const { userData } = useAuth();
  const { getCycleExpenses, getCycleSummary, getCycleTimeline } = useSalary();
  const { salary: onboardingSalary } = useOnboardingStore();
  const { width } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);
  const progress = useSharedValue(0);
  const compact = width < 422;

  const styles = useMemo(
    () => getStyles(theme, dark, compact),
    [compact, dark, theme],
  );

  const salaryCycles = useMemo(
    () =>
      getCycleTimeline(12).map((cycle, index, array) => ({
        ...cycle,
        end: cycle.end,
        label: `${formatCycleDate(cycle.start)} - ${formatCycleDate(
          new Date(cycle.end.getTime() - MS_PER_DAY),
        )}`,
        shortLabel:
          index === array.length - 1
            ? "This Month"
            : cycle.start.toLocaleDateString("en-IN", {
                month: "short",
                year: "2-digit",
              }),
      })),
    [getCycleTimeline],
  );
  const [selectedDate, setSelectedDate] = useState(
    () => salaryCycles[salaryCycles.length - 1]?.start || new Date(),
  );

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200 });
  }, [progress, selectedDate]);

  const selectedCycle = salaryCycles.find(
    (cycle) => cycle.start.getTime() === selectedDate.getTime(),
  );

  useEffect(() => {
    if (!selectedCycle) {
      setSelectedDate(salaryCycles[salaryCycles.length - 1]?.start || new Date());
    }
  }, [salaryCycles, selectedCycle]);
  const selectedCycleEnd = useMemo(
    () => selectedCycle?.end || new Date(selectedDate),
    [selectedCycle, selectedDate],
  );

  const filteredExpenses = useMemo(() => {
    if (!selectedCycle) {
      return [];
    }

    return getCycleExpenses(selectedCycle, expenses);
  }, [
    expenses,
    getCycleExpenses,
    selectedCycle,
    selectedCycleEnd,
    selectedDate,
  ]);

  const groupedCategories = useMemo(
    () =>
      filteredExpenses.reduce((acc: Record<string, number>, item: any) => {
        const category = item.category || "Other";
        acc[category] = (acc[category] || 0) + Number(item.amount || 0);
        return acc;
      }, {}),
    [filteredExpenses],
  );

  const ranges = useMemo(
    () =>
      Object.entries(groupedCategories).sort(
        (left: any, right: any) => right[1] - left[1],
      ) as [string, number][],
    [groupedCategories],
  );

  const totalSpent = ranges.reduce((sum, item) => sum + item[1], 0);
  const selectedCycleSummary = getCycleSummary(selectedDate, {
    expectedCycleStart: selectedCycle?.expectedStart,
    referenceDate: selectedDate,
  });
  const salaryAmount = Number(
    selectedCycleSummary.salary || userData?.salary || onboardingSalary || 0,
  );
  const remaining = salaryAmount - totalSpent;
  const salaryUsed =
    salaryAmount > 0 ? Math.min((totalSpent / salaryAmount) * 100, 100) : 0;
  const salaryUsedLabel =
    totalSpent > 0 && salaryUsed < 1
      ? salaryUsed.toFixed(1)
      : String(Math.round(salaryUsed));
  const savingsRate =
    salaryAmount > 0 ? Math.round((remaining / salaryAmount) * 100) : 0;
  const savingsBarWidth = Math.min(Math.max(savingsRate, 0), 100);

  const isOverspent = remaining < 0;
  const topCategory = ranges[0];
  const displayRanges = ranges.slice(0, 6);

  const trendBuckets = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const trendEnd =
      now >= selectedDate && now < selectedCycleEnd
        ? tomorrow
        : selectedCycleEnd;
    const totalDays = Math.max(
      1,
      Math.ceil((trendEnd.getTime() - selectedDate.getTime()) / MS_PER_DAY),
    );
    const bucketCount = Math.min(6, totalDays);
    const buckets = Array.from({ length: bucketCount }, (_value, index) => {
      const dayOffset = Math.floor((index * totalDays) / bucketCount);
      const bucketDate = new Date(
        selectedDate.getTime() + dayOffset * MS_PER_DAY,
      );

      return {
        label: bucketDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
        value: 0,
      };
    });

    filteredExpenses.forEach((item) => {
      const date = getExpenseDate(item.createdAt);
      if (!date) return;

      const dayOffset = Math.max(
        0,
        Math.floor((date.getTime() - selectedDate.getTime()) / MS_PER_DAY),
      );
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((dayOffset * bucketCount) / totalDays),
      );
      buckets[bucketIndex].value += Number(item.amount || 0);
    });

    let cumulativeSpend = 0;
    return buckets.map((bucket) => {
      cumulativeSpend += bucket.value;
      return { ...bucket, value: cumulativeSpend };
    });
  }, [filteredExpenses, selectedCycleEnd, selectedDate]);
  const showTrend = trendBuckets.some((item) => item.value > 0);
  const previousCycleSpend = useMemo(() => {
    const selectedCycleIndex = salaryCycles.findIndex(
      (cycle) => cycle.start.getTime() === selectedDate.getTime(),
    );
    const previousCycle = salaryCycles[selectedCycleIndex - 1];

    if (!previousCycle) {
      return 0;
    }

    return expenses.reduce((sum, item: any) => {
      const date = getExpenseDate(item.createdAt);

      if (!date || (item.type || "expense") !== "expense") return sum;

      return date >= previousCycle.start && date < previousCycle.end
        ? sum + Number(item.amount || 0)
        : sum;
    }, 0);
  }, [expenses, salaryCycles, selectedDate]);

  const hasPreviousCycle = previousCycleSpend > 0;
  const comparisonPercent =
    previousCycleSpend > 0
      ? Math.round(
          ((totalSpent - previousCycleSpend) / previousCycleSpend) * 100,
        )
      : 0;
  const comparisonUp = comparisonPercent >= 0;
  const selectedCycleIndex = salaryCycles.findIndex(
    (cycle) => cycle.start.getTime() === selectedDate.getTime(),
  );

  const selectAdjacentCycle = (offset: number) => {
    const nextCycle = salaryCycles[selectedCycleIndex + offset];

    if (!nextCycle) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(nextCycle.start);
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setSelectedDate(salaryCycles[salaryCycles.length - 1]?.start || new Date());
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
          colors={[PURPLE]}
          onRefresh={onRefresh}
          progressBackgroundColor={theme.card}
          progressViewOffset={70}
          refreshing={refreshing}
          tintColor={PURPLE}
        />
      }
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <Animated.View entering={FadeInUp.duration(500)} style={styles.headerRow}>
        <Text style={styles.title}>Analytics</Text>
        <View style={styles.monthSelector}>
          <Pressable
            accessibilityLabel="Previous salary cycle"
            disabled={selectedCycleIndex <= 0}
            hitSlop={8}
            onPress={() => selectAdjacentCycle(-1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={selectedCycleIndex <= 0 ? theme.border : theme.subText}
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
              {selectedCycle?.shortLabel ?? "This Month"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Next salary cycle"
            disabled={selectedCycleIndex >= salaryCycles.length - 1}
            hitSlop={8}
            onPress={() => selectAdjacentCycle(1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={
                selectedCycleIndex >= salaryCycles.length - 1
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
              name="pie-chart-outline"
              size={compact ? 20 : 24}
            />
            <Text style={styles.overviewTitle}>Salary Overview</Text>
          </View>

          <Text style={styles.overviewLabel}>Salary Used</Text>
          <Text style={styles.usedPercent}>{salaryUsedLabel}%</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={styles.usedAmount}
          >
            {formatMoney(totalSpent)} of {formatMoney(salaryAmount)}
          </Text>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: "#7A4CFF" }]} />
            <Text style={styles.legendText}>Used</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              style={styles.legendAmount}
            >
              {formatMoney(totalSpent)}
            </Text>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: "#C9D1CC" }]} />
            <Text style={styles.legendText}>Remaining</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              style={styles.legendAmount}
            >
              {formatMoney(remaining)}
            </Text>
          </View>

          <View style={styles.comparisonPill}>
            <Ionicons
              color={comparisonUp ? "#11D86E" : "#FF7474"}
              name={comparisonUp ? "arrow-up" : "arrow-down"}
              size={22}
            />
            <Text style={styles.comparisonText}>
              {hasPreviousCycle
                ? `${Math.abs(comparisonPercent)}% vs Last Month`
                : "First Cycle"}
            </Text>
          </View>
        </View>

        {salaryAmount > 0 && (
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
              <DonutProgress
                circumference={donutCircumference}
                progress={progress}
                radius={donutRadius}
                salaryUsed={salaryUsed}
                strokeWidth={donutStrokeWidth}
              />
            </Svg>
            <View style={styles.donutCenter}>
              <View style={styles.walletIcon}>
                <Ionicons color={PURPLE} name="wallet" size={21} />
              </View>
              <Text style={styles.donutLabel}>Total Salary</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
                style={styles.donutAmount}
              >
                {formatMoney(salaryAmount)}
              </Text>
            </View>
          </View>
        )}
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
                {topCategory[0]} is your largest expense{" "}
                <Text style={styles.insightStrong}>
                  {totalSpent > 0
                    ? Math.round((topCategory[1] / totalSpent) * 100)
                    : 0}
                  %
                </Text>{" "}
                this cycle.
              </>
            ) : (
              "Add expenses to unlock spending insights this cycle."
            )}
          </Text>
        </View>
        <Ionicons color={GREEN} name="chevron-forward" size={25} />
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(550)}
        style={styles.sectionCard}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
        </View>

        {displayRanges.length === 0 ? (
          <Text style={styles.emptyTrendText}>
            No expenses recorded in this salary cycle.
          </Text>
        ) : (
          displayRanges.map(([category, value], index) => {
            const percent = totalSpent > 0 ? (value / totalSpent) * 100 : 0;
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
          <Text style={styles.sectionTitle}>Salary Cycle Progress</Text>
          <View style={styles.trendPill}>
            <Ionicons color={GREEN} name="calendar-clear-outline" size={15} />
            <Text numberOfLines={1} style={styles.trendPillText}>
              {selectedCycle?.shortLabel ?? "This Month"}
            </Text>
          </View>
        </View>

        {showTrend ? (
          <TrendChart data={trendBuckets} styles={styles} />
        ) : (
          <Text style={styles.emptyTrendText}>
            No spending recorded for {selectedCycle?.label ?? "this cycle"}.
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
            <Text style={styles.savingsLabel}>Savings Rate</Text>
            <Text style={styles.savingsPercent}>{savingsRate}%</Text>
            <Text style={styles.savingsCaption}>
              {salaryAmount <= 0
                ? "Add salary to unlock analytics."
                : totalSpent === 0
                  ? "No spending recorded this cycle."
                  : isOverspent
                    ? `Overspent by ${formatMoney(Math.abs(remaining))}`
                    : savingsRate >= 30
                      ? "Excellent saving rate."
                      : savingsRate >= 10
                        ? "Healthy spending habits."
                        : "Keep watching the big categories."}
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
                    backgroundColor: GREEN,
                    width: `${savingsBarWidth}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.savingsSmallPercent}>{savingsRate}%</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={2}
            style={styles.savingsAmount}
          >
            {isOverspent
              ? `${formatMoney(Math.abs(remaining))} overspent`
              : `${formatMoney(remaining)} remaining`}
          </Text>
          <Text numberOfLines={1} style={styles.cycleLabel}>
            {selectedCycle?.label}
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
  const highestValue = Math.max(1, ...data.map((item) => item.value));
  const magnitude = 10 ** Math.floor(Math.log10(highestValue));
  const maxValue = Math.ceil(highestValue / magnitude) * magnitude;
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => maxValue * ratio);

  const formatAxisValue = (value: number) => {
    if (value === 0) return `${RUPEE}0`;
    if (value < 1000) return `${RUPEE}${Math.round(value)}`;

    const thousands = value / 1000;
    return `${RUPEE}${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  };

  const points = data.map((item, index) => {
    const x = left + (plotWidth / Math.max(data.length - 1, 1)) * index;
    const y = top + plotHeight - (item.value / maxValue) * plotHeight;
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
          const y = top + plotHeight - (tick / maxValue) * plotHeight;
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
        {areaPath ? <Path d={areaPath} fill="rgba(15,155,88,0.14)" /> : null}
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
            fill={GREEN}
            r="7"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        ))}
      </Svg>

      {points.length > 0 && points[points.length - 1].value > 0 ? (
        <Text
          style={[
            styles.pointLabel,
            {
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
      // fontSize: 12,
      // fontWeight: "800",
      marginBottom: 8,

      fontSize: 12,
      fontWeight: "700",
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
      backgroundColor: "rgba(6, 4, 44, 0.45)",
      borderRadius: 9,
      flexDirection: "row",
      gap: 8,
      marginTop: compact ? 18 : 23,
      paddingHorizontal: compact ? 8 : 8,
      paddingVertical: compact ? 6 : 6,
    },
    comparisonText: {
      color: "#FFFFFF",
      fontSize: compact ? 11 : 11,
      fontWeight: "900",
    },
    donutBox: {
      alignItems: "center",
      flex: 1,
      alignSelf: "flex-start",
      marginTop: 8,
      justifyContent: "center",
      marginRight: 0,
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
      backgroundColor: "#ECE4FF",

      justifyContent: "center",
      marginBottom: 5,
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    donutLabel: {
      color: "#5A6174",
      fontSize: compact ? 10 : 10,
      fontWeight: "800",
    },
    donutAmount: {
      color: "#0B102B",
      fontSize: compact ? 12 : 12,
      fontWeight: "900",
      maxWidth: compact ? 82 : 94,
      marginTop: 4,
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
    viewAllText: {
      color: PURPLE,
      fontSize: 14,
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
      fontSize: 14,
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
      color: GREEN,
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
      flexDirection: compact ? "column" : "row",
      gap: compact ? 14 : 18,
      marginTop: 22,
      minHeight: 124,
      padding: compact ? 16 : 18,
      shadowColor: "#111827",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.18 : 0.05,
      shadowRadius: 18,
    },
    savingsLeft: {
      alignItems: "center",
      flex: compact ? undefined : 1,
      flexDirection: "row",
      gap: 14,
      minWidth: 0,
      width: compact ? "100%" : undefined,
    },
    savingsIcon: {
      alignItems: "center",
      backgroundColor: dark ? "rgba(15,155,88,0.15)" : "#EAF8F1",
      borderRadius: 28,
      height: compact ? 52 : 58,
      justifyContent: "center",
      width: compact ? 52 : 58,
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
      lineHeight: compact ? 30 : 40,
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
      height: compact ? 1 : undefined,
      width: compact ? undefined : 1,
    },
    savingsRight: {
      flex: compact ? undefined : 1,
      minWidth: 0,
      width: compact ? "100%" : undefined,
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
