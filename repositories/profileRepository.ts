import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import {
  doc,
  getDoc,
  onSnapshot,
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

export type AccountRecord = {
  userId: string;
  email: string;
  displayName?: string;
  syncMode?: SyncMode;
  createdAt?: number;
  updatedAt?: number;
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
    return getRemoteProfile(userId);
  }

  const localDb = await getLocalDatabase();
  const row = await localDb.getFirstAsync<any>(
    "SELECT * FROM user_profiles WHERE userId = ?",
    userId,
  );

  return mapRowToProfile(row);
};

export const getRemoteProfile = async (userId: string) => {
  const snapshot = await getDoc(doc(db, "users", userId));

  return snapshot.exists()
    ? mapRowToProfile({
        ...(snapshot.data() as Record<string, unknown>),
        userId,
      })
      : null;
};

export const getRemoteAccountRecord = async (userId: string) => {
  const snapshot = await getDoc(doc(db, "users", userId));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;

  return {
    userId,
    email: String(data.email ?? ""),
    displayName: data.displayName == null ? "" : String(data.displayName),
    syncMode: (data.syncMode ?? "local_only") as SyncMode,
    createdAt:
      data.createdAt == null ? undefined : Number(data.createdAt),
    updatedAt:
      data.updatedAt == null ? undefined : Number(data.updatedAt),
  } satisfies AccountRecord;
};

