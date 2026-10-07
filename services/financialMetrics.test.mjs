import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return {
        shortCircuit: true,
        url: pathToFileURL(path.resolve(`${specifier.slice(2)}.ts`)).href,
      };
    return nextResolve(specifier, context);
  },
});
const {
  getTransactionTotals,
  getBudgetMetrics,
  getDailyBudget,
  getBusinessMetrics,
  getChangePercent,
  formatPercent,
} = await import("./financialMetrics.ts");
const { addMoney, subtractMoney, normalizeMoneyInput, getExpenseShortfall } =
  await import("./salaryMath.ts");

test("spending averages count expenses only, preserving paise and legacy string amounts", () => {
  assert.deepEqual(
    getTransactionTotals([
      { amount: "100.15" },
      { amount: 50.1, type: "expense" },
      { amount: 1000, type: "income" },
    ]),
    {
      income: 1000,
      expense: 150.25,
      incomeCount: 1,
      expenseCount: 2,
      averageIncome: 1000,
      averageExpense: 75.13,
    },
  );
});
test("overspending is reported above 100%, with negative remaining and savings", () => {
  assert.deepEqual(getBudgetMetrics(100, 150), {
    remaining: -50,
    usagePercent: 150,
    savingsPercent: -50,
  });
});
test("business losses, break-even, income-only and expense-only have truthful ratios", () => {
  assert.deepEqual(getBusinessMetrics(100, 150), {
    profit: -50,
    expenseRatio: 150,
    profitMargin: -50,
  });
  assert.deepEqual(getBusinessMetrics(100, 100), {
    profit: 0,
    expenseRatio: 100,
    profitMargin: 0,
  });
  assert.deepEqual(getBusinessMetrics(100, 0), {
    profit: 100,
    expenseRatio: 0,
    profitMargin: 100,
  });
  assert.deepEqual(getBusinessMetrics(0, 100), {
    profit: -100,
    expenseRatio: null,
    profitMargin: null,
  });
  assert.equal(formatPercent(null), "—");
});
test("change calculations handle previous losses and do not invent a percent from zero", () => {
  assert.equal(getChangePercent(50, -100), 150);
  assert.equal(getChangePercent(-50, -100), 50);
  assert.equal(getChangePercent(-150, -100), -50);
  assert.equal(getChangePercent(100, 0), null);
});
test("paise arithmetic prevents false shortfalls and rounds inputs consistently", () => {
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(subtractMoney(0.3, 0.1), 0.2);
  assert.deepEqual(
    getExpenseShortfall({ expenseAmount: 0.3, remaining: 0.3 - 0.1 - 0.2 }),
    { available: 0, shortfall: 0.3 },
  );
  assert.deepEqual(
    getExpenseShortfall({ expenseAmount: 0.3, remaining: 0.1 + 0.2 }),
    { available: 0.3, shortfall: 0 },
  );
  assert.equal(normalizeMoneyInput(1.005), 1.01);
  assert.throws(() => normalizeMoneyInput(0.001));
  assert.throws(() => normalizeMoneyInput(Infinity));
  assert.throws(() => normalizeMoneyInput(1e20));
});
test("tiny and huge percentages remain meaningful and bounded", () => {
  assert.equal(formatPercent(0.00001), "<0.1%");
  assert.equal(formatPercent(1e20), "1.0e+20%");
  assert.equal(formatPercent(150), "150%");
});

const { buildFinancialReportSummary } =
  await import("./financialReportSummary.ts");
const { buildSalaryCycleSnapshot } = await import("./salaryLedger.ts");
test("salary reports include carry-forward, new funds, and spending after an unconfirmed payday", () => {
  const profile = { type: "salary", salary: 50000, salaryDate: 7 };
  const start = new Date(2026, 8, 7),
    referenceDate = new Date(2026, 9, 9);
  const snapshot = {
    ...buildSalaryCycleSnapshot({
      profile,
      cycleStart: start,
      referenceDate: start,
    }),
    carryForward: 5000,
    availableTotal: 55000,
    remaining: 55000,
  };
  const summary = buildFinancialReportSummary({
    profile,
    referenceDate,
    salaryArrivals: [],
    salaryHistory: [],
    salaryCycleSnapshots: [snapshot],
    expenses: [
      {
        amount: 10000,
        type: "income",
        createdAt: new Date(2026, 9, 8).toISOString(),
      },
      {
        amount: 10000,
        type: "expense",
        createdAt: new Date(2026, 9, 8).toISOString(),
      },
    ],
  });
  assert.equal(summary.income, 65000);
  assert.equal(summary.spending, 10000);
  assert.equal(summary.balance, 55000);
  assert.equal(summary.salaryCycle.start.getTime(), start.getTime());
});
test("business reports retain paise and do not mix salary balances into income", () => {
  const summary = buildFinancialReportSummary({
    profile: { type: "self-employed" },
    salaryArrivals: [],
    salaryHistory: [],
    salaryCycleSnapshots: [],
    expenses: [
      { amount: "0.1", type: "income" },
      { amount: "0.2", type: "income" },
      { amount: "0.3", type: "expense" },
    ],
  });
  assert.equal(summary.income, 0.3);
  assert.equal(summary.spending, 0.3);
  assert.equal(summary.balance, 0);
});

test("daily budgets floor paise without overspending and stop estimating after payday", () => {
  assert.equal(getDailyBudget(100, 3), 33.33);
  assert.equal(getDailyBudget(0.29, 1), 0.29);
  assert.equal(getDailyBudget(0.58, 1), 0.58);
  assert.equal(getDailyBudget(0.01, 2), 0);
  assert.equal(getDailyBudget(-100, 3), 0);
  assert.equal(getDailyBudget(100, 0), null);
  assert.equal(getDailyBudget(100, -1), null);
});
