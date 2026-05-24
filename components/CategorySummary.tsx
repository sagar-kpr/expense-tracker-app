import { Text, View } from "react-native";

type Props = {
  expenses: any[];
};

export default function CategorySummary({ expenses }: Props) {
  const small = expenses
    .filter((item) => item.amount <= 100)
    .reduce((sum, item) => sum + item.amount, 0);

  const medium = expenses
    .filter((item) => item.amount > 100 && item.amount <= 500)
    .reduce((sum, item) => sum + item.amount, 0);

  const heavy = expenses
    .filter((item) => item.amount > 500 && item.amount <= 1000)
    .reduce((sum, item) => sum + item.amount, 0);

  const major = expenses
    .filter((item) => item.amount > 1000)
    .reduce((sum, item) => sum + item.amount, 0);

  const categories = [
    {
      title: "0 - 100",
      amount: small,
      color: "#22C55E",
    },
    {
      title: "101 - 500",
      amount: medium,
      color: "#3B82F6",
    },
    {
      title: "501 - 1000",
      amount: heavy,
      color: "#F59E0B",
    },
    {
      title: "1000+",
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
        By Category
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

          <Text
            style={{
              fontWeight: "bold",
            }}
          >
            ₹{item.amount}
          </Text>
        </View>
      ))}
    </View>
  );
}
