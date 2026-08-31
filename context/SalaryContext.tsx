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
  commitSalaryCycleRollover,
  deleteSalarySnapshot,
  subscribeSalaryRecords,
  upsertSalaryHistory,
  upsertSalarySnapshot,
  type SalaryArrivalEntry,
  type SalaryCycleSnapshot,
  type SalaryHistoryEntry,
} from "@/repositories/salaryRepository";
import {
  buildSalaryCycleSnapshot,
  ExpenseLike,
  findActiveSalarySnapshot,
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
    salary?: number;
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
  carryForward: Number(item.carryForward || 0),
  salary: Number(item.salary || 0),
  salaryDate: Number(item.salaryDate || 1),
  additionalFunds: Number(item.additionalFunds || 0),
  availableTotal: Number(
    item.availableTotal ||
      Number(item.carryForward || 0) +
        Number(item.salary || 0) +
        Number(item.additionalFunds || 0),
  ),
  totalSpent: Number(item.totalSpent || 0),
  remaining: Number(item.remaining || 0),
  usagePercent: Number(item.usagePercent || 0),
  expenseCount: Number(item.expenseCount || 0),
  status: item.status === "closed" ? "closed" : "open",
  closedAtMs:
    item.closedAtMs == null ? undefined : Number(item.closedAtMs),
  schemaVersion: Number(item.schemaVersion || 1),
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
  const migratedCycleRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.uid) {
      setSalaryArrivals([]);
      setSalaryHistory([]);
      setSalaryCycleSnapshots([]);
      setLoading(false);
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
    const previousReference = new Date(promptExpectedStart.getTime() - 1);
    const previousBoundary = getResolvedCycleBoundary({
      profile: userData || {},
      salaryArrivals,
      salaryHistory,
      cycleStart: previousReference,
      referenceDate: previousReference,
    });
    const needsConfirmation =
      referenceDate.getTime() >= promptExpectedStart.getTime() &&
      !promptBoundary.confirmed;
    const activeBoundary = needsConfirmation
      ? {
          ...previousBoundary,
          end: referenceDate,
        }
      : boundary;
    const openSnapshot = findActiveSalarySnapshot(
      salaryCycleSnapshots,
      activeBoundary,
    );
    const persistedActiveBoundary = openSnapshot
      ? {
          ...activeBoundary,
          cycleKey: openSnapshot.cycleKey,
          end: needsConfirmation
            ? referenceDate
            : new Date(openSnapshot.cycleEndMs),
          salary: openSnapshot.salary,
          salaryDate: openSnapshot.salaryDate,
          start: new Date(openSnapshot.cycleStartMs),
        }
      : activeBoundary;

    return {
      ...persistedActiveBoundary,
      confirmed: promptBoundary.confirmed,
      arrival: promptBoundary.arrival,
      expectedCycleKey: promptBoundary.expectedCycleKey,
      expectedEnd: promptBoundary.expectedEnd,
      expectedStart: promptBoundary.expectedStart,
      needsConfirmation,
    };
  };

  useEffect(() => {
    if (
      loading ||
      !user?.uid ||
      !userData ||
      userData.type !== "salary"
    ) {
      return;
    }

    const arrivalStatus = getCurrentArrivalStatus();

    if (!arrivalStatus.needsConfirmation) {
      return;
    }

    const activeSnapshot = findActiveSalarySnapshot(
      salaryCycleSnapshots,
      arrivalStatus,
    );
    const prematureSnapshot = salaryCycleSnapshots
      .filter(
        (item) =>
          item.expectedCycleKey === arrivalStatus.expectedCycleKey &&
          item.cycleKey !== activeSnapshot?.cycleKey &&
          !salaryArrivals.some(
            (arrival) =>
              arrival.expectedCycleKey === item.expectedCycleKey,
          ),
      )
      .sort((left, right) => right.cycleStartMs - left.cycleStartMs)[0];

    if (!activeSnapshot || !prematureSnapshot) {
      return;
    }

    const repairKey = `${activeSnapshot.cycleKey}:${prematureSnapshot.cycleKey}`;

    if (migratedCycleRef.current === repairKey) {
      return;
    }

    migratedCycleRef.current = repairKey;

    upsertSalarySnapshot(user.uid, {
      ...activeSnapshot,
      status: "open",
      closedAtMs: undefined,
      updatedAtMs: Date.now(),
      source: "salary-cycle-pending-confirmation-repair",
      userId: user.uid,
    })
      .then(() => deleteSalarySnapshot(user.uid, prematureSnapshot.id))
      .catch((error) => {
        migratedCycleRef.current = null;
        console.log("Salary cycle pending-confirmation repair error:", error);
      });
  }, [
    getCurrentArrivalStatus,
    loading,
    salaryArrivals,
    salaryCycleSnapshots,
    user?.uid,
    userData,
  ]);

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

      const expenseDate = getExpenseCreatedAtDate(expense.createdAt);

      if (!expenseDate) {
        return;
      }

      const activeBoundary = getCurrentArrivalStatus(expenseDate);
      const openSnapshot = findActiveSalarySnapshot(
        salaryCycleSnapshots,
        activeBoundary,
      );
      const cycleStart =
        openSnapshot && expenseDate >= new Date(openSnapshot.cycleStartMs)
          ? new Date(openSnapshot.cycleStartMs)
          : getCycleStartForExpenseDate({
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
          salaryCycleSnapshots,
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
    const confirmedSalary = Math.floor(
      Number(input?.salary ?? userData.salary ?? 0),
    );

    if (!Number.isFinite(confirmedSalary) || confirmedSalary <= 0) {
      throw new Error("Enter a valid salary amount.");
    }
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

    const nextArrivalRecord: SalaryArrivalEntry = {
      id: expectedCycleKey,
      userId: user.uid,
      arrivedAtMs,
      createdAtMs: existingArrival?.createdAtMs || now,
      cycleKey,
      expectedCycleKey,
      salary: confirmedSalary,
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

    const previousReference = new Date(expectedCycle.start.getTime() - 1);
    const previousBoundary = getResolvedCycleBoundary({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      cycleStart: previousReference,
      referenceDate: previousReference,
    });

    const previousSnapshot = buildSalaryCycleSnapshot({
      profile: userData,
      salaryArrivals: nextArrivals,
      salaryHistory,
      salaryCycleSnapshots,
      expenses,
      cycleStart: previousBoundary.start,
      expectedCycleStart: previousBoundary.expectedStart,
      referenceDate: previousReference,
    });
    const closedPreviousSnapshot = {
      ...previousSnapshot,
      status: "closed" as const,
      closedAtMs: arrivedAtMs,
      cycleEndMs: arrivedAtMs,
      updatedAtMs: Date.now(),
    };

    const currentSnapshot = buildSalaryCycleSnapshot({
      profile: {
        ...userData,
        salary: confirmedSalary,
      },
      salaryArrivals: nextArrivals,
      salaryHistory,
      salaryCycleSnapshots: [
        ...salaryCycleSnapshots.filter(
          (item) => item.cycleKey !== closedPreviousSnapshot.cycleKey,
        ),
        closedPreviousSnapshot,
      ],
      expenses,
      cycleStart: currentBoundary.start,
      expectedCycleStart: currentBoundary.expectedStart,
      referenceDate: arrivedAt,
      preferCurrentProfile: true,
    });

    const openCurrentSnapshot = {
      ...currentSnapshot,
      carryForward: Math.max(closedPreviousSnapshot.remaining, 0),
      salary: confirmedSalary,
      availableTotal:
        Math.max(closedPreviousSnapshot.remaining, 0) +
        confirmedSalary +
        currentSnapshot.additionalFunds,
      remaining:
        Math.max(closedPreviousSnapshot.remaining, 0) +
        confirmedSalary +
        currentSnapshot.additionalFunds -
        currentSnapshot.totalSpent,
      status: "open" as const,
      closedAtMs: undefined,
      source: input?.source || "salary-arrival",
    };

    await commitSalaryCycleRollover(user.uid, {
      arrival: nextArrivalRecord,
      closedSnapshot: closedPreviousSnapshot,
      deleteSnapshotId:
        existingArrival && existingArrival.cycleKey !== cycleKey
          ? existingArrival.cycleKey
          : undefined,
      openSnapshot: openCurrentSnapshot,
    });

    if (confirmedSalary !== Number(userData.salary || 0)) {
      await saveProfile(user.uid, { salary: confirmedSalary });
    }
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
  };

  useEffect(() => {
    if (
      loading ||
      !user?.uid ||
      !userData ||
      userData.type !== "salary"
    ) {
      return;
    }

    const openSnapshot = [...salaryCycleSnapshots]
      .filter((item) => item.status === "open")
      .sort((left, right) => right.cycleStartMs - left.cycleStartMs)[0];

    if (
      !openSnapshot ||
      openSnapshot.schemaVersion >= 2 ||
      migratedCycleRef.current === openSnapshot.cycleKey
    ) {
      return;
    }

    migratedCycleRef.current = openSnapshot.cycleKey;

    const upgraded = buildSalaryCycleSnapshot({
      profile: userData,
      salaryArrivals,
      salaryHistory,
      salaryCycleSnapshots,
      expenses,
      cycleStart: new Date(openSnapshot.cycleStartMs),
      referenceDate: new Date(),
    });
    const previousSnapshot = [...salaryCycleSnapshots]
      .filter((item) => item.cycleStartMs < openSnapshot.cycleStartMs)
      .sort((left, right) => right.cycleStartMs - left.cycleStartMs)[0];
    const carryForward = previousSnapshot
      ? Math.max(previousSnapshot.remaining, 0)
      : 0;

    upsertSalarySnapshot(user.uid, {
      ...upgraded,
      carryForward,
      availableTotal:
        carryForward + upgraded.salary + upgraded.additionalFunds,
      remaining:
        carryForward +
        upgraded.salary +
        upgraded.additionalFunds -
        upgraded.totalSpent,
      schemaVersion: 2,
      status: "open",
      source: "salary-cycle-v2-migration",
      userId: user.uid,
    }).catch((error) => {
      migratedCycleRef.current = null;
      console.log("Salary cycle migration error:", error);
    });
  }, [
    expenses,
    loading,
    salaryArrivals,
    salaryCycleSnapshots,
    salaryHistory,
    user?.uid,
    userData,
  ]);

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
