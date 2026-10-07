import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: pathToFileURL(
          path.resolve(process.cwd(), `${specifier.slice(2)}.ts`),
        ).href,
      };
    }

    return nextResolve(specifier, context);
  },
});

const {
  buildSalaryCycleSnapshot,
  findActiveSalarySnapshot,
  getSalaryCycleKey,
  resolveSalaryCycleSummary,
} = await import("./salaryLedger.ts");

const createSnapshot = ({
  carryForward = 0,
  cycleEnd,
  cycleStart,
  remaining,
  status,
}) => ({
  id: getSalaryCycleKey(cycleStart),
  cycleKey: getSalaryCycleKey(cycleStart),
  expectedCycleKey: getSalaryCycleKey(cycleStart),
  cycleStartMs: cycleStart.getTime(),
  cycleEndMs: cycleEnd.getTime(),
  carryForward,
  salary: 50_000,
  salaryDate: 1,
  additionalFunds: 0,
  availableTotal: carryForward + 50_000,
  totalSpent: carryForward + 50_000 - remaining,
  remaining,
  usagePercent: 0,
  expenseCount: 0,
  status,
  closedAtMs: status === "closed" ? cycleEnd.getTime() : undefined,
  schemaVersion: 2,
  source: "test",
  updatedAtMs: cycleStart.getTime(),
  createdAtMs: cycleStart.getTime(),
});

test("an open cycle summary retains the stored carry forward", () => {
  const previousStart = new Date(2026, 6, 1);
  const currentStart = new Date(2026, 7, 1);
  const currentEnd = new Date(2026, 8, 1);
  const previous = createSnapshot({
    cycleStart: previousStart,
    cycleEnd: currentStart,
    remaining: 5_000,
    status: "closed",
  });
  const current = createSnapshot({
    carryForward: 5_000,
    cycleStart: currentStart,
    cycleEnd: currentEnd,
    remaining: 55_000,
    status: "open",
  });

  const summary = resolveSalaryCycleSummary({
    profile: {
      salary: 50_000,
      salaryDate: 1,
    },
    salaryCycleSnapshots: [previous, current],
    expenses: [],
    cycleStart: currentStart,
    referenceDate: new Date(2026, 7, 7),
  });

  assert.equal(summary.carryForward, 5_000);
  assert.equal(summary.availableTotal, 55_000);
  assert.equal(summary.remaining, 55_000);
});

test("an open cycle keeps additional funds until salary arrival is confirmed", () => {
  const cycleStart = new Date(2026, 6, 7);
  const scheduledEnd = new Date(2026, 7, 7);
  const openSnapshot = {
    ...createSnapshot({
      cycleStart,
      cycleEnd: scheduledEnd,
      remaining: 60_309,
      status: "open",
    }),
    expectedCycleKey: getSalaryCycleKey(cycleStart),
    salary: 60_309,
    salaryDate: 7,
    availableTotal: 60_309,
  };

  const summary = resolveSalaryCycleSummary({
    profile: {
      salary: 60_309,
      salaryDate: 7,
    },
    salaryCycleSnapshots: [openSnapshot],
    expenses: [
      {
        id: "additional-funds",
        amount: 1_300,
        createdAt: new Date(2026, 7, 6, 12).toISOString(),
        type: "income",
      },
    ],
    cycleStart,
    referenceDate: new Date(2026, 7, 7, 12, 49),
    preferCurrentProfile: true,
  });

  assert.equal(summary.cycleStartMs, cycleStart.getTime());
  assert.equal(summary.additionalFunds, 1_300);
  assert.equal(summary.availableTotal, 61_609);
  assert.equal(summary.remaining, 61_609);
});

test("snapshot rebuilding does not start a scheduled cycle before confirmation", () => {
  const cycleStart = new Date(2026, 6, 7);
  const scheduledEnd = new Date(2026, 7, 7);
  const openSnapshot = {
    ...createSnapshot({
      cycleStart,
      cycleEnd: scheduledEnd,
      remaining: 60_309,
      status: "open",
    }),
    salary: 60_309,
    salaryDate: 7,
    availableTotal: 60_309,
  };

  const rebuilt = buildSalaryCycleSnapshot({
    profile: {
      salary: 60_309,
      salaryDate: 7,
    },
    salaryCycleSnapshots: [openSnapshot],
    expenses: [
      {
        amount: 1_300,
        createdAt: new Date(2026, 7, 6, 12).toISOString(),
        type: "income",
      },
    ],
    cycleStart,
    referenceDate: new Date(2026, 7, 7, 12, 49),
  });

  assert.equal(rebuilt.cycleKey, getSalaryCycleKey(cycleStart));
  assert.equal(rebuilt.additionalFunds, 1_300);
});

test("the active boundary ignores a premature newer open snapshot", () => {
  const julyStart = new Date(2026, 6, 7);
  const augustStart = new Date(2026, 7, 7);
  const septemberStart = new Date(2026, 8, 7);
  const julySnapshot = {
    ...createSnapshot({
      cycleStart: julyStart,
      cycleEnd: augustStart,
      remaining: 547,
      status: "closed",
    }),
    salaryDate: 7,
  };
  const prematureAugustSnapshot = {
    ...createSnapshot({
      carryForward: 547,
      cycleStart: augustStart,
      cycleEnd: septemberStart,
      remaining: -556,
      status: "open",
    }),
    salaryDate: 7,
  };

  const selected = findActiveSalarySnapshot(
    [julySnapshot, prematureAugustSnapshot],
    {
      cycleKey: getSalaryCycleKey(julyStart),
      expectedCycleKey: getSalaryCycleKey(augustStart),
    },
  );

  assert.equal(selected?.cycleKey, getSalaryCycleKey(julyStart));
});

