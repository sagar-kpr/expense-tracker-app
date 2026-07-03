import { Platform } from "react-native";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import { nowMs } from "@/repositories/shared";

type SyncMode = "local_only" | "sync_enabled" | "sync_paused";

const collections = [
  { local: "expenses", remote: "expenses" },
  { local: "pending_transactions", remote: "pendingTransactions" },
  { local: "salary_history", remote: "salaryHistory" },
  { local: "salary_arrivals", remote: "salaryArrivals" },
  { local: "salary_cycle_snapshots", remote: "salaryCycleSnapshots" },
] as const;

const toPayload = (row: Record<string, unknown>) =>
  JSON.parse(String(row.payload || "{}")) as Record<string, unknown>;

const getRemoteDocId = (table: string, row: Record<string, unknown>) => {
  if (table === "salary_arrivals") {
    return String(row.expectedCycleKey || row.id);
  }

  if (table === "salary_cycle_snapshots") {
    return String(row.cycleKey || row.id);
  }

  return String(row.id);
};

const getRemoteCollection = (userId: string, remote: string) =>
  collection(db, "users", userId, remote);

const fetchRemoteRows = async (userId: string, remote: string) => {
  const snap = await getDocs(query(getRemoteCollection(userId, remote), limit(1000)));

  return snap.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Record<string, unknown>),
  }));
};

const upsertRemoteRow = async (
  userId: string,
  remote: string,
  row: Record<string, unknown>,
) => {
  const remoteId = getRemoteDocId(remote, row);

  await setDoc(
    doc(db, "users", userId, remote, remoteId),
    {
      ...row,
      userId,
      dirty: false,
      syncState: "synced",
      updatedAt: nowMs(),
    },
    { merge: true },
  );
};

const deleteRemoteRow = async (
  userId: string,
  remote: string,
  row: Record<string, unknown>,
) => {
  const remoteId = getRemoteDocId(remote, row);

  await deleteDoc(doc(db, "users", userId, remote, remoteId));
};

const bootstrapTableFromRemote = async (
  userId: string,
  local: string,
  remote: string,
) => {
  const dbx = await getLocalDatabase();
  const remoteRows = await fetchRemoteRows(userId, remote);

  for (const row of remoteRows) {
    const payload = toPayload(row);
    await dbx.runAsync(
      `INSERT INTO ${local} (id, userId, payload) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET userId = excluded.userId, payload = excluded.payload`,
      String(row.id),
      userId,
      JSON.stringify(payload),
    );
  }
};

export const bootstrapSyncedAccount = async (userId: string) => {
  if (Platform.OS === "web") {
    return;
  }

  const dbx = await getLocalDatabase();
  const profile = await dbx.getFirstAsync<{ syncMode?: SyncMode }>(
    "SELECT syncMode FROM user_profiles WHERE userId = ?",
    userId,
  );

  if (profile?.syncMode !== "sync_enabled") {
    return;
  }

  for (const item of collections) {
    await bootstrapTableFromRemote(userId, item.local, item.remote);
  }
};

export const pushDirtyRows = async (userId: string) => {
  if (Platform.OS === "web") {
    return;
  }

  const dbx = await getLocalDatabase();

  for (const item of collections) {
    const rows = await dbx.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${item.local} WHERE userId = ? AND dirty = 1`,
      userId,
    );

    for (const row of rows) {
      if (row.syncState === "pending_delete" || row.deletedAt) {
        await deleteRemoteRow(userId, item.remote, row);
      } else {
        await upsertRemoteRow(userId, item.remote, row);
      }

      await dbx.runAsync(
        `UPDATE ${item.local}
         SET dirty = 0,
             syncState = 'synced',
             updatedAt = ?
         WHERE id = ? AND userId = ?`,
        nowMs(),
        String(row.id),
        userId,
      );
    }
  }
};
