const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FIRESTORE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_API_BASE = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

let cachedFirestoreAccessToken;
let cachedFirestoreAccessTokenExpiry = 0;
let cachedJwks;
const expenseKeywords = [
  "debited",
  "withdrawn",
  "spent",
  "paid",
  "purchase",
  "sent",
  "upi payment",
];

const incomeKeywords = [
  "credited",
  "deposited",
  "salary",
  "refund",
  "cashback",
  "received",
];

const transactionKeywords = [...expenseKeywords, ...incomeKeywords];

const expenseCategoryKeywords = [
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

const cleanAmount = (value) => Number(String(value || "").replace(/,/g, ""));

const includesAny = (message, keywords) =>
  keywords.some((keyword) => message.includes(keyword));

const getFirstKeywordIndex = (message, keywords) => {
  const indexes = keywords
    .map((keyword) => message.indexOf(keyword))
    .filter((index) => index >= 0);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
};

const getManualTransactionType = (message) => {
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

const getManualCategory = (message, type) => {
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

const isBalanceAmount = (message, startIndex) => {
  const context = message.slice(Math.max(0, startIndex - 30), startIndex);

  return /\b(?:avl|available|bal|balance|closing|current)\b/i.test(context);
};

const getAmount = (message) => {
  const matches = [];

  for (const pattern of amountPatterns) {
    pattern.lastIndex = 0;

    let match;
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

const getDescription = (rawMessage, type) => {
  const normalized = String(rawMessage || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return type === "income" ? "Detected income" : "Detected expense";
  }

  return normalized;
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
    status,
  });

const errorResponse = (message, status = 500, details = {}) =>
  jsonResponse(
    {
      details,
      error: message,
    },
    status,
  );

const normalizeMessageKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getPendingDuplicateKey = (rawMessage) => normalizeMessageKey(rawMessage);

const toBase64Url = (input) => {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : input instanceof Uint8Array
          ? input
          : new Uint8Array(input);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const pemToArrayBuffer = (pem) => {
  const normalized = String(pem || "")
    .trim()
    .replace(/^"(.*)"$/s, "$1")
    .replace(/\\n/g, "\n");

  const clean = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

const toFirestoreValue = (value) => {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  switch (typeof value) {
    case "string":
      return { stringValue: value };
    case "number":
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    case "boolean":
      return { booleanValue: value };
    case "object":
      return {
        mapValue: {
          fields: toFirestoreFields(value),
        },
      };
    default:
      return { stringValue: String(value) };
  }
};

const toFirestoreFields = (value) =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, toFirestoreValue(item)]),
  );

const getServiceAccountAccessToken = async (env) => {
  const now = Date.now();

  if (
    cachedFirestoreAccessToken &&
    cachedFirestoreAccessTokenExpiry > now + 30_000
  ) {
    return cachedFirestoreAccessToken;
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing Firestore service account credentials.");
  }

  const issuedAt = Math.floor(now / 1000);
  const assertionPayload = {
    aud: FIRESTORE_TOKEN_URL,
    exp: issuedAt + 3600,
    iat: issuedAt,
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: FIRESTORE_SCOPE,
  };
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const unsignedToken = `${toBase64Url(
    JSON.stringify(header),
  )}.${toBase64Url(JSON.stringify(assertionPayload))}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY),
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${toBase64Url(signature)}`;

  const tokenResponse = await fetch(FIRESTORE_TOKEN_URL, {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(
      `Unable to mint Firestore access token (${tokenResponse.status}): ${text.slice(0, 500)}`,
    );
  }

  const tokenData = await tokenResponse.json();

  cachedFirestoreAccessToken = tokenData.access_token;
  cachedFirestoreAccessTokenExpiry =
    now + Number(tokenData.expires_in || 3600) * 1000;

  return cachedFirestoreAccessToken;
};

const getFirestoreDocument = async (env, documentPath) => {
  const accessToken = await getServiceAccountAccessToken(env);
  const response = await fetch(
    `${FIRESTORE_API_BASE(env.FIREBASE_PROJECT_ID)}/${documentPath}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Firestore read failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return response.json();
};

const userDocumentExists = async (env, userId) => {
  const document = await getFirestoreDocument(
    env,
    `users/${encodeURIComponent(userId)}`,
  );

  return Boolean(document);
};

const buildPendingTransactionRecord = (
  message,
  senderId,
  classification,
  source,
) => ({
  amount: classification.amount,
  category: classification.category,
  createdAt: new Date().toISOString(),
  description: classification.summary,
  duplicateKey: getPendingDuplicateKey(message),
  rawMessage: String(message || ""),
  senderId: senderId || undefined,
  source: source || "web-api",
  status: "pending",
  transactionDate: classification.transactionDate || new Date().toISOString(),
  type: classification.type,
  updatedAt: Date.now(),
});

const writePendingTransactionToFirestore = async (env, userId, transaction) => {
  const accessToken = await getServiceAccountAccessToken(env);
  const documentName = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}/pendingTransactions/${transaction.id}`;
  const response = await fetch(
    `${FIRESTORE_API_BASE(env.FIREBASE_PROJECT_ID)}:commit`,
    {
      body: JSON.stringify({
        writes: [
          {
            update: {
              fields: toFirestoreFields({
                ...transaction,
                userId,
              }),
              name: documentName,
            },
          },
        ],
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Firestore write failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return response.json();
};

const classifySmsTransaction = async (message, source, senderId) => {
  const normalizedMessage = String(message || "").toLowerCase();
  const amount = getAmount(message);
  const type = getManualTransactionType(normalizedMessage);

  if (!amount || !type) {
    return {
      amount: 0,
      category: "",
      isTransaction: false,
      summary: "",
      transactionDate: null,
      type: "none",
    };
  }

  return {
    amount,
    category: getManualCategory(normalizedMessage, type),
    isTransaction: true,
    summary: getDescription(message, type),
    transactionDate: new Date().toISOString(),
    type,
  };
};

const parsePendingTransactionsPath = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);

  if (
    parts.length !== 3 ||
    parts[0] !== "api" ||
    parts[2] !== "pending-transactions"
  ) {
    return null;
  }

  return parts[1] || null;
};

const base64UrlToBytes = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const base64UrlToJson = (value) =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));

const getFirebaseJwks = async () => {
  if (cachedJwks) {
    return cachedJwks;
  }

  const response = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  );

  if (!response.ok) {
    throw new Error("Could not load Firebase signing keys.");
  }

  cachedJwks = await response.json();

  return cachedJwks;
};

const verifyFirebaseIdToken = async (idToken, projectId) => {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid token format.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlToJson(encodedHeader);
  const payload = base64UrlToJson(encodedPayload);

  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported token header.");
  }

  const jwks = await getFirebaseJwks();
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);

  if (!jwk) {
    throw new Error("Unknown Firebase signing key.");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
  const isValidSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!isValidSignature) {
    throw new Error("Invalid token signature.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    Number(payload.exp) <= nowSeconds
  ) {
    throw new Error("Invalid token claims.");
  }

  return payload;
};

const getBearerToken = (request) => {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1] || null;
};

const handlePendingTransactionStore = async (request, env) => {
  const token = getBearerToken(request);

  if (!token) {
    return errorResponse("Missing authorization token.", 401);
  }

  try {
    const payload = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    const data = await request.json();
    const message =
      typeof data?.message === "string" ? data.message.trim() : "";
    const source =
      typeof data?.source === "string" ? data.source.trim() : "web-api";
    const senderId =
      typeof data?.senderId === "string" ? data.senderId.trim() : "";

    if (!message) {
      return errorResponse("SMS message is required.", 400);
    }

    if (message.length > 2000) {
      return errorResponse("SMS message is too long.", 400);
    }

    const classificationResponse = await classifySmsTransaction(
      message,
      source,
      senderId,
    );

    if (classificationResponse instanceof Response) {
      return classificationResponse;
    }

    if (!classificationResponse.isTransaction) {
      return jsonResponse(
        {
          pending: null,
          reason: "not-a-transaction",
          result: classificationResponse,
        },
        200,
      );
    }

    const pending = buildPendingTransactionRecord(
      message,
      senderId,
      classificationResponse,
      source,
    );
    pending.id = `sms_${Math.abs(
      getPendingDuplicateKey(message)
        .split("")
        .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0),
    ).toString(36)}`;

    const userId = payload.user_id || payload.sub;

    await writePendingTransactionToFirestore(env, userId, pending);

    return jsonResponse(
      {
        pending,
        result: classificationResponse,
        stored: true,
      },
      200,
    );
  } catch (error) {
    console.error("Pending transaction store failed", error);

    return errorResponse("Unable to store pending transaction.", 500);
  }
};

const handleUidPendingTransactionStore = async (request, env, userId) => {
  try {
    if (!userId) {
      return errorResponse("Missing user id.", 400);
    }

    const exists = await userDocumentExists(env, userId);

    if (!exists) {
      return errorResponse("User not found.", 404, {
        userId,
      });
    }

    let data;

    try {
      data = await request.json();
    } catch {
      return errorResponse("Invalid JSON body.", 400);
    }

    const message =
      typeof data?.message === "string" ? data.message.trim() : "";
    const source =
      typeof data?.source === "string" ? data.source.trim() : "web-api";
    const senderId =
      typeof data?.senderId === "string" ? data.senderId.trim() : "";

    if (!message) {
      return errorResponse("SMS message is required.", 400);
    }

    if (message.length > 2000) {
      return errorResponse("SMS message is too long.", 400);
    }

    const classificationResponse = await classifySmsTransaction(
      message,
      source,
      senderId,
    );

    if (classificationResponse instanceof Response) {
      return classificationResponse;
    }

    if (!classificationResponse.isTransaction) {
      return jsonResponse(
        {
          pending: null,
          reason: "not-a-transaction",
          result: classificationResponse,
        },
        200,
      );
    }

    const pending = buildPendingTransactionRecord(
      message,
      senderId,
      classificationResponse,
      source,
    );
    pending.id = `sms_${Math.abs(
      getPendingDuplicateKey(message)
        .split("")
        .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0),
    ).toString(36)}`;
    pending.userId = userId;

    await writePendingTransactionToFirestore(env, userId, pending);

    return jsonResponse(
      {
        pending,
        result: classificationResponse,
        stored: true,
      },
      200,
    );
  } catch (error) {
    console.error("UID pending transaction handler failed", error);

    return errorResponse("Unable to store pending transaction.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    const pendingUserId = parsePendingTransactionsPath(pathname);
    if (pendingUserId) {
      return handleUidPendingTransactionStore(request, env, pendingUserId);
    }

    if (request.method !== "POST") {
      return errorResponse("Method not allowed.", 405);
    }

    if (pathname === "/api/pending-transactions") {
      return handlePendingTransactionStore(request, env);
    }

    const token = getBearerToken(request);

    if (!token) {
      return errorResponse("Missing authorization token.", 401);
    }

    try {
      await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (error) {
      console.error("Firebase token verification failed", error);

      return errorResponse("Unauthorized.", 401, {
        phase: "firebase-auth",
      });
    }

    let data;

    try {
      data = await request.json();
    } catch {
      return errorResponse("Invalid JSON body.", 400);
    }

    const message = data?.message;
    const source = data?.source;
    const senderId =
      typeof data?.senderId === "string" ? data.senderId.trim() : "";

    if (typeof message !== "string" || !message.trim()) {
      return jsonResponse({ error: "SMS message is required." }, 400);
    }

    if (message.length > 2000) {
      return errorResponse("SMS message is too long.", 400);
    }

    return jsonResponse(
      await classifySmsTransaction(message.trim(), source, senderId),
    );
  },
};
