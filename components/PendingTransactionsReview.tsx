import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  PermissionsAndroid,
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

const examples = [
  "Rs.130 debited from your account via UPI to SWIGGY.",
  "Rs.50000 credited to your account as salary.",
];
console.log(
  "🚀 ~ file: PendingTransactionsReview.tsx:11 ~ examples:",
  examples,
);
export default function PendingTransactionsReview() {
  const { theme } = useTheme();
  const {
    addPendingFromSms,
    loading,
    pendingCredits,
    pendingDebits,
    pendingTransactions,
    refreshPendingTransactions,
    smsDiagnostics,
  } = usePendingTransactions();

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

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

  // Check SMS permission status on mount
  const checkSmsPermission = async () => {
    if (Platform.OS !== "android") {
      setPermissionChecked(true);
      return;
    }

    try {
      const hasReceiveSms = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      );
      const hasReadSms = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      );

      if (!hasReceiveSms || !hasReadSms) {
        setShowPermissionModal(true);
      }

      setPermissionChecked(true);
    } catch (err) {
      console.log("Permission check error:", err);
      setPermissionChecked(true);
    }
  };

  // Request SMS permission
  const handleRequestPermission = async () => {
    if (Platform.OS !== "android") {
      setShowPermissionModal(false);
      return;
    }

    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);

      const allGranted =
        result[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
          PermissionsAndroid.RESULTS.GRANTED;

      if (allGranted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshPendingTransactions();
      }

      setShowPermissionModal(false);
    } catch (err) {
      console.log("Permission request error:", err);
      setShowPermissionModal(false);
    }
  };

  // Check permission on component mount
  useEffect(() => {
    checkSmsPermission();
  }, []);

  console.log("🚀Transactions:", pendingTransactions);

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

  return (
    <>
      {/* SMS Permission Consent Modal */}
      <Modal
        visible={showPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderRadius: 24,
              padding: 24,
              maxWidth: 320,
            }}
          >
            <View
              style={{
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: `${theme.primary}18`,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Ionicons name="mail" size={32} color={theme.primary} />
              </View>
              <Text
                style={{
                  color: theme.text,
                  fontSize: 20,
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                Allow SMS Access?
              </Text>
            </View>

            <Text
              style={{
                color: theme.subText,
                fontSize: 14,
                lineHeight: 22,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              This app needs SMS permission to automatically detect bank
              transaction messages and help you track expenses.
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowPermissionModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: theme.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Skip
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRequestPermission}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: theme.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  Allow
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

        {Platform.OS === "android" && (
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 16,
              borderWidth: 1,
              marginTop: 16,
              padding: 14,
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 14,
                fontWeight: "900",
              }}
            >
              SMS status
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 12,
                lineHeight: 19,
                marginTop: 6,
              }}
            >
              Native: {smsDiagnostics.hasNativeModule ? "yes" : "no"} | Receive:{" "}
              {smsDiagnostics.receivePermission ? "yes" : "no"} | Read:{" "}
              {smsDiagnostics.readPermission ? "yes" : "no"}
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 12,
                lineHeight: 19,
              }}
            >
              Cache: {smsDiagnostics.cachedMessageCount} | Inbox scan:{" "}
              {smsDiagnostics.lastInboxScanCount}
            </Text>
            {!!smsDiagnostics.lastEventAt && (
              <Text
                style={{
                  color: theme.subText,
                  fontSize: 12,
                  lineHeight: 19,
                }}
              >
                Last live SMS:{" "}
                {new Date(smsDiagnostics.lastEventAt).toLocaleTimeString()}
              </Text>
            )}
            {!!smsDiagnostics.lastImportAt && (
              <Text
                style={{
                  color: theme.subText,
                  fontSize: 12,
                  lineHeight: 19,
                }}
              >
                Last scan:{" "}
                {new Date(smsDiagnostics.lastImportAt).toLocaleTimeString()}
              </Text>
            )}
            {!!smsDiagnostics.lastError && (
              <Text
                style={{
                  color: theme.danger,
                  fontSize: 12,
                  fontWeight: "700",
                  lineHeight: 19,
                  marginTop: 4,
                }}
              >
                {smsDiagnostics.lastError}
              </Text>
            )}
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
