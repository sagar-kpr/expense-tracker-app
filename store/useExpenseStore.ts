import { create } from "zustand";

import { persist } from "zustand/middleware";

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Expense {
  id: string;

  title: string;

  amount: number;

  category: string;

  createdAt: string;
}

interface ExpenseState {
  expenses: Expense[];

  addExpense: (expense: Expense) => void;

  deleteExpense: (id: string) => void;

  clearExpenses: () => void;
}

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set) => ({
      expenses: [],

      addExpense: (expense) =>
        set((state) => ({
          expenses: [expense, ...state.expenses],
        })),

      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((item) => item.id !== id),
        })),

      clearExpenses: () =>
        set({
          expenses: [],
        }),
    }),
    {
      name: "expense-storage",

      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);

          return value ? JSON.parse(value) : null;
        },

        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },

        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
    },
  ),
);
