import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase";
import { getLocalDatabase } from "@/database/localDb";
import {
  boolToInt,
  fromJson,
  intToBool,
  nowMs,
  SyncMode,
  toJson,
} from "@/repositories/shared";

export type UserProfile = {
  email: string;
  onboarding: boolean;
  type?: string;
  salary?: number | null;
  salaryDate?: number | null;
  name?: string;
  businessName?: string;
  darkMode?: boolean;
  syncMode?: SyncMode;
};

const defaultProfile = (email = "", name = ""): UserProfile => ({
  email,
  onboarding: false,
  type: "",
  salary: null,
  salaryDate: null,
  name,
  businessName: "",
  darkMode: false,
  syncMode: "local_only",
});

const mapRowToProfile = (row: any): UserProfile | null => {
  if (!row) {
    return null;
  }

  const payload = fromJson<Partial<UserProfile>>(row.payload, {});

  return {
    email: row.email ?? payload.email ?? "",
    onboarding: intToBool(row.onboarding ?? payload.onboarding),
    type: row.type ?? payload.type ?? "",
    salary:
      row.salary == null
        ? payload.salary ?? null
        : Number(row.salary),
    salaryDate:
      row.salaryDate == null
        ? payload.salaryDate ?? null
        : Number(row.salaryDate),
    name: row.name ?? payload.name ?? "",
    businessName: row.businessName ?? payload.businessName ?? "",
    darkMode: intToBool(row.darkMode ?? payload.darkMode),
    syncMode: (row.syncMode ?? payload.syncMode ?? "local_only") as SyncMode,
  };
};

export const getLocalProfile = async (userId: string) => {
  if (Platform.OS === "web") {
    const snapshot = await getDoc(doc(db, "users", userId));

    return snapshot.exists()
      ? mapRowToProfile({
          ...(snapshot.data() as Record<string, unknown>),
          userId,
        })
      : null;
  }

  const localDb = await getLocalDatabase();
  const row = await localDb.getFirstAsync<any>(
    "SELECT * FROM user_profiles WHERE userId = ?",
    userId,
  );

  return mapRowToProfile(row);
};

export const upsertLocalProfile = async (
  userId: string,
  profile: UserProfile,
) => {
  if (Platform.OS === "web") {
    const current = (await getLocalProfile(userId)) || defaultProfile();
    const nextProfile = {
      ...current,
      ...defaultProfile(profile.email, profile.name),
      ...profile,
    };

    await setDoc(
      doc(db, "users", userId),
      {
        ...nextProfile,
        userId,
      },
      { merge: true },
    );

    return nextProfile;
  }

  const localDb = await getLocalDatabase();
  const existing = await getLocalProfile(userId);
  const timestamp = nowMs();
  const nextProfile = {
    ...defaultProfile(profile.email, profile.name),
    ...existing,
    ...profile,
  };

  await localDb.runAsync(
    `
    INSERT INTO user_profiles (
      userId, email, onboarding, type, salary, salaryDate, name, businessName,
      darkMode, syncMode, createdAt, updatedAt, payload
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM user_profiles WHERE userId = ?), ?), ?, ?
    )
    ON CONFLICT(userId) DO UPDATE SET
      email = excluded.email,
      onboarding = excluded.onboarding,
      type = excluded.type,
      salary = excluded.salary,
      salaryDate = excluded.salaryDate,
      name = excluded.name,
      businessName = excluded.businessName,
      darkMode = excluded.darkMode,
      syncMode = excluded.syncMode,
      updatedAt = excluded.updatedAt,
      payload = excluded.payload
  `,
    [
      userId,
      nextProfile.email,
      boolToInt(Boolean(nextProfile.onboarding)),
      nextProfile.type ?? "",
      nextProfile.salary ?? null,
      nextProfile.salaryDate ?? null,
      nextProfile.name ?? "",
      nextProfile.businessName ?? "",
      boolToInt(Boolean(nextProfile.darkMode)),
      nextProfile.syncMode ?? "local_only",
      userId,
      timestamp,
      timestamp,
      toJson(nextProfile),
    ],
  );

  return nextProfile;
};

export const ensureLocalProfile = async (params: {
  userId: string;
  email: string;
  name?: string;
}) => {
  const existing = await getLocalProfile(params.userId);

  if (existing) {
    return existing;
  }

  return upsertLocalProfile(params.userId, {
    ...defaultProfile(params.email, params.name ?? ""),
    email: params.email,
    name: params.name ?? "",
  });
};

export const loadActiveProfile = async (userId: string) => {
  return getLocalProfile(userId);
};

export const saveProfile = async (userId: string, updates: Partial<UserProfile>) => {
  if (Platform.OS === "web") {
    const current = (await getLocalProfile(userId)) || defaultProfile();
    const nextProfile = {
      ...current,
      ...updates,
    };

    await setDoc(
      doc(db, "users", userId),
      {
        ...nextProfile,
        userId,
      },
      { merge: true },
    );

    const snapshot = await getDoc(doc(db, "users", userId));

    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  }

  const current = (await getLocalProfile(userId)) || defaultProfile();
  return upsertLocalProfile(userId, {
    ...current,
    ...updates,
  });
};

export const markProfileSyncMode = async (userId: string, syncMode: SyncMode) =>
  saveProfile(userId, { syncMode });

export const isSyncEnabled = (profile: UserProfile | null | undefined) =>
  profile?.syncMode === "sync_enabled";

export const resetLocalUserSession = async (userId: string) => {
  if (Platform.OS === "web") {
    return;
  }

  const localDb = await getLocalDatabase();

  await localDb.runAsync(
    "UPDATE user_profiles SET syncMode = ?, updatedAt = ? WHERE userId = ?",
    "local_only",
    nowMs(),
    userId,
  );
};

export const subscribeLocalProfile = (
  userId: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: unknown) => void,
) => {
  const run = async () => {
    try {
      onChange(await getLocalProfile(userId));
    } catch (error) {
      onError?.(error);
    }
  };

  run();

  if (Platform.OS === "web") {
    return {
      remove() {},
    };
  }

  return SQLite.addDatabaseChangeListener((event) => {
    if (event.tableName === "user_profiles") {
      run();
    }
  });
};
