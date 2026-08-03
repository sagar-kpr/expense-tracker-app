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
    writeBatch,
} from "firebase/firestore";
import { Platform } from "react-native";

import { getLocalDatabase } from "@/database/localDb";
import { db } from "@/firebase";
import { getLocalProfile } from "@/repositories/profileRepository";
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
  carryForward: number;
  salary: number;
  salaryDate: number;
  additionalFunds: number;
  availableTotal: number;
  totalSpent: number;
  remaining: number;
  usagePercent: number;
  expenseCount: number;
  status: "open" | "closed";
  closedAtMs?: number;
  schemaVersion: number;
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
  carryForward: Number(row.carryForward || 0),
  salary: Number(row.salary || 0),
  salaryDate: Number(row.salaryDate || 1),
  additionalFunds: Number(row.additionalFunds || 0),
  availableTotal: Number(
    row.availableTotal ||
      Number(row.carryForward || 0) +
        Number(row.salary || 0) +
        Number(row.additionalFunds || 0),
  ),
  totalSpent: Number(row.totalSpent || 0),
  remaining: Number(row.remaining || 0),
  usagePercent: Number(row.usagePercent || 0),
  expenseCount: Number(row.expenseCount || 0),
  status: row.status === "closed" ? "closed" : "open",
  closedAtMs: row.closedAtMs == null ? undefined : Number(row.closedAtMs),
  schemaVersion: Number(row.schemaVersion || 1),
  source: row.source ?? undefined,
  updatedAtMs: Number(row.updatedAtMs || 0),
  createdAtMs: Number(row.createdAtMs || 0),
});

const normalizeSnapshotStatuses = (
  items: SalaryCycleSnapshot[],
): SalaryCycleSnapshot[] => {
  const sorted = [...items].sort(
    (left, right) => left.cycleStartMs - right.cycleStartMs,
  );

  return sorted.map((item, index) =>
    item.schemaVersion >= 2
      ? item
      : {
          ...item,
          status:
            index === sorted.length - 1
              ? ("open" as const)
              : ("closed" as const),
        },
  );
};

export const listSalaryHistory = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "salaryHistory"),
        orderBy("createdAtMs", "asc"),
      ),
    );
    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<SalaryHistoryEntry, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_history WHERE userId = ? ORDER BY createdAtMs ASC",
    userId,
  );

  return rows.map(mapSalaryRow);
};

export const listSalaryArrivals = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "salaryArrivals"),
        orderBy("arrivedAtMs", "asc"),
      ),
    );
    return snap.docs.map((item) => ({
      id: item.id,
      userId,
      ...(item.data() as Omit<SalaryArrivalEntry, "id" | "userId">),
    }));
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_arrivals WHERE userId = ? ORDER BY arrivedAtMs ASC",
    userId,
  );

  return rows.map(mapArrivalRow);
};

export const listSalarySnapshots = async (userId: string) => {
  if (Platform.OS === "web") {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "salaryCycleSnapshots"),
        orderBy("cycleStartMs", "asc"),
      ),
    );
    return normalizeSnapshotStatuses(
      snap.docs.map((item) =>
        mapSnapshotRow({
          id: item.id,
          userId,
          ...item.data(),
        }),
      ),
    );
  }

  const dbx = await getLocalDatabase();
  const rows = await dbx.getAllAsync<any>(
    "SELECT * FROM salary_cycle_snapshots WHERE userId = ? ORDER BY cycleStartMs ASC",
    userId,
  );

  return normalizeSnapshotStatuses(rows.map(mapSnapshotRow));
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
      note, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      effectiveFromMs = excluded.effectiveFromMs,
      createdAtMs = excluded.createdAtMs,
      source = excluded.source,
      note = excluded.note,
      updatedAt = excluded.updatedAt,
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
      toJson(payload),
    ],
  );

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    await setDoc(doc(db, "users", userId, "salaryHistory", entry.id), {
      ...payload,
      id: entry.id,
      userId,
    });
  }

  return payload;
};

export const upsertSalaryArrival = async (
  userId: string,
  entry: Omit<SalaryArrivalEntry, "userId"> & { userId?: string },
) => {
  if (Platform.OS === "web") {
    const docRef = doc(
      db,
      "users",
      userId,
      "salaryArrivals",
      entry.expectedCycleKey,
    );
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
      salary, salaryDate, source, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      toJson(payload),
    ],
  );

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    await setDoc(
      doc(db, "users", userId, "salaryArrivals", entry.expectedCycleKey),
      {
        ...payload,
        id: entry.expectedCycleKey,
        userId,
      },
    );
  }

  return payload;
};

const sanitizeFirestorePayload = <T extends Record<string, unknown>>(
  value: T,
) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;

