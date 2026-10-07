import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useState } from "react";

import Animated, { FadeInUp } from "react-native-reanimated";

import { router } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";

import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { login, loading, signup, loginWithEmail, forgotPassword } = useAuth();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSignup, setIsSignup] = useState(false);

  const [authLoading, setAuthLoading] = useState(false);

  const [error, setError] = useState("");

  const handleAuth = async () => {
    try {
      setError("");

      setAuthLoading(true);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (isSignup) {
        if (password !== confirmPassword) {
          setError("Passwords do not match");

          setAuthLoading(false);

          return;
        }

        await signup(email.trim(), password);

        router.dismissAll();

        // IMPORTANT FIX 🔥
        // user-type first
        router.replace("/(auth)/user-type" as any);
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      if (err.message?.includes("auth/invalid-email")) {
        setError("Invalid email address");
      } else if (err.message?.includes("auth/invalid-credential")) {
        setError("Wrong email or password");
      } else if (err.message?.includes("auth/email-already-in-use")) {
        setError("Email already exists");
      } else if (err.message?.includes("auth/weak-password")) {
        setError("Password should be at least 6 characters");
      } else {
        setError("Something went wrong");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      setError("Enter email first");

      return;
    }

    try {
      await forgotPassword(email);

      setError("Password reset email sent");
    } catch {
      setError("Failed to send reset email");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,

        backgroundColor: "#F7F7F7",
      }}
    >
      <View
        style={{
          flex: 1,

          padding: 24,

          paddingTop: 110,
        }}
      >
        <Animated.View entering={FadeInUp.duration(700)}>
          <Text
            style={{
              fontSize: 42,

              fontWeight: "800",

              color: "#111",
            }}
          >
            Expense
            {"\n"}
            <Text
              style={{
                color: "#159B7D",
              }}
            >
              Tracker
            </Text>
          </Text>

          <Text
            style={{
              marginTop: 12,

              color: "#777",

              fontSize: 16,

              lineHeight: 24,
            }}
          >
            Track your money smarter and manage your finance better.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(700)}>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);

              setError("");
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor="#AAA"
            style={{
              backgroundColor: "white",

              marginTop: 40,

              borderRadius: 20,

              paddingHorizontal: 18,

              paddingVertical: 18,

              fontSize: 16,

              borderWidth: 1,

              borderColor: "#ECECEC",
            }}
          />

          <View
            style={{
              marginTop: 16,
            }}
          >
            <View
              style={{
                backgroundColor: "white",

                borderRadius: 20,

                borderWidth: 1,

                borderColor: "#ECECEC",

                flexDirection: "row",

                alignItems: "center",

                paddingHorizontal: 18,
              }}
            >
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);

                  setError("");
                }}
                secureTextEntry={!showPassword}
                placeholderTextColor="#AAA"
                style={{
                  flex: 1,

                  paddingVertical: 18,

                  fontSize: 16,
                  color: "#111",
                }}
              />

              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#777"
                />
              </TouchableOpacity>
            </View>
          </View>

          {isSignup && (
            <View
              style={{
                marginTop: 16,
              }}
            >
              <View
                style={{
                  backgroundColor: "white",

                  borderRadius: 20,

                  borderWidth: 1,

                  borderColor: "#ECECEC",

                  flexDirection: "row",

                  alignItems: "center",

                  paddingHorizontal: 18,
                }}
              >
                <TextInput
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);

                    setError("");
                  }}
                  secureTextEntry={!showConfirmPassword}
                  placeholderTextColor="#AAA"
                  style={{
                    flex: 1,

                    paddingVertical: 18,

                    fontSize: 16,
                    color: "#111",
                  }}
                />

                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={22}
                    color="#777"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!!error && (
            <Text
              style={{
                color: error.includes("sent") ? "#22C55E" : "#EF4444",

                marginTop: 14,

                fontWeight: "600",

                lineHeight: 22,
              }}
            >
              {error}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(240).duration(700)}>
          <TouchableOpacity
            onPress={handleAuth}
            activeOpacity={0.85}
            disabled={authLoading}
            style={{
              marginTop: 28,

              backgroundColor: authLoading ? "#159B7D" : "#159B7D",

              paddingVertical: 18,

              borderRadius: 22,

              alignItems: "center",

              opacity: authLoading ? 0.7 : 1,
            }}
          >
            {authLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                style={{
                  color: "white",

                  fontSize: 17,

                  fontWeight: "700",
                }}
              >
                {isSignup ? "Create Account" : "Login"}
              </Text>
            )}
          </TouchableOpacity>

          {/* <TouchableOpacity
            onPress={login}
            activeOpacity={0.85}
            style={{
              marginTop: 16,

              backgroundColor: "white",

              paddingVertical: 18,

              borderRadius: 22,

              alignItems: "center",

              borderWidth: 1,

              borderColor: "#71c7b4",
            }}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text
                style={{
                  color: "#111",

                  fontSize: 17,

                  fontWeight: "700",
                }}
              >
                Continue with Google
              </Text>
            )}
          </TouchableOpacity> */}

          {!isSignup && (
            <TouchableOpacity
              onPress={handleForgot}
              style={{
                marginTop: 20,

                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#159B7D",

                  fontWeight: "700",
                }}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setIsSignup(!isSignup);

              setError("");
            }}
            style={{
              marginTop: 28,

              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#111",

                fontWeight: "600",

                lineHeight: 22,
              }}
            >
              {isSignup
                ? "Already have an account? Login"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}
