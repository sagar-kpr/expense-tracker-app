import {
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
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

import { useAuth } from "@/context/AuthContext";
import { useExpense } from "@/context/ExpenseContext";
import { auth, db } from "@/firebase";
import {
  buildSalaryCycleSnapshot,
  ExpenseLike,
  getCycleTimeline,
  getCycleStartForExpenseDate,
  getExpectedCycleForDate,
  getExpenseCreatedAtDate,
  getExpensesForCycle,
  getNextSalaryCycleStart,
  getResolvedCycleBoundary,
  getSalaryArrivalCollection,
  getSalaryCycleCollection,
  getSalaryHistoryCollection,
  rebuildSalaryCycleSnapshot,
  resolveSalaryCycleSummary,
  SalaryArrivalEntry,
  SalaryCycleSnapshot,
  SalaryHistoryEntry,
  SalaryProfileLike,
} from "@/services/salaryLedger";
import { deleteDoc } from "firebase/firestore";

type SalaryProfileUpdate = Partial<{
  salary: number;
  salaryDate: number;
  source: string;
  note: string;
}>;

type SalaryContextType = {
  loading: boolean;
  salaryArrivals: SalaryArrivalEntry[];
  salaryCycleSnapshots: SalaryCycleSnapshot[];
  salaryHistory: SalaryHistoryEntry[];
  getCycleSummary: (
    cycleStart: Date,
    options?: {
      expectedCycleStart?: Date;
      preferCurrentProfile?: boolean;
      profile?: SalaryProfileLike;
      referenceDate?: Date;
    },
  ) => SalaryCycleSnapshot;
  getCurrentArrivalStatus: (
    referenceDate?: Date,
  ) => ReturnType<typeof getResolvedCycleBoundary> & {
    needsConfirmation: boolean;
  };
  getCycleTimeline: (count?: number, referenceDate?: Date) => Array<
    ReturnType<typeof getResolvedCycleBoundary>
  >;
  getCycleExpenses: (
    cycle: ReturnType<typeof getResolvedCycleBoundary>,
    items?: ExpenseLike[],
  ) => ExpenseLike[];
  rebuildCycleSnapshotForExpense: (
    expense: ExpenseLike,
    options?: { remainingExpenses?: ExpenseLike[] },
  ) => Promise<void>;
  confirmSalaryArrival: (input?: {
    arrivedAtMs?: number;
    source?: string;
  }) => Promise<void>;
  saveSalaryProfile: (updates: SalaryProfileUpdate) => Promise<void>;
};

const SalaryContext = createContext<SalaryContextType | undefined>(undefined);

const mapHistory = (item: any): SalaryHistoryEntry => ({
  id: item.id,
  salary: Number(item.data()?.salary || 0),
  salaryDate: Number(item.data()?.salaryDate || 1),
  effectiveFromMs: Number(
    item.data()?.effectiveFromMs || item.data()?.createdAtMs || Date.now(),
  ),
  createdAtMs: Number(item.data()?.createdAtMs || Date.now()),
  source: item.data()?.source,
  note: item.data()?.note,
});

const mapSnapshot = (item: any): SalaryCycleSnapshot => ({
  id: item.id,
  cycleKey: String(item.data()?.cycleKey || item.id),
  cycleStartMs: Number(item.data()?.cycleStartMs || 0),
  cycleEndMs: Number(item.data()?.cycleEndMs || 0),
  salary: Number(item.data()?.salary || 0),
  salaryDate: Number(item.data()?.salaryDate || 1),
  totalSpent: Number(item.data()?.totalSpent || 0),
  remaining: Number(item.data()?.remaining || 0),
  usagePercent: Number(item.data()?.usagePercent || 0),
  expenseCount: Number(item.data()?.expenseCount || 0),
  source: item.data()?.source,
  updatedAtMs: Number(item.data()?.updatedAtMs || Date.now()),
  createdAtMs: Number(item.data()?.createdAtMs || Date.now()),
});

const mapArrival = (item: any): SalaryArrivalEntry => ({
  id: item.id,
  arrivedAtMs: Number(item.data()?.arrivedAtMs || Date.now()),
  createdAtMs: Number(item.data()?.createdAtMs || Date.now()),
  cycleKey: String(item.data()?.cycleKey || item.id),
  expectedCycleKey: String(item.data()?.expectedCycleKey || item.id),
  salary: Number(item.data()?.salary || 0),
  salaryDate: Number(item.data()?.salaryDate || 1),
  source: item.data()?.source,
});

export function SalaryProvider({ children }: { children: ReactNode }) {
  const { userData } = useAuth();
  const { expenses } = useExpense();
  const [salaryArrivals, setSalaryArrivals] = useState<SalaryArrivalEntry[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryEntry[]>([]);
  const [salaryCycleSnapshots, setSalaryCycleSnapshots] = useState<
    SalaryCycleSnapshot[]
  >([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef("");

  useEffect(() => {
    let unsubscribeArrivals: (() => void) | undefined;
    let unsubscribeHistory: (() => void) | undefined;
    let unsubscribeSnapshots: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      unsubscribeArrivals?.();
      unsubscribeHistory?.();
      unsubscribeSnapshots?.();

      if (!user?.uid) {
        setSalaryArrivals([]);
        setSalaryHistory([]);
        setSalaryCycleSnapshots([]);
        setLoading(false);
        seededRef.current = "";
        return;
      }

      setLoading(true);

      unsubscribeArrivals = onSnapshot(
        query(getSalaryArrivalCollection(user.uid), orderBy("arrivedAtMs", "asc")),
        (snapshot) => {
          setSalaryArrivals(snapshot.docs.map(mapArrival));
          setLoading(false);
        },
        (error) => {
          console.log("Salary arrival listener error:", error);
          setSalaryArrivals([]);
          setLoading(false);
        },
      );

      unsubscribeHistory = onSnapshot(
        query(getSalaryHistoryCollection(user.uid), orderBy("createdAtMs", "asc")),
        (snapshot) => {
          setSalaryHistory(snapshot.docs.map(mapHistory));
          setLoading(false);
        },
        (error) => {
          console.log("Salary history listener error:", error);
          setSalaryHistory([]);
          setLoading(false);
        },
      );

      unsubscribeSnapshots = onSnapshot(
        query(getSalaryCycleCollection(user.uid), orderBy("cycleStartMs", "asc")),
        (snapshot) => {
          setSalaryCycleSnapshots(snapshot.docs.map(mapSnapshot));
          setLoading(false);
        },
        (error) => {
          console.log("Salary snapshot listener error:", error);
          setSalaryCycleSnapshots([]);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeArrivals?.();
      unsubscribeHistory?.();
      unsubscribeSnapshots?.();
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user?.uid || !userData || userData.type !== "salary") {
      return;
    }

    if (userData.salary == null || userData.salaryDate == null) {
      return;
    }

    if (seededRef.current === user.uid || salaryHistory.length > 0) {
      seededRef.current = user.uid;
      return;
    }

    const seedHistory = async () => {
      const existing = await getDocs(
        query(getSalaryHistoryCollection(user.uid), orderBy("createdAtMs", "asc")),
      );

      if (!existing.empty) {
        seededRef.current = user.uid;
        return;
      }

      const now = Date.now();

      await setDoc(doc(getSalaryHistoryCollection(user.uid)), {
        salary: Number(userData.salary || 0),
        salaryDate: Number(userData.salaryDate || 1),
        effectiveFromMs: now,
        createdAtMs: now,
        source: "seed",
        note: "Baseline salary history created from the current profile.",
      });

      seededRef.current = user.uid;
    };

    seedHistory().catch((error) => {
      console.log("Salary history seed error:", error);
    });
  }, [salaryHistory.length, userData]);

  const getCycleSummary: SalaryContextType["getCycleSummary"] = (
    cycleStart,
    options,
  ) =>
    resolveSalaryCycleSummary({
      profile: options?.profile || userData || {},
      referenceDate: options?.referenceDate || cycleStart,
      expectedCycleStart: options?.expectedCycleStart,
      salaryArrivals,
      salaryHistory,
      salaryCycleSnapshots,
      expenses,
      cycleStart,
      preferCurrentProfile: options?.preferCurrentProfile,
    });

  const getCurrentArrivalStatus: SalaryContextType["getCurrentArrivalStatus"] = (
    referenceDate = new Date(),
  ) => {
    const currentSalaryDate = Math.max(
      1,
      Math.floor(Number(userData?.salaryDate || 1)),
    );
    const setupAnchorMs =
      salaryHistory[0]?.createdAtMs ||
      salaryHistory[0]?.effectiveFromMs ||
      auth.currentUser?.metadata?.creationTime
        ? new Date(
            salaryHistory[0]?.createdAtMs ||
              salaryHistory[0]?.effectiveFromMs ||
              auth.currentUser?.metadata?.creationTime ||
              Date.now(),
          ).getTime()
        : Date.now();
    const setupAnchorDate = new Date(setupAnchorMs);
    const currentMonthExpectedStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      Math.min(
        currentSalaryDate,
        new Date(
          referenceDate.getFullYear(),
          referenceDate.getMonth() + 1,
          0,
        ).getDate(),
      ),
    );
    currentMonthExpectedStart.setHours(0, 0, 0, 0);
    const promptExpectedStart =
      setupAnchorDate.getTime() > currentMonthExpectedStart.getTime()
        ? getNextSalaryCycleStart(currentMonthExpectedStart, currentSalaryDate)
        : currentMonthExpectedStart;

    const boundary = getResolvedCycleBoundary({
      profile: userData || {},
      salaryArrivals,
      salaryHistory,
      cycleStart: referenceDate,
      referenceDate,
    });
    const promptBoundary = getResolvedCycleBoundary({
      profile: userData || {},
      salaryArrivals,
      salaryHistory,
      cycleStart: promptExpectedStart,
      expectedCycleStart: promptExpectedStart,
      referenceDate: promptExpectedStart,
    });

    return {
      ...boundary,
      needsConfirmation:
        referenceDate.getTime() >= promptExpectedStart.getTime() &&
        !promptBoundary.confirmed,
    };
  };

  const getTimeline: SalaryContextType["getCycleTimeline"] = (
    count = 12,
    referenceDate = new Date(),
  ) =>
    getCycleTimeline({
      count,
      profile: userData || {},
      referenceDate,
      salaryArrivals,
      salaryHistory,
    });

  const getCycleExpenses: SalaryContextType["getCycleExpenses"] = (
    cycle,
    items,
  ) => getExpensesForCycle(items || expenses, cycle.start, cycle.end);

  const rebuildCycleSnapshotForExpense: SalaryContextType["rebuildCycleSnapshotForExpense"] =
    async (expense, options) => {
      const user = auth.currentUser;

      if (!user?.uid || !userData || userData.type !== "salary") {
        return;
      }

      if ((expense.type || "expense") !== "expense") {
        return;
      }

      const expenseDate = getExpenseCreatedAtDate(expense.createdAt);

      if (!expenseDate) {
        return;
      }

      const cycleStart = getCycleStartForExpenseDate({
        expenseDate,
        profile: userData,
        salaryArrivals,
        salaryHistory,
      });
      const resolvedBoundary = getResolvedCycleBoundary({
        profile: userData,
        salaryArrivals,
        salaryHistory,
        cycleStart: expenseDate,
        referenceDate: expenseDate,
      });

      await rebuildSalaryCycleSnapshot({
        uid: user.uid,
        profile: userData,
        salaryArrivals,
        salaryHistory,
        expenses: options?.remainingExpenses || expenses,
        cycleStart,
        expectedCycleStart: resolvedBoundary.expectedStart,
        referenceDate: expenseDate,
      });
    };

  useEffect(() => {
    const user = auth.currentUser;

    if (!user?.uid || !userData || userData.type !== "salary") {
      return;
    }

    if (userData.salary == null || userData.salaryDate == null) {
      return;
    }

    const cycle = getCurrentArrivalStatus();
    const snapshot = buildSalaryCycleSnapshot({
      profile: userData,
      expectedCycleStart: cycle.expectedStart,
      referenceDate: cycle.start,
      salaryArrivals,
      salaryHistory,
      expenses,
      cycleStart: cycle.start,
      preferCurrentProfile: true,
    });

    setDoc(doc(getSalaryCycleCollection(user.uid), snapshot.cycleKey), snapshot).catch(
      (error) => {
        console.log("Salary snapshot write error:", error);
      },
    );
  }, [expenses, salaryArrivals, salaryHistory, userData]);

  const confirmSalaryArrival: SalaryContextType["confirmSalaryArrival"] = async (
    input,
  ) => {
    const user = auth.currentUser;

    if (!user?.uid || !userData) {
      return;
    }

    const arrivedAtMs = Number(input?.arrivedAtMs || Date.now());
    const arrivedAt = new Date(arrivedAtMs);
    const expectedCycle = getExpectedCycleForDate(
      userData,
      salaryHistory,
      arrivedAt,
    );
    const expectedCycleKey = `${expectedCycle.start.getFullYear()}-${String(
      expectedCycle.start.getMonth() + 1,
    ).padStart(2, "0")}-${String(expectedCycle.start.getDate()).padStart(2, "0")}`;
    const cycleKey = `${arrivedAt.getFullYear()}-${String(
      arrivedAt.getMonth() + 1,
    ).padStart(2, "0")}-${String(arrivedAt.getDate()).padStart(2, "0")}`;
    const currentExisting =
      salaryArrivals.find((item) => item.expectedCycleKey === expectedCycleKey) ||
      null;
    const now = Date.now();

    await setDoc(doc(getSalaryArrivalCollection(user.uid), expectedCycleKey), {
      arrivedAtMs,
      createdAtMs: now,
      cycleKey,
      expectedCycleKey,
      salary: Number(userData.salary || 0),
      salaryDate: Number(userData.salaryDate || 1),
      source: input?.source || "manual-confirm",
    });

    if (currentExisting && currentExisting.cycleKey !== cycleKey) {
      await deleteDoc(doc(getSalaryCycleCollection(user.uid), currentExisting.cycleKey));
    }

    const nextArrivals = [
      ...salaryArrivals.filter((item) => item.expectedCycleKey !== expectedCycleKey),
      {
        id: expectedCycleKey,
        arrivedAtMs,
        createdAtMs: now,
        cycleKey,
        expectedCycleKey,
        salary: Number(userData.salary || 0),
        salaryDate: Number(userData.salaryDate || 1),
        source: input?.source || "manual-confirm",
      },
    ];

    const currentBoundary = getResolvedCycleBoundary({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      cycleStart: arrivedAt,
      expectedCycleStart: expectedCycle.start,
      referenceDate: arrivedAt,
    });

    await rebuildSalaryCycleSnapshot({
      uid: user.uid,
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      expenses,
      cycleStart: currentBoundary.start,
      expectedCycleStart: currentBoundary.expectedStart,
      referenceDate: arrivedAt,
    });

    const previousReference = new Date(expectedCycle.start.getTime() - 1);
    const previousBoundary = getResolvedCycleBoundary({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      cycleStart: previousReference,
      referenceDate: previousReference,
    });

    await rebuildSalaryCycleSnapshot({
      uid: user.uid,
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      expenses,
      cycleStart: previousBoundary.start,
      expectedCycleStart: previousBoundary.expectedStart,
      referenceDate: previousReference,
    });
  };

  const saveSalaryProfile = async (updates: SalaryProfileUpdate) => {
    const user = auth.currentUser;

    if (!user?.uid || !userData) {
      return;
    }

    const nextSalary = Number(updates.salary ?? userData.salary ?? 0);
    const nextSalaryDate = Math.max(
      1,
      Math.floor(Number(updates.salaryDate ?? userData.salaryDate ?? 1)),
    );
    const now = Date.now();
    const profileUpdates = {
      ...(typeof updates.salary === "number" ? { salary: nextSalary } : {}),
      ...(typeof updates.salaryDate === "number"
        ? { salaryDate: nextSalaryDate }
        : {}),
    };

    await updateDoc(doc(db, "users", user.uid), profileUpdates);

    await setDoc(doc(getSalaryHistoryCollection(user.uid)), {
      salary: nextSalary,
      salaryDate: nextSalaryDate,
      effectiveFromMs: now,
      createdAtMs: now,
      source: updates.source || "salary-update",
      note: updates.note || "",
    });

    const cycle = getExpectedCycleForDate(
      {
        salary: nextSalary,
        salaryDate: nextSalaryDate,
      },
      salaryHistory,
      new Date(),
      true,
    );
    const snapshot = buildSalaryCycleSnapshot({
      profile: {
        salary: nextSalary,
        salaryDate: nextSalaryDate,
      },
      salaryHistory,
      expenses,
      cycleStart: cycle.start,
      preferCurrentProfile: true,
    });

    await setDoc(doc(getSalaryCycleCollection(user.uid), snapshot.cycleKey), snapshot);
  };

  const value = useMemo(
    () => ({
      loading,
      salaryArrivals,
      salaryCycleSnapshots,
      salaryHistory,
      getCycleSummary,
      getCurrentArrivalStatus,
      getCycleTimeline: getTimeline,
      getCycleExpenses,
      rebuildCycleSnapshotForExpense,
      confirmSalaryArrival,
      saveSalaryProfile,
    }),
    [loading, salaryArrivals, salaryCycleSnapshots, salaryHistory, expenses, userData],
  );

  return (
    <SalaryContext.Provider value={value}>{children}</SalaryContext.Provider>
  );
}

export const useSalary = () => {
  const context = useContext(SalaryContext);

  if (!context) {
    throw new Error("useSalary must be used inside SalaryProvider");
  }

  return context;
};