const {
  buildSalaryArrivalRollover, getCycleTimeline, getExpectedCycleForArrival,
  getResolvedCycleBoundary,
} = await import("./salaryLedger.ts");

test("late payday summary includes expenses and funds after the scheduled end", () => {
  const cycleStart = new Date(2026,8,7);
  const profile = {salary: 50000, salaryDate: 7};
  const open = buildSalaryCycleSnapshot({profile, cycleStart, referenceDate: cycleStart});
  const summary = resolveSalaryCycleSummary({profile, cycleStart, salaryCycleSnapshots: [open],
    referenceDate: new Date(2026,9,9,12), expenses: [
      {type: "expense", amount: 50000, createdAt: new Date(2026,9,8).toISOString()},
      {type: "income", amount: 1000, createdAt: new Date(2026,9,9,10).toISOString()},
    ]});
  assert.equal(summary.totalSpent, 50000);
  assert.equal(summary.additionalFunds, 1000);
  assert.equal(summary.remaining, 1000);
});

test("an early arrival belongs to the upcoming payday and preserves carry forward", () => {
  const profile = {salary: 50000, salaryDate: 7};
  const cycleStart = new Date(2026,8,7);
  const old = buildSalaryCycleSnapshot({profile, cycleStart, referenceDate: cycleStart});
  const arrivedAtMs = new Date(2026,9,5,12).getTime();
  const plan = buildSalaryArrivalRollover({profile, salaryCycleSnapshots: [old],
    arrivedAtMs, salary: 60000, now: new Date(2026,9,9).getTime(), expenses: [
      {type: "expense", amount: 49000, createdAt: new Date(2026,9,5,10).toISOString()},
      {type: "expense", amount: 2000, createdAt: new Date(2026,9,5,13).toISOString()},
    ]});
  assert.equal(plan.arrival.expectedCycleKey, "2026-10-07");
  assert.equal(plan.closedSnapshot.cycleStartMs, cycleStart.getTime());
  assert.equal(plan.closedSnapshot.remaining, 1000);
  assert.equal(plan.openSnapshot.carryForward, 1000);
  assert.equal(plan.openSnapshot.salary, 60000);
  assert.equal(plan.openSnapshot.remaining, 59000);
  assert.equal(plan.openSnapshot.totalSpent, 2000);
  const boundary = getResolvedCycleBoundary({profile, salaryArrivals: [plan.arrival],
    cycleStart: new Date(2026,9,6), referenceDate: new Date(2026,9,6)});
  assert.equal(boundary.start.getTime(), arrivedAtMs);
  const timeline = getCycleTimeline({profile, salaryArrivals: [plan.arrival], referenceDate: new Date(2026,9,6), count: 3});
  assert.equal(timeline.length, 3);
  assert.equal(new Set(timeline.map((cycle) => cycle.expectedCycleKey)).size, 3);
  assert.equal(timeline.at(-1).cycleKey, "2026-10-05");
  assert.equal(timeline.at(-2).cycleKey, "2026-09-07");
});

test("late confirmation keeps spending before the actual arrival in the previous cycle", () => {
  const profile = {salary: 50000, salaryDate: 7};
  const cycleStart = new Date(2026,8,7);
  const old = buildSalaryCycleSnapshot({profile, cycleStart, referenceDate: cycleStart});
  const arrivedAtMs = new Date(2026,9,9,12).getTime();
  const plan = buildSalaryArrivalRollover({profile, salaryCycleSnapshots: [old],
    arrivedAtMs, salary: 50000, now: arrivedAtMs, expenses: [
      {type: "expense", amount: 40000, createdAt: new Date(2026,9,8).toISOString()},
      {type: "expense", amount: 9000, createdAt: new Date(2026,9,9,10).toISOString()},
    ]});
  assert.equal(plan.closedSnapshot.totalSpent, 49000);
  assert.equal(plan.openSnapshot.availableTotal, 51000);
  const beforeArrival = new Date(2026,9,9,10);
  const boundary = getResolvedCycleBoundary({profile, salaryArrivals: [plan.arrival], cycleStart: beforeArrival, referenceDate: beforeArrival});
  assert.equal(boundary.start.getTime(), cycleStart.getTime());
  assert.equal(boundary.end.getTime(), arrivedAtMs);
});

test("expected arrival dates clamp payday 31 to the end of February", () => {
  const expected = getExpectedCycleForArrival({salary: 50000, salaryDate: 31}, [], new Date(2026,1,25));
  assert.equal(getSalaryCycleKey(expected.start), "2026-02-28");
  assert.equal(getSalaryCycleKey(expected.end), "2026-03-31");
});

test("a late-arrival snapshot stays anchored through another missed payday", () => {
  const profile = {salary: 50000, salaryDate: 7};
  const start = new Date(2026,9,9,12);
  const arrival = {id: "2026-10-07", expectedCycleKey: "2026-10-07", cycleKey: "2026-10-09", salary: 50000,
    salaryDate: 7, arrivedAtMs: start.getTime(), createdAtMs: start.getTime()};
  const open = buildSalaryCycleSnapshot({profile, salaryArrivals: [arrival], cycleStart: start,
    expectedCycleStart: new Date(2026,9,7), referenceDate: start});
  const summary = resolveSalaryCycleSummary({profile, salaryArrivals: [arrival], salaryCycleSnapshots: [open],
    cycleStart: start, referenceDate: new Date(2026,10,8), expenses: [
      {type: "expense", amount: 49000, createdAt: new Date(2026,9,20).toISOString()},
      {type: "expense", amount: 1000, createdAt: new Date(2026,10,7,12).toISOString()},
    ]});
  assert.equal(summary.cycleStartMs, start.getTime());
  assert.equal(summary.remaining, 0);
});
