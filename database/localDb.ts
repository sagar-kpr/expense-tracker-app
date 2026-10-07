import { Platform } from "react-native";

import * as SQLite from "expo-sqlite";
import { initializeLocalSchema } from "./schema";

const DATABASE_NAME = "expense-tracker.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const isLocalSqliteAvailable = Platform.OS !== "web";

export const getLocalDatabase = async () => {
  if (!isLocalSqliteAvailable) {
    throw new Error("Local SQLite is not available on web.");
  }

  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME, {
      enableChangeListener: true,
    }).then(async (db) => {
      await initializeLocalSchema(db);
      return db;
    });
  }

  return dbPromise;
};

export type LocalDatabase = Awaited<ReturnType<typeof getLocalDatabase>>;
