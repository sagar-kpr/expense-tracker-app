import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppState,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";

import { auth, db } from "@/firebase";
import { ParsedSmsTransaction, parseSmsMessage } from "@/utils/smsParser";

export type PendingTransaction = ParsedSmsTransaction & {
  id: string;
  createdAt?: unknown;
  status?: "pending";
};

type PendingTransactionInput = Omit<PendingTransaction, "id">;

type PendingTransactionContextType = {
  addPendingFromSms: (
    rawMessage: string,
    source?: "manual-paste" | "sms-auto",
  ) => Promise<PendingTransaction | null>;
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
      clearPendingMessages: () => Promise<void>;
      getPendingMessages: () => Promise<string[]>;
    }
  | undefined;

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

export const PendingTransactionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);

  const [loading, setLoading] = useState(true);

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

    const docRef = await addDoc(collections.pending, {
      ...transaction,
      createdAt: serverTimestamp(),
      status: "pending",
    });

    return {
      ...transaction,
      id: docRef.id,
      status: "pending" as const,
    };
  };

  const addPendingFromSms = async (
    rawMessage: string,
    source: "manual-paste" | "sms-auto" = "manual-paste",
  ) => {
    const parsed = parseSmsMessage(rawMessage, source);

    if (!parsed) {
      return null;
    }

    return addPendingTransaction(parsed);
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

  const importNativeSmsMessages = async () => {
    const hasPermissions = await requestSmsPermissions();

    if (!hasPermissions || Platform.OS !== "android" || !SmsTransactionModule) {
      return;
    }

    const messages = await SmsTransactionModule.getPendingMessages();

    if (messages.length === 0) {
      return;
    }

    for (const message of messages) {
      const parsed = parseSmsMessage(message, "sms-auto");

      if (parsed) {
        await addPendingTransaction(parsed);
      }
    }

    await SmsTransactionModule.clearPendingMessages();
  };

  const refreshPendingTransactions = async () => {
    await importNativeSmsMessages();
  };

  useEffect(() => {
    importNativeSmsMessages().catch((error) => {
      console.log("Native SMS import error:", error);
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        importNativeSmsMessages().catch((error) => {
          console.log("Native SMS import error:", error);
        });
      }
    });

    return () => {
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
