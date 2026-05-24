import { forwardRef, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

type Props = {
  handleAddExpense: (amount: string, description: string) => Promise<void>;
};

const ExpenseModal = forwardRef<any, Props>(({ handleAddExpense }, ref) => {
  const snapPoints = useMemo(() => ["95%"], []);

  const [amount, setAmount] = useState("");

  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);

  const descriptionInputRef = useRef<TextInput>(null);

  const amountInputRef = useRef<TextInput>(null);

  const resetFields = () => {
    setAmount("");
    setDescription("");
  };

  const onSave = async () => {
    if (!amount) return;

    try {
      setLoading(true);

      Keyboard.dismiss();

      await handleAddExpense(amount, description);

      resetFields();

      (ref as any)?.current?.close();
    } catch (err) {
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

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleSheetClose}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="none"
      backgroundStyle={{
        backgroundColor: "white",
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
        <BottomSheetView
          style={{
            flex: 1,
            paddingHorizontal: 28,
            paddingTop: 20,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 18,
              color: "#555",
              fontWeight: "600",
            }}
          >
            Quick Add Expense
          </Text>

          <View
            style={{
              marginTop: 70,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: amount.length > 10 ? 18 : amount.length > 7 ? 20 : 22,
                fontWeight: "600",
                color: amount.length === 0 ? "#BDBDBD" : "#444",
                marginRight: 4,
                alignSelf: "flex-start",
                marginTop: 12,
              }}
            >
              ₹
            </Text>

            <TextInput
              ref={amountInputRef}
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
              selectionColor="#6C63FF"
              placeholder="0"
              placeholderTextColor="#BDBDBD"
              style={{
                fontSize: 42,
                fontWeight: "600",
                color: "#444",
                textAlign: "center",
                flexShrink: 1,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 40,
            }}
          >
            {[50, 100, 500].map((value) => (
              <Pressable
                key={value}
                onPress={() => {
                  const current = Number(amount || 0);

                  setAmount(String(current + value));
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#E6EEF8",
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  + ₹{value}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            ref={descriptionInputRef}
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            style={{
              borderWidth: 1,
              borderColor: "#ECECEC",
              borderRadius: 18,
              paddingVertical: 18,
              paddingHorizontal: 18,
              marginTop: 40,
              marginBottom: 20,
              fontSize: 16,
              color: "#222",
            }}
          />

          <View
            style={{
              marginTop: "auto",
              paddingBottom: 25,
            }}
          >
            <Pressable
              onPress={onSave}
              android_ripple={{
                color: "#8B84FF",
              }}
              style={{
                backgroundColor: loading ? "#B9C9EE" : "#6C63FF",
                paddingVertical: 18,
                borderRadius: 18,
                opacity: loading ? 0.8 : 1,
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
                {loading && <ActivityIndicator size="small" color="white" />}

                <Text
                  style={{
                    color: "white",
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: "700",
                  }}
                >
                  Add Expense
                </Text>
              </View>
            </Pressable>
          </View>
        </BottomSheetView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
});

export default ExpenseModal;
