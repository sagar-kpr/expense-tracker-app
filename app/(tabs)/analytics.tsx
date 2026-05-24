import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { LineChart } from "react-native-chart-kit";

import Svg, { Circle } from "react-native-svg";

import { useExpense } from "@/context/ExpenseContext";
import { useFocusEffect } from "@react-navigation/native";

import { useOnboardingStore } from "@/store/useOnboardingStore";

const screenWidth = Dimensions.get("window").width;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AnalyticsScreen() {
  const { expenses } = useExpense();

  const { salary } = useOnboardingStore();

  const [selectedDate, setSelectedDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);

    setSelectedDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );

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
  }, [selectedDate]);

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

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const rawDate: any = item.createdAt;

      const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

      return (
        date.getDate() >= selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [expenses, selectedDate]);

  const grouped = {
    "0-100": 0,
    "101-500": 0,
    "501-1000": 0,
    "1000+": 0,
  };

  filteredExpenses.forEach((item) => {
    const amount = Number(item.amount);

    if (amount <= 100) {
      grouped["0-100"] += amount;
    } else if (amount <= 500) {
      grouped["101-500"] += amount;
    } else if (amount <= 1000) {
      grouped["501-1000"] += amount;
    } else {
      grouped["1000+"] += amount;
    }
  });

  const totalSpent = Object.values(grouped).reduce(
    (sum, value) => sum + value,
    0,
  );

  const salaryUsed =
    Number(salary || 0) > 0 ? (totalSpent / Number(salary)) * 100 : 0;

  const ranges = Object.entries(grouped);

  const colors = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444"];

  const radius = 70;

  const strokeWidth = 18;

  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  const groupedByDay = filteredExpenses.reduce(
    (acc: Record<string, number>, item) => {
      const rawDate: any = item.createdAt;

      const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

      const day = date.getDate();

      acc[day] = (acc[day] || 0) + Number(item.amount);

      return acc;
    },
    {},
  );

  const sortedDays = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const chartData = {
    labels: sortedDays.map(String),

    datasets: [
      {
        data: sortedDays.map((day) => groupedByDay[day]),
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

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#F7F7F7",
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C63FF"
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
          fontSize: 30,
          fontWeight: "800",
          color: "#111",
        }}
      >
        Analytics
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          marginTop: 24,
          paddingRight: 20,
        }}
      >
        {months.map((month, index) => {
          const active = selectedDate.getMonth() === index;

          return (
            <Text
              key={month}
              onPress={() =>
                setSelectedDate(new Date(selectedDate.getFullYear(), index, 1))
              }
              style={{
                backgroundColor: active ? "#6C63FF" : "white",

                color: active ? "white" : "#555",

                paddingVertical: 12,
                paddingHorizontal: 18,

                borderRadius: 999,

                marginRight: 10,

                fontWeight: "600",
              }}
            >
              {month}
            </Text>
          );
        })}
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(100).duration(700)}
        style={{
          backgroundColor: "white",
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
            color: "#111",
            marginBottom: 26,
          }}
        >
          Spending Distribution
        </Text>

        <Animated.View
          key={`donut-${selectedDate.getMonth()}-${refreshing}`}
          // entering={ZoomIn.duration(1200)}
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
              stroke="#ECECEC"
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
                const animatedProps = useAnimatedProps(() => ({
                  strokeDasharray: [dash * progress.value, circumference],
                }));

                return (
                  <AnimatedCircle
                    key={key}
                    cx="90"
                    cy="90"
                    r={radius}
                    stroke={colors[index]}
                    strokeWidth={strokeWidth}
                    fill="none"
                    animatedProps={animatedProps}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={0}
                    transform={`rotate(${rotation - 90} 90 90)`}
                    strokeLinecap="round"
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
                color: "#111",
              }}
            >
              {Math.round(salaryUsed)}%
            </Text>

            <Text
              style={{
                color: "#777",
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
          {ranges.map(([key, value], index) => {
            const percent =
              totalSpent > 0 ? ((value / totalSpent) * 100).toFixed(1) : "0";

            return (
              <View
                key={key}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                  backgroundColor: "#F5F5F5",
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
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      backgroundColor: colors[index],
                      marginRight: 12,
                    }}
                  />

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#222",
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
                      color: "#111",
                      fontSize: 16,
                    }}
                  >
                    ₹{value.toLocaleString()}
                  </Text>

                  <Text
                    style={{
                      color: "#777",
                      marginTop: 2,
                    }}
                  >
                    {percent}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <View
        style={{
          backgroundColor: "white",
          borderRadius: 28,
          padding: 24,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#111",
            marginBottom: 22,
          }}
        >
          Daily Spending
        </Text>

        {sortedDays.length > 0 ? (
          <LineChart
            data={chartData}
            width={screenWidth - 88}
            height={240}
            withDots
            withInnerLines
            withOuterLines={false}
            withVerticalLines={false}
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              decimalPlaces: 0,

              color: () => "#6C63FF",

              labelColor: () => "#777",

              propsForDots: {
                r: "5",
                strokeWidth: "2",
                stroke: "#6C63FF",
              },
            }}
            bezier
            style={{
              borderRadius: 18,
            }}
          />
        ) : (
          <View
            style={{
              paddingVertical: 40,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#888",
              }}
            >
              No chart data
            </Text>
          </View>
        )}
      </View>

      <View
        style={{
          backgroundColor: "white",
          borderRadius: 28,
          padding: 24,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#111",
            marginBottom: 24,
          }}
        >
          Insights
        </Text>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "#666",
              fontSize: 16,
            }}
          >
            Total Transactions
          </Text>

          <Text
            style={{
              fontWeight: "700",
              fontSize: 16,
              color: "#111",
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
              color: "#666",
              fontSize: 16,
            }}
          >
            Highest Expense
          </Text>

          <Text
            style={{
              fontWeight: "700",
              fontSize: 16,
              color: "#111",
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
              color: "#666",
              fontSize: 16,
            }}
          >
            Avg Per Day
          </Text>

          <Text
            style={{
              fontWeight: "700",
              fontSize: 16,
              color: "#111",
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
              color: "#666",
              fontSize: 16,
            }}
          >
            Highest Spending Day
          </Text>

          <Text
            style={{
              fontWeight: "700",
              fontSize: 16,
              color: "#111",
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
