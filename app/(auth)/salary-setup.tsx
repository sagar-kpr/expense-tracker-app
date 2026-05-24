import { Pressable, Text, TextInput, View } from "react-native";

import { router } from "expo-router";

import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useOnboardingStore } from "@/store/useOnboardingStore";

export default function SalarySetupScreen() {
  const { salary, salaryDate, setSalary, setSalaryDate } = useOnboardingStore();

  const handleContinue = () => {
    router.push("/(auth)/success");
  };

  return (
    <KeyboardAwareScrollView
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
      }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 70,
        paddingBottom: 40,
      }}
      enableOnAndroid
      extraScrollHeight={20}
      enableResetScrollToCoords={false}
      keyboardShouldPersistTaps="handled"
      enableAutomaticScroll
    >
      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={{
            fontSize: 34,
            fontWeight: "800",
            color: "#111",
            lineHeight: 44,
          }}
        >
          Setup your{"\n"}salary
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: "#777",
            marginTop: 18,
            lineHeight: 26,
          }}
        >
          We’ll use this to track remaining balance and monthly spending.
        </Text>

        <View
          style={{
            marginTop: 50,
            gap: 22,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 15,
                color: "#666",
                marginBottom: 10,
                fontWeight: "600",
              }}
            >
              Monthly Salary
            </Text>

            <TextInput
              value={salary}
              onChangeText={(text) => setSalary(text.replace(/[^0-9]/g, ""))}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="₹50,000"
              placeholderTextColor="#AAA"
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 18,
                fontSize: 18,
                borderWidth: 1,
                borderColor: "#ECECEC",
              }}
            />
          </View>

          <View>
            <Text
              style={{
                fontSize: 15,
                color: "#666",
                marginBottom: 10,
                fontWeight: "600",
              }}
            >
              Salary Credit Date
            </Text>

            <TextInput
              value={salaryDate}
              onChangeText={(text) =>
                setSalaryDate(text.replace(/[^0-9]/g, ""))
              }
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="5"
              placeholderTextColor="#AAA"
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 18,
                fontSize: 18,
                borderWidth: 1,
                borderColor: "#ECECEC",
              }}
            />

            <Text
              style={{
                fontSize: 13,
                color: "#888",
                marginTop: 10,
                lineHeight: 20,
              }}
            >
              Example: Enter 5 if your salary comes on the 5th of every month.
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: "auto",
            paddingTop: 40,
          }}
        >
          <Pressable
            onPress={handleContinue}
            style={{
              backgroundColor: "#6C63FF",
              paddingVertical: 18,
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                color: "white",
                textAlign: "center",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
