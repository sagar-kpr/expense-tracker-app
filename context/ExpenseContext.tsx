import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";
import {
  deleteExpense as removeExpenseRecord,
  subscribeExpenses,
  type ExpenseRecord,
} from "@/repositories/expenseRepository";
import { createId } from "@/repositories/shared";
import {
  getSalaryBalanceState,
  isTransactionInOpenSalaryCycle,
  saveExpenseWithAdditionalFunds,
  saveTransactionWithSalaryValidation,
} from "@/services/salaryBalance";

type Expense = ExpenseRecord;

export type TransactionSaveResult =
  | {
      status: "saved";
      expense: ExpenseRecord;
    }
  | {
      status: "insufficient-funds";
      available: number;
      shortfall: number;
    };

type ExpenseContextType = {
  expenses: Expense[];
  salaryCycleExpenses: Expense[];
  currentMonthExpenses: Expense[];
  loading: boolean;
  addExpense: (
    amount: string,
    description: string,
    category?: string,
    type?: "income" | "expense",
  ) => Promise<TransactionSaveResult>;
  addExpenseWithFunds: (input: {
    amount: string;
    description: string;
    category?: string;
    additionalFunds: string;
    fundsDescription?: string;
  }) => Promise<TransactionSaveResult>;
  deleteExpense: (expenseOrId: Expense | string) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const getExpenseDate = (value: Expense["createdAt"]) => {
  const date =
    typeof value === "object" && value && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const { user, userData } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const subscription = subscribeExpenses(
      user.uid,
      (items) => {
        setExpenses(items);
        setLoading(false);
      },
      (error) => {
        console.log("Expense listener error:", error);
        setLoading(false);
      },
    );

    return () => {
      if (typeof subscription === "function") {
        subscription();
        return;
      }

      subscription.remove?.();
    };
  }, [user?.uid]);

  const salaryCycleExpenses = useMemo(() => {
    const salaryDate = Number(userData?.salaryDate || 1);
    const now = new Date();

    let cycleStart = new Date(now.getFullYear(), now.getMonth(), salaryDate);

    if (now.getDate() < salaryDate) {
      cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, salaryDate);
    }

    let cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);

    return expenses.filter((item) => {
      const expenseDate = getExpenseDate(item.createdAt);

      if (!expenseDate || (item.type || "expense") !== "expense") {
        return false;
      }

      return expenseDate >= cycleStart && expenseDate < cycleEnd;
    });
  }, [expenses, userData?.salaryDate]);

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return expenses.filter((item) => {
      const expenseDate = getExpenseDate(item.createdAt);

      if (!expenseDate) {
        return false;
      }

      return expenseDate >= monthStart && expenseDate < nextMonth;
    });
  }, [expenses]);

  const addExpense = async (
    amount: string,
    description: string,
    category = "Other",
    type: "income" | "expense" = "expense",
  ): Promise<TransactionSaveResult> => {
    if (!user?.uid) {
      throw new Error("Sign in before saving a transaction.");
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Enter a valid amount.");
    }

    return saveTransactionWithSalaryValidation({
      expenses,
      profile: userData || {},
      transaction: {
      id: createId(),
      amount: parsedAmount,
      description,
      category,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      },
      userId: user.uid,
    });
  };

  const addExpenseWithFunds: ExpenseContextType["addExpenseWithFunds"] =
    async ({
      amount,
      description,
      category = "Other",
      additionalFunds,
      fundsDescription = "Additional funds",
    }) => {
      if (!user?.uid || userData?.type !== "salary") {
        throw new Error("Additional Funds are available for salary accounts.");
      }

      const parsedAmount = Number(amount);
      const parsedFunds = Number(additionalFunds);

      if (
        !Number.isFinite(parsedAmount) ||
        parsedAmount <= 0 ||
        !Number.isFinite(parsedFunds) ||
        parsedFunds <= 0
      ) {
        throw new Error("Enter valid expense and Additional Funds amounts.");
      }

      return saveExpenseWithAdditionalFunds({
        additionalFunds: parsedFunds,
        category,
        description,
        expenseAmount: parsedAmount,
        fundsDescription,
        profile: userData,
        userId: user.uid,
      });
  };

  const deleteExpense = async (expenseOrId: Expense | string) => {
    if (!user?.uid) {
      return;
    }

    const expense =
      typeof expenseOrId === "string"
        ? expenses.find((item) => item.id === expenseOrId)
        : expenseOrId;
    const expenseId = typeof expenseOrId === "string" ? expenseOrId : expenseOrId.id;

    if (userData?.type === "salary" && expense) {
      const balance = await getSalaryBalanceState({
        expenses,
        profile: userData,
        userId: user.uid,
      });

      if (!isTransactionInOpenSalaryCycle(expense, balance)) {
        throw new Error("Completed salary cycles are read-only.");
      }
    }

    await removeExpenseRecord(user.uid, expenseId);
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        salaryCycleExpenses,
        currentMonthExpenses,
        loading,
        addExpense,
        addExpenseWithFunds,
        deleteExpense,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);

  if (!context) {
    throw new Error("useExpense must be used inside ExpenseProvider");
  }

  return context;
};
