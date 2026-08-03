import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  PendingTransaction,
  usePendingTransactions,
} from "@/context/PendingTransactionContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const expenseCategories = [
  "Food",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Freelance",
  "Client",
  "Business",
  "Cash",
  "Commission",
  "Other",
];
const salaryIncomeCategories = [
  "Additional Funds",
  "Bonus",
  "Refund",
  "Cash",
  "Transfer",
  "Other",
];

const formatMoney = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

type Props = {
  transaction: PendingTransaction;
};

export default function PendingTransactionCard({ transaction }: Props) {
  const { userData } = useAuth();
  const { theme, dark } = useTheme();
  const {
    approvePendingTransaction,
    approvePendingTransactionWithFunds,
    ignorePendingTransaction,
    updatePendingTransaction,
  } = usePendingTransactions();

  const [editOpen, setEditOpen] = useState(false);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category);
  const [description, setDescription] = useState(transaction.description);
  const [type, setType] = useState<"expense" | "income">(
    transaction.type || "expense",
  );
  const [saving, setSaving] = useState<"add" | "ignore" | "edit" | null>(
    null,
  );

  const isIncome = transaction.type === "income";
  const color = isIncome ? theme.primary : theme.danger;
  const isSalaryCredit = userData?.type === "salary" && type === "income";
  const categories =
    type === "income"
      ? isSalaryCredit
        ? salaryIncomeCategories
        : incomeCategories
      : expenseCategories;

  const handleApprove = async () => {
    try {
      setSaving("add");

      const result = await approvePendingTransaction(transaction);

      if (result.status === "insufficient-funds") {
        Alert.alert(
          "Add Additional Funds first?",
          `This expense needs ₹${result.shortfall.toLocaleString(
            "en-IN",
          )} more than the available balance.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: `Add ₹${result.shortfall.toLocaleString("en-IN")} & Save`,
              onPress: async () => {
                try {
                  setSaving("add");
                  const fundedResult =
                    await approvePendingTransactionWithFunds(
                      transaction,
                      result.shortfall,
                    );

                  if (fundedResult.status === "saved") {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }
                } finally {
                  setSaving(null);
                }
              },
            },
          ],
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(null);
    }
  };

  const handleIgnore = async () => {
    try {
      setSaving("ignore");

      await ignorePendingTransaction(transaction.id);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveEdit = async () => {
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    try {
      setSaving("edit");

      await updatePendingTransaction(transaction.id, {
        amount: parsedAmount,
        category,
        description,
        type,
      });

      setEditOpen(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <View
        style={{
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderRadius: 22,
          borderWidth: 1,
          marginBottom: 14,
          padding: 18,
        }}
      >
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: `${color}18`,
              borderRadius: 18,
              height: 52,
              justifyContent: "center",
              marginRight: 14,
              width: 52,
            }}
          >
            <Ionicons
              name={isIncome ? "arrow-down-circle" : "arrow-up-circle"}
              size={25}
              color={color}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontSize: 17,
                fontWeight: "800",
              }}
            >
              {transaction.description}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: theme.subText,
                fontSize: 13,
                marginTop: 6,
              }}
            >
              {userData?.type === "salary" && isIncome
                ? "Additional Funds"
                : transaction.category} •{" "}
              {transaction.source === "sms-auto" ? "SMS" : "Paste"}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color,
              fontSize: 20,
              fontWeight: "900",
              marginLeft: 12,
              maxWidth: 116,
            }}
          >
            {isIncome ? "+" : "-"}
            {formatMoney(transaction.amount)}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 16,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleApprove}
            disabled={!!saving}
            style={{
              alignItems: "center",
              backgroundColor: theme.primary,
              borderRadius: 16,
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
            }}
          >
            {saving === "add" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                Add
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setEditOpen(true)}
            disabled={!!saving}
            style={{
              alignItems: "center",
              backgroundColor: theme.border,
              borderRadius: 16,
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 14,
                fontWeight: "800",
              }}
            >
              Edit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleIgnore}
            disabled={!!saving}
            style={{
              alignItems: "center",
              backgroundColor: dark ? "#332126" : "#FEE2E2",
              borderRadius: 16,
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
            }}
          >
            {saving === "ignore" ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <Text
                style={{
                  color: theme.danger,
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                Ignore
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        transparent
        visible={editOpen}
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.46)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 26,
              padding: 22,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 22,
                fontWeight: "900",
              }}
            >
              Edit Transaction
            </Text>

            <View
              style={{
                backgroundColor: theme.background,
                borderRadius: 16,
                flexDirection: "row",
                marginTop: 20,
                padding: 5,
              }}
            >
              {(["expense", "income"] as const).map((item) => {
                const active = type === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setType(item);
                      setCategory(
                        item === "income"
                          ? userData?.type === "salary"
                            ? "Additional Funds"
                            : "Cash"
                          : "Other",
                      );
                    }}
                    style={{
                      alignItems: "center",
                      backgroundColor: active ? theme.primary : "transparent",
                      borderRadius: 12,
                      flex: 1,
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : theme.subText,
                        fontWeight: "800",
                      }}
                    >
                      {item === "income"
                        ? userData?.type === "salary"
                          ? "Additional Funds"
                          : "Income"
                        : "Expense"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={amount}
              onChangeText={(text) =>
                setAmount(text.replace(/[^0-9.]/g, ""))
              }
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={theme.subText}
              style={{
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderRadius: 16,
                borderWidth: 1,
                color: theme.text,
                fontSize: 18,
                fontWeight: "800",
                marginTop: 16,
                minHeight: 56,
                paddingHorizontal: 16,
              }}
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={theme.subText}
              style={{
                backgroundColor: theme.background,
                borderColor: theme.border,
                borderRadius: 16,
                borderWidth: 1,
                color: theme.text,
                fontSize: 15,
                marginTop: 12,
                minHeight: 56,
                paddingHorizontal: 16,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 9,
                marginTop: 16,
              }}
            >
              {categories.map((item) => {
                const active = category === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={{
                      backgroundColor: active ? theme.primary : theme.border,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : theme.text,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 22,
              }}
            >
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.border,
                  borderRadius: 16,
                  flex: 1,
                  paddingVertical: 15,
                }}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: "800",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={saving === "edit"}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.primary,
                  borderRadius: 16,
                  flex: 1,
                  paddingVertical: 15,
                }}
              >
                {saving === "edit" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "800",
                    }}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
