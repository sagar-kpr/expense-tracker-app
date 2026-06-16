import Constants from "expo-constants";

import { auth } from "@/firebase";

export type ParsedSmsTransaction = {
  amount: number;
  category: string;
  description: string;
  duplicateKey?: string;
  rawMessage: string;
  senderId?: string;
  source: "manual-paste" | "sms-auto";
  transactionDate: string;
  type: "expense" | "income";
};

type SmsTransactionType = ParsedSmsTransaction["type"];
type SmsSource = ParsedSmsTransaction["source"];
export type NativeSmsMessage = {
  body?: string;
  message?: string;
  sender?: string;
  senderId?: string;
};

type AiSmsResult = {
  amount: number;
  category: string;
  isTransaction: boolean;
  summary: string;
  transactionDate: string | null;
  type: SmsTransactionType | "none";
};

type SmsAiWorkerError = {
  details?: {
    aiStatus?: unknown;
    aiText?: unknown;
    openAiStatus?: unknown;
    openAiText?: unknown;
    phase?: unknown;
  };
  error?: unknown;
};

export type SmsParseFailureReason =
  | "ai-rejected"
  | "missing-amount"
  | "missing-auth"
  | "missing-keyword"
  | "missing-worker-url"
  | "network-error"
  | "worker-error";

export type SmsParseResult =
  | {
      transaction: ParsedSmsTransaction;
    }
  | {
      reason: SmsParseFailureReason;
      message?: string;
      status?: number;
      transaction: null;
    };

const DEFAULT_SMS_AI_WORKER_URL =
  "https://expense-tracker-sms-ai.expense-tracker-sagar.workers.dev";

const SMS_AI_DEBUG = typeof __DEV__ !== "undefined" && __DEV__;

const debugSmsAi = (step: string, data?: Record<string, unknown>) => {
  if (!SMS_AI_DEBUG) {
    return;
  }

  console.log(`[SMS AI] ${step}`, data || "");
};

const expenseKeywords = [
  "debited",
  // "debit",
  // "spent",
  // "paid",
  "withdrawn",
  // "purchase",
  // "sent",
  // "upi payment",
];

const incomeKeywords = [
  "credited",
  // "credit",
  // "received",
  "deposited",
  // "salary",
  // "refund",
  // "cashback",
];

const transactionKeywords = [...expenseKeywords, ...incomeKeywords];

const expenseCategoryKeywords: Array<{
  category: string;
  keywords: string[];
}> = [
  { category: "Food", keywords: ["restaurant", "swiggy", "zomato", "food"] },
  { category: "Travel", keywords: ["ola", "uber", "metro", "fuel", "petrol"] },
  {
    category: "Shopping",
    keywords: ["amazon", "flipkart", "myntra", "purchase", "shopping"],
  },
  {
    category: "Bills",
    keywords: ["bill", "electricity", "recharge", "broadband", "mobile"],
  },
  { category: "Health", keywords: ["hospital", "medical", "pharmacy"] },
];

const amountPatterns = [
  /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)/gi,
];

const cleanAmount = (value: string) => Number(value.replace(/,/g, ""));

const includesAny = (message: string, keywords: string[]) =>
  keywords.some((keyword) => message.includes(keyword));

const normalizeSmsInput = (input: string | NativeSmsMessage) => {
  if (typeof input === "string") {
    return {
      rawMessage: input,
      senderId: undefined,
    };
  }

  return {
    rawMessage: String(input.body || input.message || ""),
    senderId:
      typeof input.senderId === "string"
        ? input.senderId.trim()
        : typeof input.sender === "string"
          ? input.sender.trim()
          : undefined,
  };
};

const getFirstKeywordIndex = (message: string, keywords: string[]) => {
  const indexes = keywords
    .map((keyword) => message.indexOf(keyword))
    .filter((index) => index >= 0);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
};

const getManualTransactionType = (
  message: string,
): SmsTransactionType | null => {
  const expenseIndex = getFirstKeywordIndex(message, expenseKeywords);
  const incomeIndex = getFirstKeywordIndex(message, incomeKeywords);

  if (expenseIndex < 0 && incomeIndex < 0) {
    return null;
  }

  if (expenseIndex < 0) {
    return "income";
  }

  if (incomeIndex < 0) {
    return "expense";
  }

  return expenseIndex <= incomeIndex ? "expense" : "income";
};

