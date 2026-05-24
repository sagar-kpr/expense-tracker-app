import { Pressable, Text, TextInput, View } from "react-native";

type Props = {
  amount: string;
  description: string;
  setAmount: (value: string) => void;
  setDescription: (value: string) => void;
  handleAddExpense: () => void;
};

export default function ExpenseForm({
  amount,
  description,
  setAmount,
  setDescription,
  handleAddExpense,
}: Props) {
  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 20,
        borderRadius: 20,
        marginTop: 20,
      }}
    >
      <TextInput
        placeholder="Enter Amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 15,
          marginBottom: 15,
        }}
      />

      <TextInput
        placeholder="Description (Optional)"
        value={description}
        onChangeText={setDescription}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 12,
          padding: 15,
          marginBottom: 15,
        }}
      />

      <Pressable
        onPress={handleAddExpense}
        style={{
          backgroundColor: "#6C63FF",
          padding: 15,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          Add Expense
        </Text>
      </Pressable>
    </View>
  );
}
