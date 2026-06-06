import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  AppState,
  NativeModules,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import PendingTransactionCard from "@/components/PendingTransactionCard";
import { usePendingTransactions } from "@/context/PendingTransactionContext";
import { useTheme } from "@/context/ThemeContext";

const SmsTransactionModule = NativeModules.SmsTransactionModule as
  | {
      isNotificationAccessEnabled?: () => Promise<boolean>;
      openNotificationAccessSettings?: () => Promise<void>;
    }
  | undefined;

const hasNotificationAccessApi =
  typeof SmsTransactionModule?.isNotificationAccessEnabled === "function" &&
  typeof SmsTransactionModule?.openNotificationAccessSettings === "function";

export default function PendingTransactionsReview() {
  const { theme } = useTheme();
  const {
    addPendingFromSms,
    loading,
    pendingCredits,
    pendingDebits,
    pendingTransactions,
    refreshPendingTransactions,
  } = usePendingTransactions();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationAccessEnabled, setNotificationAccessEnabled] =
    useState(false);

  const handlePasteImport = async (value = message) => {
    if (!value.trim()) {
      setError("Paste a bank message to detect a transaction.");

      return;
    }

    try {
      setParsing(true);
      setError("");

      const pending = await addPendingFromSms(value.trim(), "manual-paste");

      if (!pending) {
        setError("Could not detect amount and debit/credit from this message.");

        return;
      }

      setMessage("");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setParsing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshPendingTransactions();
    } finally {
      setRefreshing(false);
    }
  };

  // Append message passed via query param (e.g. /pending-transactions?message=...)
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params?.message) {
      const incoming = Array.isArray(params.message)
        ? params.message.join("\n")
        : params.message;

      if (incoming) {
        setMessage((prev) => (prev ? `${prev}\n${incoming}` : incoming));
      }
    }
  }, [params?.message]);

  useEffect(() => {
    if (
      Platform.OS !== "android" ||
      !SmsTransactionModule ||
      !hasNotificationAccessApi
    ) {
      return;
    }

    const refreshNotificationAccess = () => {
      SmsTransactionModule.isNotificationAccessEnabled!()
        .then(setNotificationAccessEnabled)
        .catch(() => setNotificationAccessEnabled(false));
    };

    refreshNotificationAccess();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshNotificationAccess();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <ScrollView
        style={{
          backgroundColor: theme.background,
          flex: 1,
        }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 120,
          paddingTop: 68,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: theme.text,
            fontSize: 32,
            fontWeight: "900",
          }}
        >
          Detected Transactions
        </Text>

        <Text
          style={{
            color: theme.subText,
            fontSize: 15,
            lineHeight: 24,
            marginTop: 10,
          }}
        >
          Review bank messages before they become real expense records.
        </Text>

        {Platform.OS === "android" &&
          SmsTransactionModule &&
          hasNotificationAccessApi && (
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 20,
              borderWidth: 1,
              marginTop: 20,
              padding: 18,
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row" }}>
              <Ionicons
                name={
                  notificationAccessEnabled
                    ? "notifications-circle"
                    : "notifications-outline"
                }
                size={28}
                color={theme.primary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  Business message detection
                </Text>
                <Text
                  style={{
                    color: theme.subText,
                    fontSize: 13,
                    lineHeight: 19,
                    marginTop: 4,
                  }}
                >
                  {notificationAccessEnabled
                    ? "Enabled for bank debit and credit alerts from Google Messages."
                    : "Enable notification access to detect bank RCS business messages."}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                SmsTransactionModule.openNotificationAccessSettings!().catch(
                  () => setError("Could not open Notification Access settings."),
                );
              }}
              style={{
                alignItems: "center",
                backgroundColor: notificationAccessEnabled
                  ? theme.border
                  : theme.primary,
                borderRadius: 14,
                justifyContent: "center",
                marginTop: 14,
                minHeight: 46,
              }}
            >
              <Text
                style={{
                  color: notificationAccessEnabled ? theme.text : "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "800",
                }}
              >
                {notificationAccessEnabled
                  ? "Manage notification access"
                  : "Enable notification access"}
              </Text>
            </TouchableOpacity>
          </View>
          )}

        {/* <View
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderRadius: 24,
            borderWidth: 1,
            marginTop: 24,
            padding: 18,
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              marginBottom: 14,
            }}
          >
            <Ionicons name="scan" size={22} color={theme.primary} />
            <Text
              style={{
                color: theme.text,
                fontSize: 18,
                fontWeight: "900",
                marginLeft: 10,
              }}
            >
              Test With Message
            </Text>
          </View>

          <TextInput
            multiline
            value={message}
            onChangeText={(text) => {
              setMessage(text);
              setError("");
            }}
            placeholder="Paste bank SMS here..."
            placeholderTextColor={theme.subText}
            style={{
              backgroundColor: theme.background,
              borderColor: error ? theme.danger : theme.border,
              borderRadius: 18,
              borderWidth: 1,
              color: theme.text,
              fontSize: 15,
              minHeight: 118,
              padding: 16,
              textAlignVertical: "top",
            }}
          />

          {!!error && (
            <Text
              style={{
                color: theme.danger,
                fontSize: 13,
                fontWeight: "700",
                marginTop: 10,
              }}
            >
              {error}
            </Text>
          )}

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginTop: 14,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handlePasteImport()}
              disabled={parsing}
              style={{
                alignItems: "center",
                backgroundColor: theme.primary,
                borderRadius: 16,
                flex: 1,
                minHeight: 50,
                justifyContent: "center",
              }}
            >
              {parsing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "800",
                  }}
                >
                  Detect
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                const sample =
                  examples[Math.floor(Math.random() * examples.length)];
                setMessage(sample);
                setError("");
              }}
              style={{
                alignItems: "center",
                backgroundColor: theme.border,
                borderRadius: 16,
                flex: 1,
                minHeight: 50,
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: theme.text,
                  fontSize: 15,
                  fontWeight: "800",
                }}
              >
                Sample
              </Text>
            </TouchableOpacity>
          </View>
        </View> */}

        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 18,
          }}
        >
          <CountCard label="Debits" value={pendingDebits.length} />
          <CountCard label="Credits" value={pendingCredits.length} />
        </View>

        <View style={{ marginTop: 24 }}>
          {pendingTransactions.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.card,
                borderRadius: 24,
                paddingHorizontal: 26,
                paddingVertical: 42,
              }}
            >
              <Ionicons
                name="checkmark-circle"
                size={54}
                color={theme.primary}
              />
              <Text
                style={{
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: "900",
                  marginTop: 14,
                }}
              >
                No pending transactions
              </Text>
              <Text
                style={{
                  color: theme.subText,
                  fontSize: 14,
                  lineHeight: 22,
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Detected SMS transactions will wait here until you add or ignore
                them.
              </Text>
            </View>
          ) : (
            pendingTransactions.map((item) => (
              <PendingTransactionCard key={item.id} transaction={item} />
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderRadius: 20,
        borderWidth: 1,
        flex: 1,
        padding: 18,
      }}
    >
      <Text
        style={{
          color: theme.subText,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.text,
          fontSize: 28,
          fontWeight: "900",
          marginTop: 8,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
