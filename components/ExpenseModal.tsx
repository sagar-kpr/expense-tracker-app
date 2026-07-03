import { useTheme } from "@/context/ThemeContext";

import { useAuth } from "@/context/AuthContext";

import * as Haptics from "expo-haptics";

import { forwardRef, useCallback, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  handleAddExpense: (
    amount: string,
    description: string,
    category: string,

    type?: "income" | "expense",
  ) => Promise<void>;
};

const expenseCategories = [
  "Food",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Other",
];

const incomeCategories = [
  "Freelance",
  "Client",
  "Business",
  "Cash",
  "Commission",
  "Other",
];

const ExpenseModal = forwardRef<any, Props>(({ handleAddExpense }, ref) => {
  const snapPoints = useMemo(() => ["95%"], []);

  const { theme } = useTheme();

  const { userData } = useAuth();

  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState("");

  const [description, setDescription] = useState("");

  const [type, setType] = useState<"income" | "expense">("expense");

  const [category, setCategory] = useState("Food");

  const [loading, setLoading] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);

  const inputAccessoryViewID = "amountKeyboard";

  const categories = type === "income" ? incomeCategories : expenseCategories;

  const resetFields = () => {
    setAmount("");

    setDescription("");

    setType("expense");

    setCategory("Food");
  };

  const onSave = async () => {
    if (!amount || loading) return;

    try {
      setLoading(true);

      Keyboard.dismiss();

      await handleAddExpense(
        amount,

        description,

        category,

        type,
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      resetFields();

      (ref as any)?.current?.close();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetClose = () => {
    resetFields();

    Keyboard.dismiss();
  };

  const formatAmount = (value: string) => {
    if (!value) return "";

    const cleaned = value.replace(/,/g, "");

    const parts = cleaned.split(".");

    const number = parts[0];

    const lastThree = number.slice(-3);

    const otherNumbers = number.slice(0, -3);

    const formatted = otherNumbers
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;

    return parts[1] ? formatted + "." + parts[1] : formatted;
  };

  const scrollToActions = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    });

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 300);
  }, []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={handleSheetClose}
      bottomInset={insets.bottom}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => {
        if (index >= 0) {
          setTimeout(() => {
            amountInputRef.current?.focus();
          }, 250);
        }
      }}
      backgroundStyle={{
        backgroundColor: theme.card,

        borderTopLeftRadius: 35,

        borderTopRightRadius: 35,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
        }}
      >
        <BottomSheetScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,

            paddingHorizontal: 28,

            paddingTop: 60,

            paddingBottom: 30,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text
            style={{
              textAlign: "center",

              fontSize: 18,

              color: theme.subText,

              fontWeight: "600",
            }}
          >
            {type === "income" ? "Quick Add Income" : "Quick Add Expense"}
          </Text>

          {userData?.type === "self-employed" && (
            <View
              style={{
                flexDirection: "row",

                marginTop: 28,

                backgroundColor: theme.background,

                borderRadius: 18,

                padding: 6,
              }}
            >
              <Pressable
                onPress={() => {
                  setType("income");

                  setCategory("Freelance");
                }}
                style={{
                  flex: 1,

                  backgroundColor:
                    type === "income" ? "#11735E" : "transparent",

                  paddingVertical: 14,

                  borderRadius: 14,

                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: type === "income" ? "white" : theme.subText,

                    fontWeight: "800",

                    fontSize: 15,
                  }}
                >
                  Income
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setType("expense");

                  setCategory("Food");
                }}
                style={{
                  flex: 1,

                  backgroundColor:
                    type === "expense" ? "#172033" : "transparent",

                  paddingVertical: 14,

                  borderRadius: 14,

                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: type === "expense" ? "white" : theme.subText,

                    fontWeight: "800",

                    fontSize: 15,
                  }}
                >
                  Expense
                </Text>
              </Pressable>
            </View>
          )}

          <View
            style={{
              marginTop: 65,

              alignItems: "center",

              flexDirection: "row",

              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: amount.length > 10 ? 18 : amount.length > 7 ? 20 : 22,

                fontWeight: "600",

                color: amount.length === 0 ? theme.subText : theme.text,

                marginRight: 4,

                alignSelf: "flex-start",

                marginTop: 12,
              }}
            >
              ₹
            </Text>

            <TextInput
              ref={amountInputRef}
              inputAccessoryViewID={inputAccessoryViewID}
              value={formatAmount(amount)}
              onChangeText={(text) => {
                const cleaned = text.replace(/,/g, "");

                const numeric = Number(cleaned);

                if (numeric > 10000000) {
                  return;
                }

                setAmount(cleaned);
              }}
              keyboardType="decimal-pad"
              selectionColor={theme.primary}
              placeholder="0"
              placeholderTextColor={theme.subText}
              style={{
                fontSize: 42,

                fontWeight: "600",

                color: theme.text,

                textAlign: "center",

                flexShrink: 1,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",

              justifyContent: "space-between",

              marginTop: 36,
            }}
          >
            {[50, 100, 500].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  const current = Number(amount || 0);

                  setAmount(String(current + value));
                }}
                style={({ pressed }) => ({
                  borderWidth: 1,

                  borderColor: theme.border,

                  backgroundColor: pressed ? theme.border : theme.card,

                  paddingVertical: 12,

                  paddingHorizontal: 24,

                  borderRadius: 16,

                  transform: [
                    {
                      scale: pressed ? 0.97 : 1,
                    },
                  ],
                })}
              >
                <Text
                  style={{
                    fontSize: 15,

                    fontWeight: "600",

                    color: theme.text,
                  }}
                >
                  + ₹{value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text
            style={{
              marginTop: 36,

              marginBottom: 14,

              fontSize: 15,

              fontWeight: "700",

              color: theme.subText,
            }}
          >
            Category
          </Text>

          <View
            style={{
              flexDirection: "row",

              flexWrap: "wrap",

              marginTop: 2,

              gap: 10,
            }}
          >
            {categories.map((item) => {
              const active = category === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={{
                    minWidth: 95,

                    height: 46,

                    borderRadius: 16,

                    justifyContent: "center",

                    alignItems: "center",

                    backgroundColor: active
                      ? type === "income" || userData?.type !== "self-employed"
                        ? "#11735E"
                        : "#172033"
                      : theme.card,

                    borderWidth: 1,

                    borderColor: active
                      ? type === "income" || userData?.type !== "self-employed"
                        ? "#11735E"
                        : "#172033"
                      : theme.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? "white" : theme.subText,

                      fontWeight: "700",

                      fontSize: 14,

                      letterSpacing: 0.2,
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <BottomSheetTextInput
            placeholder="Add description..."
            value={description}
            onChangeText={setDescription}
            onFocus={scrollToActions}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            placeholderTextColor={theme.subText}
            style={{
              backgroundColor: theme.card,

              borderRadius: 20,

              paddingVertical: 18,

              paddingHorizontal: 18,

              marginTop: 36,

              marginBottom: 20,

              fontSize: 16,

              color: theme.text,

              borderWidth: 1,

              borderColor: theme.border,
            }}
          />

          <View
            style={{
              marginTop: "auto",

              paddingBottom: 25,
            }}
          >
            <Pressable
              disabled={!amount || loading}
              onPress={onSave}
              android_ripple={{
                color: type === "income" ? "#11735E" : "#172033",
              }}
              style={{
                backgroundColor: !amount
                  ? type === "income" || userData?.type !== "self-employed"
                    ? "#6bc0ae"
                    : "#50596d"
                  : loading
                    ? theme.border
                    : type === "income" || userData?.type !== "self-employed"
                      ? "#11735E"
                      : "#172033",

                paddingVertical: 18,

                borderRadius: 20,

                opacity: loading ? 0.85 : 1,
              }}
            >
              <View
                style={{
                  flexDirection: "row",

                  alignItems: "center",

                  justifyContent: "center",

                  gap: 10,
                }}
              >
                {loading && (
                  <ActivityIndicator size="small" color={theme.card} />
                )}

                <Text
                  style={{
                    color: "white",

                    textAlign: "center",

                    fontSize: 20,

                    fontWeight: "700",
                  }}
                >
                  {type === "income" ? "Add Income" : "Add Expense"}
                </Text>
              </View>
            </Pressable>
          </View>
        </BottomSheetScrollView>

        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={inputAccessoryViewID}>
            <View
              style={{
                backgroundColor: theme.card,

                borderTopWidth: 1,

                borderColor: theme.border,

                padding: 12,

                alignItems: "flex-end",
              }}
            >
              <Pressable onPress={() => Keyboard.dismiss()}>
                <Text
                  style={{
                    color: theme.primary,

                    fontSize: 16,

                    fontWeight: "700",
                  }}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
});

ExpenseModal.displayName = "ExpenseModal";

export default ExpenseModal;