export const upsertRemoteAccountRecord = async (
  userId: string,
  account: Partial<Omit<AccountRecord, "userId">> & {
    email: string;
  },
) => {
  const current: AccountRecord | null = (await getRemoteAccountRecord(userId)) || {
    userId,
    email: "",
    displayName: "",
    syncMode: "local_only" as SyncMode,
  };
  const timestamp = nowMs();

  const nextAccount: AccountRecord = {
    userId,
    email: account.email || current.email,
    displayName: account.displayName ?? current.displayName ?? "",
    syncMode: (account.syncMode ?? current.syncMode ?? "local_only") as SyncMode,
    createdAt: current.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await setDoc(
    doc(db, "users", userId),
    {
      ...nextAccount,
      userId,
    },
    { merge: true },
  );

  return nextAccount;
};

export const ensureRemoteAccountRecord = async (
  userId: string,
  account: {
    email: string;
    displayName?: string;
    syncMode?: SyncMode;
  },
  profile?: Partial<UserProfile>,
) => {
  const current = await getRemoteAccountRecord(userId);

  if (current) {
    const nextAccount = await upsertRemoteAccountRecord(userId, {
      ...account,
      email: account.email || current.email,
      displayName: account.displayName ?? current.displayName,
      syncMode: account.syncMode ?? current.syncMode,
    });

    if (profile) {
      await mirrorProfileMetadataToRemote(userId, {
        ...profile,
        email: account.email || current.email,
        name: profile.name ?? account.displayName ?? current.displayName,
        syncMode: account.syncMode ?? current.syncMode,
      });
    }

    return nextAccount;
  }

  const nextAccount = await upsertRemoteAccountRecord(userId, account);

  if (profile) {
    await mirrorProfileMetadataToRemote(userId, {
      ...profile,
      email: account.email,
      name: profile.name ?? account.displayName ?? "",
      syncMode: account.syncMode ?? "local_only",
    });
  }

  return nextAccount;
};

export const setProfileSyncMode = async (
  userId: string,
  syncMode: SyncMode,
) => {
  const current = (await getLocalProfile(userId)) || defaultProfile();
  const nextProfile = await saveProfile(userId, {
    syncMode,
  });

  await upsertRemoteAccountRecord(userId, {
    email: current.email,
    displayName: current.name ?? "",
    syncMode,
  });

  if (syncMode === "sync_enabled") {
    const { uploadLocalAccountToFirestore } = await import(
      "@/repositories/accountRepository"
    );

    await uploadLocalAccountToFirestore(userId);
  }

  return nextProfile;
};

export const mirrorProfileMetadataToRemote = async (
  userId: string,
  profile: Partial<UserProfile> & { email?: string; name?: string },
) => {
  const current = (await getRemoteAccountRecord(userId)) || {
    userId,
    email: "",
    displayName: "",
    syncMode: "local_only" as SyncMode,
    createdAt: undefined,
    updatedAt: undefined,
  };
  const timestamp = nowMs();
  const nextName = profile.name ?? "";
  const nextEmail = profile.email ?? current.email ?? "";

  await setDoc(
    doc(db, "users", userId),
    {
      userId,
      email: nextEmail,
      displayName: nextName,
      name: nextName,
      type: profile.type ?? "",
      onboarding: Boolean(profile.onboarding),
      businessName: profile.businessName ?? "",
      darkMode: Boolean(profile.darkMode),
      syncMode: (profile.syncMode ?? current.syncMode ?? "local_only") as SyncMode,
      updatedAt: timestamp,
      createdAt: current.createdAt ?? timestamp,
    },
    { merge: true },
  );
};

export const upsertRemoteProfile = async (
  userId: string,
  profile: UserProfile,
) => {
  const current = (await getRemoteProfile(userId)) || defaultProfile();
  const nextProfile = {
    ...current,
    ...profile,
  };

  if (!current.email && profile.email) {
    nextProfile.email = profile.email;
  }

  if (!current.name && profile.name) {
    nextProfile.name = profile.name;
  }

  if (nextProfile.onboarding == null) {
    nextProfile.onboarding = current.onboarding ?? false;
  }

  if (nextProfile.darkMode == null) {
    nextProfile.darkMode = current.darkMode ?? false;
  }

  if (!nextProfile.syncMode) {
    nextProfile.syncMode = current.syncMode ?? "local_only";
  }

  await setDoc(
    doc(db, "users", userId),
    {
      ...nextProfile,
      userId,
    },
    { merge: true },
  );

  return nextProfile;
};

export const upsertLocalProfile = async (
  userId: string,
  profile: UserProfile,
) => {
  if (Platform.OS === "web") {
    return upsertRemoteProfile(userId, profile);
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

  const remote = await getRemoteProfile(params.userId);

  if (remote) {
    if (Platform.OS === "web") {
      return remote;
    }

    return upsertLocalProfile(params.userId, {
      ...defaultProfile(params.email, params.name ?? ""),
      ...remote,
      email: remote.email || params.email,
      name: remote.name ?? params.name ?? "",
    });
  }

  if (Platform.OS === "web") {
    return upsertRemoteProfile(params.userId, {
      ...defaultProfile(params.email, params.name ?? ""),
      email: params.email,
      name: params.name ?? "",
    });
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
    const nextProfile = await upsertRemoteProfile(userId, updates as UserProfile);

    return nextProfile;
  }

  const current = (await getLocalProfile(userId)) || defaultProfile();
  const nextProfile = await upsertLocalProfile(userId, {
    ...current,
    ...updates,
  });

  await mirrorProfileMetadataToRemote(userId, nextProfile);

  return nextProfile;
};

export const subscribeLocalProfile = (
  userId: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: unknown) => void,
) => {
  if (Platform.OS === "web") {
    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (snapshot) => {
        try {
          onChange(
            snapshot.exists()
              ? mapRowToProfile({
                  ...(snapshot.data() as Record<string, unknown>),
                  userId,
                })
              : null,
          );
        } catch (error) {
          onError?.(error);
        }
      },
      (error) => {
        onError?.(error);
      },
    );

    return {
      remove: unsubscribe,
    };
  }

  const run = async () => {
    try {
      onChange(await getLocalProfile(userId));
    } catch (error) {
      onError?.(error);
    }
  };

  run();

  return SQLite.addDatabaseChangeListener((event) => {
    if (event.tableName === "user_profiles") {
      run();
    }
  });
};
