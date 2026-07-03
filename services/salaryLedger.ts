import { createId } from "@/repositories/shared";

export type SalaryHistoryEntry = {
  id: string;
  salary: number;
  salaryDate: number;
  effectiveFromMs: number;
  createdAtMs: number;
  source?: string;
  note?: string;
};

export type SalaryCycleSnapshot = {
  id: string;
  cycleKey: string;
  expectedCycleKey?: string;
  cycleStartMs: number;
  cycleEndMs: number;
  salary: number;
  salaryDate: number;
  totalSpent: number;
  remaining: number;
  usagePercent: number;
  expenseCount: number;
  source?: string;
  updatedAtMs: number;
  createdAtMs: number;
};

export type SalaryProfileLike = {
  salary?: number | null;
  salaryDate?: number | null;
};

export type ExpenseLike = {
  id?: string;
  amount?: number | string | null;
  createdAt?: string | number | Date | { toDate?: () => Date } | null;
  type?: "income" | "expense" | string;
};

export type SalarySaveInput = {
  uid: string;
  profile: SalaryProfileLike;
  updates: Record<string, unknown>;
  expenses?: ExpenseLike[];
  source?: string;
  note?: string;
};

export type SalaryArrivalEntry = {
  id: string;
  arrivedAtMs: number;
  createdAtMs: number;
  cycleKey: string;
  expectedCycleKey: string;
  salary: number;
  salaryDate: number;
  source?: string;
};

export type SalarySnapshotContext = {
  profile: SalaryProfileLike;
  salaryHistory?: SalaryHistoryEntry[];
  salaryArrivals?: SalaryArrivalEntry[];
  salaryCycleSnapshots?: SalaryCycleSnapshot[];
  expenses?: ExpenseLike[];
  cycleStart: Date;
  expectedCycleStart?: Date;
  referenceDate?: Date;
  preferCurrentProfile?: boolean;
};

const getSafeCycleDate = (year: number, month: number, salaryDate: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();

  return new Date(year, month, Math.min(salaryDate, lastDay));
};

export const getCurrentSalaryCycle = (
  salaryDateValue: number,
  referenceDate = new Date(),
) => {
  const salaryDate = Math.max(1, Math.floor(Number(salaryDateValue || 1)));
  let start = getSafeCycleDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    salaryDate,
  );

  if (referenceDate < start) {
    start = getSafeCycleDate(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - 1,
      salaryDate,
    );
  }

  start.setHours(0, 0, 0, 0);

  const end = getSafeCycleDate(
    start.getFullYear(),
    start.getMonth() + 1,
    salaryDate,
  );

  end.setHours(0, 0, 0, 0);

  return { end, start };
};

export const getNextSalaryCycleStart = (
  cycleStart: Date,
  salaryDateValue: number,
) => {
  const salaryDate = Math.max(1, Math.floor(Number(salaryDateValue || 1)));
  const end = getSafeCycleDate(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    salaryDate,
  );

  end.setHours(0, 0, 0, 0);

  return end;
};

