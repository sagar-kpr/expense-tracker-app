import { addMoney, roundMoney, subtractMoney } from "@/services/salaryMath";

type Transaction = { amount?: number | string | null; type?: string };
export const getTransactionTotals = (items: Transaction[]) => {
  let income = 0,
    expense = 0,
    incomeCount = 0,
    expenseCount = 0;
  for (const item of items) {
    const amount = Number(item.amount || 0);
    if (!Number.isFinite(amount)) continue;
    if (item.type === "income") {
      income = addMoney(income, amount);
      incomeCount++;
    } else {
      expense = addMoney(expense, amount);
      expenseCount++;
    }
  }
  return {
    income,
    expense,
    incomeCount,
    expenseCount,
    averageIncome: incomeCount ? roundMoney(income / incomeCount) : 0,
    averageExpense: expenseCount ? roundMoney(expense / expenseCount) : 0,
  };
};
export const getBudgetMetrics = (available: number, spent: number) => {
  const remaining = subtractMoney(available, spent);
  return {
    remaining,
    usagePercent:
      available > 0 ? (spent / available) * 100 : spent > 0 ? null : 0,
    savingsPercent: available > 0 ? (remaining / available) * 100 : null,
  };
};
export const getBusinessMetrics = (income: number, expense: number) => {
  const profit = subtractMoney(income, expense);
  return {
    profit,
    expenseRatio:
      income > 0 ? (expense / income) * 100 : expense > 0 ? null : 0,
    profitMargin: income > 0 ? (profit / income) * 100 : null,
  };
};
export const getChangePercent = (current: number, previous: number) =>
  previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
export const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value !== 0 && Math.abs(value) < 0.1)
    return value > 0 ? "<0.1%" : ">-0.1%";
  return `${Math.abs(value) >= 100000 ? value.toExponential(1) : value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
};

export const getDailyBudget = (remaining: number, daysLeft: number) => {
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return null;
  return Math.floor(Math.round(Math.max(0, roundMoney(remaining)) * 100) / Math.ceil(daysLeft)) / 100;
};
