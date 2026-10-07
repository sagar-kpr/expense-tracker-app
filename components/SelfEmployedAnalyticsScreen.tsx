import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import Svg, { Circle } from "react-native-svg";

import { getCategoryMeta } from "@/components/categoryMeta";
import { useExpense } from "@/context/ExpenseContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";

const screenWidth = Dimensions.get("window").width;
const RUPEE = "\u20B9";
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Transaction = {
  id: string;
  amount: number | string;
  category?: string;
  description?: string;
  type?: "income" | "expense";
  createdAt?: string | Date | { toDate?: () => Date };
};

const parseDate = (value: Transaction["createdAt"]) => {
  if (!value) return null;

  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMoney = (value: number) =>
  `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

export default function SelfEmployedAnalyticsScreen() {
  const { expenses } = useExpense();
  const { theme } = useTheme();
  const monthScrollRef = useRef<any>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [refreshing, setRefreshing] = useState(false);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  useFocusEffect(
    React.useCallback(() => {
      setSelectedDate(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      );
    }, []),
  );

  useEffect(() => {
    monthScrollRef.current?.scrollTo({
      x: Math.max(0, (selectedDate.getMonth() - 2) * 95),
      animated: true,
    });
  }, [selectedDate]);

  const filteredTransactions = useMemo(() => {
    return (expenses as Transaction[]).filter((item) => {
      const date = parseDate(item.createdAt);

      return (
        date &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [expenses, selectedDate]);

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
  const cashFlowTotal = totals.income + totals.expense;

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

  const categoryRows = Object.entries(groupedExpenseCategories)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const daysInSelectedMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0,
  ).getDate();

  const monthDays = Array.from(
    { length: daysInSelectedMonth },
    (_value, index) => index + 1,
  );

  const groupedByDay = filteredTransactions.reduce<Record<number, number>>(
    (acc, item) => {
      const date = parseDate(item.createdAt);
      if (!date) return acc;

      const amount = Number(item.amount || 0);
      const signedAmount =
        (item.type || "expense") === "income" ? amount : -amount;
      const day = date.getDate();

      acc[day] = (acc[day] || 0) + signedAmount;

      return acc;
    },
    {},
  );

  const chartLabels = monthDays.map((day) =>
    day === 1 || day === daysInSelectedMonth || day % 5 === 0
      ? String(day)
      : "",
  );
  const chartValues = monthDays.map((day) => groupedByDay[day] || 0);
  const chartData = {
    labels: chartLabels,
    datasets: [{ data: chartValues.length > 0 ? chartValues : [0] }],
  };

  const highestExpense = filteredTransactions
    .filter((item) => (item.type || "expense") === "expense")
    .reduce(
      (max, item) =>
        Number(item.amount) > Number(max?.amount || 0) ? item : max,
      undefined as Transaction | undefined,
    );
  const totalTransactions = filteredTransactions.length;
  const topCategory = categoryRows[0];

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setSelectedDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );

    setTimeout(() => {
      setRefreshing(false);
    }, 900);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
          progressBackgroundColor={theme.card}
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
      <Text style={{ fontSize: 30, fontWeight: "900", color: theme.text }}>
        Business Analytics
      </Text>

      <ScrollView
        ref={monthScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ marginTop: 24, paddingRight: 20 }}
      >
        {months.map((month, index) => {
          const active = selectedDate.getMonth() === index;

          return (
            <Text
              key={month}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedDate(new Date(selectedDate.getFullYear(), index, 1));
              }}
              style={{
                backgroundColor: active ? theme.primary : theme.card,
                color: active ? theme.card : theme.subText,
                paddingVertical: 11,
                paddingHorizontal: 17,
                borderRadius: 999,
                marginRight: 10,
                fontWeight: "700",
                overflow: "hidden",
              }}
            >
              {month}
            </Text>
          );
        })}
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(100).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 26,
          padding: 22,
          marginTop: 28,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 21,
            fontWeight: "900",
            marginBottom: 20,
          }}
        >
          Income vs Expense
        </Text>

        <FinanceDonut
          income={totals.income}
          expense={totals.expense}
          total={cashFlowTotal}
        />

        <View style={{ width: "100%", marginTop: 24 }}>
          <DonutLegend
            color="#159665"
            label="Income"
            value={totals.income}
            percent={
              cashFlowTotal > 0 ? (totals.income / cashFlowTotal) * 100 : 0
            }
          />
          <DonutLegend
            color="#EF4444"
            label="Expense"
            value={totals.expense}
            percent={
              cashFlowTotal > 0 ? (totals.expense / cashFlowTotal) * 100 : 0
            }
            last
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(200).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 26,
          padding: 22,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 21,
            fontWeight: "900",
            marginBottom: 20,
          }}
        >
          Expense Categories
        </Text>

        {categoryRows.length === 0 ? (
          <EmptyState icon="pie-chart" label="No expense categories yet" />
        ) : (
          categoryRows.map(([key, value]) => {
            const meta = getCategoryMeta(key);
            const percent =
              totals.expense > 0
                ? ((value / totals.expense) * 100).toFixed(1)
                : "0.0";

            return (
              <View
                key={key}
                style={{
                  backgroundColor: theme.background,
                  borderRadius: 18,
                  padding: 15,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: meta.tint,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={meta.icon} size={23} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 15,
                      fontWeight: "800",
                    }}
                  >
                    {key}
                  </Text>
                  <Text
                    style={{ color: theme.subText, fontSize: 13, marginTop: 4 }}
                  >
                    {percent}% of spending
                  </Text>
                </View>
                <Text
                  style={{ color: meta.color, fontSize: 17, fontWeight: "900" }}
                >
                  {formatMoney(value)}
                </Text>
              </View>
            );
          })
        )}
      </Animated.View>

      {/* <Animated.View
        entering={FadeInUp.delay(300).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 26,
          padding: 22,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 21,
            fontWeight: "900",
            marginBottom: 20,
          }}
        >
          Daily Cash Flow
        </Text>

        <BarChart
          data={chartData}
          width={screenWidth - 84}
          height={230}
          fromZero
          showBarTops
          yAxisLabel=""
          yAxisSuffix=""
          withInnerLines
          withVerticalLines={false}
          chartConfig={{
            backgroundColor: theme.card,
            backgroundGradientFrom: theme.card,
            backgroundGradientTo: theme.card,
            decimalPlaces: 0,
            color: () => theme.primary,
            labelColor: () => theme.subText,
            fillShadowGradient: theme.primary,
            fillShadowGradientOpacity: 0.12,
            propsForBackgroundLines: {
              strokeWidth: 0.5,
            },
            propsForLabels: {
              fontSize: 11,
            },
          }}
          style={{ borderRadius: 18, marginLeft: -10 }}
        />
      </Animated.View> */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(650)}
        style={{
          backgroundColor: theme.card,
          borderRadius: 26,
          padding: 22,
          marginTop: 24,
        }}
      >
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <View>
            <Text
              style={{
                color: theme.text,
                fontSize: 21,
                fontWeight: "900",
              }}
            >
              Cash Flow Overview
            </Text>

            <Text
              style={{
                marginTop: 4,
                color: theme.subText,
                fontSize: 14,
              }}
            >
              Monthly business insights
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
              Monthly
            </Text>
          </View>
        </View>

        {/* CARDS */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {/* TOTAL CASH FLOW */}
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
              Total Expense
            </Text>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                color: "#16A34A",
                fontSize: 24,
                fontWeight: "900",
              }}
            >
              ₹{totals.expense.toLocaleString("en-IN")}
            </Text>
          </View>

          {/* HIGHEST SPEND */}
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
                fontSize: 22,
                fontWeight: "900",
              }}
            >
              ₹{highestExpense?.amount.toLocaleString("en-IN") || "0"}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 26,
          padding: 22,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 21,
            fontWeight: "900",
            marginBottom: 20,
          }}
        >
          Insights
        </Text>

        <View
          style={{
            backgroundColor: profit < 0 ? "#FEE2E2" : "#DCFCE7",
            padding: 16,
            borderRadius: 18,
            marginBottom: 22,
          }}
        >
          <Text
            style={{
              color: profit < 0 ? "#DC2626" : "#159665",
              fontSize: 14,
              fontWeight: "800",
              lineHeight: 22,
            }}
          >
            {topCategory
              ? `Highest business spend is ${topCategory[0]} this month.`
              : "No business spending insights yet."}
          </Text>
        </View>

        <InsightRow
          label="Total Transactions"
          value={String(totalTransactions)}
        />
        <InsightRow
          label="Highest Expense"
          value={formatMoney(Number(highestExpense?.amount || 0))}
        />
        <InsightRow label="Total Income" value={formatMoney(totals.income)} />
        <InsightRow
          label="Total Expense"
          value={formatMoney(totals.expense)}
          last
        />
      </View>
    </ScrollView>
  );
}

function FinanceDonut({
  income,
  expense,
  total,
}: {
  income: number;
  expense: number;
  total: number;
}) {
  const { theme } = useTheme();
  const radius = 70;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  const incomeDash = total > 0 ? circumference * (income / total) : 0;
  const expenseDash = total > 0 ? circumference * (expense / total) : 0;
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 0;

  const isNoIncome = income <= 0;
  const isOverBudget = income > 0 && expense > income;

  let centerTitle = `${expenseRatio}%`;
  let centerSubtitle = "Expense Ratio";

  if (isNoIncome && expense > 0) {
    centerTitle = "No Income";
    centerSubtitle = "Add income to track";
  } else if (isOverBudget) {
    centerTitle = "Over Spent";
    centerSubtitle = `${expenseRatio}% expense ratio`;
  } else if (income === 0 && expense === 0) {
    centerTitle = "No Data";
    centerSubtitle = "No transactions";
  }
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200 });
  }, [expense, income, progress, total]);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={180} height={180}>
        <Circle
          cx="90"
          cy="90"
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {(total > 0 || expense > 0) && (
          <>
            <DonutArc
              circumference={circumference}
              dash={incomeDash}
              progress={progress}
              stroke="#159665"
            />
            <DonutArc
              circumference={circumference}
              dash={isNoIncome || isOverBudget ? circumference : expenseDash}
              offset={isNoIncome || isOverBudget ? 0 : -incomeDash}
              progress={progress}
              stroke="#EF4444"
            />
          </>
        )}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            color: isNoIncome || isOverBudget ? "#EF4444" : theme.text,
            fontSize: centerTitle.length > 10 ? 16 : isOverBudget ? 18 : 20,
            fontWeight: "900",
            textAlign: "center",
            paddingHorizontal: 20,
            lineHeight: 22,
          }}
        >
          {centerTitle}
        </Text>

        <Text
          style={{
            color: theme.subText,
            fontSize: 10,
            marginTop: 4,
            textAlign: "center",
            paddingHorizontal: 16,
          }}
        >
          {centerSubtitle}
        </Text>

        {isOverBudget && (
          <Text
            style={{
              color: "#EF4444",
              fontSize: 9,
              fontWeight: "700",
              marginTop: 6,
            }}
          >
            {formatMoney(expense - income)} over income
          </Text>
        )}

        {isNoIncome && expense > 0 && (
          <Text
            style={{
              color: "#EF4444",
              fontSize: 9,
              fontWeight: "700",
              marginTop: 6,
            }}
          >
            {formatMoney(expense)} spent
          </Text>
        )}
      </View>
    </View>
  );
}

function DonutArc({
  circumference,
  dash,
  offset = 0,
  progress,
  stroke,
}: {
  circumference: number;
  dash: number;
  offset?: number;
  progress: SharedValue<number>;
  stroke: string;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${dash * progress.value} ${circumference}`,
  }));

  return (
    <AnimatedCircle
      cx="90"
      cy="90"
      r={70}
      stroke={stroke}
      strokeWidth={18}
      fill="none"
      animatedProps={animatedProps}
      strokeDashoffset={offset}
      strokeLinecap="round"
      transform="rotate(-90 90 90)"
    />
  );
}

function DonutLegend({
  color,
  label,
  value,
  percent,
  last,
}: {
  color: string;
  label: string;
  value: number;
  percent: number;
  last?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.background,
        borderRadius: 18,
        flexDirection: "row",
        marginBottom: last ? 0 : 12,
        padding: 15,
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          backgroundColor: color,
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>
          {label}
        </Text>
        <Text style={{ color: theme.subText, fontSize: 13, marginTop: 3 }}>
          {percent.toFixed(1)}% of cash flow
        </Text>
      </View>
      <Text style={{ color, fontSize: 17, fontWeight: "900" }}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

function InsightRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: last ? 0 : 18,
        gap: 16,
      }}
    >
      <Text style={{ color: theme.subText, fontSize: 15 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          color: theme.text,
          fontSize: 15,
          fontWeight: "800",
          maxWidth: 150,
        }}
      >
        {value}
      </Text>
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
    <View style={{ alignItems: "center", paddingVertical: 34 }}>
      <Ionicons name={icon} size={38} color={theme.primary} />
      <Text style={{ color: theme.subText, fontSize: 14, marginTop: 10 }}>
        {label}
      </Text>
    </View>
  );
}
