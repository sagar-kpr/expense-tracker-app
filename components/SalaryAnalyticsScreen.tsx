import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import Animated, {
  FadeInUp,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { getCategoryMeta } from "@/components/categoryMeta";
import CategoryRadialProgress from "@/components/CategoryRadialProgress";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

import Svg, { Circle } from "react-native-svg";

import * as Haptics from "expo-haptics";

import { useExpense } from "@/context/ExpenseContext";

import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "@/context/AuthContext";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const screenWidth = Dimensions.get("window").width;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getSafeCycleDate = (year: number, month: number, salaryDate: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();

  return new Date(year, month, Math.min(salaryDate, lastDay));
};

const getCurrentCycleStart = (salaryDate: number) => {
  const now = new Date();
  let start = getSafeCycleDate(now.getFullYear(), now.getMonth(), salaryDate);

  if (now < start) {
    start = getSafeCycleDate(now.getFullYear(), now.getMonth() - 1, salaryDate);
  }

  start.setHours(0, 0, 0, 0);

  return start;
};

const getNextCycleStart = (cycleStart: Date, salaryDate: number) => {
  const next = getSafeCycleDate(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    salaryDate,
  );

  next.setHours(0, 0, 0, 0);

  return next;
};

const formatCycleDate = (date: Date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const getExpenseDate = (value: any) => {
  const date = value?.toDate ? value.toDate() : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

type DonutSegmentProps = {
  color: string;
  circumference: number;
  dash: number;
  gap: number;
  progress: SharedValue<number>;
  radius: number;
  rotation: number;
  strokeWidth: number;
};

function DonutSegment({
  color,
  circumference,
  dash,
  gap,
  progress,
  radius,
  rotation,
  strokeWidth,
}: DonutSegmentProps) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [dash * progress.value, circumference],
  }));

  return (
    <AnimatedCircle
      cx="90"
      cy="90"
      r={radius}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      animatedProps={animatedProps}
      strokeDasharray={`${dash} ${gap}`}
      strokeDashoffset={0}
      transform={`rotate(${rotation - 90} 90 90)`}
      strokeLinecap="round"
    />
  );
}