export const upsertSalarySnapshot = async (
  userId: string,
  entry: Omit<SalaryCycleSnapshot, "userId"> & { userId?: string },
) => {
  if (Platform.OS === "web") {
    const docRef = doc(
      db,
      "users",
      userId,
      "salaryCycleSnapshots",
      entry.cycleKey,
    );
    const payload = sanitizeFirestorePayload({ ...entry, userId });
    await setDoc(docRef, payload, { merge: true });
    return { ...entry, id: docRef.id, userId };
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();
  const payload = { ...entry, userId };

  await dbx.runAsync(
    `
    INSERT INTO salary_cycle_snapshots (
      id, userId, cycleKey, expectedCycleKey, cycleStartMs, cycleEndMs,
      carryForward, salary, salaryDate, additionalFunds, availableTotal,
      totalSpent, remaining, usagePercent, expenseCount, status, closedAtMs,
      schemaVersion, source, updatedAtMs, createdAtMs, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      cycleKey = excluded.cycleKey,
      expectedCycleKey = excluded.expectedCycleKey,
      cycleStartMs = excluded.cycleStartMs,
      cycleEndMs = excluded.cycleEndMs,
      carryForward = excluded.carryForward,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      additionalFunds = excluded.additionalFunds,
      availableTotal = excluded.availableTotal,
      totalSpent = excluded.totalSpent,
      remaining = excluded.remaining,
      usagePercent = excluded.usagePercent,
      expenseCount = excluded.expenseCount,
      status = excluded.status,
      closedAtMs = excluded.closedAtMs,
      schemaVersion = excluded.schemaVersion,
      source = excluded.source,
      updatedAtMs = excluded.updatedAtMs,
      createdAtMs = excluded.createdAtMs,
      updatedAt = excluded.updatedAt,
      payload = excluded.payload
  `,
    [
      entry.id,
      userId,
      entry.cycleKey,
      entry.expectedCycleKey ?? null,
      entry.cycleStartMs,
      entry.cycleEndMs,
      entry.carryForward,
      entry.salary,
      entry.salaryDate,
      entry.additionalFunds,
      entry.availableTotal,
      entry.totalSpent,
      entry.remaining,
      entry.usagePercent,
      entry.expenseCount,
      entry.status,
      entry.closedAtMs ?? null,
      entry.schemaVersion,
      entry.source ?? null,
      entry.updatedAtMs,
      entry.createdAtMs,
      timestamp,
      toJson(payload),
    ],
  );

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    const payloadForFirestore = sanitizeFirestorePayload({
      ...payload,
      id: entry.cycleKey,
      userId,
    });
    await setDoc(
      doc(db, "users", userId, "salaryCycleSnapshots", entry.cycleKey),
      payloadForFirestore,
    );
  }

  return payload;
};

