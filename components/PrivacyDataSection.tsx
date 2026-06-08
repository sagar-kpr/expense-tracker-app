import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { deleteUser } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/firebase";

const deleteCollectionInBatches = async (path: string) => {
  const snapshot = await getDocs(collection(db, path));

  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(db);
  let operationCount = 0;

  for (const item of snapshot.docs) {
    batch.delete(item.ref);
    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
};

export default function PrivacyDataSection() {
  const { theme } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "transactions" | "account" | "account-final" | null
  >(null);
  const [notice, setNotice] = useState("");

  const deleteUserFirestoreData = async (uid: string) => {
    await Promise.all([
      deleteCollectionInBatches(`users/${uid}/expenses`),
      deleteCollectionInBatches(`users/${uid}/pendingTransactions`),
    ]);

    await deleteDoc(doc(db, "users", uid));
  };

  const handleDeleteTransactionData = () => {
    setNotice("");
    setConfirmAction("transactions");
  };

  const handleDeleteAccount = () => {
    setNotice("");
    setConfirmAction("account");
  };

  const deleteTransactionData = async () => {
    const user = auth.currentUser;

    if (!user) {
      setNotice("Please log in again to delete data.");

      return;
    }

    try {
      setDeleting(true);

      await Promise.all([
        deleteCollectionInBatches(`users/${user.uid}/expenses`),
        deleteCollectionInBatches(`users/${user.uid}/pendingTransactions`),
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setNotice("Transaction data deleted.");
    } catch (error) {
      console.log("Delete transaction data error:", error);

      setNotice("Could not delete data. Please check your connection.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteAccount = async () => {
    const user = auth.currentUser;

    if (!user) {
      setNotice("Please log in again to delete your account.");

      return;
    }

    const lastSignInTime = user.metadata.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).getTime()
      : 0;
    const recentLoginWindowMs = 5 * 60 * 1000;
    const needsRecentLogin =
      !lastSignInTime || Date.now() - lastSignInTime > recentLoginWindowMs;

    if (needsRecentLogin) {
      setNotice(
        "For security, log out and log in again before deleting your account.",
      );

      return;
    }

    try {
      setDeletingAccount(true);

      await deleteUserFirestoreData(user.uid);
      await deleteUser(user);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.log("Delete account error:", error);

      if (
        error?.code === "auth/requires-recent-login" ||
        error?.message?.includes("requires-recent-login")
      ) {
        setNotice(
          "For security, log out and log in again before deleting your account.",
        );
      } else {
        setNotice("Could not delete account. Please check your connection.");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmTitle =
    confirmAction === "transactions"
      ? "Delete transaction data?"
      : confirmAction === "account"
        ? "Delete account?"
        : "Are you sure?";
  const confirmMessage =
    confirmAction === "transactions"
      ? "This permanently removes saved expenses and pending SMS transactions. Your login and profile stay active."
      : confirmAction === "account"
        ? "This permanently deletes your profile, expenses, pending transactions, and sign-in account."
        : "All account data will be removed permanently. This cannot be undone.";
  const confirmLabel =
    confirmAction === "transactions"
      ? "Delete data"
      : confirmAction === "account"
        ? "Continue"
        : "Yes, delete";

  const handleConfirm = async () => {
    const action = confirmAction;

    if (action === "account") {
      setConfirmAction("account-final");

      return;
    }

    setConfirmAction(null);

    if (action === "transactions") {
      await deleteTransactionData();
    }

    if (action === "account-final") {
      await deleteAccount();
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(620).duration(700)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 28,
        marginTop: 24,
        padding: 22,
      }}
    >
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "900",
          marginBottom: 18,
        }}
      >
        Privacy & Data
      </Text>

      <ActionRow
        icon="shield-checkmark-outline"
        label="Privacy Policy"
        onPress={() => router.push("/privacy" as any)}
      />

      <View
        style={{
          backgroundColor: theme.border,
          height: 1,
          marginVertical: 14,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={deleting || deletingAccount}
        onPress={handleDeleteTransactionData}
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 48,
          opacity: deleting ? 0.65 : 1,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${theme.danger}18`,
            borderRadius: 14,
            height: 40,
            justifyContent: "center",
            marginRight: 12,
            width: 40,
          }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.danger,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Delete transaction data
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Removes expenses and pending SMS reviews.
          </Text>
        </View>
        {deleting ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: theme.border,
          height: 1,
          marginVertical: 14,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={deleting || deletingAccount}
        onPress={handleDeleteAccount}
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 48,
          opacity: deletingAccount ? 0.65 : 1,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${theme.danger}18`,
            borderRadius: 14,
            height: 40,
            justifyContent: "center",
            marginRight: 12,
            width: 40,
          }}
        >
          <Ionicons
            name="person-remove-outline"
            size={20}
            color={theme.danger}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.danger,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Delete account
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Removes profile, transactions, and login.
          </Text>
        </View>
        {deletingAccount ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </TouchableOpacity>

      {!!notice && (
        <Text
          style={{
            color: notice.includes("deleted") ? theme.primary : theme.danger,
            fontSize: 13,
            fontWeight: "700",
            lineHeight: 20,
            marginTop: 14,
          }}
        >
          {notice}
        </Text>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={!!confirmAction}
        onRequestClose={() => setConfirmAction(null)}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.46)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 24,
              borderWidth: 1,
              padding: 22,
              width: "100%",
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 21,
                fontWeight: "900",
              }}
            >
              {confirmTitle}
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 14,
                lineHeight: 22,
                marginTop: 10,
              }}
            >
              {confirmMessage}
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setConfirmAction(null)}
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
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleConfirm}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.danger,
                  borderRadius: 16,
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        minHeight: 48,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: `${theme.primary}18`,
          borderRadius: 14,
          height: 40,
          justifyContent: "center",
          marginRight: 12,
          width: 40,
        }}
      >
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <Text
        style={{
          color: theme.text,
          flex: 1,
          fontSize: 15,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={theme.subText} />
    </TouchableOpacity>
  );
}
