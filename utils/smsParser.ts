export type ParsedSmsTransaction = {
  amount: number;
  category: string;
  description: string;
  rawMessage: string;
  source: "manual-paste" | "sms-auto";
  transactionDate: string;
  type: "expense" | "income";
};

const expenseKeywords = [
  "debited",
  "debit",
  "spent",
  "paid",
  "withdrawn",
  "purchase",
  "sent",
  "upi payment",
];

const incomeKeywords = [
  "credited",
  "credit",
  "received",
  "deposited",
  "salary",
  "refund",
  "cashback",
];

const categoryRules = [
  {
    category: "Food",
    keywords: ["swiggy", "zomato", "restaurant", "food", "cafe"],
  },
  {
    category: "Travel",
    keywords: ["uber", "ola", "metro", "irctc", "flight", "travel"],
  },
  {
    category: "Shopping",
    keywords: ["amazon", "flipkart", "myntra", "shopping", "store"],
  },
  {
    category: "Bills",
    keywords: ["electricity", "bill", "recharge", "broadband", "mobile"],
  },
  {
    category: "Health",
    keywords: ["pharmacy", "hospital", "clinic", "medical"],
  },
];

const amountPatterns = [
  /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)/gi,
  /([0-9,]+(?:\.[0-9]{1,2})?)/gi,
];

const cleanAmount = (value: string) => Number(value.replace(/,/g, ""));

const includesAny = (message: string, keywords: string[]) =>
  keywords.some((keyword) => message.includes(keyword));

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

const getCategory = (message: string, type: "expense" | "income") => {
  if (type === "income") {
    if (message.includes("salary")) {
      return "Salary";
    }

    if (message.includes("refund") || message.includes("cashback")) {
      return "Other";
    }

    return "Cash";
  }

  return (
    categoryRules.find((rule) =>
      rule.keywords.some((keyword) => message.includes(keyword)),
    )?.category || "Other"
  );
};

const getDescription = (rawMessage: string, type: "expense" | "income") => {
  const normalized = rawMessage.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return type === "income" ? "Detected income" : "Detected expense";
  }

  return normalized.length > 72
    ? `${normalized.slice(0, 69).trim()}...`
    : normalized;
};

const hasDebitAccountContext = (message: string) =>
  /\b(?:a\/c|account|acct|card|wallet)\b.{0,80}\b(?:debited|debit)\b/.test(
    message,
  ) ||
  /\b(?:debited|debit)\b.{0,80}\b(?:from\s+)?(?:your\s+)?(?:a\/c|account|acct|card|wallet)\b/.test(
    message,
  );

const hasCreditAccountContext = (message: string) =>
  /\b(?:a\/c|account|acct|wallet)\b.{0,80}\b(?:credited|credit)\b/.test(
    message,
  ) ||
  /\b(?:credited|credit)\b.{0,80}\b(?:to|in)\s+(?:your\s+)?(?:a\/c|account|acct|wallet)\b/.test(
    message,
  );

const getTransactionType = (message: string) => {
  const isExpense = includesAny(message, expenseKeywords);
  const isIncome = includesAny(message, incomeKeywords);

  if (!isExpense && !isIncome) {
    return null;
  }

  if (isExpense && isIncome) {
    if (hasDebitAccountContext(message)) {
      return "expense";
    }

    if (hasCreditAccountContext(message)) {
      return "income";
    }

    return "expense";
  }

  return isExpense ? "expense" : "income";
};

export const parseSmsMessage = (
  rawMessage: string,
  source: "manual-paste" | "sms-auto" = "manual-paste",
): ParsedSmsTransaction | null => {
  const message = rawMessage.toLowerCase();
  const amount = getAmount(rawMessage);

  if (!amount) {
    return null;
  }

  const type = getTransactionType(message);

  if (!type) {
    return null;
  }

  return {
    amount,
    category: getCategory(message, type),
    description: getDescription(rawMessage, type),
    rawMessage,
    source,
    transactionDate: new Date().toISOString(),
    type,
  };
};