export const commitSalaryCycleRollover = async (
  userId: string,
  input: {
    arrival: Omit<SalaryArrivalEntry, "userId">;
    closedSnapshot: Omit<SalaryCycleSnapshot, "userId">;
    deleteSnapshotId?: string;
    openSnapshot: Omit<SalaryCycleSnapshot, "userId">;
  },
) => {
  const arrival = { ...input.arrival, userId };
  const closedSnapshot = { ...input.closedSnapshot, userId };
  const openSnapshot = { ...input.openSnapshot, userId };

  if (Platform.OS === "web") {
    const batch = writeBatch(db);

    batch.set(
      doc(db, "users", userId, "salaryArrivals", arrival.expectedCycleKey),
      sanitizeFirestorePayload(arrival),
      { merge: true },
    );
    batch.set(
      doc(db, "users", userId, "salaryCycleSnapshots", closedSnapshot.cycleKey),
      sanitizeFirestorePayload(closedSnapshot),
      { merge: true },
    );
    batch.set(
      doc(db, "users", userId, "salaryCycleSnapshots", openSnapshot.cycleKey),
      sanitizeFirestorePayload(openSnapshot),
      { merge: true },
    );

    if (
      input.deleteSnapshotId &&
      input.deleteSnapshotId !== closedSnapshot.cycleKey &&
      input.deleteSnapshotId !== openSnapshot.cycleKey
    ) {
      batch.delete(
        doc(
          db,
          "users",
          userId,
          "salaryCycleSnapshots",
          input.deleteSnapshotId,
        ),
      );
    }

    await batch.commit();
    return;
  }

  const dbx = await getLocalDatabase();
  const timestamp = nowMs();

  await dbx.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `
      INSERT INTO salary_arrivals (
        id, userId, arrivedAtMs, createdAtMs, cycleKey, expectedCycleKey,
        salary, salaryDate, source, updatedAt, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        arrivedAtMs = excluded.arrivedAtMs,
        cycleKey = excluded.cycleKey,
        expectedCycleKey = excluded.expectedCycleKey,
        salary = excluded.salary,
        salaryDate = excluded.salaryDate,
        source = excluded.source,
        updatedAt = excluded.updatedAt,
        payload = excluded.payload
    `,
      [
        arrival.id,
        userId,
        arrival.arrivedAtMs,
        arrival.createdAtMs,
        arrival.cycleKey,
        arrival.expectedCycleKey,
        arrival.salary,
        arrival.salaryDate,
        arrival.source ?? null,
        timestamp,
        toJson(arrival),
      ],
    );

    for (const snapshot of [closedSnapshot, openSnapshot]) {
      await txn.runAsync(
        `
        INSERT INTO salary_cycle_snapshots (
          id, userId, cycleKey, expectedCycleKey, cycleStartMs, cycleEndMs,
          carryForward, salary, salaryDate, additionalFunds, availableTotal,
          totalSpent, remaining, usagePercent, expenseCount, status, closedAtMs,
          schemaVersion, source, updatedAtMs, createdAtMs, updatedAt, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          cycleKey = excluded.cycleKey,
          expectedCycleKey = excluded.expectedCycleKey,
          cycleStartMs = excluded.cycleStartMs,
          cycleEndMs = excluded.cycleEndMs,
          carryForward = excluded.carryForward,
          salary = excluded.salary,
          salaryDate = excluded.salaryDate,
          additionalFunds = excluded.additionalFunds,
          availableTotal = excluded.availableTotal,
          totalSpent = excluded.totalSpent,
          remaining = excluded.remaining,
          usagePercent = excluded.usagePercent,
          expenseCount = excluded.expenseCount,
          status = excluded.status,
          closedAtMs = excluded.closedAtMs,
          schemaVersion = excluded.schemaVersion,
          source = excluded.source,
          updatedAtMs = excluded.updatedAtMs,
          updatedAt = excluded.updatedAt,
          payload = excluded.payload
      `,
        [
          snapshot.id,
          userId,
          snapshot.cycleKey,
          snapshot.expectedCycleKey ?? null,
          snapshot.cycleStartMs,
          snapshot.cycleEndMs,
          snapshot.carryForward,
          snapshot.salary,
          snapshot.salaryDate,
          snapshot.additionalFunds,
          snapshot.availableTotal,
          snapshot.totalSpent,
          snapshot.remaining,
          snapshot.usagePercent,
          snapshot.expenseCount,
          snapshot.status,
          snapshot.closedAtMs ?? null,
          snapshot.schemaVersion,
          snapshot.source ?? null,
          snapshot.updatedAtMs,
          snapshot.createdAtMs,
          timestamp,
          toJson(snapshot),
        ],
      );
    }

    if (
      input.deleteSnapshotId &&
      input.deleteSnapshotId !== closedSnapshot.cycleKey &&
      input.deleteSnapshotId !== openSnapshot.cycleKey
    ) {
      await txn.runAsync(
        "DELETE FROM salary_cycle_snapshots WHERE id = ? AND userId = ?",
        input.deleteSnapshotId,
        userId,
      );
    }
  });

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    const batch = writeBatch(db);
    batch.set(
      doc(db, "users", userId, "salaryArrivals", arrival.expectedCycleKey),
      arrival,
      { merge: true },
    );
    batch.set(
      doc(db, "users", userId, "salaryCycleSnapshots", closedSnapshot.cycleKey),
      closedSnapshot,
      { merge: true },
    );
    batch.set(
      doc(db, "users", userId, "salaryCycleSnapshots", openSnapshot.cycleKey),
      openSnapshot,
      { merge: true },
    );

    if (
      input.deleteSnapshotId &&
      input.deleteSnapshotId !== closedSnapshot.cycleKey &&
      input.deleteSnapshotId !== openSnapshot.cycleKey
    ) {
      batch.delete(
        doc(
          db,
          "users",
          userId,
          "salaryCycleSnapshots",
          input.deleteSnapshotId,
        ),
      );
    }

    await batch.commit();
  }
};

export const deleteSalarySnapshot = async (userId: string, id: string) => {
  if (Platform.OS === "web") {
    await deleteDoc(doc(db, "users", userId, "salaryCycleSnapshots", id));
    return;
  }

  const dbx = await getLocalDatabase();
  await dbx.runAsync(
    "DELETE FROM salary_cycle_snapshots WHERE id = ? AND userId = ?",
    id,
    userId,
  );

  const profile = await getLocalProfile(userId);

  if (profile?.syncMode === "sync_enabled") {
    await deleteDoc(doc(db, "users", userId, "salaryCycleSnapshots", id));
  }
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
      onSnapshot(
        collection(db, "users", userId, "salaryArrivals"),
        run,
        onError,
      ),
      onSnapshot(
        collection(db, "users", userId, "salaryHistory"),
        run,
        onError,
      ),
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
