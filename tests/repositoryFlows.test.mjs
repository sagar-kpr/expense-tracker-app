import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createSqliteAdapter } from "./sqliteAdapter.mjs";

globalThis.reviewDb = createSqliteAdapter();
globalThis.remoteDeletes = [];
const mocks = {
  "react-native": 'export const Platform = { OS: "ios" };',
  "expo-sqlite": 'export const openDatabaseAsync = async () => globalThis.reviewDb; export const addDatabaseChangeListener = () => ({remove(){}});',
  "@/firebase": 'export const db = {};',
  "firebase/firestore": `
    export const doc = (...args) => args.slice(1).join('/');
    export const collection = doc;
    export const getDoc = async () => ({exists: () => false});
    export const getDocs = async () => ({empty: true, docs: []});
    export const setDoc = async () => {};
    export const deleteDoc = async (ref) => { globalThis.remoteDeletes.push(ref); };
    export const onSnapshot = () => () => {};
    export const orderBy = () => {};
    export const query = () => {};
    export const updateDoc = async () => {};
    export const writeBatch = () => ({set(){}, delete(){}, async commit(){}});
  `,
};
registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocks[specifier]) return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}` };
  if (specifier.startsWith("@/")) return { shortCircuit: true, url: pathToFileURL(path.resolve(`${specifier.slice(2)}.ts`)).href };
  if (specifier === "./schema") return { shortCircuit: true, url: new URL("./schema.ts", context.parentURL).href };
  return nextResolve(specifier, context);
}});
const { getLocalDatabase } = await import("../database/localDb.ts");
const { upsertLocalProfile, getLocalProfile } = await import("../repositories/profileRepository.ts");
const { upsertExpense, listExpenses } = await import("../repositories/expenseRepository.ts");
const { upsertSalaryHistory, upsertSalarySnapshot, listSalarySnapshots, listSalaryArrivals } = await import("../repositories/salaryRepository.ts");
const { upsertPendingTransaction, listPendingTransactions, updatePendingTransaction } = await import("../repositories/pendingTransactionRepository.ts");
const { clearLocalAccountData, deleteRemoteAccountData } = await import("../repositories/accountRepository.ts");
const { buildSalaryCycleSnapshot } = await import("../services/salaryLedger.ts");
const { saveTransactionWithSalaryValidation, saveExpenseWithAdditionalFunds, getSalaryBalanceState } = await import("../services/salaryBalance.ts");
const { confirmSalaryArrivalRecord } = await import("../services/salaryArrival.ts");
const profile = { email: "test@example.com", onboarding: true, type: "salary", salary: 50000, salaryDate: 7, syncMode: "local_only", name: "", businessName: "", darkMode: false };
const start = new Date(2026, 8, 7);
const timestamp = new Date(2026, 9, 9, 12).getTime();
const transaction = (id, amount, date, type = "expense") => ({ id, amount, type, createdAt: date.toISOString() });

beforeEach(async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: timestamp });
  const db = await getLocalDatabase();
  await db.execAsync("DELETE FROM user_profiles;");
  globalThis.remoteDeletes = [];
  for (const uid of ["A", "B"]) await upsertLocalProfile(uid, profile);
  await upsertSalaryHistory("A", { id: "baseline", salary: 50000, salaryDate: 7, effectiveFromMs: start.getTime(), createdAtMs: start.getTime() });
  await upsertSalarySnapshot("A", buildSalaryCycleSnapshot({ profile, cycleStart: start, referenceDate: start }));
});

test("actual repository upserts isolate accounts sharing salary and SMS IDs", async () => {
  const snapshot = buildSalaryCycleSnapshot({ profile: {salary: 60000, salaryDate: 7}, cycleStart: start, referenceDate: start });
  await upsertSalarySnapshot("B", snapshot);
  assert.equal((await listSalarySnapshots("A"))[0].salary, 50000);
  assert.equal((await listSalarySnapshots("B"))[0].salary, 60000);
  for (const uid of ["A", "B"]) {
    await upsertExpense(uid, transaction("sms_same", uid === "A" ? 100 : 200, new Date()));
    await upsertPendingTransaction(uid, transaction("pending_same", uid === "A" ? 300 : 400, new Date()));
  }
  assert.equal((await listExpenses("A"))[0].amount, 100);
  assert.equal((await listExpenses("B"))[0].amount, 200);
  assert.equal((await listPendingTransactions("A"))[0].amount, 300);
  assert.equal((await listPendingTransactions("B"))[0].amount, 400);
});

test("late payday validation includes spending after the scheduled payday", async () => {
  await upsertExpense("A", transaction("spent", 50000, new Date(2026, 9, 8)));
  const result = await saveTransactionWithSalaryValidation({ userId: "A", profile,
    transaction: transaction("new", 1, new Date()) });
  assert.equal(result.status, "insufficient-funds");
  assert.equal(result.available, 0);
  assert.equal((await listExpenses("A")).length, 1);
});

test("early salary rollover persists the correct month and remains idempotent across SMS/manual confirmation", async () => {
  const arrivedAtMs = new Date(2026, 9, 5, 12).getTime();
  await upsertExpense("A", transaction("old-spend", 49000, new Date(2026, 9, 4)));
  await confirmSalaryArrivalRecord({userId: "A", profile, arrivedAtMs, salary: 50000, source: "sms-salary-arrival", skipIfConfirmed: true});
  await confirmSalaryArrivalRecord({userId: "A", profile, arrivedAtMs, salary: 50000});
  await confirmSalaryArrivalRecord({userId: "A", profile, arrivedAtMs, salary: 50000, skipIfConfirmed: true});
  const arrivals = await listSalaryArrivals("A");
  assert.equal(arrivals.length, 1);
  assert.equal(arrivals[0].expectedCycleKey, "2026-10-07");
  const balance = await getSalaryBalanceState({userId: "A", profile, expenses: await listExpenses("A")});
  assert.equal(balance.cycle.availableTotal, 51000);
  assert.equal(balance.cycle.additionalFunds, 0);
  assert.equal((await listExpenses("A")).length, 1);
});

test("completed cycles reject pending debits, credits, and funded approval before writing", async () => {
  await confirmSalaryArrivalRecord({ userId: "A", profile, arrivedAtMs: new Date(2026,9,7,12).getTime() });
  for (const type of ["expense", "income"]) {
    await assert.rejects(saveTransactionWithSalaryValidation({userId: "A", profile,
      transaction: transaction("old-"+type, 100, new Date(2026,9,6), type)}), /read-only/);
  }
  await assert.rejects(saveExpenseWithAdditionalFunds({userId: "A", profile, additionalFunds: 100,
    expenseAmount: 100, description: "old", transaction: transaction("old-funded", 100, new Date(2026,9,6))}), /read-only/);
  assert.equal((await listExpenses("A")).length, 0);
});

test("funded pending approval retains its original ID/date and retry does not add funds twice", async () => {
  await upsertExpense("A", transaction("spent", 50000, new Date(2026,9,8)));
  const pending = transaction("pending", 100, new Date(2026,9,8,18));
  const input = {userId: "A", profile, additionalFunds: 100, expenseAmount: 100, description: "pending", transaction: pending};
  await saveExpenseWithAdditionalFunds(input);
  await saveExpenseWithAdditionalFunds(input);
  const records = await listExpenses("A");
  assert.equal(records.length, 3);
  assert.equal(records.find((item) => item.id === "pending").createdAt, pending.createdAt);
});

test("transaction deletion preserves profile and another user's data; account deletion removes the profile", async () => {
  await upsertExpense("B", transaction("keep", 100, new Date()));
  await clearLocalAccountData("A", true);
  await deleteRemoteAccountData("A", true);
  assert.deepEqual(await getLocalProfile("A"), profile);
  const reset = (await listSalarySnapshots("A"))[0];
  assert.equal(reset.carryForward, 0);
  assert.equal(reset.totalSpent, 0);
  assert.equal(reset.salary, profile.salary);
  assert.equal((await listExpenses("B")).length, 1);
  assert.deepEqual(globalThis.remoteDeletes, []);
  await clearLocalAccountData("A");
  await deleteRemoteAccountData("A");
  assert.equal(await getLocalProfile("A"), null);
  assert.deepEqual(globalThis.remoteDeletes, ["users/A"]);
});

test("pending SMS edits preserve sender and the deduplication fingerprint", async () => {
  await upsertPendingTransaction("A", {...transaction("edit", 500, new Date()), senderId: "VK-HDFCBK", duplicateKey: "fingerprint"});
  await updatePendingTransaction("A", "edit", {amount: 600, category: "Bills"});
  const pending = (await listPendingTransactions("A"))[0];
  assert.equal(pending.amount, 600);
  assert.equal(pending.senderId, "VK-HDFCBK");
  assert.equal(pending.duplicateKey, "fingerprint");
});

test("confirming salary after a transaction reset does not double the baseline salary", async () => {
  await clearLocalAccountData("A", true);
  await confirmSalaryArrivalRecord({userId: "A", profile, salary: 50000,
    arrivedAtMs: new Date(2026,9,9,11).getTime(), skipIfConfirmed: true});
  const balance = await getSalaryBalanceState({userId: "A", profile, expenses: await listExpenses("A")});
  assert.equal(balance.cycle.availableTotal, 50000);
  assert.equal(balance.cycle.carryForward, 0);
  assert.equal((await listSalarySnapshots("A")).filter((item) => item.status === "open").length, 1);
});

test("salary rollovers on the same date stay isolated across accounts", async () => {
  await upsertSalarySnapshot("B", buildSalaryCycleSnapshot({profile: {...profile, salary: 60000}, cycleStart: start, referenceDate: start}));
  const arrivedAtMs = new Date(2026,9,7,12).getTime();
  await confirmSalaryArrivalRecord({userId: "A", profile, arrivedAtMs, salary: 50000});
  await confirmSalaryArrivalRecord({userId: "B", profile: {...profile, salary: 60000}, arrivedAtMs, salary: 60000});
  assert.equal((await listSalaryArrivals("A"))[0].salary, 50000);
  assert.equal((await listSalaryArrivals("B"))[0].salary, 60000);
  assert.equal((await listSalarySnapshots("A")).find((item) => item.status === "open").salary, 50000);
  assert.equal((await listSalarySnapshots("B")).find((item) => item.status === "open").salary, 60000);
});

test("concurrent expenses share one balance check and cannot overspend", async () => {
  const results = await Promise.all(["one", "two"].map((id) =>
    saveTransactionWithSalaryValidation({userId: "A", profile, transaction: transaction(id, 30000, new Date())})));
  assert.deepEqual(results.map((item) => item.status).sort(), ["insufficient-funds", "saved"]);
  assert.equal((await listExpenses("A")).length, 1);
});

test("decimal expenses can use the exact last paise without a false shortfall", async () => {
  await upsertExpense("A", transaction("large",49999.7,new Date()));
  const result = await saveTransactionWithSalaryValidation({userId:"A",profile,transaction:transaction("last",0.3,new Date())});
  assert.equal(result.status,"saved");
  const balance = await getSalaryBalanceState({userId:"A",profile,expenses:await listExpenses("A")});
  assert.equal(balance.cycle.remaining,0);
});
test("writes normalize paise and reject amounts too small or too large to represent accurately", async () => {
  const business = {...profile,type:"self-employed"};
  const result = await saveTransactionWithSalaryValidation({userId:"A",profile:business,transaction:transaction("decimal",1.005,new Date())});
  assert.equal(result.expense.amount,1.01);
  for(const value of [0.001,1e100,Infinity,-1]) await assert.rejects(saveTransactionWithSalaryValidation({userId:"A",profile:business,transaction:transaction("invalid",value,new Date())}));
  assert.equal((await listExpenses("A")).length,1);
});
