import { Pressable, Text, TextInput, View } from "react-native";

import { useEffect, useState } from "react";

import { router } from "expo-router";

import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useOnboardingStore } from "@/store/useOnboardingStore";

import { auth, db } from "@/firebase";

import { doc, updateDoc } from "firebase/firestore";

export default function SalarySetupScreen() {
  const { salary, salaryDate, setSalary, setSalaryDate, reset } =
    useOnboardingStore();

  const [name, setName] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) return;
  }, []);

  const handleContinue = async () => {
    if (!name.trim()) {
      setError("Please enter your name");

      return;
    }

    if (!salary) {
      setError("Please enter salary");

      return;
    }

    if (!salaryDate) {
      setError("Please enter salary date");

      return;
    }

    const user = auth.currentUser;

    if (!user) return;

    try {
      setLoading(true);

      setError("");

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await updateDoc(
        doc(db, "users", user.uid),

        {
          name,

          salary: Number(salary),

          salaryDate: Number(salaryDate),

          onboarding: true,
        },
      );

      reset();

      router.replace("/(auth)/success" as any);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
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
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flex: 1,
        }}
      >
        <Animated.View entering={FadeInUp.delay(100).duration(700)}>
          <Text
            style={{
              fontSize: 38,

              fontWeight: "800",

              color: "#111",

              lineHeight: 48,

              letterSpacing: -1,
            }}
          >
            Setup your{"\n"}
            <Text
              style={{
                color: "#159B7D",
              }}
            >
              salary
            </Text>
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
        </Animated.View>

        <View
          style={{
            marginTop: 52,

            gap: 22,
          }}
        >
          <Animated.View entering={FadeInDown.delay(250).duration(700)}>
            <Text
              style={{
                fontSize: 15,

                color: "#666",

                marginBottom: 10,

                fontWeight: "600",
              }}
            >
              Full Name
            </Text>

            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);

                setError("");
              }}
              placeholder="Sagar Kapoor"
              placeholderTextColor="#AAA"
              style={{
                backgroundColor: "white",

                borderRadius: 22,

                paddingVertical: 18,

                paddingHorizontal: 18,

                fontSize: 18,

                borderWidth: 1,

                borderColor: "#ECECEC",
              }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(700)}>
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
              onChangeText={(text) => {
                setSalary(text.replace(/[^0-9]/g, ""));

                setError("");
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="₹10,000"
              placeholderTextColor="#AAA"
              style={{
                backgroundColor: "white",

                borderRadius: 22,

                paddingVertical: 18,

                paddingHorizontal: 18,

                fontSize: 18,

                borderWidth: 1,

                borderColor: "#ECECEC",
              }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(450).duration(700)}>
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
              onChangeText={(text) => {
                setSalaryDate(text.replace(/[^0-9]/g, ""));

                setError("");
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder="1"
              placeholderTextColor="#AAA"
              style={{
                backgroundColor: "white",

                borderRadius: 22,

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
              Example: Enter 1 if your salary comes on the 1st of every month.
            </Text>
          </Animated.View>
        </View>

        {!!error && (
          <Animated.Text
            entering={FadeInUp.duration(400)}
            style={{
              color: "#EF4444",

              fontWeight: "600",

              marginTop: 20,

              lineHeight: 22,
            }}
          >
            {error}
          </Animated.Text>
        )}

        <Animated.View
          entering={FadeInUp.delay(650).duration(700)}
          style={{
            marginTop: "auto",

            paddingTop: 42,
          }}
        >
          <Pressable
            onPress={handleContinue}
            disabled={loading}
            style={{
              backgroundColor: "#159B7D",

              paddingVertical: 18,

              borderRadius: 22,

              shadowColor: "#159B7D",

              shadowOpacity: 0.25,

              shadowRadius: 18,

              shadowOffset: {
                width: 0,

                height: 10,
              },

              elevation: 8,

              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: "white",

                textAlign: "center",

                fontSize: 18,

                fontWeight: "800",

                letterSpacing: 0.3,
              }}
            >
              {loading ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAwareScrollView>
  );
}
