import assert from "node:assert/strict";
import test from "node:test";
import { initializeLocalSchema, schema } from "./schema.ts";
import { createSqliteAdapter } from "../tests/sqliteAdapter.mjs";

const seedProfiles = (db) => db.database.exec(`
  INSERT INTO user_profiles (userId,createdAt,updatedAt,payload)
  VALUES ('A',0,0,'{}'),('B',0,0,'{}');
`);

test("fresh salary tables support repository payloads and account-scoped IDs", async () => {
  const db = createSqliteAdapter();
  try {
    await initializeLocalSchema(db);
    seedProfiles(db);
    for (const userId of ["A", "B"]) {
      await db.runAsync(`INSERT INTO salary_history
        (id,userId,salary,salaryDate,effectiveFromMs,createdAtMs,updatedAt,payload)
        VALUES ('same-id',?,50000,7,0,0,0,'{}')`, userId);
      await db.runAsync(`INSERT INTO salary_arrivals
        (id,userId,arrivedAtMs,createdAtMs,cycleKey,expectedCycleKey,salary,salaryDate,updatedAt,payload)
        VALUES ('2026-10-07',?,0,0,'2026-10-07','2026-10-07',50000,7,0,'{}')`, userId);
      await db.runAsync(`INSERT INTO salary_cycle_snapshots
        (id,userId,cycleKey,cycleStartMs,cycleEndMs,salary,salaryDate,totalSpent,remaining,usagePercent,expenseCount,updatedAtMs,createdAtMs,updatedAt,payload)
        VALUES ('2026-10-07',?,'2026-10-07',0,1,50000,7,0,50000,0,0,0,0,0,'{}')`, userId);
      await db.runAsync(`INSERT INTO expenses
        (id,userId,amount,createdAt,updatedAt,payload) VALUES ('same-sms',?,500,'date',0,'{}')`, userId);
      await db.runAsync(`INSERT INTO pending_transactions
        (id,userId,amount,createdAt,updatedAt) VALUES ('same-sms',?,500,'date',0)`, userId);
    }
    for (const table of ["salary_history", "salary_arrivals", "salary_cycle_snapshots", "expenses", "pending_transactions"]) {
      assert.equal((await db.getAllAsync(`SELECT * FROM ${table}`)).length, 2);
    }
  } finally { db.database.close(); }
});

test("legacy migration preserves records, adds payload columns, and is idempotent", async () => {
  const db = createSqliteAdapter();
  try {
    const legacy = schema.replaceAll("  PRIMARY KEY(userId, id),\n", "")
      .replaceAll("  id TEXT NOT NULL,", "  id TEXT PRIMARY KEY NOT NULL,")
      .replaceAll("  payload TEXT NOT NULL DEFAULT '{}',\n", "");
    await db.execAsync(legacy);
    seedProfiles(db);
    await db.runAsync(`INSERT INTO expenses
      (id,userId,amount,createdAt,updatedAt,payload) VALUES ('expense','A',123,'date',0,'{"source":"legacy"}')`);
    await db.runAsync(`INSERT INTO salary_history
      (id,userId,salary,salaryDate,effectiveFromMs,createdAtMs,updatedAt) VALUES ('history','A',50000,7,0,0,0)`);
    await initializeLocalSchema(db);
    await initializeLocalSchema(db);
    assert.equal((await db.getFirstAsync("SELECT * FROM expenses WHERE userId='A'")).amount, 123);
    assert.equal((await db.getFirstAsync("SELECT * FROM salary_history WHERE userId='A'")).salary, 50000);
    assert.equal((await db.getFirstAsync("SELECT * FROM salary_history WHERE userId='A'")).payload, "{}");
    await db.runAsync(`INSERT INTO expenses
      (id,userId,amount,createdAt,updatedAt,payload) VALUES ('expense','B',456,'date',0,'{}')`);
    assert.equal((await db.getAllAsync("SELECT * FROM expenses")).length, 2);
  } finally { db.database.close(); }
});
