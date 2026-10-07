import { formatPercent, getBudgetMetrics, getChangePercent } from "@/services/financialMetrics";
import { addMoney } from "@/services/salaryMath";
import MoneyText from "@/components/MoneyText";
import useScreenLayout from "@/components/useScreenLayout";
import FinancialOverview from "@/components/FinancialOverview";
import { formatMoney, formatCompactMoney, formatReadableMoney } from "@/utils/money";
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
const PURPLE = "#6E3CFF";
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
  const screenLayout = useScreenLayout();
  const { expenses } = useExpense();
  const { theme, dark } = useTheme();
  const { userData } = useAuth();
  const {
    getCurrentArrivalStatus,
    getCycleExpenses,
    getCycleSummary,
    getCycleTimeline,
  } = useSalary();
  const { salary: onboardingSalary } = useOnboardingStore();
  const { width, fontScale } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);
  const progress = useSharedValue(0);
  const compact = width / fontScale < 440;

  const styles = useMemo(
    () => getStyles(theme, dark, compact),
    [compact, dark, theme],
  );
  const arrivalStatus = getCurrentArrivalStatus();

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
  const visibleSalaryCycles = useMemo(() => {
    if (!arrivalStatus.needsConfirmation) {
      return salaryCycles;
    }

    const activeIndex = salaryCycles.findIndex(
      (cycle) => cycle.start.getTime() === arrivalStatus.start.getTime(),
    );

    if (activeIndex < 0) {
      return salaryCycles;
    }

    return salaryCycles.slice(0, activeIndex + 1);
  }, [arrivalStatus.needsConfirmation, arrivalStatus.start, salaryCycles]);
  const [selectedDate, setSelectedDate] = useState(
    () =>
      arrivalStatus.start ||
      visibleSalaryCycles[visibleSalaryCycles.length - 1]?.start ||
      new Date(),
  );

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200 });
  }, [progress, selectedDate]);

  const selectedCycle = salaryCycles.find(
    (cycle) => cycle.start.getTime() === selectedDate.getTime(),
  );
  const visibleSelectedCycle = visibleSalaryCycles.find(
    (cycle) => cycle.start.getTime() === selectedDate.getTime(),
  );
  const activeSelectedCycle =
    visibleSelectedCycle &&
    arrivalStatus.needsConfirmation &&
    visibleSelectedCycle.start.getTime() === arrivalStatus.start.getTime()
      ? {
          ...visibleSelectedCycle,
          end: arrivalStatus.end,
        }
      : visibleSelectedCycle;

  useEffect(() => {
    if (!visibleSelectedCycle) {
      setSelectedDate(
        arrivalStatus.start ||
          visibleSalaryCycles[visibleSalaryCycles.length - 1]?.start ||
          new Date(),
      );
    }
  }, [arrivalStatus.start, visibleSelectedCycle, visibleSalaryCycles]);
  const selectedCycleEnd = useMemo(
    () => activeSelectedCycle?.end || new Date(selectedDate),
    [activeSelectedCycle, selectedDate],
  );

  const filteredExpenses = useMemo(() => {
    if (!activeSelectedCycle) {
      return [];
    }

    return getCycleExpenses(activeSelectedCycle, expenses);
  }, [
    expenses,
    getCycleExpenses,
    activeSelectedCycle,
    selectedCycleEnd,
    selectedDate,
  ]);

  const groupedCategories = useMemo(
    () =>
      filteredExpenses.reduce((acc: Record<string, number>, item: any) => {
        const category = item.category || "Other";
        acc[category] = addMoney(acc[category] || 0, Number(item.amount || 0));
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

  const totalSpent = ranges.reduce((sum, item) => addMoney(sum, item[1]), 0);
  const selectedCycleSummary = getCycleSummary(selectedDate, {
    expectedCycleStart: activeSelectedCycle?.expectedStart,
    referenceDate:
      activeSelectedCycle?.start.getTime() === arrivalStatus.start.getTime()
        ? new Date()
        : selectedDate,
  });
  const salaryAmount = Number(
    selectedCycleSummary.salary ?? userData?.salary ?? onboardingSalary ?? 0,
  );
  const carryForward = Number(selectedCycleSummary.carryForward || 0);
  const additionalFunds = Number(selectedCycleSummary.additionalFunds || 0);
  const availableTotal = addMoney(addMoney(carryForward, salaryAmount), additionalFunds);
  const { remaining, usagePercent: usageRatio, savingsPercent } = getBudgetMetrics(availableTotal, totalSpent);
  const salaryUsed = Math.min(Math.max(usageRatio ?? 0, 0), 100);
  const salaryUsedLabel = formatPercent(usageRatio);
  const savingsRate = savingsPercent;
  const savingsBarWidth = Math.min(Math.max(savingsRate ?? 0, 0), 100);

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
      buckets[bucketIndex].value = addMoney(buckets[bucketIndex].value, Number(item.amount || 0));
    });

    let cumulativeSpend = 0;
    return buckets.map((bucket) => {
      cumulativeSpend = addMoney(cumulativeSpend, bucket.value);
      return { ...bucket, value: cumulativeSpend };
    });
  }, [filteredExpenses, selectedCycleEnd, selectedDate]);
  const showTrend = trendBuckets.some((item) => item.value > 0);
  const previousCycleSpend = useMemo(() => {
    const selectedCycleIndex = visibleSalaryCycles.findIndex(
      (cycle) => cycle.start.getTime() === selectedDate.getTime(),
    );
    const previousCycle = visibleSalaryCycles[selectedCycleIndex - 1];

    if (!previousCycle) {
      return 0;
    }

    return expenses.reduce((sum, item: any) => {
      const date = getExpenseDate(item.createdAt);

      if (!date || (item.type || "expense") !== "expense") return sum;

      return date >= previousCycle.start && date < previousCycle.end
        ? addMoney(sum, Number(item.amount || 0))
        : sum;
    }, 0);
  }, [expenses, selectedDate, visibleSalaryCycles]);

  const hasPreviousCycle = visibleSalaryCycles.findIndex((cycle) => cycle.start.getTime() === selectedDate.getTime()) > 0;
  const comparisonPercent = getChangePercent(totalSpent, previousCycleSpend);
  const comparisonUp = totalSpent > previousCycleSpend;
  const comparisonLabel = !hasPreviousCycle ? "First Cycle"
    : comparisonPercent === null ? "No previous spending"
    : totalSpent === previousCycleSpend ? "No change vs previous cycle"
    : `${formatPercent(Math.abs(comparisonPercent))} ${comparisonUp ? "more" : "less"} spending`;
  const visibleSelectedCycleIndex = visibleSalaryCycles.findIndex(
    (cycle) => cycle.start.getTime() === selectedDate.getTime(),
  );

  const selectAdjacentCycle = (offset: number) => {
    const nextCycle = visibleSalaryCycles[visibleSelectedCycleIndex + offset];

    if (!nextCycle) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(nextCycle.start);
  };

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setSelectedDate(
      visibleSalaryCycles[visibleSalaryCycles.length - 1]?.start || new Date(),
    );
    setTimeout(() => setRefreshing(false), 700);
  };

  const donutRadius = 74;
  const donutStrokeWidth = 10;
  const donutCircumference = 2 * Math.PI * donutRadius;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, screenLayout.contentStyle]}
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
            disabled={visibleSelectedCycleIndex <= 0}
            hitSlop={8}
            onPress={() => selectAdjacentCycle(-1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={
                visibleSelectedCycleIndex <= 0 ? theme.border : theme.subText
              }
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
              {activeSelectedCycle?.shortLabel ?? "This Month"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Next salary cycle"
            disabled={
              visibleSelectedCycleIndex >= visibleSalaryCycles.length - 1
            }
            hitSlop={8}
            onPress={() => selectAdjacentCycle(1)}
            style={styles.monthArrow}
          >
            <Ionicons
              color={
                visibleSelectedCycleIndex >= visibleSalaryCycles.length - 1
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
        <FinancialOverview
          title="Salary Overview"
          label="Used"
          percent={salaryUsedLabel}
          summary={`Spent ${formatReadableMoney(totalSpent)}\nAvailable ${formatReadableMoney(availableTotal)}`}
          rows={[
            { label: "Carry Forward", amount: carryForward, color: "#34D399" },
            { label: "Salary", amount: salaryAmount, color: "#60A5FA" },
            { label: "Additional Funds", amount: additionalFunds, color: "#FBBF24" },
            { label: "Used", amount: totalSpent, color: "#9676FF" },
            { label: "Remaining", amount: remaining, color: "#C9D1CC" },
          ]}
          comparison={comparisonLabel}
          comparisonFavorable={!comparisonUp}
          comparisonNeutral={!hasPreviousCycle || comparisonPercent === null || totalSpent === previousCycleSpend}
          comparisonUp={comparisonUp}
        >
        {availableTotal > 0 && (
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
              <Text style={styles.donutLabel}>Available</Text>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
                accessibilityLabel={formatMoney(availableTotal)}
                maxFontSizeMultiplier={1.2}
                style={styles.donutAmount}
              >
                {formatCompactMoney(availableTotal)}
              </Text>
            </View>
          </View>
        )}
        </FinancialOverview>
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
        {/* <Ionicons color={GREEN} name="chevron-forward" size={25} /> */}
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
                      <MoneyText
                        style={[styles.categoryAmount, { color }]}
                       value={value}
                     />
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
                          width: `${Math.min(100, Math.max(percent, value > 0 ? 3 : 0))}%`,
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
          <Text style={styles.sectionTitle}>Progress</Text>
          <View style={styles.trendPill}>
            <Ionicons color={GREEN} name="calendar-clear-outline" size={15} />
            <Text numberOfLines={1} style={styles.trendPillText}>
              {activeSelectedCycle?.shortLabel ?? "This Month"}
            </Text>
          </View>
        </View>

        {showTrend ? (
          <TrendChart data={trendBuckets} styles={styles} />
        ) : (
          <Text style={styles.emptyTrendText}>
            No spending recorded for{" "}
            {activeSelectedCycle?.label ?? "this cycle"}.
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.savingsLabel}>Savings Rate</Text>
            <Text style={styles.savingsPercent}>{formatPercent(savingsRate)}</Text>
            <Text style={styles.savingsCaption}>
              {salaryAmount <= 0
                ? "Add salary to unlock analytics."
                : totalSpent === 0
                  ? "No spending recorded this cycle."
                  : isOverspent
                    ? `Overspent by ${formatReadableMoney(Math.abs(remaining))}`
                    : (savingsRate ?? 0) >= 30
                      ? "Excellent saving rate."
                      : (savingsRate ?? 0) >= 10
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
            <Text style={styles.savingsSmallPercent}>{formatPercent(savingsRate)}</Text>
          </View>
          <Text style={styles.savingsLabel}>{isOverspent ? "Overspent" : "Remaining"}</Text>
          <MoneyText value={Math.abs(remaining)} style={styles.savingsAmount} />
          <Text numberOfLines={1} style={styles.cycleLabel}>
            {activeSelectedCycle?.label}
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
  const [chartWidth, setChartWidth] = useState(300);
  const chartHeight = 160;
  const left = 68;
  const right = 10;
  const top = 12;
  const bottom = 32;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const highestValue = Math.max(1, ...data.map((item) => item.value));
  const magnitude = 10 ** Math.floor(Math.log10(highestValue));
  const maxValue = Math.ceil(highestValue / magnitude) * magnitude;
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => maxValue * ratio);


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
    <View style={styles.trendChart} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
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
          maxFontSizeMultiplier={1.2}
          style={[
            styles.pointLabel,
            {
              right: 0,
              top: Math.max(0, points[points.length - 1].y - 24),
            },
          ]}
        >
          {formatCompactMoney(points[points.length - 1].value)}
        </Text>
      ) : null}

      <View style={styles.yAxisLabels}>
        {yTicks.map((tick) => (
          <MoneyText key={tick} value={tick} style={[styles.axisText, { width: "100%" }]} maxFontSizeMultiplier={1.1} />
        ))}
      </View>

      <View style={styles.xAxisLabels}>
        {data.map((item) => (
          <Text
            adjustsFontSizeToFit
            key={item.label}
            maxFontSizeMultiplier={1.1}
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
      alignItems: compact ? "flex-start" : "center",
      flexDirection: compact ? "column" : "row",
      gap: compact ? 12 : 16,
      justifyContent: "space-between",
    },
    title: {
      color: dark ? "#FFFFFF" : "#070E2D",
      flexShrink: 0,
      fontSize: compact ? 28 : 33,
      fontWeight: "900",
    },
    monthSelector: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: dark ? "#2D3240" : "#D9DDE8",
      borderRadius: 16,
      borderWidth: 1,
      flexGrow: 0,
      flexShrink: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      maxWidth: compact ? 220 : 196,
      width: compact ? "100%" : undefined,
      alignSelf: compact ? "flex-start" : undefined,
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
    overviewCard: { marginTop: 24 },
    donutBox: {
      alignItems: "center",
      alignSelf: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: 155,
      height: 155,
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
      maxWidth: 88,
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
      flexShrink: 1,
      marginRight: 8,
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
      fontVariant: ["tabular-nums"],
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
      width: 62,
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
      left: 68,
      position: "absolute",
      right: 5,
    },
    monthLabel: {
      color: theme.subText,
      fontSize: compact ? 9 : 10,
      fontWeight: "900",
      textAlign: "center",
      flex: 1,
      minWidth: 0,
    },
    pointLabel: {
      backgroundColor: theme.card,
      borderRadius: 6,
      color: GREEN,
      fontSize: 11,
      fontWeight: "900",
      minWidth: 56,
      maxWidth: 120,
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
      maxWidth: "100%",
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
