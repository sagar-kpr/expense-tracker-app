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
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import { ensureLocalProfile, getLocalProfile } from "@/repositories/profileRepository";
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
  source?: string;
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
    "SELECT * FROM expenses WHERE userId = ? ORDER BY createdAt DESC",
    userId,
  );

  return rows.map(mapLocalExpense);
};

export const upsertExpense = async (
  userId: string,
  expense: Omit<ExpenseRecord, "userId">,
) => {
  const [saved] = await upsertExpenses(userId, [expense]);

  return saved;
};

export const upsertExpenses = async (
  userId: string,
  expenses: Omit<ExpenseRecord, "userId">[],
) => {
  if (expenses.length === 0) {
    return [];
  }

  if (Platform.OS === "web") {
    const batch = writeBatch(db);
    const saved = expenses.map((expense) => {
      const docRef = expense.id
        ? doc(db, "users", userId, "expenses", expense.id)
        : doc(collection(db, "users", userId, "expenses"));
      const record = {
        ...expense,
        id: docRef.id,
        userId,
      };

      batch.set(docRef, record, { merge: true });

      return record;
    });

    await batch.commit();

    return saved;
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const existingProfile = await getLocalProfile(userId);

  if (!existingProfile) {
    await ensureLocalProfile({
      userId,
      email: "",
    });
  }

  const payloads = expenses.map((expense) => ({
    ...expense,
    userId,
    updatedAt: timestamp,
  }));

  await dbx.withExclusiveTransactionAsync(async (txn) => {
    for (const payload of payloads) {
      await txn.runAsync(
        `
        INSERT INTO expenses (
          id, userId, amount, description, category, type, createdAt, updatedAt, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          userId = excluded.userId,
          amount = excluded.amount,
          description = excluded.description,
          category = excluded.category,
          type = excluded.type,
          createdAt = excluded.createdAt,
          updatedAt = excluded.updatedAt,
          payload = excluded.payload
      `,
        [
          payload.id,
          userId,
          payload.amount,
          payload.description ?? null,
          payload.category ?? null,
          payload.type || "expense",
          String(payload.createdAt || new Date().toISOString()),
          timestamp,
          toJson(payload),
        ],
      );
    }
  });

  const profile = existingProfile || (await getLocalProfile(userId));

  if (profile?.syncMode === "sync_enabled") {
    const batch = writeBatch(db);

    payloads.forEach((payload) => {
      const docRef = doc(db, "users", userId, "expenses", payload.id);
      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
  }

  return payloads;
};

export const deleteExpense = async (userId: string, expenseId: string) => {
  if (Platform.OS === "web") {
    await deleteDoc(doc(db, "users", userId, "expenses", expenseId));
    return;
  }

  const dbx = await getLocalDatabase();
  await dbx.runAsync("DELETE FROM expenses WHERE id = ? AND userId = ?", expenseId, userId);

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    await deleteDoc(doc(db, "users", userId, "expenses", expenseId));
  }
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
