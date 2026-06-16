import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
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

import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/firebase";
import {
  getSmsDuplicateId,
  getSmsDuplicateKey,
  parseSmsMessageResult,
  ParsedSmsTransaction,
  parseSmsMessage,
  NativeSmsMessage,
} from "@/utils/smsParser";

export type PendingTransaction = ParsedSmsTransaction & {
  id: string;
  createdAt?: unknown;
  status?: "pending";
};

type PendingTransactionInput = Omit<PendingTransaction, "id">;
type PendingSmsResult =
  | {
      pending: PendingTransaction;
    }
  | {
      pending: null;
      reason:
        | "ai-rejected"
        | "missing-amount"
        | "missing-auth"
        | "missing-keyword"
        | "missing-user"
        | "missing-worker-url"
        | "network-error"
        | "save-skipped"
        | "worker-error";
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
  approvePendingTransaction: (transaction: PendingTransaction) => Promise<void>;
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

const getUserCollections = () => {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  return {
    expenses: collection(db, "users", user.uid, "expenses"),
    pending: collection(db, "users", user.uid, "pendingTransactions"),
  };
};

const getPendingDuplicateId = (transaction: ParsedSmsTransaction) => {
  if (transaction.source !== "sms-auto") {
    return null;
  }

  return getSmsDuplicateId(transaction.rawMessage);
};

export const PendingTransactionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { loading: authLoading, userData } = useAuth();
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);

  const [loading, setLoading] = useState(true);
  const processedNativeMessagesRef = useRef<string[]>([]);
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
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      if (!user?.uid) {
        setPendingTransactions([]);

        setLoading(false);

        return;
      }

      setLoading(true);

      const pendingQuery = query(
        collection(db, "users", user.uid, "pendingTransactions"),
        orderBy("createdAt", "desc"),
      );

      unsubscribeSnapshot = onSnapshot(
        pendingQuery,
        (snapshot) => {
          setPendingTransactions(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as PendingTransaction[],
          );

          setLoading(false);
        },
        (error) => {
          console.log("Pending transaction listener error:", error);

          setPendingTransactions([]);

          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeAuth();

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const pendingDebits = useMemo(
    () => pendingTransactions.filter((item) => item.type === "expense"),
    [pendingTransactions],
  );

  const pendingCredits = useMemo(
    () => pendingTransactions.filter((item) => item.type === "income"),
    [pendingTransactions],
  );

  const addPendingTransaction = async (transaction: ParsedSmsTransaction) => {
    const collections = getUserCollections();

    if (!collections) {
      return null;
    }

    if (
      userTypeRef.current === "salary" &&
      transaction.source === "sms-auto" &&
      transaction.type === "income"
    ) {
      return null;
    }

    const duplicateId = getPendingDuplicateId(transaction);
    const payload = {
      ...transaction,
      duplicateKey:
        transaction.duplicateKey || getSmsDuplicateKey(transaction.rawMessage),
      createdAt: serverTimestamp(),
      status: "pending",
    };

    if (duplicateId) {
      const docRef = doc(collections.pending, duplicateId);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        return {
          id: docRef.id,
          ...(existing.data() as PendingTransactionInput),
        } as PendingTransaction;
      }

      await setDoc(docRef, payload);

      return {
        ...transaction,
        id: docRef.id,
        status: "pending" as const,
      };
    }

    const docRef = await addDoc(collections.pending, payload);

    return {
      ...transaction,
      id: docRef.id,
      status: "pending" as const,
    };
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
    if (!auth.currentUser) {
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
      !hasSmsQueueApi
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
      const rawMessage =
        typeof message === "string"
          ? message
          : String(message.body || message.message || "");

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
      !auth.currentUser
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
  }, [authLoading]);

  useEffect(() => {
    const nativeSmsSubscription =
      Platform.OS === "android" && SmsTransactionModule && hasSmsEventApi
        ? new NativeEventEmitter(SmsTransactionModule as any).addListener(
            "SmsTransactionReceived",
            (message: string | NativeSmsMessage) => {
              const rawMessage =
                typeof message === "string"
                  ? message
                  : String(message.body || message.message || "");

              processedNativeMessagesRef.current = [
                ...processedNativeMessagesRef.current,
                rawMessage,
              ];

              addNativeSmsMessage(message).catch((error) => {
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
  }, []);

  const approvePendingTransaction = async (transaction: PendingTransaction) => {
    const collections = getUserCollections();

    if (!collections) {
      return;
    }

    await addDoc(collections.expenses, {
      amount: Number(transaction.amount),
      category: transaction.category,
      createdAt: transaction.transactionDate || new Date().toISOString(),
      description: transaction.description,
      source: transaction.source,
      type: transaction.type,
    });

    await deleteDoc(doc(collections.pending, transaction.id));
  };

  const ignorePendingTransaction = async (id: string) => {
    const collections = getUserCollections();

    if (!collections) {
      return;
    }

    await deleteDoc(doc(collections.pending, id));
  };

  const updatePendingTransaction = async (
    id: string,
    data: Partial<PendingTransactionInput>,
  ) => {
    const collections = getUserCollections();

    if (!collections) {
      return;
    }

    await updateDoc(doc(collections.pending, id), data);
  };

  return (
    <PendingTransactionContext.Provider
      value={{
        addPendingFromSms,
        addPendingFromSmsWithResult,
        approvePendingTransaction,
        ignorePendingTransaction,
        loading,
        pendingCount: pendingTransactions.length,
        pendingCredits,
        pendingDebits,
        pendingTransactions,
        refreshPendingTransactions,
        updatePendingTransaction,
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
