import { Platform } from "react-native";

import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "expense-tracker.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS user_profiles (
  userId TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  onboarding INTEGER NOT NULL DEFAULT 0,
  type TEXT,
  salary REAL,
  salaryDate INTEGER,
  name TEXT,
  businessName TEXT,
  darkMode INTEGER NOT NULL DEFAULT 0,
  syncMode TEXT NOT NULL DEFAULT 'local_only',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  category TEXT,
  type TEXT NOT NULL DEFAULT 'expense',
  createdAt TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  payload TEXT NOT NULL,
  FOREIGN KEY(userId) REFERENCES user_profiles(userId) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_createdAt
  ON expenses(userId, createdAt DESC);

CREATE TABLE IF NOT EXISTS pending_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  category TEXT,
  type TEXT NOT NULL DEFAULT 'expense',
  createdAt TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  senderId TEXT,
  FOREIGN KEY(userId) REFERENCES user_profiles(userId) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_user_createdAt
  ON pending_transactions(userId, createdAt DESC);

CREATE TABLE IF NOT EXISTS salary_history (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  salary REAL NOT NULL,
  salaryDate INTEGER NOT NULL,
  effectiveFromMs INTEGER NOT NULL,
  createdAtMs INTEGER NOT NULL,
  source TEXT,
  note TEXT,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES user_profiles(userId) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salary_history_user_effective
  ON salary_history(userId, effectiveFromMs ASC);

CREATE TABLE IF NOT EXISTS salary_arrivals (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  arrivedAtMs INTEGER NOT NULL,
  createdAtMs INTEGER NOT NULL,
  cycleKey TEXT NOT NULL,
  expectedCycleKey TEXT NOT NULL,
  salary REAL NOT NULL,
  salaryDate INTEGER NOT NULL,
  source TEXT,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES user_profiles(userId) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salary_arrivals_user_expected
  ON salary_arrivals(userId, expectedCycleKey ASC);

CREATE TABLE IF NOT EXISTS salary_cycle_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  cycleKey TEXT NOT NULL,
  expectedCycleKey TEXT,
  cycleStartMs INTEGER NOT NULL,
  cycleEndMs INTEGER NOT NULL,
  carryForward REAL NOT NULL DEFAULT 0,
  salary REAL NOT NULL,
  salaryDate INTEGER NOT NULL,
  additionalFunds REAL NOT NULL DEFAULT 0,
  availableTotal REAL NOT NULL DEFAULT 0,
  totalSpent REAL NOT NULL,
  remaining REAL NOT NULL,
  usagePercent REAL NOT NULL,
  expenseCount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closedAtMs INTEGER,
  schemaVersion INTEGER NOT NULL DEFAULT 2,
  source TEXT,
  updatedAtMs INTEGER NOT NULL,
  createdAtMs INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY(userId) REFERENCES user_profiles(userId) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_salary_snapshots_user_cycle
  ON salary_cycle_snapshots(userId, cycleStartMs ASC);
`;

const ensureSalarySnapshotV2Columns = async (db: SQLite.SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(salary_cycle_snapshots)",
  );
  const names = new Set(columns.map((column) => column.name));
  const additions = [
    ["carryForward", "REAL NOT NULL DEFAULT 0"],
    ["additionalFunds", "REAL NOT NULL DEFAULT 0"],
    ["availableTotal", "REAL NOT NULL DEFAULT 0"],
    ["status", "TEXT NOT NULL DEFAULT 'open'"],
    ["closedAtMs", "INTEGER"],
    ["schemaVersion", "INTEGER NOT NULL DEFAULT 1"],
  ] as const;

  for (const [name, definition] of additions) {
    if (!names.has(name)) {
      await db.execAsync(
        `ALTER TABLE salary_cycle_snapshots ADD COLUMN ${name} ${definition}`,
      );
    }
  }

  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    "salary_cycle_schema",
    "2",
  );
};

export const isLocalSqliteAvailable = Platform.OS !== "web";

export const getLocalDatabase = async () => {
  if (!isLocalSqliteAvailable) {
    throw new Error("Local SQLite is not available on web.");
  }

  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME, {
      enableChangeListener: true,
    }).then(async (db) => {
      await db.execAsync(schema);
      await ensureSalarySnapshotV2Columns(db);
      return db;
    });
  }

  return dbPromise;
};

export type LocalDatabase = Awaited<ReturnType<typeof getLocalDatabase>>;
