import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
  AppState,
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
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
  smsDiagnostics: SmsDiagnostics;
  updatePendingTransaction: (
    id: string,
    data: Partial<PendingTransactionInput>,
  ) => Promise<void>;
};

type SmsDiagnostics = {
  cachedMessageCount: number;
  hasNativeModule: boolean;
  lastError?: string;
  lastEventAt?: string;
  lastImportAt?: string;
  lastInboxScanCount: number;
  readPermission?: boolean;
  receivePermission?: boolean;
};

const PendingTransactionContext = createContext<
  PendingTransactionContextType | undefined
>(undefined);

const SmsTransactionModule = NativeModules.SmsTransactionModule as
  | {
      addListener: (eventName: string) => void;
      clearPendingMessages: () => Promise<void>;
      getRecentInboxMessages: (limit: number) => Promise<string[]>;
      getPendingMessages: () => Promise<string[]>;
      removeListeners: (count: number) => void;
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
  const { userData } = useAuth();
  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [smsDiagnostics, setSmsDiagnostics] = useState<SmsDiagnostics>({
    cachedMessageCount: 0,
    hasNativeModule: Platform.OS === "android" && !!SmsTransactionModule,
    lastInboxScanCount: 0,
  });
  const processedNativeMessagesRef = useRef<string[]>([]);
  const seenDuplicateKeysRef = useRef<Set<string>>(new Set());
  const seenRawMessagesRef = useRef<Set<string>>(new Set());

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
          seenRawMessagesRef.current = new Set(
            snapshot.docs
              .map((item) => item.data().rawMessage)
              .filter((rawMessage): rawMessage is string =>
                Boolean(rawMessage),
              ),
          );
          seenDuplicateKeysRef.current = new Set(
            snapshot.docs
              .map((item) => item.data().duplicateKey)
              .filter((duplicateKey): duplicateKey is string =>
                Boolean(duplicateKey),
              ),
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

  const hasStoredTransaction = async (duplicateKey: string) => {
    if (seenDuplicateKeysRef.current.has(duplicateKey)) {
      return true;
    }

    const collections = getUserCollections();

    if (!collections) {
      return false;
    }

    const pendingSnapshot = await getDocs(
      query(collections.pending, where("duplicateKey", "==", duplicateKey), limit(1)),
    );

    if (!pendingSnapshot.empty) {
      seenDuplicateKeysRef.current.add(duplicateKey);
      return true;
    }

    const expensesSnapshot = await getDocs(
      query(
        collections.expenses,
        where("duplicateKey", "==", duplicateKey),
        limit(1),
      ),
    );

    if (!expensesSnapshot.empty) {
      seenDuplicateKeysRef.current.add(duplicateKey);
      return true;
    }

    return false;
  };

  const shouldStoreParsedTransaction = (transaction: ParsedSmsTransaction) => {
    if (userData?.type === "salary" && transaction.type === "income") {
      return false;
    }

    return true;
  };

  const addPendingTransaction = async (transaction: ParsedSmsTransaction) => {
    const collections = getUserCollections();

    if (!collections) {
      return null;
    }

    if (!shouldStoreParsedTransaction(transaction)) {
      return null;
    }

    if (await hasStoredTransaction(transaction.duplicateKey)) {
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

  const addNativeSmsMessage = async (rawMessage: string) => {
    if (seenRawMessagesRef.current.has(rawMessage)) {
      return;
    }

    const parsed = parseSmsMessage(rawMessage, "sms-auto");

    if (parsed) {
      seenRawMessagesRef.current.add(rawMessage);
      seenDuplicateKeysRef.current.add(parsed.duplicateKey);
      await addPendingTransaction(parsed);
      return;
    }

    seenRawMessagesRef.current.add(rawMessage);
    await addPendingTransaction(createFallbackPendingTransaction(rawMessage));
  };

  const addParsedInboxMessage = async (rawMessage: string) => {
    if (seenRawMessagesRef.current.has(rawMessage)) {
      return;
    }

    const parsed = parseSmsMessage(rawMessage, "sms-auto");

    if (!parsed) {
      return;
    }

    seenRawMessagesRef.current.add(rawMessage);
    seenDuplicateKeysRef.current.add(parsed.duplicateKey);
    await addPendingTransaction(parsed);
  };

  const createFallbackPendingTransaction = (
    rawMessage: string,
  ): ParsedSmsTransaction => ({
    amount: 100,
    category: "Other",
    description: "Unable to parse SMS. Edit details to save.",
    duplicateKey: `raw:expense:100:${rawMessage.toLowerCase().replace(/\s+/g, " ").trim()}`,
    rawMessage,
    source: "sms-auto",
    transactionDate: new Date().toISOString(),
    type: "expense",
  });

  const updateSmsPermissionDiagnostics = async () => {
    if (Platform.OS !== "android") {
      return;
    }

    const [receivePermission, readPermission] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    ]);

    setSmsDiagnostics((current) => ({
      ...current,
      hasNativeModule: !!SmsTransactionModule,
      readPermission,
      receivePermission,
    }));
  };

  const importNativeSmsMessages = async () => {
    if (Platform.OS !== "android" || !SmsTransactionModule) {
      setSmsDiagnostics((current) => ({
        ...current,
        hasNativeModule: !!SmsTransactionModule,
        lastImportAt: new Date().toISOString(),
      }));
      return;
    }

    const [receivePermission, readPermission] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    ]);
    const hasPermissions = receivePermission && readPermission;

    if (!hasPermissions) {
      setSmsDiagnostics((current) => ({
        ...current,
        hasNativeModule: true,
        lastImportAt: new Date().toISOString(),
        readPermission,
        receivePermission,
      }));
      return;
    }

    const messages = await SmsTransactionModule.getPendingMessages();
    const inboxMessages = await SmsTransactionModule.getRecentInboxMessages(25);

    const alreadyProcessed = new Set(processedNativeMessagesRef.current);

    for (const message of messages) {
      if (alreadyProcessed.has(message)) {
        continue;
      }

      await addNativeSmsMessage(message);
    }

    for (const message of inboxMessages) {
      await addParsedInboxMessage(message);
    }

    processedNativeMessagesRef.current = [];

    await SmsTransactionModule.clearPendingMessages();

    setSmsDiagnostics((current) => ({
      ...current,
      cachedMessageCount: messages.length,
      hasNativeModule: true,
      lastError: undefined,
      lastImportAt: new Date().toISOString(),
      lastInboxScanCount: inboxMessages.length,
    }));
  };

  const refreshPendingTransactions = async () => {
    try {
      await updateSmsPermissionDiagnostics();
      await importNativeSmsMessages();
    } catch (error) {
      setSmsDiagnostics((current) => ({
        ...current,
        lastError: error instanceof Error ? error.message : String(error),
      }));

      throw error;
    }
  };

  useEffect(() => {
    updateSmsPermissionDiagnostics().catch((error) => {
      console.log("Native SMS diagnostics error:", error);
    });

    importNativeSmsMessages().catch((error) => {
      setSmsDiagnostics((current) => ({
        ...current,
        lastError: error instanceof Error ? error.message : String(error),
      }));
      console.log("Native SMS import error:", error);
    });

    const nativeSmsSubscription =
      Platform.OS === "android" && SmsTransactionModule
        ? new NativeEventEmitter(SmsTransactionModule).addListener(
            "SmsTransactionReceived",
            (message: string) => {
              processedNativeMessagesRef.current = [
                ...processedNativeMessagesRef.current,
                message,
              ];
              setSmsDiagnostics((current) => ({
                ...current,
                lastEventAt: new Date().toISOString(),
              }));

              addNativeSmsMessage(message).catch((error) => {
                setSmsDiagnostics((current) => ({
                  ...current,
                  lastError:
                    error instanceof Error ? error.message : String(error),
                }));
                console.log("Native SMS event import error:", error);
              });
            },
          )
        : undefined;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        importNativeSmsMessages().catch((error) => {
          setSmsDiagnostics((current) => ({
            ...current,
            lastError: error instanceof Error ? error.message : String(error),
          }));
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
      duplicateKey: transaction.duplicateKey,
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
        smsDiagnostics,
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
