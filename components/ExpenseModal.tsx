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

type Props = {
  handleAddExpense: (
    amount: string,
    description: string,
    category: string,
  ) => Promise<void>;
};

const categories = ["Food", "Travel", "Bills", "Shopping", "Health", "Other"];

const ExpenseModal = forwardRef<any, Props>(({ handleAddExpense }, ref) => {
  const snapPoints = useMemo(() => ["95%"], []);

  const [amount, setAmount] = useState("");

  const [description, setDescription] = useState("");

  const [category, setCategory] = useState("Food");

  const [loading, setLoading] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  const scrollViewRef = useRef<BottomSheetScrollViewMethods>(null);

  const inputAccessoryViewID = "amountKeyboard";

  const resetFields = () => {
    setAmount("");

    setDescription("");

    setCategory("Food");
  };

  const onSave = async () => {
    if (!amount || loading) return;

    try {
      setLoading(true);

      Keyboard.dismiss();

      await handleAddExpense(amount, description, category);
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
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleSheetClose}
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
        <BottomSheetScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 28,
            paddingTop: 20,
            paddingBottom: 30,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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

                  borderColor: "#E8E8E8",

                  backgroundColor: pressed ? "#F5F4FF" : "white",

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

                    color: "#444",
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

              color: "#555",
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

                    backgroundColor: active ? "#6963FF" : "#F7F7F7",

                    borderWidth: 1,

                    borderColor: active ? "#6C63FF" : "#ECECEC",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "white" : "#555",

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
            placeholderTextColor="#A3A3A3"
            style={{
              backgroundColor: "#F8F8F8",

              borderRadius: 20,

              paddingVertical: 18,

              paddingHorizontal: 18,

              marginTop: 36,

              marginBottom: 20,

              fontSize: 16,

              color: "#222",

              borderWidth: 1,

              borderColor: "#EFEFEF",
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
                color: "#8B84FF",
              }}
              style={{
                backgroundColor: !amount
                  ? "#CFCDFE"
                  : loading
                    ? "#B9C9EE"
                    : "#6C63FF",

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
        </BottomSheetScrollView>

        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={inputAccessoryViewID}>
            <View
              style={{
                backgroundColor: "white",

                borderTopWidth: 1,

                borderColor: "#ECECEC",

                padding: 12,

                alignItems: "flex-end",
              }}
            >
              <Pressable onPress={() => Keyboard.dismiss()}>
                <Text
                  style={{
                    color: "#6C63FF",

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

export default ExpenseModal;
