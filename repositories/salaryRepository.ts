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

export type SalaryHistoryEntry = {
  id: string;
  userId?: string;
  salary: number;
  salaryDate: number;
  effectiveFromMs: number;
  createdAtMs: number;
  source?: string;
  note?: string;
};

export type SalaryArrivalEntry = {
  id: string;
  userId?: string;
  arrivedAtMs: number;
  createdAtMs: number;
  cycleKey: string;
  expectedCycleKey: string;
  salary: number;
  salaryDate: number;
  source?: string;
};

export type SalaryCycleSnapshot = {
  id: string;
  userId?: string;
  cycleKey: string;
  expectedCycleKey?: string;
  cycleStartMs: number;
  cycleEndMs: number;
  salary: number;
  salaryDate: number;
  totalSpent: number;
  remaining: number;
  usagePercent: number;
  expenseCount: number;
  source?: string;
  updatedAtMs: number;
  createdAtMs: number;
};

const mapRow = <T extends { id: string }>(row: any, userId: string): T => ({
  id: row.id,
  userId,
  ...row,
});

const mapSalaryRow = (row: any): SalaryHistoryEntry => ({
  id: row.id,
  userId: row.userId,
  salary: Number(row.salary || 0),
  salaryDate: Number(row.salaryDate || 1),
  effectiveFromMs: Number(row.effectiveFromMs || 0),
  createdAtMs: Number(row.createdAtMs || 0),
  source: row.source ?? undefined,
  note: row.note ?? undefined,
});

const mapArrivalRow = (row: any): SalaryArrivalEntry => ({
  id: row.id,
  userId: row.userId,
  arrivedAtMs: Number(row.arrivedAtMs || 0),
  createdAtMs: Number(row.createdAtMs || 0),
  cycleKey: String(row.cycleKey || row.id),
  expectedCycleKey: String(row.expectedCycleKey || row.id),
  salary: Number(row.salary || 0),
  salaryDate: Number(row.salaryDate || 1),
  source: row.source ?? undefined,
});

const mapSnapshotRow = (row: any): SalaryCycleSnapshot => ({
  id: row.id,
  userId: row.userId,
  cycleKey: String(row.cycleKey || row.id),
  expectedCycleKey: row.expectedCycleKey ?? undefined,
  cycleStartMs: Number(row.cycleStartMs || 0),
  cycleEndMs: Number(row.cycleEndMs || 0),
  salary: Number(row.salary || 0),
  salaryDate: Number(row.salaryDate || 1),
  totalSpent: Number(row.totalSpent || 0),
  remaining: Number(row.remaining || 0),
  usagePercent: Number(row.usagePercent || 0),
  expenseCount: Number(row.expenseCount || 0),
  source: row.source ?? undefined,
  updatedAtMs: Number(row.updatedAtMs || 0),
  createdAtMs: Number(row.createdAtMs || 0),
});

export const listSalaryHistory = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(collection(db, "users", userId, "salaryHistory"), orderBy("createdAtMs", "asc")),
    );
    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<SalaryHistoryEntry, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_history WHERE userId = ? AND deletedAt IS NULL ORDER BY createdAtMs ASC",
    userId,
  );

  return rows.map(mapSalaryRow);
};

export const listSalaryArrivals = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(collection(db, "users", userId, "salaryArrivals"), orderBy("arrivedAtMs", "asc")),
    );
    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<SalaryArrivalEntry, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_arrivals WHERE userId = ? AND deletedAt IS NULL ORDER BY arrivedAtMs ASC",
    userId,
  );

  return rows.map(mapArrivalRow);
};

export const listSalarySnapshots = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(collection(db, "users", userId, "salaryCycleSnapshots"), orderBy("cycleStartMs", "asc")),
    );
    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<SalaryCycleSnapshot, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_cycle_snapshots WHERE userId = ? AND deletedAt IS NULL ORDER BY cycleStartMs ASC",
    userId,
  );

  return rows.map(mapSnapshotRow);
};

