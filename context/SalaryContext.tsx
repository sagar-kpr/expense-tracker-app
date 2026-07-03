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
import {
  deleteSalarySnapshot,
  subscribeSalaryRecords,
  upsertSalaryArrival,
  upsertSalaryHistory,
  upsertSalarySnapshot,
  type SalaryArrivalEntry,
  type SalaryCycleSnapshot,
  type SalaryHistoryEntry,
} from "@/repositories/salaryRepository";
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
  resolveSalaryCycleSummary,
  SalaryProfileLike,
} from "@/services/salaryLedger";
import { saveProfile } from "@/repositories/profileRepository";
import { createId } from "@/repositories/shared";

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
  userId: item.userId,
  salary: Number(item.salary || 0),
  salaryDate: Number(item.salaryDate || 1),
  effectiveFromMs: Number(item.effectiveFromMs || item.createdAtMs || Date.now()),
  createdAtMs: Number(item.createdAtMs || Date.now()),
  source: item.source,
  note: item.note,
});

const mapSnapshot = (item: any): SalaryCycleSnapshot => ({
  id: item.id,
  userId: item.userId,
  cycleKey: String(item.cycleKey || item.id),
  cycleStartMs: Number(item.cycleStartMs || 0),
  cycleEndMs: Number(item.cycleEndMs || 0),
  salary: Number(item.salary || 0),
  salaryDate: Number(item.salaryDate || 1),
  totalSpent: Number(item.totalSpent || 0),
  remaining: Number(item.remaining || 0),
  usagePercent: Number(item.usagePercent || 0),
  expenseCount: Number(item.expenseCount || 0),
  source: item.source,
  updatedAtMs: Number(item.updatedAtMs || Date.now()),
  createdAtMs: Number(item.createdAtMs || Date.now()),
});

const mapArrival = (item: any): SalaryArrivalEntry => ({
  id: item.id,
  userId: item.userId,
  arrivedAtMs: Number(item.arrivedAtMs || Date.now()),
  createdAtMs: Number(item.createdAtMs || Date.now()),
  cycleKey: String(item.cycleKey || item.id),
  expectedCycleKey: String(item.expectedCycleKey || item.id),
  salary: Number(item.salary || 0),
  salaryDate: Number(item.salaryDate || 1),
  source: item.source,
});