const getManualCategory = (message: string, type: SmsTransactionType) => {
  if (type === "income") {
    if (message.includes("salary")) {
      return "Salary";
    }

    if (message.includes("refund") || message.includes("cashback")) {
      return "Refund";
    }

    return "Cash";
  }

  const match = expenseCategoryKeywords.find((item) =>
    includesAny(message, item.keywords),
  );

  return match?.category || "Other";
};

const isBalanceAmount = (message: string, startIndex: number) => {
  const context = message.slice(Math.max(0, startIndex - 30), startIndex);

  return /\b(?:avl|available|bal|balance|closing|current)\b/i.test(context);
};

const getAmount = (message: string) => {
  const matches: Array<{ amount: number; index: number }> = [];

  for (const pattern of amountPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(message)) !== null) {
      if (!match[1]) {
        continue;
      }

      const amount = cleanAmount(match[1]);

      if (Number.isFinite(amount) && amount > 0) {
        matches.push({ amount, index: match.index });
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  const nonBalanceMatch = matches.find(
    (match) => !isBalanceAmount(message, match.index),
  );

  return nonBalanceMatch ? nonBalanceMatch.amount : matches[0].amount;
};

const getDescription = (rawMessage: string, type: SmsTransactionType) => {
  const normalized = rawMessage.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return type === "income" ? "Detected income" : "Detected expense";
  }

  return normalized.length > 72
    ? `${normalized.slice(0, 69).trim()}...`
    : normalized;
};

export const getSmsDuplicateKey = (rawMessage: string) =>
  rawMessage.toLowerCase().replace(/\s+/g, " ").trim();

export const getSmsDuplicateId = (rawMessage: string) => {
  const normalized = getSmsDuplicateKey(rawMessage);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) | 0;
  }

  return `sms_${Math.abs(hash).toString(36)}`;
};

const normalizeAiResult = (
  rawMessage: string,
  source: SmsSource,
  result: AiSmsResult,
  senderId?: string,
): ParsedSmsTransaction | null => {
  if (
    result.isTransaction !== true ||
    (result.type !== "expense" && result.type !== "income") ||
    !Number.isFinite(result.amount) ||
    result.amount <= 0
  ) {
    return null;
  }

  return {
    amount: result.amount,
    category:
      result.category?.trim() || (result.type === "income" ? "Cash" : "Other"),
    description:
      result.summary?.trim() || getDescription(rawMessage, result.type),
    duplicateKey: getSmsDuplicateKey(rawMessage),
    rawMessage,
    senderId,
    source,
    transactionDate: result.transactionDate?.trim() || new Date().toISOString(),
    type: result.type,
  };
};

const parseSmsManually = (
  rawMessage: string,
  source: SmsSource,
  senderId?: string,
): ParsedSmsTransaction | null => {
  const message = rawMessage.toLowerCase();
  const amount = getAmount(rawMessage);
  const type = getManualTransactionType(message);

  if (!amount || !type) {
    return null;
  }

  return {
    amount,
    category: getManualCategory(message, type),
    description: getDescription(rawMessage, type),
    duplicateKey: getSmsDuplicateKey(rawMessage),
    rawMessage,
    senderId,
    source,
    transactionDate: new Date().toISOString(),
    type,
  };
};

const getManualFallbackResult = (
  rawMessage: string,
  source: SmsSource,
  senderId?: string,
): SmsParseResult => {
  const transaction = parseSmsManually(rawMessage, source, senderId);

  if (transaction) {
    debugSmsAi("manual fallback accepted", {
      amount: transaction.amount,
      category: transaction.category,
      type: transaction.type,
    });

    return { transaction };
  }

  debugSmsAi("manual fallback rejected");

  return { reason: "ai-rejected", transaction: null };
};

const getSmsAiWorkerUrl = () =>
  (typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_SMS_AI_WORKER_URL?.trim()
    : undefined) ||
  (typeof Constants.expoConfig?.extra?.smsAiWorkerUrl === "string"
    ? Constants.expoConfig.extra.smsAiWorkerUrl.trim()
    : undefined) ||
  DEFAULT_SMS_AI_WORKER_URL;

const getWorkerErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as SmsAiWorkerError;
    const error = typeof data.error === "string" ? data.error : "Worker error";
    const phase =
      typeof data.details?.phase === "string" ? data.details.phase : undefined;
    const aiStatus =
      typeof data.details?.aiStatus === "number"
        ? data.details.aiStatus
        : typeof data.details?.openAiStatus === "number"
          ? data.details.openAiStatus
          : undefined;
    const aiText =
      typeof data.details?.aiText === "string"
        ? data.details.aiText
        : typeof data.details?.openAiText === "string"
          ? data.details.openAiText
          : undefined;

    return [
      phase ? `${phase}: ${error}` : error,
      aiStatus ? `AI ${aiStatus}` : "",
      aiText || "",
    ]
      .filter(Boolean)
      .join(" - ");
  } catch {
    return `Worker returned HTTP ${response.status}.`;
  }
};

const confirmSmsTransactionWithAi = async (
  rawMessage: string,
  source: SmsSource,
  senderId?: string,
): Promise<SmsParseResult> => {
  const workerUrl = getSmsAiWorkerUrl();
  const token = await auth.currentUser?.getIdToken();

  if (!workerUrl) {
    debugSmsAi("missing setup", {
      hasToken: Boolean(token),
      hasWorkerUrl: false,
    });

    return getManualFallbackResult(rawMessage, source, senderId);
  }

  if (!token) {
    debugSmsAi("missing setup", {
      hasToken: false,
      hasWorkerUrl: true,
    });

    return getManualFallbackResult(rawMessage, source, senderId);
  }

  try {
    debugSmsAi("calling worker", {
      messageLength: rawMessage.length,
      senderId,
      source,
    });

    const response = await fetch(workerUrl, {
      body: JSON.stringify({ message: rawMessage, senderId, source }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    console.log("Worker status:", response.status);

    try {
      const workerBody = await response.clone().text();

      console.log("Worker body:", workerBody);
    } catch (bodyError) {
      console.log("Worker body read error:", bodyError);
    }

    if (!response.ok) {
      const message = await getWorkerErrorMessage(response);

      debugSmsAi("worker failed", {
        message,
        status: response.status,
      });

      const fallback = getManualFallbackResult(rawMessage, source, senderId);

      return fallback.transaction
        ? fallback
        : {
            message,
            reason: "worker-error",
            status: response.status,
            transaction: null,
          };
    }

    const result = (await response.json()) as AiSmsResult;

    debugSmsAi("worker result", {
      amount: result.amount,
      category: result.category,
      isTransaction: result.isTransaction,
      type: result.type,
    });

    const transaction = normalizeAiResult(rawMessage, source, result, senderId);

    return transaction
      ? { transaction }
      : { reason: "ai-rejected", transaction: null };
  } catch (error) {
    console.log("SMS AI detection error:", error);
    const fallback = getManualFallbackResult(rawMessage, source, senderId);

    return fallback.transaction
      ? fallback
      : { reason: "network-error", transaction: null };
  }
};

export const parseSmsMessageResult = async (
  input: string | NativeSmsMessage,
  source: SmsSource = "manual-paste",
): Promise<SmsParseResult> => {
  const { rawMessage, senderId } = normalizeSmsInput(input);
  const message = rawMessage.toLowerCase();
  const amount = getAmount(rawMessage);
  const hasKeyword = includesAny(message, transactionKeywords);

  debugSmsAi("local gate", {
    hasAmount: Boolean(amount),
    hasKeyword,
    messageLength: rawMessage.length,
    senderId,
    source,
  });

  if (!hasKeyword) {
    debugSmsAi("local gate rejected");

    return { reason: "missing-keyword", transaction: null };
  }

  const manualTransaction = parseSmsManually(rawMessage, source, senderId);

  if (manualTransaction) {
    debugSmsAi("manual parser accepted", {
      amount: manualTransaction.amount,
      category: manualTransaction.category,
      type: manualTransaction.type,
    });

    return { transaction: manualTransaction };
  }

  debugSmsAi("manual parser failed, calling ai");

  return confirmSmsTransactionWithAi(rawMessage, source, senderId);
};

export const parseSmsMessage = async (
  input: string | NativeSmsMessage,
  source: SmsSource = "manual-paste",
): Promise<ParsedSmsTransaction | null> => {
  const result = await parseSmsMessageResult(input, source);

  return result.transaction;
};
