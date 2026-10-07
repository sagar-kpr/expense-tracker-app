import { formatReadableMoney as formatMoney } from "@/utils/money";
import MoneyText from "@/components/MoneyText";
import { Text, View } from "react-native";

type Props = {
  remainingSalary: number;
  totalSpent: number;
};

export default function SalaryCard({ remainingSalary, totalSpent }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#6C63FF",
        padding: 20,
        borderRadius: 20,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 18,
        }}
      >
        Remaining Salary
      </Text>

      <MoneyText
        style={{
          color: "white",
          fontSize: 36,
          fontWeight: "bold",
          marginTop: 10,
        }}
        value={Number(remainingSalary)}
      />

      <Text
        style={{
          color: "white",
          marginTop: 10,
        }}
      >
        Total Spent: {formatMoney(totalSpent)}
      </Text>
    </View>
  );
}