export const upsertSalaryHistory = async (
  userId: string,
  entry: Omit<SalaryHistoryEntry, "userId"> & { userId?: string },
) => {
  if (Platform.OS === "web") {
    const docRef = entry.id
      ? doc(db, "users", userId, "salaryHistory", entry.id)
      : doc(collection(db, "users", userId, "salaryHistory"));
    await setDoc(docRef, { ...entry, userId }, { merge: true });
    return { ...entry, id: docRef.id, userId };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = { ...entry, userId };

  await dbx.runAsync(
    `
    INSERT INTO salary_history (
      id, userId, salary, salaryDate, effectiveFromMs, createdAtMs, source,
      note, updatedAt, deletedAt, dirty, syncState, version, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      effectiveFromMs = excluded.effectiveFromMs,
      createdAtMs = excluded.createdAtMs,
      source = excluded.source,
      note = excluded.note,
      updatedAt = excluded.updatedAt,
      dirty = excluded.dirty,
      syncState = excluded.syncState,
      version = salary_history.version + 1,
      payload = excluded.payload
  `,
    [
      entry.id,
      userId,
      entry.salary,
      entry.salaryDate,
      entry.effectiveFromMs,
      entry.createdAtMs,
      entry.source ?? null,
      entry.note ?? null,
      timestamp,
      null,
      1,
      "local_only",
      1,
      toJson(payload),
    ],
  );

  return payload;
};

export const upsertSalaryArrival = async (
  userId: string,
  entry: Omit<SalaryArrivalEntry, "userId"> & { userId?: string },
) => {
  if (Platform.OS === "web") {
    const docRef = doc(db, "users", userId, "salaryArrivals", entry.expectedCycleKey);
    await setDoc(docRef, { ...entry, userId }, { merge: true });
    return { ...entry, id: docRef.id, userId };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = { ...entry, userId };

  await dbx.runAsync(
    `
    INSERT INTO salary_arrivals (
      id, userId, arrivedAtMs, createdAtMs, cycleKey, expectedCycleKey,
      salary, salaryDate, source, updatedAt, deletedAt, dirty, syncState,
      version, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      arrivedAtMs = excluded.arrivedAtMs,
      createdAtMs = excluded.createdAtMs,
      cycleKey = excluded.cycleKey,
      expectedCycleKey = excluded.expectedCycleKey,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      source = excluded.source,
      updatedAt = excluded.updatedAt,
      dirty = excluded.dirty,
      syncState = excluded.syncState,
      version = salary_arrivals.version + 1,
      payload = excluded.payload
  `,
    [
      entry.id,
      userId,
      entry.arrivedAtMs,
      entry.createdAtMs,
      entry.cycleKey,
      entry.expectedCycleKey,
      entry.salary,
      entry.salaryDate,
      entry.source ?? null,
      timestamp,
      null,
      1,
      "local_only",
      1,
      toJson(payload),
    ],
  );

  return payload;
};

export const upsertSalarySnapshot = async (
  userId: string,
  entry: Omit<SalaryCycleSnapshot, "userId"> & { userId?: string },
) => {
  if (Platform.OS === "web") {
    const docRef = doc(db, "users", userId, "salaryCycleSnapshots", entry.cycleKey);
    await setDoc(docRef, { ...entry, userId }, { merge: true });
    return { ...entry, id: docRef.id, userId };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = { ...entry, userId };

  await dbx.runAsync(
    `
    INSERT INTO salary_cycle_snapshots (
      id, userId, cycleKey, expectedCycleKey, cycleStartMs, cycleEndMs, salary,
      salaryDate, totalSpent, remaining, usagePercent, expenseCount, source,
      updatedAtMs, createdAtMs, updatedAt, deletedAt, dirty, syncState,
      version, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      cycleKey = excluded.cycleKey,
      expectedCycleKey = excluded.expectedCycleKey,
      cycleStartMs = excluded.cycleStartMs,
      cycleEndMs = excluded.cycleEndMs,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      totalSpent = excluded.totalSpent,
      remaining = excluded.remaining,
      usagePercent = excluded.usagePercent,
      expenseCount = excluded.expenseCount,
      source = excluded.source,
      updatedAtMs = excluded.updatedAtMs,
      createdAtMs = excluded.createdAtMs,
      updatedAt = excluded.updatedAt,
      dirty = excluded.dirty,
      syncState = excluded.syncState,
      version = salary_cycle_snapshots.version + 1,
      payload = excluded.payload
  `,
    [
      entry.id,
      userId,
      entry.cycleKey,
      entry.expectedCycleKey ?? null,
      entry.cycleStartMs,
      entry.cycleEndMs,
      entry.salary,
      entry.salaryDate,
      entry.totalSpent,
      entry.remaining,
      entry.usagePercent,
      entry.expenseCount,
      entry.source ?? null,
      entry.updatedAtMs,
      entry.createdAtMs,
      timestamp,
      null,
      1,
      "local_only",
      1,
      toJson(payload),
    ],
  );

  return payload;
};

export const deleteSalarySnapshot = async (userId: string, id: string) => {
  if (Platform.OS === "web") {
    await deleteDoc(doc(db, "users", userId, "salaryCycleSnapshots", id));
    return;
  }

  const dbx = await getLocalDatabase();
  await dbx.runAsync(
    "UPDATE salary_cycle_snapshots SET deletedAt = ?, dirty = 1, syncState = 'pending_delete' WHERE id = ? AND userId = ?",
    nowMs(),
    id,
    userId,
  );
};

export const subscribeSalaryRecords = (
  userId: string,
  onChange: (records: {
    arrivals: SalaryArrivalEntry[];
    history: SalaryHistoryEntry[];
    snapshots: SalaryCycleSnapshot[];
  }) => void,
  onError?: (error: unknown) => void,
) => {
  const run = async () => {
    try {
      const [arrivals, history, snapshots] = await Promise.all([
        listSalaryArrivals(userId),
        listSalaryHistory(userId),
        listSalarySnapshots(userId),
      ]);

      onChange({ arrivals, history, snapshots });
    } catch (error) {
      onError?.(error);
    }
  };

  run();

  if (Platform.OS === "web") {
    const unsubscribers = [
      onSnapshot(collection(db, "users", userId, "salaryArrivals"), run, onError),
      onSnapshot(collection(db, "users", userId, "salaryHistory"), run, onError),
      onSnapshot(
        collection(db, "users", userId, "salaryCycleSnapshots"),
        run,
        onError,
      ),
    ];

    return {
      remove() {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      },
    };
  }

  const salaryTables = new Set([
    "salary_arrivals",
    "salary_history",
    "salary_cycle_snapshots",
  ]);

  return SQLite.addDatabaseChangeListener((event) => {
    if (salaryTables.has(event.tableName)) {
      run();
    }
  });
};
