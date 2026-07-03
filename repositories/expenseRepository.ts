import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import { nowMs, toJson } from "@/repositories/shared";

export type ExpenseRecord = {
  id: string;
  userId?: string;
  amount: number;
  description?: string;
  category?: string;
  type?: "income" | "expense";
  createdAt?: string | Date | { toDate?: () => Date };
  updatedAt?: number;
  deletedAt?: number | null;
  dirty?: boolean;
  syncState?: "local_only" | "synced" | "dirty" | "pending_delete";
  source?: string;
  version?: number;
};

const mapLocalExpense = (row: any): ExpenseRecord => ({
  id: row.id,
  userId: row.userId,
  amount: Number(row.amount || 0),
  description: row.description ?? undefined,
  category: row.category ?? undefined,
  type: (row.type || "expense") as "income" | "expense",
  createdAt: row.createdAt,
  updatedAt: Number(row.updatedAt || 0),
  deletedAt: row.deletedAt == null ? null : Number(row.deletedAt),
  dirty: Boolean(row.dirty),
  syncState: row.syncState,
});

export const listExpenses = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(collection(db, "users", userId, "expenses"), orderBy("createdAt", "desc")),
    );

    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<ExpenseRecord, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM expenses WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
    userId,
  );

  return rows.map(mapLocalExpense);
};

export const upsertExpense = async (
  userId: string,
  expense: Omit<ExpenseRecord, "userId">,
) => {
  if (Platform.OS === "web") {
    const docRef = expense.id
      ? doc(db, "users", userId, "expenses", expense.id)
      : doc(collection(db, "users", userId, "expenses"));
    await setDoc(
      docRef,
      {
        ...expense,
        userId,
      },
      { merge: true },
    );

    return {
      ...expense,
      id: docRef.id,
      userId,
    };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = {
    ...expense,
    userId,
    dirty: true,
    syncState: "local_only",
    updatedAt: timestamp,
  };

  await dbx.runAsync(
    `
    INSERT INTO expenses (
      id, userId, amount, description, category, type, createdAt, updatedAt,
      deletedAt, dirty, syncState, version, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      amount = excluded.amount,
      description = excluded.description,
      category = excluded.category,
      type = excluded.type,
      createdAt = excluded.createdAt,
      updatedAt = excluded.updatedAt,
      deletedAt = excluded.deletedAt,
      dirty = excluded.dirty,
      syncState = excluded.syncState,
      version = expenses.version + 1,
      payload = excluded.payload
  `,
    [
      expense.id,
      userId,
      expense.amount,
      expense.description ?? null,
      expense.category ?? null,
      expense.type || "expense",
      String(expense.createdAt || new Date().toISOString()),
      timestamp,
      expense.deletedAt ?? null,
      1,
      "local_only",
      1,
      toJson(payload),
    ],
  );

  return payload;
};

export const deleteExpense = async (userId: string, expenseId: string) => {
  if (Platform.OS === "web") {
    await deleteDoc(doc(db, "users", userId, "expenses", expenseId));
    return;
  }

  const dbx = await getLocalDatabase();
  await dbx.runAsync(
    `
    UPDATE expenses
    SET deletedAt = ?, dirty = 1, syncState = 'pending_delete', updatedAt = updatedAt + 1
    WHERE id = ? AND userId = ?
  `,
    nowMs(),
    expenseId,
    userId,
  );
};

export const subscribeExpenses = (
  userId: string,
  onChange: (expenses: ExpenseRecord[]) => void,
  onError?: (error: unknown) => void,
) => {
  if (Platform.OS === "web") {
    return onSnapshot(
      query(collection(db, "users", userId, "expenses"), orderBy("createdAt", "desc")),
      (snapshot) => {
        onChange(
          snapshot.docs.map((item) => ({
            id: item.id,
            userId,
            ...(item.data() as Omit<ExpenseRecord, "id" | "userId">),
          })),
        );
      },
      onError,
    );
  }

  const run = async () => {
    try {
      onChange(await listExpenses(userId));
    } catch (error) {
      onError?.(error);
    }
  };

  run();

  return SQLite.addDatabaseChangeListener((event) => {
    if (event.tableName === "expenses") {
      run();
    }
  });
};
