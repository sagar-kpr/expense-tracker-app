import { confirmSalaryArrivalRecord } from "@/services/salaryArrival";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  AppState,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";

import * as Notifications from "expo-notifications";

import { useAuth } from "@/context/AuthContext";
import {
  deletePendingTransaction,
  listPendingTransactions,
  subscribePendingTransactions,
  updatePendingTransaction,
  upsertPendingTransaction,
  type PendingTransactionRecord,
} from "@/repositories/pendingTransactionRepository";
import { createId } from "@/repositories/shared";
import {
  saveExpenseWithAdditionalFunds,
  saveTransactionWithSalaryValidation,
  type SalaryTransactionSaveResult,
} from "@/services/salaryBalance";
import {
  getSmsDuplicateId,
  getNativeSmsMessageKey,
  getSmsTransactionDuplicateKey,
  isSalaryCredit,
  isRecentSmsDuplicate,
  parseSmsMessageResult,
  ParsedSmsTransaction,
  parseSmsMessage,
  NativeSmsMessage,
} from "@/utils/smsParser";

export type PendingTransaction = PendingTransactionRecord;

type PendingApprovalResult = SalaryTransactionSaveResult | { status: "salary-confirmed" };

type PendingTransactionInput = Omit<PendingTransaction, "id">;
type PendingSmsResult =
  | {
      pending: PendingTransaction;
    }
  | {
      pending: null;
      reason:
        | "missing-amount"
        | "missing-keyword"
        | "missing-user"
        | "save-skipped"
        | "untrusted-sender";
      message?: string;
      status?: number;
    };

type PendingTransactionContextType = {
  addPendingFromSms: (
    rawMessage: string | NativeSmsMessage,
    source?: "manual-paste" | "sms-auto",
  ) => Promise<PendingTransaction | null>;
  addPendingFromSmsWithResult: (
    rawMessage: string | NativeSmsMessage,
    source?: "manual-paste" | "sms-auto",
  ) => Promise<PendingSmsResult>;
  approvePendingTransaction: (
    transaction: PendingTransaction,
  ) => Promise<PendingApprovalResult>;
  approvePendingTransactionWithFunds: (
    transaction: PendingTransaction,
    additionalFunds: number,
  ) => Promise<SalaryTransactionSaveResult>;
  ignorePendingTransaction: (id: string) => Promise<void>;
  loading: boolean;
  pendingCount: number;
  pendingCredits: PendingTransaction[];
  pendingDebits: PendingTransaction[];
  pendingTransactions: PendingTransaction[];
  refreshPendingTransactions: () => Promise<void>;
  updatePendingTransaction: (
    id: string,
    data: Partial<PendingTransactionInput>,
  ) => Promise<void>;
};

const PendingTransactionContext = createContext<
  PendingTransactionContextType | undefined
>(undefined);

const SmsTransactionModule = NativeModules.SmsTransactionModule as
  | {
      addListener?: (eventName: string) => void;
      clearPendingMessages?: () => Promise<void>;
      getPendingMessages?: () => Promise<Array<string | NativeSmsMessage>>;
      isNotificationAccessEnabled?: () => Promise<boolean>;
      openNotificationAccessSettings?: () => Promise<void>;
      removeListeners?: (count: number) => void;
      setCurrentUserType?: (userType: string) => Promise<void>;
    }
  | undefined;

const hasSmsQueueApi =
  typeof SmsTransactionModule?.getPendingMessages === "function" &&
  typeof SmsTransactionModule?.clearPendingMessages === "function";
const hasSmsEventApi =
  typeof SmsTransactionModule?.addListener === "function" &&
  typeof SmsTransactionModule?.removeListeners === "function";

const NOTIFICATION_ACCESS_PROMPTED_KEY =
  "bank_message_notification_access_prompted";
const DUPLICATE_MESSAGE_WINDOW_MS = 7_000;

const getPendingDuplicateFingerprint = (transaction: ParsedSmsTransaction) => {
  if (transaction.source !== "sms-auto") {
    return null;
  }

  return getSmsDuplicateId(getSmsTransactionDuplicateKey(transaction));
};

