const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const SMS_RESULT_SCHEMA = {
  properties: {
    amount: {
      description: "Transaction amount only. Use 0 when not a transaction.",
      type: "number",
    },
    category: {
      description:
        "Short category like Food, Travel, Shopping, Bills, Health, Salary, Refund, Cash, Other.",
      type: "string",
    },
    isTransaction: {
      description:
        "True only when this is a valid, actual, completed bank/payment transaction SMS. False for fake, suspicious, personal, OTP, offer, failed, pending, reminder, balance-only, or non-transaction messages.",
      type: "boolean",
    },
    summary: {
      description: "Short user-facing transaction description.",
      type: "string",
    },
    transactionDate: {
      description:
        "ISO date/time if clearly present in SMS, otherwise an empty string.",
      type: "string",
    },
    type: {
      description:
        "expense for debit/spend/payment, income for credit/received, none when ignored.",
      enum: ["expense", "income", "none"],
      type: "string",
    },
  },
  required: [
    "isTransaction",
    "type",
    "amount",
    "category",
    "summary",
    "transactionDate",
  ],
  type: "object",
};

let cachedJwks;

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

const getGeminiOutputText = (body) => {
  for (const candidate of body?.candidates || []) {
    const text = candidate?.content?.parts?.find(
      (part) => typeof part?.text === "string",
    )?.text;

    if (text) {
      return text;
    }
  }

  return null;
};

const normalizeSmsResult = (result) => {
  const isValidTransaction =
    result?.isTransaction === true &&
    (result.type === "expense" || result.type === "income") &&
    Number.isFinite(result.amount) &&
    result.amount > 0;

  if (!isValidTransaction) {
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
    amount: result.amount,
    category:
      String(result.category || "").trim() ||
      (result.type === "income" ? "Cash" : "Other"),
    isTransaction: true,
    summary: String(result.summary || "").trim() || "Detected transaction",
    transactionDate:
      typeof result.transactionDate === "string" &&
      result.transactionDate.trim()
        ? result.transactionDate.trim()
        : null,
    type: result.type,
  };
};

const detectSmsTransaction = async (message, source, senderId, env) => {
  const model = env.GEMINI_SMS_MODEL || "gemini-2.5-flash-lite";

  if (!env.GEMINI_API_KEY) {
    return errorResponse("Missing Gemini API key.", 500, {
      phase: "gemini-setup",
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Source: ${source || "unknown"}\nSender ID: ${
                  senderId || "unknown"
                }\nSMS:\n${message}`,
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          maxOutputTokens: 250,
          responseMimeType: "application/json",
          responseSchema: SMS_RESULT_SCHEMA,
        },
        systemInstruction: {
          parts: [
            {
              text: "You classify Indian bank/payment SMS messages. Return only the requested JSON. Set isTransaction true only when the message is a valid, actual, completed debit/expense or credit/income transaction from a bank, card issuer, UPI app, wallet, or payment provider. Use the Sender ID when present; genuine Indian sender IDs often look like AD-HDFCBK, VM-ICICIB, JD-SBIBNK, or similar bank/payment short codes. Set isTransaction false for unknown/personal-looking senders, fake or suspicious messages, personal messages pretending payment happened, phishing, prize/refund scams, suspicious links, OTP/PIN/password requests, urgent KYC/account-blocking threats, offers, bill due reminders, statement summaries, balance-only alerts, failed/reversed/pending/declined payments, and non-transaction messages. When false, return type none, amount 0, and empty category, summary, and transactionDate. Do not classify only from keywords; read the full message.",
            },
          ],
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      method: "POST",
    },
  );
  console.log("Response:", response);

  if (!response.ok) {
    const errorText = await response.text();

    console.error("Gemini SMS detection failed", {
      body: errorText.slice(0, 500),
      status: response.status,
    });

    return errorResponse("Gemini request failed.", 502, {
      aiStatus: response.status,
      aiText: errorText.slice(0, 700),
      phase: "gemini-request",
    });
  }

  const body = await response.json();
  const outputText = getGeminiOutputText(body);

  if (!outputText) {
    return errorResponse("No Gemini output.", 502, {
      phase: "gemini-output",
    });
  }

  try {
    return jsonResponse(normalizeSmsResult(JSON.parse(outputText)));
  } catch (error) {
    console.error("Gemini SMS detection JSON parse failed", error);

    return errorResponse("Invalid Gemini output.", 502, {
      outputText: outputText.slice(0, 700),
      phase: "gemini-json-parse",
    });
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }

    if (request.method !== "POST") {
      return errorResponse("Method not allowed.", 405);
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

    return detectSmsTransaction(message.trim(), source, senderId, env);
  },
};