export const getSalaryCycleKey = (cycleStart: Date) => {
  const year = cycleStart.getFullYear();
  const month = `${cycleStart.getMonth() + 1}`.padStart(2, "0");
  const day = `${cycleStart.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const getSalaryCycleCollection = (uid: string) =>
  uid;

export const getSalaryHistoryCollection = (uid: string) =>
  uid;

export const getSalaryArrivalCollection = (uid: string) =>
  uid;

const toDate = (value: ExpenseLike["createdAt"] | number | string | Date) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const next = value.toDate?.();

    return next && !Number.isNaN(next.getTime()) ? next : null;
  }

  const date = new Date(value as string | number);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const getExpenseCreatedAtDate = (value: ExpenseLike["createdAt"]) =>
  toDate(value as ExpenseLike["createdAt"] | number | string | Date);

const toAmount = (value: ExpenseLike["amount"]) => Number(value || 0);

const normalizeHistory = (history: SalaryHistoryEntry[] = []) =>
  [...history].sort(
    (left, right) => left.effectiveFromMs - right.effectiveFromMs,
  );

const normalizeArrivals = (arrivals: SalaryArrivalEntry[] = []) =>
  [...arrivals].sort((left, right) => left.arrivedAtMs - right.arrivedAtMs);

const getSalaryStateForCycle = (
  profile: SalaryProfileLike,
  salaryHistory: SalaryHistoryEntry[] | undefined,
  cycleStart: Date,
  preferCurrentProfile = false,
) => {
  const currentSalary = Number(profile.salary || 0);
  const currentSalaryDate = Math.max(
    1,
    Math.floor(Number(profile.salaryDate || 1)),
  );

  if (preferCurrentProfile) {
    return {
      salary: currentSalary,
      salaryDate: currentSalaryDate,
    };
  }

  const history = normalizeHistory(salaryHistory);
  const cycleStartMs = cycleStart.getTime();
  const candidate = [...history]
    .reverse()
    .find((entry) => entry.effectiveFromMs <= cycleStartMs);

  return {
    salary: Number(candidate?.salary ?? currentSalary ?? 0),
    salaryDate: Math.max(
      1,
      Math.floor(Number((candidate?.salaryDate ?? currentSalaryDate) || 1)),
    ),
  };
};

export const getSalaryStateForDate = (
  profile: SalaryProfileLike,
  salaryHistory: SalaryHistoryEntry[] | undefined,
  referenceDate: Date,
  preferCurrentProfile = false,
) => {
  const currentSalary = Number(profile.salary || 0);
  const currentSalaryDate = Math.max(
    1,
    Math.floor(Number(profile.salaryDate || 1)),
  );

  if (preferCurrentProfile) {
    return {
      salary: currentSalary,
      salaryDate: currentSalaryDate,
    };
  }

  const history = normalizeHistory(salaryHistory);
  const referenceMs = referenceDate.getTime();
  const candidate = [...history]
    .reverse()
    .find((entry) => entry.effectiveFromMs <= referenceMs);

  return {
    salary: Number(candidate?.salary ?? currentSalary ?? 0),
    salaryDate: Math.max(
      1,
      Math.floor(Number((candidate?.salaryDate ?? currentSalaryDate) || 1)),
    ),
  };
};

export const getCycleStartForExpenseDate = ({
  expenseDate,
  profile,
  salaryHistory,
  salaryArrivals,
  preferCurrentProfile = false,
}: {
  expenseDate: Date;
  profile: SalaryProfileLike;
  salaryHistory?: SalaryHistoryEntry[];
  salaryArrivals?: SalaryArrivalEntry[];
  preferCurrentProfile?: boolean;
}) => {
  return getResolvedCycleBoundary({
    profile,
    salaryHistory,
    salaryArrivals,
    referenceDate: expenseDate,
    cycleStart: expenseDate,
    preferCurrentProfile,
  }).start;
};

export const getResolvedCycleBoundary = ({
  profile,
  salaryHistory,
  salaryArrivals,
  cycleStart,
  expectedCycleStart,
  referenceDate,
  preferCurrentProfile = false,
}: SalarySnapshotContext) => {
  const resolvedReferenceDate = referenceDate || cycleStart;
  const baseState = expectedCycleStart
    ? getSalaryStateForCycle(
        profile,
        salaryHistory,
        expectedCycleStart,
        preferCurrentProfile,
      )
    : getSalaryStateForDate(
        profile,
        salaryHistory,
        resolvedReferenceDate,
        preferCurrentProfile,
      );
  const expectedBoundary = expectedCycleStart
    ? {
        end: getNextSalaryCycleStart(expectedCycleStart, baseState.salaryDate),
        start: new Date(expectedCycleStart),
      }
    : getCurrentSalaryCycle(baseState.salaryDate, resolvedReferenceDate);
  const resolvedExpectedStart = new Date(expectedBoundary.start);
  const resolvedExpectedEnd = new Date(expectedBoundary.end);
  const resolvedExpectedKey = getSalaryCycleKey(resolvedExpectedStart);
  const nextExpectedKey = getSalaryCycleKey(resolvedExpectedEnd);
  const arrivals = normalizeArrivals(salaryArrivals);
  const currentArrival =
    arrivals.find((item) => item.expectedCycleKey === resolvedExpectedKey) ||
    null;
  const nextArrival =
    arrivals.find((item) => item.expectedCycleKey === nextExpectedKey) || null;
  const actualStart = currentArrival
    ? new Date(currentArrival.arrivedAtMs)
    : resolvedExpectedStart;
  const actualEnd = nextArrival
    ? new Date(nextArrival.arrivedAtMs)
    : resolvedExpectedEnd;

  return {
    arrival: currentArrival,
    confirmed: Boolean(currentArrival),
    cycleKey: currentArrival?.cycleKey || getSalaryCycleKey(actualStart),
    end: actualEnd,
    expectedCycleKey: resolvedExpectedKey,
    expectedEnd: resolvedExpectedEnd,
    expectedStart: resolvedExpectedStart,
    salary: baseState.salary,
    salaryDate: baseState.salaryDate,
    start: actualStart,
  };
};

export const getCycleTimeline = ({
  profile,
  salaryHistory,
  salaryArrivals,
  referenceDate = new Date(),
  count = 12,
  preferCurrentProfile = false,
}: {
  profile: SalaryProfileLike;
  salaryHistory?: SalaryHistoryEntry[];
  salaryArrivals?: SalaryArrivalEntry[];
  referenceDate?: Date;
  count?: number;
  preferCurrentProfile?: boolean;
}) => {
  const timeline: Array<
    ReturnType<typeof getResolvedCycleBoundary>
  > = [];
  let cursor = new Date(referenceDate);

  for (let index = 0; index < count; index += 1) {
    const boundary = getResolvedCycleBoundary({
      profile,
      salaryHistory,
      salaryArrivals,
      cycleStart: cursor,
      referenceDate: cursor,
      preferCurrentProfile,
    });

    timeline.unshift(boundary);

    const previousCursor = new Date(boundary.expectedStart.getTime() - 1);

    if (previousCursor.getTime() === cursor.getTime()) {
      break;
    }

    cursor = previousCursor;
  }

  return timeline;
};

const getExpenseStatsForCycle = (
  expenses: ExpenseLike[] | undefined,
  cycleStart: Date,
  cycleEnd: Date,
) => {
  const relevant = (expenses || []).filter((item) => {
    const date = toDate(item.createdAt);

    if (!date || (item.type || "expense") !== "expense") {
      return false;
    }

    return date >= cycleStart && date < cycleEnd;
  });

  const totalSpent = relevant.reduce(
    (sum, item) => sum + toAmount(item.amount),
    0,
  );

  return {
    expenseCount: relevant.length,
    totalSpent,
  };
};

export const getExpensesForCycle = (
  expenses: ExpenseLike[] | undefined,
  cycleStart: Date,
  cycleEnd: Date,
) =>
  (expenses || []).filter((item) => {
    const date = toDate(item.createdAt);

    if (!date || (item.type || "expense") !== "expense") {
      return false;
    }

    return date >= cycleStart && date < cycleEnd;
  });

export const getExpectedCycleForDate = (
  profile: SalaryProfileLike,
  salaryHistory: SalaryHistoryEntry[] | undefined,
  referenceDate: Date,
  preferCurrentProfile = false,
) => {
  const { salaryDate } = getSalaryStateForDate(
    profile,
    salaryHistory,
    referenceDate,
    preferCurrentProfile,
  );
  return getCurrentSalaryCycle(salaryDate, referenceDate);
};

export const buildSalaryCycleSnapshot = ({
  profile,
  salaryHistory,
  salaryArrivals,
  expenses,
  cycleStart,
  expectedCycleStart,
  referenceDate,
  preferCurrentProfile,
}: SalarySnapshotContext) => {
  const boundary = getResolvedCycleBoundary({
    profile,
    salaryHistory,
    salaryArrivals,
    cycleStart,
    expectedCycleStart,
    referenceDate,
    preferCurrentProfile,
  });
  const { expenseCount, totalSpent } = getExpenseStatsForCycle(
    expenses,
    boundary.start,
    boundary.end,
  );
  const remaining = boundary.salary - totalSpent;
  const usagePercent =
    boundary.salary > 0
      ? Math.round((totalSpent / boundary.salary) * 100)
      : 0;
  const now = Date.now();

  return {
    id: boundary.cycleKey,
    cycleKey: boundary.cycleKey,
    expectedCycleKey: boundary.expectedCycleKey,
    cycleStartMs: boundary.start.getTime(),
    cycleEndMs: boundary.end.getTime(),
    salary: boundary.salary,
    salaryDate: boundary.salaryDate,
    totalSpent,
    remaining,
    usagePercent,
    expenseCount,
    source: "derived",
    updatedAtMs: now,
    createdAtMs: now,
  } satisfies SalaryCycleSnapshot;
};

export const findSalarySnapshotForCycle = (
  snapshots: SalaryCycleSnapshot[] | undefined,
  cycleStart: Date,
) => {
  const cycleKey = getSalaryCycleKey(cycleStart);

  return snapshots?.find((item) => item.cycleKey === cycleKey) || null;
};

export const resolveSalaryCycleSummary = ({
  profile,
  salaryHistory,
  salaryArrivals,
  salaryCycleSnapshots,
  expenses,
  cycleStart,
  expectedCycleStart,
  referenceDate,
  preferCurrentProfile = false,
}: SalarySnapshotContext) => {
  const boundary = getResolvedCycleBoundary({
    profile,
    salaryHistory,
    salaryArrivals,
    cycleStart,
    expectedCycleStart,
    referenceDate,
    preferCurrentProfile,
  });
  const stored = findSalarySnapshotForCycle(
    salaryCycleSnapshots,
    boundary.start,
  );

  if (stored && !preferCurrentProfile) {
    return stored;
  }

  return buildSalaryCycleSnapshot({
    profile,
    salaryHistory,
    salaryArrivals,
    expenses,
    cycleStart: boundary.start,
    expectedCycleStart: boundary.expectedStart,
    referenceDate: boundary.start,
    preferCurrentProfile,
  });
};

export const appendSalaryHistoryEntry = async ({
  uid,
  profile,
  updates,
  source = "salary-update",
  note,
}: SalarySaveInput) => {
  const now = Date.now();
  const mergedProfile = {
    salary: Number(updates.salary ?? profile.salary ?? 0),
    salaryDate: Math.max(
      1,
      Math.floor(Number(updates.salaryDate ?? profile.salaryDate ?? 1)),
    ),
  };

  const { upsertSalaryHistory } = await import(
    "@/repositories/salaryRepository"
  );

  return upsertSalaryHistory(uid, {
    id: createId(),
    salary: mergedProfile.salary,
    salaryDate: mergedProfile.salaryDate,
    effectiveFromMs: now,
    createdAtMs: now,
    source,
    note: note || "",
  });
};

export const upsertSalaryCycleSnapshot = async ({
  uid,
  profile,
  salaryHistory,
  salaryArrivals,
  expenses,
  cycleStart,
  expectedCycleStart,
  referenceDate,
  preferCurrentProfile = false,
}: {
  uid: string;
  profile: SalaryProfileLike;
  salaryHistory?: SalaryHistoryEntry[];
  salaryArrivals?: SalaryArrivalEntry[];
  expenses?: ExpenseLike[];
  cycleStart: Date;
  expectedCycleStart?: Date;
  referenceDate?: Date;
  preferCurrentProfile?: boolean;
}) => {
  const snapshot = buildSalaryCycleSnapshot({
    profile,
    salaryHistory,
    salaryArrivals,
    expenses,
    cycleStart,
    expectedCycleStart,
    referenceDate,
    preferCurrentProfile,
  });
  const { upsertSalarySnapshot } = await import(
    "@/repositories/salaryRepository"
  );

  return upsertSalarySnapshot(uid, {
    ...snapshot,
    userId: uid,
  });
};

export const rebuildSalaryCycleSnapshot = async ({
  uid,
  profile,
  salaryHistory,
  salaryArrivals,
  expenses,
  cycleStart,
  expectedCycleStart,
  referenceDate,
  preferCurrentProfile = false,
}: {
  uid: string;
  profile: SalaryProfileLike;
  salaryHistory?: SalaryHistoryEntry[];
  salaryArrivals?: SalaryArrivalEntry[];
  expenses?: ExpenseLike[];
  cycleStart: Date;
  expectedCycleStart?: Date;
  referenceDate?: Date;
  preferCurrentProfile?: boolean;
}) =>
  upsertSalaryCycleSnapshot({
    uid,
    profile,
    salaryHistory,
    salaryArrivals,
    expenses,
    cycleStart,
    expectedCycleStart,
    referenceDate,
    preferCurrentProfile,
  });

export const saveSalaryProfileChange = async ({
  uid,
  profile,
  updates,
  expenses,
  source = "salary-update",
  note,
}: SalarySaveInput) => {
  const nextProfile = {
    salary: Math.floor(Number(updates.salary ?? profile.salary ?? 0)),
    salaryDate: Math.max(
      1,
      Math.floor(Number(updates.salaryDate ?? profile.salaryDate ?? 1)),
    ),
  };
  const currentCycle = getCurrentSalaryCycle(nextProfile.salaryDate);

  const { saveProfile } = await import("@/repositories/profileRepository");
  const { upsertSalaryHistory, upsertSalarySnapshot } = await import(
    "@/repositories/salaryRepository"
  );

  await saveProfile(uid, updates);

  const history = await upsertSalaryHistory(uid, {
    id: createId(),
    salary: nextProfile.salary,
    salaryDate: nextProfile.salaryDate,
    effectiveFromMs: Date.now(),
    createdAtMs: Date.now(),
    source,
    note: note || "",
  });

  const snapshot = expenses
    ? await upsertSalarySnapshot(uid, {
        ...buildSalaryCycleSnapshot({
          profile: nextProfile,
          salaryHistory: [history],
          expenses,
          cycleStart: currentCycle.start,
          preferCurrentProfile: true,
        }),
        userId: uid,
      })
    : null;

  return {
    history,
    snapshot,
  };
};

export const seedSalaryHistoryIfMissing = async ({
  uid,
  profile,
  expenses,
}: {
  uid: string;
  profile: SalaryProfileLike;
  expenses?: ExpenseLike[];
}) => {
  const { listSalaryHistory, upsertSalarySnapshot } = await import(
    "@/repositories/salaryRepository"
  );
  const existing = await listSalaryHistory(uid);

  if (existing.length > 0) {
    return null;
  }

  const seededHistory = await appendSalaryHistoryEntry({
    uid,
    profile,
    updates: {
      salary: profile.salary ?? 0,
      salaryDate: profile.salaryDate ?? 1,
    },
    source: "seed",
    note: "Baseline salary history created from the current profile.",
  });

  const snapshot = expenses
    ? await upsertSalarySnapshot(uid, {
        ...buildSalaryCycleSnapshot({
          profile,
          salaryHistory: [seededHistory],
          expenses,
          cycleStart: getCurrentSalaryCycle(Number(profile.salaryDate || 1))
            .start,
          preferCurrentProfile: true,
        }),
        userId: uid,
      })
    : null;

  return {
    history: seededHistory,
    snapshot,
  };
};