export const PendingTransactionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { loading: authLoading, user, userData } = useAuth();
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const processedNativeMessagesRef = useRef<string[]>([]);
  const recentPendingMessagesRef = useRef(new Map<string, number>());
  const requestedStartupImportRef = useRef(false);
  const userTypeRef = useRef(userData?.type);

  useEffect(() => {
    userTypeRef.current = userData?.type;

    if (
      Platform.OS === "android" &&
      typeof SmsTransactionModule?.setCurrentUserType === "function"
    ) {
      SmsTransactionModule.setCurrentUserType(userData?.type || "").catch(
        (error) => {
          console.log("Native user type sync error:", error);
        },
      );
    }
  }, [userData?.type]);

  useEffect(() => {
    if (!user?.uid) {
      setPendingTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const subscription = subscribePendingTransactions(
      user.uid,
      (items) => {
        setPendingTransactions(items);
        setLoading(false);
      },
      (error) => {
        console.log("Pending transaction listener error:", error);
        setPendingTransactions([]);
        setLoading(false);
      },
    );

    return () => {
      if (typeof subscription === "function") {
        subscription();
        return;
      }

      subscription.remove?.();
    };
  }, [user?.uid]);

  const pendingDebits = useMemo(
    () => pendingTransactions.filter((item) => item.type === "expense"),
    [pendingTransactions],
  );

  const pendingCredits = useMemo(
    () => pendingTransactions.filter((item) => item.type === "income"),
    [pendingTransactions],
  );

  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "web") {
      return;
    }

    const badgeCount = user?.uid ? pendingTransactions.length : 0;

    const syncBadgeCount = async () => {
      if (Platform.OS === "web" && typeof navigator !== "undefined") {
        try {
          if ("setAppBadge" in navigator && "clearAppBadge" in navigator) {
            if (badgeCount > 0) {
              await navigator.setAppBadge(badgeCount);
            } else {
              await navigator.clearAppBadge();
            }
            return;
          }
        } catch (error) {
          console.log("Web app icon badge sync error:", error);
        }
      }

      try {
        await Notifications.setBadgeCountAsync(badgeCount);
      } catch (error) {
        console.log("Badge sync error:", error);
      }
    };

    void syncBadgeCount();
  }, [pendingTransactions.length, user?.uid]);

  const addPendingTransaction = async (transaction: ParsedSmsTransaction) => {
    if (!user?.uid) {
      return null;
    }

    const now = Date.now();
    const duplicateFingerprint = getPendingDuplicateFingerprint(transaction);
    const duplicateKey = `${user.uid}:${getSmsTransactionDuplicateKey(transaction)}`;
    const recentMessages = recentPendingMessagesRef.current;
    for (const [key, timestamp] of recentMessages) {
      if (now - timestamp > DUPLICATE_MESSAGE_WINDOW_MS) recentMessages.delete(key);
    }
    if (duplicateFingerprint && (recentMessages.has(duplicateKey) ||
        isRecentSmsDuplicate(duplicateFingerprint, pendingTransactions, now))) {
      return null;
    }
    if (duplicateFingerprint) recentMessages.set(duplicateKey, now);

    const payload = {
      ...transaction,
      duplicateKey: getSmsDuplicateId(getSmsTransactionDuplicateKey(transaction)),
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      updatedAt: Date.now(),
    };

    const id = createId();
    try {
      return await upsertPendingTransaction(user.uid, { ...payload, id }) as PendingTransaction;
    } catch (error) {
      recentMessages.delete(duplicateKey);
      throw error;
    }
  };

  const addPendingFromSms = async (
    rawMessage: string | NativeSmsMessage,
    source: "manual-paste" | "sms-auto" = "manual-paste",
  ) => {
    const parsed = await parseSmsMessage(rawMessage, source);

    if (!parsed) {
      return null;
    }

    return addPendingTransaction(parsed);
  };

  const addPendingFromSmsWithResult = async (
    rawMessage: string | NativeSmsMessage,
    source: "manual-paste" | "sms-auto" = "manual-paste",
  ): Promise<PendingSmsResult> => {
    if (!user) {
      return { pending: null, reason: "missing-user" };
    }

    const parsed = await parseSmsMessageResult(rawMessage, source);

    if (!parsed.transaction) {
      return {
        message: parsed.message,
        pending: null,
        reason: parsed.reason,
        status: parsed.status,
      };
    }

    const pending = await addPendingTransaction(parsed.transaction);

    if (!pending) {
      return { pending: null, reason: "save-skipped" };
    }

    return { pending };
  };

  const addNativeSmsMessage = async (message: string | NativeSmsMessage) => {
    const parsed = await parseSmsMessage(message, "sms-auto");

    if (!parsed) {
      return;
    }

    await addPendingTransaction(parsed);
  };

  const requestSmsPermissions = async () => {
    if (Platform.OS !== "android") {
      return true;
    }

    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);

    const hasReceiveSms =
      permissions[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const hasReadSms =
      permissions[PermissionsAndroid.PERMISSIONS.READ_SMS] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return hasReceiveSms && hasReadSms;
  };

  const requestTransactionNotificationPermission = async () => {
    if (
      Platform.OS !== "android" ||
      Number(Platform.Version) < 33 ||
      !PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    ) {
      return;
    }

    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  };

  const importNativeSmsMessages = async () => {
    if (
      Platform.OS !== "android" ||
      !SmsTransactionModule ||
      !hasSmsQueueApi ||
      !user?.uid
    ) {
      return;
    }

    await requestSmsPermissions();

    const messages = await SmsTransactionModule.getPendingMessages!();

    if (messages.length === 0) {
      return;
    }

    const alreadyProcessed = new Set(processedNativeMessagesRef.current);

    for (const message of messages) {
      const rawMessage = getNativeSmsMessageKey(message);

      if (alreadyProcessed.has(rawMessage)) {
        continue;
      }

      await addNativeSmsMessage(message);
    }

    processedNativeMessagesRef.current = [];

    await SmsTransactionModule.clearPendingMessages!();
  };

  const promptForNotificationAccess = async () => {
    if (
      Platform.OS !== "android" ||
      !SmsTransactionModule ||
      typeof SmsTransactionModule.isNotificationAccessEnabled !== "function" ||
      typeof SmsTransactionModule.openNotificationAccessSettings !==
        "function" ||
      !user
    ) {
      return;
    }

    const [isEnabled, hasPrompted] = await Promise.all([
      SmsTransactionModule.isNotificationAccessEnabled(),
      AsyncStorage.getItem(NOTIFICATION_ACCESS_PROMPTED_KEY),
    ]);

    if (isEnabled || hasPrompted === "true") {
      return;
    }

    await AsyncStorage.setItem(NOTIFICATION_ACCESS_PROMPTED_KEY, "true");

    Alert.alert(
      "Enable business message detection",
      "Expense Tracker needs Notification Access to detect bank RCS business messages in Google Messages. Other app notifications are ignored by the transaction filter.",
      [
        {
          text: "Not now",
          style: "cancel",
        },
        {
          text: "Continue",
          onPress: () => {
            SmsTransactionModule.openNotificationAccessSettings!().catch(
              (error) => {
                console.log("Notification Access settings error:", error);
              },
            );
          },
        },
      ],
    );
  };

  const refreshPendingTransactions = async () => {
    await importNativeSmsMessages();
    if (user?.uid) {
      setPendingTransactions(await listPendingTransactions(user.uid));
    }
  };

  useEffect(() => {
    if (authLoading || requestedStartupImportRef.current) {
      return;
    }

    requestedStartupImportRef.current = true;

    const timeout = setTimeout(() => {
      importNativeSmsMessages()
        .then(requestTransactionNotificationPermission)
        .then(promptForNotificationAccess)
        .catch((error) => {
          console.log("Native message setup error:", error);
        });
    }, 700);

    return () => clearTimeout(timeout);
  }, [authLoading, user?.uid]);

  useEffect(() => {
    const nativeSmsSubscription =
      Platform.OS === "android" && SmsTransactionModule && hasSmsEventApi
        ? new NativeEventEmitter(SmsTransactionModule as any).addListener(
            "SmsTransactionReceived",
            (message: string | NativeSmsMessage) => {
              const rawMessage = getNativeSmsMessageKey(message);

              if (!user?.uid) return;
              addNativeSmsMessage(message)
                .then(() => {
                  processedNativeMessagesRef.current = [
                    ...processedNativeMessagesRef.current, rawMessage,
                  ];
                })
                .catch((error) => {
                  console.log("Native SMS event import error:", error);
                });
            },
          )
        : undefined;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        importNativeSmsMessages().catch((error) => {
          console.log("Native SMS import error:", error);
        });
      }
    });

    return () => {
      nativeSmsSubscription?.remove();
      subscription.remove();
    };
  }, [user?.uid]);

  const approvePendingTransaction = async (transaction: PendingTransaction): Promise<PendingApprovalResult> => {
    if (!user?.uid || !userData) {
      throw new Error("Sign in before approving a transaction.");
    }

    if (userData.type === "salary" && isSalaryCredit(transaction)) {
      const arrivedAtMs = new Date(String(transaction.createdAt || new Date().toISOString())).getTime();
      await confirmSalaryArrivalRecord({
        userId: user.uid, profile: userData, arrivedAtMs,
        salary: transaction.amount, source: "sms-salary-arrival", skipIfConfirmed: true,
      });
      await deletePendingTransaction(user.uid, transaction.id);
      return { status: "salary-confirmed" };
    }

    const result = await saveTransactionWithSalaryValidation({
      profile: userData,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        description:
          transaction.rawMessage?.trim() || transaction.description,
        category:
          userData.type === "salary" && transaction.type === "income"
            ? "Additional Funds"
            : transaction.category,
        type: transaction.type || "expense",
        createdAt: transaction.createdAt || new Date().toISOString(),
        updatedAt: Date.now(),
        source:
          userData.type === "salary" && transaction.type === "income"
            ? "sms-additional-funds"
            : transaction.source,
      },
      userId: user.uid,
    });

    if (result.status === "saved") {
      await deletePendingTransaction(user.uid, transaction.id);
    }

    return result;
  };

  const approvePendingTransactionWithFunds = async (
    transaction: PendingTransaction,
    additionalFunds: number,
  ) => {
    if (!user?.uid || !userData) {
      throw new Error("Sign in before approving a transaction.");
    }

    const result = await saveExpenseWithAdditionalFunds({
      additionalFunds,
      category: transaction.category,
      description:
        transaction.rawMessage?.trim() || transaction.description || "",
      expenseAmount: transaction.amount,
      fundsDescription: "Additional funds for detected expense",
      profile: userData,
      transaction: {
        id: transaction.id,
        createdAt: transaction.createdAt as string | undefined,
      },
      userId: user.uid,
    });

    if (result.status === "saved") {
      await deletePendingTransaction(user.uid, transaction.id);
    }

    return result;
  };

  const ignorePendingTransaction = async (id: string) => {
    if (!user?.uid) {
      return;
    }

    await deletePendingTransaction(user.uid, id);
  };

  const updateTransaction = async (
    id: string,
    data: Partial<PendingTransactionInput>,
  ) => {
    if (!user?.uid) {
      return;
    }

    await updatePendingTransaction(user.uid, id, data);
  };

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    listPendingTransactions(user.uid)
      .then(setPendingTransactions)
      .catch((error) => {
        console.log("Pending refresh error:", error);
      });
  }, [user?.uid]);

  return (
    <PendingTransactionContext.Provider
      value={{
        addPendingFromSms,
        addPendingFromSmsWithResult,
        approvePendingTransaction,
        approvePendingTransactionWithFunds,
        ignorePendingTransaction,
        loading,
        pendingCount: pendingTransactions.length,
        pendingCredits,
        pendingDebits,
        pendingTransactions,
        refreshPendingTransactions,
        updatePendingTransaction: updateTransaction,
      }}
    >
      {children}
    </PendingTransactionContext.Provider>
  );
};

export const usePendingTransactions = () => {
  const context = useContext(PendingTransactionContext);

  if (!context) {
    throw new Error(
      "usePendingTransactions must be used inside PendingTransactionProvider",
    );
  }

  return context;
};
