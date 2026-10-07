export type SyncMode = "local_only" | "sync_enabled" | "sync_paused";

export const nowMs = () => Date.now();

export const createId = () => {
  const cryptoObj = globalThis.crypto as
    | ({ randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array } & typeof globalThis.crypto)
    | undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const toJson = (value: unknown) => JSON.stringify(value);

export const fromJson = <T>(value: string | null | undefined, fallback: T) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const boolToInt = (value: boolean) => (value ? 1 : 0);

export const intToBool = (value: unknown) => Boolean(Number(value || 0));

export const normalizeText = (value: unknown) =>
  value == null ? null : String(value);
