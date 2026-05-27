// import {
//   createContext,
//   ReactNode,
//   useContext,
//   useEffect,
//   useState,
// } from "react";

// import {
//   addDoc,
//   collection,
//   deleteDoc,
//   doc,
//   onSnapshot,
//   orderBy,
//   query,
// } from "firebase/firestore";

// import { auth, db } from "@/firebase";

// type Expense = {
//   id: string;

//   amount: number;

//   description: string;

//   category?: string;

//   createdAt: string;
// };

// type ExpenseContextType = {
//   expenses: Expense[];

//   loading: boolean;

//   addExpense: (
//     amount: string,
//     description: string,
//     category?: string,
//   ) => Promise<void>;

//   deleteExpense: (id: string) => Promise<void>;
// };

// const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

// export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
//   const [expenses, setExpenses] = useState<Expense[]>([]);

//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     let unsubscribeSnapshot: (() => void) | undefined;

//     const unsubscribeAuth = auth.onAuthStateChanged((user) => {
//       if (unsubscribeSnapshot) {
//         unsubscribeSnapshot();
//       }

//       if (!user?.uid) {
//         setExpenses([]);

//         setLoading(false);

//         return;
//       }

//       setLoading(true);

//       const q = query(
//         collection(db, "users", user.uid, "expenses"),

//         orderBy("createdAt", "desc"),
//       );

//       unsubscribeSnapshot = onSnapshot(
//         q,

//         (snapshot) => {
//           if (snapshot.empty) {
//             setExpenses([]);

//             setLoading(false);

//             return;
//           }

//           const expenseData = snapshot.docs.map((doc) => ({
//             id: doc.id,
//             ...doc.data(),
//           })) as Expense[];

//           setExpenses(expenseData);

//           setLoading(false);
//         },

//         (error) => {
//           console.log("Expense listener error:", error);

//           setExpenses([]);

//           setLoading(false);
//         },
//       );
//     });

//     return () => {
//       unsubscribeAuth();

//       if (unsubscribeSnapshot) {
//         unsubscribeSnapshot();
//       }
//     };
//   }, []);

//   const addExpense = async (
//     amount: string,
//     description: string,
//     category = "Other",
//   ) => {
//     const user = auth.currentUser;

//     if (!user) return;

//     await addDoc(
//       collection(db, "users", user.uid, "expenses"),

//       {
//         amount: Number(amount),

//         description,

//         category,

//         createdAt: new Date().toISOString(),
//       },
//     );
//   };

//   const deleteExpense = async (id: string) => {
//     const user = auth.currentUser;

//     if (!user) return;

//     await deleteDoc(doc(db, "users", user.uid, "expenses", id));
//   };

//   return (
//     <ExpenseContext.Provider
//       value={{
//         expenses,

//         loading,

//         addExpense,

//         deleteExpense,
//       }}
//     >
//       {children}
//     </ExpenseContext.Provider>
//   );
// };

// export const useExpense = () => {
//   const context = useContext(ExpenseContext);

//   if (!context) {
//     throw new Error("useExpense must be used inside ExpenseProvider");
//   }

//   return context;
// };

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

import { auth, db } from "@/firebase";

type Expense = {
  id: string;

  amount: number;

  description: string;

  category?: string;

  type?: "income" | "expense";

  createdAt: string;
};

type ExpenseContextType = {
  expenses: Expense[];

  loading: boolean;

  addExpense: (
    amount: string,
    description: string,
    category?: string,

    type?: "income" | "expense",
  ) => Promise<void>;

  deleteExpense: (id: string) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
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

            // SUPPORT OLD DATA
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

  const deleteExpense = async (id: string) => {
    const user = auth.currentUser;

    if (!user) return;

    await deleteDoc(doc(db, "users", user.uid, "expenses", id));
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
