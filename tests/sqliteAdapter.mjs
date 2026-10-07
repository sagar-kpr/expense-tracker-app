import { DatabaseSync } from "node:sqlite";

export const createSqliteAdapter = () => {
  const database = new DatabaseSync(":memory:");
  const params = (values) => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const adapter = {
    database,
    execAsync: async (sql) => { database.exec(sql); },
    getAllAsync: async (sql, ...values) => database.prepare(sql).all(...params(values)),
    getFirstAsync: async (sql, ...values) => database.prepare(sql).get(...params(values)) || null,
    runAsync: async (sql, ...values) => database.prepare(sql).run(...params(values)),
    withExclusiveTransactionAsync: async (task) => {
      database.exec("BEGIN IMMEDIATE");
      try {
        await task(adapter);
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return adapter;
};