export function SalaryProvider({ children }: { children: ReactNode }) {
  const { user, userData } = useAuth();
  const { expenses } = useExpense();
  const [salaryArrivals, setSalaryArrivals] = useState<SalaryArrivalEntry[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryEntry[]>([]);
  const [salaryCycleSnapshots, setSalaryCycleSnapshots] = useState<
    SalaryCycleSnapshot[]
  >([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef("");

  useEffect(() => {
    if (!user?.uid) {
      setSalaryArrivals([]);
      setSalaryHistory([]);
      setSalaryCycleSnapshots([]);
      setLoading(false);
      seededRef.current = "";
      return;
    }

    setLoading(true);

    const subscription = subscribeSalaryRecords(
      user.uid,
      ({ arrivals, history, snapshots }) => {
        setSalaryArrivals(arrivals.map(mapArrival));
        setSalaryHistory(history.map(mapHistory));
        setSalaryCycleSnapshots(snapshots.map(mapSnapshot));
        setLoading(false);
      },
      (error) => {
        console.log("Salary listener error:", error);
        setLoading(false);
      },
    );

    return () => {
      subscription.remove?.();
    };
  }, [user?.uid]);

  useEffect(() => {
    const currentUser = user;

    if (!currentUser?.uid || !userData || userData.type !== "salary") {
      return;
    }

    if (userData.salary == null || userData.salaryDate == null) {
      return;
    }

    if (seededRef.current === currentUser.uid || salaryHistory.length > 0) {
      seededRef.current = currentUser.uid;
      return;
    }

    const seedHistory = async () => {
      const now = Date.now();
      const seeded = await upsertSalaryHistory(currentUser.uid, {
        id: createId(),
        salary: Number(userData.salary || 0),
        salaryDate: Number(userData.salaryDate || 1),
        effectiveFromMs: now,
        createdAtMs: now,
        source: "seed",
        note: "Baseline salary history created from the current profile.",
      });

      seededRef.current = currentUser.uid;
      return seeded;
    };

    seedHistory().catch((error) => {
      console.log("Salary history seed error:", error);
    });
  }, [salaryHistory.length, userData, user?.uid]);

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
      user?.metadata?.creationTime
        ? new Date(
            salaryHistory[0]?.createdAtMs ||
              salaryHistory[0]?.effectiveFromMs ||
              user?.metadata?.creationTime ||
              Date.now(),
          ).getTime()
        : Date.now();
    const setupAnchorDate = new Date(setupAnchorMs);
    const currentMonthExpectedStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      Math.min(
        currentSalaryDate,
        new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate(),
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
        salaryHistory,
        salaryArrivals,
      });
      const resolvedBoundary = getResolvedCycleBoundary({
        profile: userData,
        salaryArrivals,
        salaryHistory,
        cycleStart: expenseDate,
        referenceDate: expenseDate,
      });

      await upsertSalarySnapshot(user.uid, {
        ...(buildSalaryCycleSnapshot({
          profile: userData,
          salaryArrivals,
          salaryHistory,
          expenses: options?.remainingExpenses || expenses,
          cycleStart,
          expectedCycleStart: resolvedBoundary.expectedStart,
          referenceDate: expenseDate,
        }) as any),
        userId: user.uid,
      });
    };

  const confirmSalaryArrival: SalaryContextType["confirmSalaryArrival"] = async (
    input,
  ) => {
    if (!user?.uid || !userData || userData.salary == null || userData.salaryDate == null) {
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
    const now = Date.now();
    const existingArrival =
      salaryArrivals.find((item) => item.expectedCycleKey === expectedCycleKey) ||
      null;

    await upsertSalaryArrival(user.uid, {
      id: expectedCycleKey,
      arrivedAtMs,
      createdAtMs: existingArrival?.createdAtMs || now,
      cycleKey,
      expectedCycleKey,
      salary: Number(userData.salary || 0),
      salaryDate: Number(userData.salaryDate || 1),
      source: input?.source || "manual-confirm",
    });

    if (existingArrival && existingArrival.cycleKey !== cycleKey) {
      await deleteSalarySnapshot(user.uid, existingArrival.cycleKey);
    }

    const nextArrivalRecord: SalaryArrivalEntry = {
      id: expectedCycleKey,
      userId: user.uid,
      arrivedAtMs,
      createdAtMs: existingArrival?.createdAtMs || now,
      cycleKey,
      expectedCycleKey,
      salary: Number(userData.salary || 0),
      salaryDate: Number(userData.salaryDate || 1),
      source: input?.source || "manual-confirm",
    };

    const nextArrivals: SalaryArrivalEntry[] = [
      ...salaryArrivals.filter((item) => item.expectedCycleKey !== expectedCycleKey),
      nextArrivalRecord,
    ];

    const currentBoundary = getResolvedCycleBoundary({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      cycleStart: arrivedAt,
      expectedCycleStart: expectedCycle.start,
      referenceDate: arrivedAt,
    });

    await upsertSalarySnapshot(
      user.uid,
      {
        ...(buildSalaryCycleSnapshot({
          profile: userData,
          salaryArrivals: nextArrivals,
          salaryHistory,
          expenses,
          cycleStart: currentBoundary.start,
          expectedCycleStart: currentBoundary.expectedStart,
          referenceDate: arrivedAt,
        }) as any),
        userId: user.uid,
      },
    );

    const previousReference = new Date(expectedCycle.start.getTime() - 1);
    const previousBoundary = getResolvedCycleBoundary({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      cycleStart: previousReference,
      referenceDate: previousReference,
    });

    await upsertSalarySnapshot(
      user.uid,
      {
        ...(buildSalaryCycleSnapshot({
          profile: userData,
          salaryArrivals: nextArrivals,
          salaryHistory,
          expenses,
          cycleStart: previousBoundary.start,
          expectedCycleStart: previousBoundary.expectedStart,
          referenceDate: previousReference,
        }) as any),
        userId: user.uid,
      },
    );
  };

  const saveSalaryProfile = async (updates: SalaryProfileUpdate) => {
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
      onboarding: true,
    };

    await saveProfile(user.uid, profileUpdates);

    const historyEntry = {
      id: createId(),
      salary: nextSalary,
      salaryDate: nextSalaryDate,
      effectiveFromMs: now,
      createdAtMs: now,
      source: updates.source || "salary-update",
      note: updates.note || "",
    };

    await upsertSalaryHistory(user.uid, historyEntry);

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
      salaryHistory: [...salaryHistory, historyEntry],
      salaryArrivals,
      expenses,
      cycleStart: cycle.start,
      expectedCycleStart: cycle.start,
      preferCurrentProfile: true,
    });

    await upsertSalarySnapshot(user.uid, {
      ...(snapshot as any),
      userId: user.uid,
    });
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
