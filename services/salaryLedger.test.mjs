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
