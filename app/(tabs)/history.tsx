import { ScrollView, Text, View } from "react-native";

import { useExpense } from "@/context/ExpenseContext";

import ExpenseItem from "@/components/ExpenseItem";

export default function HistoryScreen() {
  const { expenses } = useExpense();

  const groupedExpenses = expenses.reduce((groups: any, item) => {
    const rawDate: any = item.createdAt;

    const date = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);

    if (isNaN(date.getTime())) {
      return groups;
    }

    const today = new Date();

    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    let label = "";

    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
    }

    if (!groups[label]) {
      groups[label] = [];
    }

    groups[label].push(item);

    return groups;
  }, {});

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#F7F7F7",
      }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 70,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 30,
          fontWeight: "800",
          color: "#111",
          marginBottom: 28,
        }}
      >
        History
      </Text>

      {Object.entries(groupedExpenses).map(([date, items]: any) => (
        <View
          key={date}
          style={{
            marginBottom: 28,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111",
              marginBottom: 16,
            }}
          >
            {date}
          </Text>

          {items.map((item: any) => (
            <ExpenseItem key={item.id} item={item} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
