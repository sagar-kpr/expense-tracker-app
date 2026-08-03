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

export type SmsParseFailureReason =
  | "missing-amount"
  | "missing-keyword"
  | "missing-user"
  | "untrusted-sender";

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

const SMS_DEBUG = typeof __DEV__ !== "undefined" && __DEV__;

const debugSmsParse = (step: string, data?: Record<string, unknown>) => {
  if (!SMS_DEBUG) {
    return;
  }

  console.log(`[SMS parser] ${step}`, data || "");
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

export const isPhoneNumberSender = (senderId?: string) => {
  const compact = String(senderId || "")
    .trim()
    .replace(/[\s()-]/g, "");

  if (!/^\+?\d+$/.test(compact)) {
    return false;
  }

  const digitCount = compact.replace(/\D/g, "").length;

  return digitCount >= 10 && digitCount <= 15;
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
    debugSmsParse("manual fallback accepted", {
      amount: transaction.amount,
      category: transaction.category,
      type: transaction.type,
    });

    return { transaction };
  }

  debugSmsParse("manual fallback rejected");

  return { reason: "missing-amount", transaction: null };
};

export const parseSmsMessageResult = async (
  input: string | NativeSmsMessage,
  source: SmsSource = "manual-paste",
): Promise<SmsParseResult> => {
  const { rawMessage, senderId } = normalizeSmsInput(input);
  const message = rawMessage.toLowerCase();
  const amount = getAmount(rawMessage);
  const hasKeyword = includesAny(message, transactionKeywords);

  debugSmsParse("local gate", {
    hasAmount: Boolean(amount),
    hasKeyword,
    messageLength: rawMessage.length,
    senderId,
    source,
  });

  if (
    source === "sms-auto" &&
    senderId &&
    isPhoneNumberSender(senderId)
  ) {
    debugSmsParse("phone-number sender rejected", { senderId });

    return { reason: "untrusted-sender", transaction: null };
  }

  if (!hasKeyword) {
    debugSmsParse("local gate rejected");

    return { reason: "missing-keyword", transaction: null };
  }

  const manualTransaction = parseSmsManually(rawMessage, source, senderId);

  if (manualTransaction) {
    debugSmsParse("manual parser accepted", {
      amount: manualTransaction.amount,
      category: manualTransaction.category,
      type: manualTransaction.type,
    });

    return { transaction: manualTransaction };
  }

  debugSmsParse("manual parser failed, using fallback");

  return getManualFallbackResult(rawMessage, source, senderId);
};

export const parseSmsMessage = async (
  input: string | NativeSmsMessage,
  source: SmsSource = "manual-paste",
): Promise<ParsedSmsTransaction | null> => {
  const result = await parseSmsMessageResult(input, source);

  return result.transaction;
};
