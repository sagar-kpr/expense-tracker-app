import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import BottomSheet from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";

import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import ExpenseModal from "@/components/ExpenseModal";

import { useExpense } from "@/context/ExpenseContext";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function HomeScreen() {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const { theme, dark } = useTheme();

  const { expenses, addExpense } = useExpense();

  const { userData } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount), 0),
    [expenses],
  );

  const remainingSalary = Number(userData?.salary || 0) - totalSpent;

  const greeting = (() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good Morning ☀️";

    if (hour < 18) return "Good Afternoon 🌤";

    return "Good Evening 🌙";
  })();

  const firstName = userData?.name?.trim()?.split(" ")[0];

  const handleAddExpense = async (
    amount: string,
    description: string,
    category: string,
  ) => {
    await addExpense(amount, description, category);
  };

  const grouped = expenses.reduce(
    (acc: Record<string, number>, item) => {
      const category = item.category || "Other";

      acc[category] = (acc[category] || 0) + Number(item.amount);

      return acc;
    },

    {},
  );

  const categoryData = [
    {
      key: "Food",
      color: "#22C55E",
      emoji: "🍔",
    },

    {
      key: "Travel",
      color: "#3B82F6",
      emoji: "✈️",
    },

    {
      key: "Shopping",
      color: "#F59E0B",
      emoji: "🛍",
    },

    {
      key: "Bills",
      color: "#EF4444",
      emoji: "💡",
    },

    {
      key: "Health",
      color: "#EC4899",
      emoji: "🏥",
    },

    {
      key: "Other",
      color: "#8B5CF6",
      emoji: "✨",
    },
  ];

  const categoryMeta: Record<
    string,
    {
      emoji: string;
      color: string;
    }
  > = {
    Food: {
      emoji: "🍔",
      color: "#22C55E",
    },

    Travel: {
      emoji: "✈️",
      color: "#3B82F6",
    },

    Shopping: {
      emoji: "🛍",
      color: "#F59E0B",
    },

    Bills: {
      emoji: "💡",
      color: "#EF4444",
    },

    Health: {
      emoji: "🏥",
      color: "#EC4899",
    },

    Other: {
      emoji: "✨",
      color: "#8B5CF6",
    },
  };

  const getRelativeDate = (date: string) => {
    const expenseDate = new Date(date);

    const today = new Date();

    const yesterday = new Date();

    today.setHours(0, 0, 0, 0);

    yesterday.setHours(0, 0, 0, 0);

    yesterday.setDate(yesterday.getDate() - 1);

    const compareDate = new Date(expenseDate);

    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) {
      return "Today";
    }

    if (compareDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }

    const diff = today.getTime() - compareDate.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 7) {
      return `${days} days ago`;
    }

    return expenseDate.toLocaleDateString("en-IN", {
      day: "numeric",

      month: "short",

      year: "numeric",
    });
  };

  const today = new Date();

  const currentDay = today.getDate();

  const salaryDate = Number(userData?.salaryDate || 1);

  let daysLeft = 0;

  if (currentDay <= salaryDate) {
    daysLeft = salaryDate - currentDay;
  } else {
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();

    daysLeft = daysInMonth - currentDay + salaryDate;
  }

  const dailyAverage =
    daysLeft > 0 ? remainingSalary / daysLeft : remainingSalary;

  const progress = useSharedValue(0);

  const progressPercentage = Math.min(
    100,
    (totalSpent / Number(userData?.salary || 1)) * 100,
  );

  useEffect(() => {
    progress.value = withTiming(progressPercentage, {
      duration: 1200,
    });
  }, [progressPercentage]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
    };
  });

  const fabScale = useSharedValue(1);

  useEffect(() => {
    fabScale.value = withRepeat(
      withSequence(
        withTiming(1.04, {
          duration: 1400,
        }),

        withTiming(1, {
          duration: 1400,
        }),
      ),

      -1,
      true,
    );
  }, []);

  const fabAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: fabScale.value,
        },
      ],
    };
  });

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);

    progress.value = 0;

    setTimeout(() => {
      progress.value = withTiming(progressPercentage, {
        duration: 1200,
      });

      setRefreshing(false);
    }, 700);
  };

  return (
    <>
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.background,
        }}
        // contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          paddingTop: 70,
          paddingBottom: 140,
        }}
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
        <Text
          style={{
            fontSize: 16,
            color: theme.text,
          }}
        >
          {firstName ? `${greeting}, ${firstName}` : `${greeting}`}
        </Text>

        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: theme.text,
            marginTop: 8,
          }}
        >
          Dashboard
        </Text>

        <Animated.View
          entering={FadeInUp.delay(100).duration(700)}
          style={{
            backgroundColor: theme.primary,

            borderRadius: 30,

            padding: 24,

            marginTop: 30,
          }}
        >
          <Text
            style={{
              color: theme.border,

              fontSize: 15,
            }}
          >
            Remaining Balance
          </Text>

          <Text
            style={{
              color: theme.card,

              fontSize: 38,

              fontWeight: "800",

              marginTop: 12,
            }}
          >
            ₹{remainingSalary.toLocaleString()}
          </Text>

          <View
            style={{
              height: 1,

              backgroundColor: theme.border,

              marginVertical: 22,
            }}
          />

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  color: theme.border,

                  fontSize: 14,
                }}
              >
                Salary
              </Text>

              <Text
                style={{
                  color: theme.card,

                  fontSize: 22,

                  fontWeight: "700",

                  marginTop: 6,
                }}
              >
                ₹{Number(userData?.salary || 0).toLocaleString()}
              </Text>
            </View>

            <View>
              <Text
                style={{
                  color: theme.border,

                  fontSize: 14,
                }}
              >
                Spent
              </Text>

              <Text
                style={{
                  color: theme.card,

                  fontSize: 22,

                  fontWeight: "700",

                  marginTop: 6,
                }}
              >
                ₹{totalSpent.toLocaleString()}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(200).duration(700)}
          style={{
            backgroundColor: theme.card,

            borderRadius: 26,

            padding: 24,

            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: theme.text,

              marginBottom: 22,
            }}
          >
            Monthly Usage
          </Text>

          <View
            style={{
              height: 18,

              backgroundColor: theme.border,

              borderRadius: 999,

              overflow: "hidden",
            }}
          >
            <Animated.View
              style={[
                {
                  height: "100%",

                  backgroundColor:
                    remainingSalary > 0 ? theme.primary : theme.danger,

                  borderRadius: 999,
                },

                animatedProgressStyle,
              ]}
            />
          </View>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",

              marginTop: 14,
            }}
          >
            <Text
              style={{
                color: theme.subText,

                fontSize: 15,
              }}
            >
              Used: {Math.round(progressPercentage)}%
            </Text>

            <Text
              style={{
                color: theme.text,

                fontWeight: "700",

                fontSize: 15,
              }}
            >
              ₹{totalSpent.toLocaleString()}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(250).duration(700)}
          style={{
            backgroundColor: theme.card,

            borderRadius: 26,

            padding: 24,

            marginTop: 24,

            flexDirection: "row",

            alignItems: "center",

            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={{
                fontSize: 15,

                color: theme.subText,

                fontWeight: "600",
              }}
            >
              Safe to Spend Today
            </Text>

            <Text
              style={{
                fontSize: 32,

                fontWeight: "800",

                color: dailyAverage > 0 ? theme.text : theme.danger,

                marginTop: 10,
              }}
            >
              ₹{Math.max(0, Math.round(dailyAverage)).toLocaleString()}
              <Text
                style={{
                  fontSize: 16,

                  color: theme.subText,

                  fontWeight: "600",
                }}
              >
                /day
              </Text>
            </Text>

            <Text
              style={{
                marginTop: 10,

                fontSize: 13,

                color: theme.subText,

                lineHeight: 20,
              }}
            >
              {daysLeft} days left till next salary.
            </Text>
          </View>

          <View
            style={{
              width: 72,

              height: 72,

              borderRadius: 24,

              backgroundColor: dailyAverage > 0 ? "#6C63FF15" : "#EF444415",

              justifyContent: "center",

              alignItems: "center",

              marginLeft: 16,
            }}
          >
            <Text
              style={{
                fontSize: 34,
              }}
            >
              {dailyAverage > 0 ? "💰" : "⚠️"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(300).duration(700)}
          style={{
            backgroundColor: theme.card,

            borderRadius: 26,

            padding: 24,

            marginTop: 24,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: theme.text,

              marginBottom: 20,
            }}
          >
            By Category
          </Text>

          {Object.keys(grouped).length === 0 && (
            <View
              style={{
                paddingVertical: 30,

                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 42,
                }}
              >
                📊
              </Text>

              <Text
                style={{
                  marginTop: 12,

                  color: theme.subText,

                  fontSize: 15,
                }}
              >
                No category data yet
              </Text>
            </View>
          )}

          {categoryData
            .filter((item) => grouped[item.key] > 0)
            .map((item) => {
              const value = grouped[item.key];

              return (
                <View
                  key={item.key}
                  style={{
                    flexDirection: "row",

                    justifyContent: "space-between",

                    alignItems: "center",

                    marginBottom: 14,

                    backgroundColor: theme.background,

                    paddingVertical: 16,

                    paddingHorizontal: 16,

                    borderRadius: 20,
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
                        width: 44,

                        height: 44,

                        borderRadius: 16,

                        backgroundColor: item.color + "18",

                        justifyContent: "center",

                        alignItems: "center",

                        marginRight: 14,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                        }}
                      >
                        {item.emoji}
                      </Text>
                    </View>

                    <View>
                      <Text
                        style={{
                          color: theme.text,

                          fontSize: 16,

                          fontWeight: "700",
                        }}
                      >
                        {item.key}
                      </Text>

                      <Text
                        style={{
                          color: theme.subText,

                          fontSize: 13,

                          marginTop: 3,
                        }}
                      >
                        Category Expense
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontWeight: "800",

                      fontSize: 18,

                      color: theme.text,
                    }}
                  >
                    ₹{Number(value).toLocaleString()}
                  </Text>
                </View>
              );
            })}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(400).duration(700)}
          style={{
            marginTop: 26,
          }}
        >
          <Text
            style={{
              fontSize: 22,

              fontWeight: "700",

              color: theme.text,

              marginBottom: 18,
            }}
          >
            Recent Transactions
          </Text>

          {expenses.length === 0 ? (
            <View
              style={{
                backgroundColor: theme.card,

                borderRadius: 26,

                paddingVertical: 46,

                alignItems: "center",

                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 52,
                }}
              >
                💸
              </Text>

              <Text
                style={{
                  marginTop: 16,

                  fontSize: 18,

                  fontWeight: "800",

                  color: theme.text,
                }}
              >
                No transactions yet
              </Text>

              <Text
                style={{
                  marginTop: 10,

                  color: theme.subText,

                  fontSize: 14,

                  textAlign: "center",

                  lineHeight: 22,

                  paddingHorizontal: 40,
                }}
              >
                Your recent expenses will appear here once you start tracking
                spending.
              </Text>
            </View>
          ) : (
            expenses.slice(0, 5).map((item) => {
              const meta =
                categoryMeta[item.category || "Other"] || categoryMeta.Other;

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: theme.card,

                    borderRadius: 24,

                    padding: 18,

                    marginBottom: 14,

                    flexDirection: "row",

                    alignItems: "center",

                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",

                      alignItems: "center",

                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 52,

                        height: 52,

                        borderRadius: 18,

                        backgroundColor: meta.color + "18",

                        justifyContent: "center",

                        alignItems: "center",

                        marginRight: 14,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 24,
                        }}
                      >
                        {meta.emoji}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: theme.text,

                          fontSize: 16,

                          fontWeight: "700",
                        }}
                      >
                        {item.description || item.category || "Other"}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",

                          alignItems: "center",

                          marginTop: 6,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: meta.color + "15",

                            paddingHorizontal: 10,

                            paddingVertical: 5,

                            borderRadius: 999,
                          }}
                        >
                          <Text
                            style={{
                              color: meta.color,

                              fontSize: 12,

                              fontWeight: "700",
                            }}
                          >
                            {item.category || "Other"}
                          </Text>
                        </View>

                        <Text
                          style={{
                            color: theme.subText,

                            fontSize: 13,

                            marginLeft: 10,

                            lineHeight: 16,

                            marginTop: 1,
                          }}
                        >
                          {getRelativeDate(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 18,

                      fontWeight: "800",

                      color: theme.text,

                      marginLeft: 12,
                    }}
                  >
                    ₹{Number(item.amount).toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      <Animated.View
        style={[
          {
            position: "absolute",

            bottom: 40,

            right: 24,
          },

          fabAnimatedStyle,
        ]}
      >
        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            bottomSheetRef.current?.expand();
          }}
          style={{
            width: 64,

            height: 64,

            borderRadius: 999,

            backgroundColor: theme.primary,

            justifyContent: "center",

            alignItems: "center",

            shadowColor: theme.text,

            shadowOpacity: 0.15,

            shadowRadius: 10,

            elevation: 10,
          }}
        >
          <Text
            style={{
              color: theme.card,

              fontSize: 34,

              marginTop: -2,
            }}
          >
            +
          </Text>
        </Pressable>
      </Animated.View>

      <ExpenseModal ref={bottomSheetRef} handleAddExpense={handleAddExpense} />
    </>
  );
}
