import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
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

import { db } from "@/firebase";

type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  createdAt: string;
};

type ExpenseContextType = {
  expenses: Expense[];

  loading: boolean;

  addExpense: (
    amount: string,
    description: string,
    category?: string,
  ) => Promise<void>;

  deleteExpense: (id: string) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenseData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[];

      setExpenses(expenseData);

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addExpense = async (
    amount: string,
    description: string,
    category = "Other",
  ) => {
    await addDoc(collection(db, "expenses"), {
      amount: Number(amount),

      description,

      category,

      createdAt: new Date().toISOString(),
    });
  };

  const deleteExpense = async (id: string) => {
    await deleteDoc(doc(db, "expenses", id));
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
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
