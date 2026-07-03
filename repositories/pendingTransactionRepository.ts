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
  updateDoc,
} from "firebase/firestore";

import { db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import { nowMs, toJson } from "@/repositories/shared";

export type PendingTransactionRecord = {
  id: string;
  userId?: string;
  amount: number;
  description?: string;
  category?: string;
  type?: "income" | "expense";
  createdAt?: unknown;
  status?: "pending";
  updatedAt?: number;
  deletedAt?: number | null;
  dirty?: boolean;
  syncState?: "local_only" | "synced" | "dirty" | "pending_delete";
  source?: string;
  duplicateKey?: string;
  transactionDate?: string;
  rawMessage?: string;
};

const mapLocalPending = (row: any): PendingTransactionRecord => ({
  id: row.id,
  userId: row.userId,
  amount: Number(row.amount || 0),
  description: row.description ?? undefined,
  category: row.category ?? undefined,
  type: (row.type || "expense") as "income" | "expense",
  createdAt: row.createdAt,
  status: "pending",
  updatedAt: Number(row.updatedAt || 0),
  deletedAt: row.deletedAt == null ? null : Number(row.deletedAt),
  dirty: Boolean(row.dirty),
  syncState: row.syncState,
});

export const listPendingTransactions = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "pendingTransactions"),
        orderBy("createdAt", "desc"),
      ),
    );

    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<PendingTransactionRecord, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM pending_transactions WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
    userId,
  );

  return rows.map(mapLocalPending);
};

export const upsertPendingTransaction = async (
  userId: string,
  transaction: Omit<PendingTransactionRecord, "userId">,
) => {
  if (Platform.OS === "web") {
    const docRef = transaction.id
      ? doc(db, "users", userId, "pendingTransactions", transaction.id)
      : doc(collection(db, "users", userId, "pendingTransactions"));

    await setDoc(
      docRef,
      {
        ...transaction,
        userId,
      },
      { merge: true },
    );

    return {
      ...transaction,
      id: docRef.id,
      userId,
    };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = {
    ...transaction,
    userId,
    dirty: true,
    syncState: "local_only",
    updatedAt: timestamp,
  };

  await dbx.runAsync(
    `
    INSERT INTO pending_transactions (
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
      version = pending_transactions.version + 1,
      payload = excluded.payload
  `,
    [
      transaction.id,
      userId,
      transaction.amount,
      transaction.description ?? null,
      transaction.category ?? null,
      transaction.type || "expense",
      String(transaction.createdAt || new Date().toISOString()),
      timestamp,
      transaction.deletedAt ?? null,
      1,
      "local_only",
      1,
      toJson(payload),
    ],
  );

  return payload;
};

export const deletePendingTransaction = async (userId: string, id: string) => {
  if (Platform.OS === "web") {
    await deleteDoc(doc(db, "users", userId, "pendingTransactions", id));
    return;
  }

  const dbx = await getLocalDatabase();
  await dbx.runAsync(
    `
    UPDATE pending_transactions
    SET deletedAt = ?, dirty = 1, syncState = 'pending_delete', updatedAt = updatedAt + 1
    WHERE id = ? AND userId = ?
  `,
    nowMs(),
    id,
    userId,
  );
};

export const updatePendingTransaction = async (
  userId: string,
  id: string,
  data: Partial<Omit<PendingTransactionRecord, "id" | "userId">>,
) => {
  if (Platform.OS === "web") {
    await updateDoc(doc(db, "users", userId, "pendingTransactions", id), data);
    return;
  }

  const dbx = await getLocalDatabase();
  const current = await dbx.getFirstAsync<any>(
    "SELECT * FROM pending_transactions WHERE id = ? AND userId = ?",
    id,
    userId,
  );

  if (!current) {
    return;
  }

  const next = {
    ...current,
    ...data,
    updatedAt: nowMs(),
    dirty: 1,
    syncState: "local_only",
  };

  await dbx.runAsync(
    `
    UPDATE pending_transactions
    SET amount = ?, description = ?, category = ?, type = ?, createdAt = ?, updatedAt = ?, dirty = 1, syncState = 'local_only', payload = ?
    WHERE id = ? AND userId = ?
  `,
    [
      next.amount,
      next.description ?? null,
      next.category ?? null,
      next.type || "expense",
      String(next.createdAt || new Date().toISOString()),
      next.updatedAt,
      toJson(next),
      id,
      userId,
    ],
  );
};

export const subscribePendingTransactions = (
  userId: string,
  onChange: (transactions: PendingTransactionRecord[]) => void,
  onError?: (error: unknown) => void,
) => {
  if (Platform.OS === "web") {
    return onSnapshot(
      query(
        collection(db, "users", userId, "pendingTransactions"),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        onChange(
          snapshot.docs.map((item) => ({
            id: item.id,
            userId,
            ...(item.data() as Omit<PendingTransactionRecord, "id" | "userId">),
          })),
        );
      },
      onError,
    );
  }

  const run = async () => {
    try {
      onChange(await listPendingTransactions(userId));
    } catch (error) {
      onError?.(error);
    }
  };

  run();

  return SQLite.addDatabaseChangeListener((event) => {
    if (event.tableName === "pending_transactions") {
      run();
    }
  });
};