export default function AnalyticsScreen() {
  const { expenses } = useExpense();
  const monthScrollRef = useRef<any>(null);
  const { theme } = useTheme();
  const { salary: onboardingSalary } = useOnboardingStore();

  const { userData } = useAuth();

  const salaryDate = Number(userData?.salaryDate || 1);

  const [selectedDate, setSelectedDate] = useState(() =>
    getCurrentCycleStart(salaryDate),
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setRefreshing(true);

    setSelectedDate(getCurrentCycleStart(salaryDate));

    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;

    progress.value = withTiming(1, {
      duration: 1400,
    });
  }, [progress, selectedDate]);

  const salaryCycles = useMemo(() => {
    const currentCycleStart = getCurrentCycleStart(salaryDate);

    return Array.from({ length: 12 }, (_value, index) => {
      const monthOffset = index - 8;
      const start = getSafeCycleDate(
        currentCycleStart.getFullYear(),
        currentCycleStart.getMonth() + monthOffset,
        salaryDate,
      );
      const end = getNextCycleStart(start, salaryDate);
      const displayEnd = new Date(end.getTime() - MS_PER_DAY);

      return {
        end,
        label: `${formatCycleDate(start)} - ${formatCycleDate(displayEnd)}`,
        start,
      };
    });
  }, [salaryDate]);

  useFocusEffect(
    React.useCallback(() => {
      setSelectedDate(getCurrentCycleStart(salaryDate));
    }, [salaryDate]),
  );

  useEffect(() => {
    const selectedIndex = salaryCycles.findIndex(
      (cycle) => cycle.start.getTime() === selectedDate.getTime(),
    );

    monthScrollRef.current?.scrollTo({
      x: Math.max(0, (selectedIndex - 2) * 142),
      animated: true,
    });
  }, [salaryCycles, selectedDate]);

  const selectedCycleEnd = useMemo(
    () => getNextCycleStart(selectedDate, salaryDate),
    [salaryDate, selectedDate],
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const date = getExpenseDate(item.createdAt);

      if (
        !date ||
        (item.type || "expense") !== "expense"
      ) {
        return false;
      }

      return date >= selectedDate && date < selectedCycleEnd;
    });
  }, [expenses, selectedCycleEnd, selectedDate]);

  const groupedCategories = filteredExpenses.reduce(
    (acc: Record<string, number>, item: any) => {
      const category = item.category || "Other";

      acc[category] = (acc[category] || 0) + Number(item.amount);

      return acc;
    },
    {},
  );

  const totalSpent = Object.values(groupedCategories).reduce(
    (sum, value) => sum + value,
    0,
  );

  const salaryAmount = Number(userData?.salary ?? onboardingSalary ?? 0);

  const salaryUsed =
    salaryAmount > 0 ? Math.min((totalSpent / salaryAmount) * 100, 100) : 0;
  const salaryUsedLabel =
    totalSpent > 0 && salaryUsed < 1
      ? String(salaryUsed.toFixed(2))
      : String(Math.round(salaryUsed));

  const ranges = Object.entries(groupedCategories).sort(
    (a: any, b: any) => b[1] - a[1],
  );

  const emptyCategoryData = [
    "Food",
    "Travel",
    "Shopping",
    "Bills",
    "Other",
    "Health",
  ].map((category) => [category, 0] as [string, number]);

  const displayRanges =
    ranges.length > 0 ? (ranges as [string, number][]) : emptyCategoryData;

  const radius = 70;

  const strokeWidth = 18;

  const circumference = 2 * Math.PI * radius;

  const groupedByDay = filteredExpenses.reduce(
    (acc: Record<string, number>, item) => {
      const date = getExpenseDate(item.createdAt);

      if (!date) {
        return acc;
      }

      const day =
        Math.floor(
          (new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
          ).getTime() -
            selectedDate.getTime()) /
            MS_PER_DAY,
        ) + 1;

      acc[day] = (acc[day] || 0) + Number(item.amount);

      return acc;
    },
    {},
  );

  const sortedDays = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const daysInSelectedCycle = Math.max(
    1,
    Math.round((selectedCycleEnd.getTime() - selectedDate.getTime()) / MS_PER_DAY),
  );

  const monthDays = Array.from(
    {
      length: daysInSelectedCycle,
    },
    (_value, index) => index + 1,
  );

  const chartLabels = monthDays.map((day) => {
    const shouldShowLabel =
      day === 1 || day === daysInSelectedCycle || day % 5 === 0;

    if (!shouldShowLabel) {
      return "";
    }

    const labelDate = new Date(selectedDate);

    labelDate.setDate(selectedDate.getDate() + day - 1);

    return String(labelDate.getDate());
  });

  const chartValues = monthDays.map((day) => groupedByDay[day] || 0);

  const chartData = {
    labels: chartLabels,

    datasets: [
      {
        data: chartValues,
      },
    ],
  };

  const highestExpense = filteredExpenses.reduce(
    (max, item) => (Number(item.amount) > Number(max.amount) ? item : max),
    filteredExpenses[0] || {},
  );

  const totalTransactions = filteredExpenses.length;

  const averagePerDay =
    sortedDays.length > 0 ? totalSpent / sortedDays.length : 0;

  const highestDay = Object.entries(groupedByDay).sort(
    (a: any, b: any) => b[1] - a[1],
  )[0];

  const topCategory = ranges[0];

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.background,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          progressViewOffset={60}
        />
      }
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 120,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.text,
        }}
      >
        Analytics
      </Text>

      <ScrollView
        ref={monthScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          marginTop: 24,
          paddingRight: 20,
        }}
      >
        {salaryCycles.map((cycle) => {
          const active = selectedDate.getTime() === cycle.start.getTime();

          return (
            <Text
              key={cycle.start.toISOString()}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                setSelectedDate(cycle.start);
              }}
              style={{
                backgroundColor: active ? theme.primary : theme.card,

                color: active ? theme.card : theme.subText,

                paddingVertical: 12,

                paddingHorizontal: 18,

                borderRadius: 999,

                marginRight: 10,

                fontWeight: "700",

                overflow: "hidden",
              }}
            >
              {cycle.label}
            </Text>
          );
        })}
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: theme.card,

          borderRadius: 28,

          padding: 24,

          marginTop: 28,

          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 22,

            fontWeight: "700",

            color: theme.text,

            marginBottom: 26,
          }}
        >
          Spending Distribution
        </Text>

        {displayRanges.length > 0 ? (
          <>
            <Animated.View
              key={`donut-${selectedDate.getTime()}-${refreshing}`}
              style={{
                justifyContent: "center",

                alignItems: "center",
              }}
            >
              <Svg width={180} height={180}>
                <Circle
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke={theme.border}
                  strokeWidth={strokeWidth}
                  fill="none"
                />

                {(() => {
                  let cumulativePercent = 0;

                  return ranges.map(([key, value], index) => {
                    const percent = totalSpent > 0 ? value / totalSpent : 0;

                    const dash = circumference * percent;

                    const gap = circumference - dash + 6;

                    const rotation = cumulativePercent * 360;

                    cumulativePercent += percent;

                    return (
                      <DonutSegment
                        key={key}
                        color={getCategoryMeta(key).color}
                        circumference={circumference}
                        dash={dash}
                        gap={gap}
                        progress={progress}
                        radius={radius}
                        rotation={rotation}
                        strokeWidth={strokeWidth}
                      />
                    );
                  });
                })()}
              </Svg>

              <View
                style={{
                  position: "absolute",

                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 28,

                    fontWeight: "800",

                    color: theme.text,
                  }}
                >
                  {salaryUsedLabel}%
                </Text>

                <Text
                  style={{
                    color: theme.subText,

                    marginTop: 4,
                  }}
                >
                  Salary Used
                </Text>
              </View>
            </Animated.View>

            <View
              style={{
                width: "100%",

                marginTop: 30,
              }}
            >
              {displayRanges.map(([key, value], index) => {
                const percent =
                  totalSpent > 0
                    ? ((value / totalSpent) * 100).toFixed(1)
                    : "0";

                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: "row",

                      justifyContent: "space-between",

                      alignItems: "center",

                      marginBottom: 18,

                      backgroundColor: theme.border,

                      padding: 16,

                      borderRadius: 18,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",

                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 38,

                          height: 38,

                          borderRadius: 14,

                          backgroundColor: getCategoryMeta(key).tint,

                          marginRight: 12,

                          alignItems: "center",

                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name={getCategoryMeta(key).icon}
                          size={20}
                          color={getCategoryMeta(key).color}
                        />
                      </View>

                      <Text
                        style={{
                          fontSize: 16,

                          fontWeight: "700",

                          color: theme.text,
                        }}
                      >
                        {key}
                      </Text>
                    </View>

                    <View
                      style={{
                        alignItems: "flex-end",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "700",

                          color: theme.text,

                          fontSize: 16,
                        }}
                      >
                        ₹{value.toLocaleString()}
                      </Text>

                      <Text
                        style={{
                          color: theme.subText,

                          marginTop: 6,
                        }}
                      >
                        {percent}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View
            style={{
              paddingVertical: 50,

              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 52,
              }}
            >
              📊
            </Text>

            <Text
              style={{
                marginTop: 14,

                fontSize: 18,

                fontWeight: "800",

                color: theme.text,
              }}
            >
              No spending data
            </Text>

            <Text
              style={{
                marginTop: 8,

                color: theme.subText,

                textAlign: "center",

                lineHeight: 22,
              }}
            >
              No analytics available for this salary cycle.
            </Text>
          </View>
        )}
      </Animated.View>

      <CategoryRadialProgress
        items={ranges as [string, number][]}
        referenceAmount={salaryAmount}
        referenceLabel="your salary"
        totalSpent={totalSpent}
      />

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 28,
          padding: 24,
          marginTop: 24,
        }}
      >
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: theme.text,
              }}
            >
              Spending Overview
            </Text>

            <Text
              style={{
                marginTop: 4,
                color: theme.subText,
                fontSize: 14,
              }}
            >
              Monitor your spending insights
            </Text>
          </View>

          <View
            style={{
              backgroundColor: theme.background,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 14,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontWeight: "700",
                fontSize: 9,
              }}
            >
              Salary Cycle
            </Text>
          </View>
        </View>

        {chartValues.length > 0 ? (
          <>
            {/* TOP CARDS */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 28,
              }}
            >
              {/* TOTAL */}
              <View
                style={{
                  width: "48%",
                  backgroundColor: "#F0FDF4",
                  borderRadius: 22,
                  padding: 18,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: "#DCFCE7",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="wallet" size={26} color="#16A34A" />
                </View>

                <Text
                  style={{
                    color: "#666",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  Total Spent
                </Text>

                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    color: "#16A34A",
                    fontSize: 20,
                    fontWeight: "900",
                  }}
                >
                  ₹{totalSpent.toLocaleString("en-IN")}
                </Text>
              </View>

              {/* HIGHEST */}
              <View
                style={{
                  width: "48%",
                  backgroundColor: "#F5F7FF",
                  borderRadius: 22,
                  padding: 18,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    backgroundColor: "#E9EEFF",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="trending-up" size={26} color="#2563EB" />
                </View>

                <Text
                  style={{
                    color: "#666",
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  Highest Spend
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    color: "#2563EB",
                    fontSize: 20,
                    fontWeight: "900",
                  }}
                >
                  ₹{highestExpense?.amount?.toLocaleString("en-IN") || "0"}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View
            style={{
              paddingVertical: 60,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 52,
              }}
            >
              📊
            </Text>

            <Text
              style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: "800",
                color: theme.text,
              }}
            >
              No spending data
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: theme.subText,
                textAlign: "center",
                lineHeight: 22,
                paddingHorizontal: 30,
              }}
            >
              Your daily expense analytics will appear here once transactions
              are added.
            </Text>
          </View>
        )}
      </Animated.View>

      <View
        style={{
          backgroundColor: theme.card,

          borderRadius: 28,

          padding: 24,

          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 22,

            fontWeight: "700",

            color: theme.text,

            marginBottom: 24,
          }}
        >
          Insights
        </Text>

        <View
          style={{
            backgroundColor: theme.primary + "10",

            padding: 18,

            borderRadius: 20,

            marginBottom: 24,
          }}
        >
          <Text
            style={{
              color: theme.primary,

              fontWeight: "700",

              fontSize: 15,

              lineHeight: 24,
            }}
          >
            {topCategory
              ? `You spent most on ${topCategory[0]} this salary cycle 🔥`
              : "No spending insights yet"}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Total Transactions
          </Text>

          <Text
            style={{
              fontWeight: "700",

              fontSize: 16,

              color: theme.text,
            }}
          >
            {totalTransactions}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Highest Expense
          </Text>

          <Text
            style={{
              fontWeight: "700",

              fontSize: 16,

              color: theme.text,
            }}
          >
            ₹
            {highestExpense?.amount
              ? Number(highestExpense.amount).toLocaleString()
              : 0}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",

            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Avg Per Day
          </Text>

          <Text
            style={{
              fontWeight: "700",

              fontSize: 16,

              color: theme.text,
            }}
          >
            ₹{Math.round(averagePerDay).toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",

            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: theme.subText,

              fontSize: 16,
            }}
          >
            Highest Spending Day
          </Text>

          <Text
            style={{
              fontWeight: "700",

              fontSize: 16,

              color: theme.text,
            }}
          >
            {highestDay
              ? `${highestDay[0]} • ₹${Number(highestDay[1]).toLocaleString()}`
              : "N/A"}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
