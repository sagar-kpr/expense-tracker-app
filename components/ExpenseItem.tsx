import { Text, View } from "react-native";

type Props = {
  item: any;
};

export default function ExpenseItem({ item }: Props) {
  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 15,
        borderRadius: 16,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "bold",
        }}
      >
        ₹{item.amount}
      </Text>

      <Text
        style={{
          marginTop: 5,
          color: "#666",
        }}
      >
        {item.description}
      </Text>

      <Text
        style={{
          marginTop: 8,
          color: "#6C63FF",
          fontWeight: "600",
        }}
      >
        {item.category}
      </Text>
    </View>
  );
}
