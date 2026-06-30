import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { auth, db } from "@/firebase";

import { useAuth } from "@/context/AuthContext";

type Expense = {
  id: string;

  amount: number;

  description?: string;

  category?: string;

  type?: "income" | "expense";

  createdAt?: string | Date | { toDate?: () => Date };
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
  ) => Promise<void>;

  deleteExpense: (expenseOrId: Expense | string) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const getExpenseDate = (value: Expense["createdAt"]) => {
  const date =
    typeof value === "object" && "toDate" in value && value.toDate
      ? value.toDate()
      : new Date(value as string | Date);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const { userData } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      if (!user?.uid) {
        setExpenses([]);

        setLoading(false);

        return;
      }

      setLoading(true);

      const q = query(
        collection(db, "users", user.uid, "expenses"),

        orderBy("createdAt", "desc"),
      );

      unsubscribeSnapshot = onSnapshot(
        q,

        (snapshot) => {
          if (snapshot.empty) {
            setExpenses([]);

            setLoading(false);

            return;
          }

          const expenseData = snapshot.docs.map((doc) => ({
            id: doc.id,

            ...doc.data(),

            type: doc.data()?.type || "expense",
          })) as Expense[];

          setExpenses(expenseData);

          setLoading(false);
        },

        (error) => {
          console.log("Expense listener error:", error);

          setExpenses([]);

          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeAuth();

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  /*
    SALARY CYCLE FILTER
    Example:
    salary date = 5
    cycle = 5th → next 5th
  */

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

  /*
    CURRENT MONTH FILTER
    FOR SELF-EMPLOYED USERS
  */

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
    const user = auth.currentUser;

    if (!user) return;

    await addDoc(
      collection(db, "users", user.uid, "expenses"),

      {
        amount: Number(amount),

        description,

        category,

        type,

        createdAt: new Date().toISOString(),
      },
    );
  };

  const deleteExpense = async (expenseOrId: Expense | string) => {
    const user = auth.currentUser;

    if (!user) return;

    const expense =
      typeof expenseOrId === "string"
        ? expenses.find((item) => item.id === expenseOrId) || null
        : expenseOrId;
    const expenseId =
      typeof expenseOrId === "string" ? expenseOrId : expenseOrId.id;

    await deleteDoc(doc(db, "users", user.uid, "expenses", expenseId));

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
