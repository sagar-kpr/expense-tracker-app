import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSalaryCycleTotals,
  getExpenseShortfall,
  normalizeCarryForward,
} from "./salaryMath.ts";

test("combines carry forward, salary, and additional funds", () => {
  assert.deepEqual(
    calculateSalaryCycleTotals({
      carryForward: 5_000,
      salary: 50_000,
      additionalFunds: 2_500,
      totalSpent: 20_000,
    }),
    {
      availableTotal: 57_500,
      remaining: 37_500,
      usagePercent: 35,
    },
  );
});

test("a new cycle resets additional funds without losing carry forward", () => {
  assert.equal(
    calculateSalaryCycleTotals({
      carryForward: 7_500,
      salary: 50_000,
      additionalFunds: 0,
      totalSpent: 0,
    }).availableTotal,
    57_500,
  );
});

test("an exact-balance expense has no shortfall", () => {
  assert.deepEqual(
    getExpenseShortfall({ expenseAmount: 1_250, remaining: 1_250 }),
    { available: 1_250, shortfall: 0 },
  );
});

test("an oversized expense reports the exact shortfall", () => {
  assert.deepEqual(
    getExpenseShortfall({ expenseAmount: 1_500, remaining: 1_250 }),
    { available: 1_250, shortfall: 250 },
  );
});

test("legacy negative closing balances do not carry forward", () => {
  assert.equal(normalizeCarryForward(-900), 0);
  assert.equal(normalizeCarryForward(900), 900);
});
