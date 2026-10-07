import { addMoney } from "@/services/salaryMath";
import MoneyText from "@/components/MoneyText";
import { Text, View } from "react-native";

type Props = {
  expenses: any[];
};

export default function CategorySummary({ expenses }: Props) {
  const small = expenses
    .filter(
      (item) => (item.type || "expense") === "expense" && item.amount <= 100,
    )
    .reduce((sum, item) => addMoney(sum, Number(item.amount)), 0);

  const medium = expenses
    .filter(
      (item) =>
        (item.type || "expense") === "expense" &&
        item.amount > 100 &&
        item.amount <= 500,
    )
    .reduce((sum, item) => addMoney(sum, Number(item.amount)), 0);

  const heavy = expenses
    .filter(
      (item) =>
        (item.type || "expense") === "expense" &&
        item.amount > 500 &&
        item.amount <= 1000,
    )
    .reduce((sum, item) => addMoney(sum, Number(item.amount)), 0);

  const major = expenses
    .filter(
      (item) => (item.type || "expense") === "expense" && item.amount > 1000,
    )
    .reduce((sum, item) => addMoney(sum, Number(item.amount)), 0);

  const categories = [
    {
      title: "0 - 100",
      amount: small,
      color: "#22C55E",
    },
    {
      title: ">100 - 500",
      amount: medium,
      color: "#3B82F6",
    },
    {
      title: ">500 - 1000",
      amount: heavy,
      color: "#F59E0B",
    },
    {
      title: ">1000",
      amount: major,
      color: "#EF4444",
    },
  ];

  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 20,
        borderRadius: 20,
        marginTop: 20,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "bold",
          marginBottom: 20,
        }}
      >
        By Amount
      </Text>

      {categories.map((item) => (
        <View
          key={item.title}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 15,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 10,
                backgroundColor: item.color,
                marginRight: 10,
              }}
            />

            <Text>{item.title}</Text>
          </View>

          <MoneyText
            style={{
              fontWeight: "bold",
              maxWidth: "50%",
              flexShrink: 1,
            }}
            value={Number(item.amount)}
          />
        </View>
      ))}
    </View>
  );
}
