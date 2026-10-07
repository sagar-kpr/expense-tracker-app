import { buildSalaryCycleSnapshot, getCurrentSalaryCycle } from "@/services/salaryLedger";
import { Platform } from "react-native";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import { getLocalProfile } from "@/repositories/profileRepository";
import { listExpenses } from "@/repositories/expenseRepository";
import { listPendingTransactions } from "@/repositories/pendingTransactionRepository";
import {
  listSalaryArrivals,
  listSalaryHistory,
  listSalarySnapshots,
  upsertSalaryHistory,
  upsertSalarySnapshot,
} from "@/repositories/salaryRepository";
import { mirrorProfileMetadataToRemote } from "@/repositories/profileRepository";
import { createId } from "@/repositories/shared";

const deleteCollectionInBatches = async (path: string) => {
  const snapshot = await getDocs(collection(db, path));

  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(db);
  let operationCount = 0;

  for (const item of snapshot.docs) {
    batch.delete(item.ref);
    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
};

export const exportAccountData = async (uid: string) => {
  const [profile, expenses, pending, salaryArrivals, salaryHistory, salaryCycleSnapshots] =
    await Promise.all([
      getLocalProfile(uid),
      listExpenses(uid),
      listPendingTransactions(uid),
      listSalaryArrivals(uid),
      listSalaryHistory(uid),
      listSalarySnapshots(uid),
    ]);

  return {
    expenses,
    pending,
    profile,
    salaryArrivals,
    salaryCycleSnapshots,
    salaryHistory,
  };
};

const writeCollection = async (
  userId: string,
  collectionName: string,
  items: Array<Record<string, unknown> & { id?: string }>,
) => {
  await Promise.all(
    items.map((item) =>
      setDoc(
        doc(db, "users", userId, collectionName, String(item.id || createId())),
        {
          ...item,
          userId,
        },
        { merge: true },
      ),
    ),
  );
};

export const uploadLocalAccountToFirestore = async (uid: string) => {
  const { expenses, pending, profile, salaryArrivals, salaryCycleSnapshots, salaryHistory } =
    await exportAccountData(uid);

  if (profile) {
    await mirrorProfileMetadataToRemote(uid, {
      ...profile,
      syncMode: "sync_enabled",
    });
  }

  await Promise.all([
    writeCollection(uid, "expenses", expenses),
    writeCollection(uid, "pendingTransactions", pending),
    writeCollection(uid, "salaryHistory", salaryHistory),
    writeCollection(uid, "salaryArrivals", salaryArrivals),
    writeCollection(uid, "salaryCycleSnapshots", salaryCycleSnapshots),
  ]);
};

export const clearLocalAccountData = async (uid: string, preserveProfile = false) => {
  if (Platform.OS === "web") {
    return;
  }

  const dbx = await getLocalDatabase();
  const profile = preserveProfile ? await getLocalProfile(uid) : null;
  await dbx.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("DELETE FROM salary_cycle_snapshots WHERE userId = ?", uid);
    await txn.runAsync("DELETE FROM salary_arrivals WHERE userId = ?", uid);
    await txn.runAsync("DELETE FROM salary_history WHERE userId = ?", uid);
    await txn.runAsync("DELETE FROM pending_transactions WHERE userId = ?", uid);
    await txn.runAsync("DELETE FROM expenses WHERE userId = ?", uid);
    if (!preserveProfile) {
      await txn.runAsync("DELETE FROM user_profiles WHERE userId = ?", uid);
    }
  });
  // Start a clean baseline, so old savings and confirmation prompts do not
  // survive a transaction reset while the account remains usable.
  if (profile?.type === "salary" && Number(profile.salary || 0) > 0) {
    const now = Date.now();
    await upsertSalaryHistory(uid, {
      id: createId(), salary: Number(profile.salary), salaryDate: Number(profile.salaryDate || 1),
      effectiveFromMs: now, createdAtMs: now, source: "transaction-data-reset",
    });
    const cycle = getCurrentSalaryCycle(Number(profile.salaryDate || 1));
    await upsertSalarySnapshot(uid, {
      ...buildSalaryCycleSnapshot({profile, cycleStart: cycle.start, referenceDate: new Date()}),
      source: "transaction-data-reset",
    });
  }
};

export const deleteRemoteAccountData = async (uid: string, preserveProfile = false) => {
  await Promise.all([
    deleteCollectionInBatches(`users/${uid}/expenses`),
    deleteCollectionInBatches(`users/${uid}/pendingTransactions`),
    deleteCollectionInBatches(`users/${uid}/salaryHistory`),
    deleteCollectionInBatches(`users/${uid}/salaryArrivals`),
    deleteCollectionInBatches(`users/${uid}/salaryCycleSnapshots`),
  ]);

  if (!preserveProfile) {
    await deleteDoc(doc(db, "users", uid));
  }
};
