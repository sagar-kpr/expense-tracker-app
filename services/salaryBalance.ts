import { withUserTransactionLock } from "@/services/transactionLock";
import {
  listSalaryArrivals,
  listSalaryHistory,
  listSalarySnapshots,
} from "@/repositories/salaryRepository";
import {
  listExpenses,
  type ExpenseRecord,
  upsertExpense,
  upsertExpenses,
} from "@/repositories/expenseRepository";
import { createId } from "@/repositories/shared";
import { addMoney, normalizeMoneyInput, getExpenseShortfall } from "@/services/salaryMath";
import {
  type ExpenseLike,
  getCurrentSalaryCycle,
  getExpenseCreatedAtDate,
  resolveSalaryCycleSummary,
  type SalaryCycleSnapshot,
  type SalaryProfileLike,
} from "@/services/salaryLedger";

export type SalaryBalanceState = {
  cycle: SalaryCycleSnapshot;
  cycleEnd: Date;
  cycleStart: Date;
};

export type SalaryTransactionSaveResult =
  | {
      status: "saved";
      expense: ExpenseRecord;
    }
  | {
      status: "insufficient-funds";
      available: number;
      shortfall: number;
    };

export const getSalaryBalanceState = async ({
  expenses,
  profile,
  referenceDate = new Date(),
  userId,
}: {
  expenses: ExpenseLike[];
  profile: SalaryProfileLike;
  referenceDate?: Date;
  userId: string;
}): Promise<SalaryBalanceState> => {
  const [salaryArrivals, salaryHistory, salaryCycleSnapshots] =
    await Promise.all([
      listSalaryArrivals(userId),
      listSalaryHistory(userId),
      listSalarySnapshots(userId),
    ]);
  const openSnapshot = [...salaryCycleSnapshots]
    .filter((item) => item.status === "open")
    .sort((left, right) => right.cycleStartMs - left.cycleStartMs)[0];
  const fallback = getCurrentSalaryCycle(
    Number(profile.salaryDate || 1),
    referenceDate,
  );
  const cycleStart = openSnapshot
    ? new Date(openSnapshot.cycleStartMs)
    : fallback.start;
  const storedCycleEnd = openSnapshot
    ? new Date(openSnapshot.cycleEndMs)
    : fallback.end;
  const cycleEnd =
    openSnapshot && referenceDate >= storedCycleEnd
      ? new Date(referenceDate.getTime() + 1)
      : storedCycleEnd;
  const cycle = resolveSalaryCycleSummary({
    profile,
    salaryArrivals,
    salaryHistory,
    salaryCycleSnapshots,
    expenses,
    cycleStart,
    referenceDate,
  });

  return {
    cycle,
    cycleEnd,
    cycleStart,
  };
};

export const isTransactionInOpenSalaryCycle = (
  transaction: ExpenseLike,
  balance: SalaryBalanceState,
) => {
  const date = getExpenseCreatedAtDate(transaction.createdAt);

  return Boolean(
    date && date >= balance.cycleStart && date < balance.cycleEnd,
  );
};

export const saveTransactionWithSalaryValidation = async ({
  expenses,
  profile,
  transaction,
  userId,
}: {
  expenses?: ExpenseRecord[];
  profile: SalaryProfileLike & { type?: string };
  transaction: Omit<ExpenseRecord, "userId">;
  userId: string;
}): Promise<SalaryTransactionSaveResult> =>
  withUserTransactionLock(userId, async () => {
    transaction = { ...transaction, amount: normalizeMoneyInput(transaction.amount) };
    const currentExpenses =
      profile.type === "salary"
        ? await listExpenses(userId)
        : expenses || (await listExpenses(userId));

    if (profile.type === "salary") {
      const balance = await getSalaryBalanceState({
        expenses: currentExpenses.filter((item) => item.id !== transaction.id),
        profile,
        userId,
      });
      if (!isTransactionInOpenSalaryCycle(transaction, balance)) {
        throw new Error("Completed salary cycles are read-only.");
      }

      const { available, shortfall } = getExpenseShortfall({
        expenseAmount: transaction.amount,
        remaining: balance.cycle.remaining,
      });

      if ((transaction.type || "expense") === "expense" && shortfall > 0) {
        return {
          status: "insufficient-funds",
          available,
          shortfall,
        };
      }
    }

    const saved = await upsertExpense(userId, transaction);

    return {
      status: "saved",
      expense: saved,
    };
  });

export const saveExpenseWithAdditionalFunds = async ({
  additionalFunds,
  category = "Other",
  description,
  expenseAmount,
  fundsDescription = "Additional funds",
  profile,
  transaction,
  userId,
}: {
  additionalFunds: number;
  category?: string;
  description: string;
  expenseAmount: number;
  fundsDescription?: string;
  profile: SalaryProfileLike & { type?: string };
  transaction?: Pick<ExpenseRecord, "id" | "createdAt">;
  userId: string;
}): Promise<SalaryTransactionSaveResult> =>
  withUserTransactionLock(userId, async () => {
    if (profile.type !== "salary") {
      throw new Error("Additional Funds are available for salary accounts.");
    }

    expenseAmount = normalizeMoneyInput(expenseAmount);
    additionalFunds = normalizeMoneyInput(additionalFunds);
    const currentExpenses = await listExpenses(userId);
    if (transaction?.id) {
      const saved = currentExpenses.find((item) => item.id === transaction.id);
      if (saved) return { status: "saved", expense: saved };
    }
    const balance = await getSalaryBalanceState({
      expenses: currentExpenses,
      profile,
      userId,
    });
    if (transaction && !isTransactionInOpenSalaryCycle(transaction, balance)) {
      throw new Error("Completed salary cycles are read-only.");
    }

    const availableAfterFunds =
      addMoney(balance.cycle.remaining, additionalFunds);
    const { available, shortfall } = getExpenseShortfall({
      expenseAmount,
      remaining: availableAfterFunds,
    });

    if (shortfall > 0) {
      return {
        status: "insufficient-funds",
        available,
        shortfall,
      };
    }

    const createdAt = new Date().toISOString();
    const [, expense] = await upsertExpenses(userId, [
      {
        id: createId(),
        amount: additionalFunds,
        description: fundsDescription,
        category: "Additional Funds",
        type: "income",
        createdAt,
        updatedAt: Date.now(),
        source: "insufficient-funds-flow",
      },
      {
        id: transaction?.id || createId(),
        amount: expenseAmount,
        description,
        category,
        type: "expense",
        createdAt: transaction?.createdAt || createdAt,
        updatedAt: Date.now(),
      },
    ]);

    return {
      status: "saved",
      expense,
    };
  });
