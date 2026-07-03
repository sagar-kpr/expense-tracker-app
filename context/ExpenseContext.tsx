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
  listExpenses,
  subscribeExpenses,
  type ExpenseRecord,
  upsertExpense,
} from "@/repositories/expenseRepository";
import { createId } from "@/repositories/shared";

type Expense = ExpenseRecord;

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
  ) => Promise<void>;
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
  ) => {
    if (!user?.uid) {
      return;
    }

    await upsertExpense(user.uid, {
      id: createId(),
      amount: Number(amount),
      description,
      category,
      type,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      deletedAt: null,
      dirty: true,
      syncState: "local_only",
      version: 1,
    });
  };

  const deleteExpense = async (expenseOrId: Expense | string) => {
    if (!user?.uid) {
      return;
    }

    const expenseId =
      typeof expenseOrId === "string" ? expenseOrId : expenseOrId.id;

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
