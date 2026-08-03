import assert from "node:assert/strict";
import test from "node:test";

import {
  isPhoneNumberSender,
  parseSmsMessageResult,
} from "./smsParser.ts";

const creditMessage = "INR 2,500 credited to your account.";
const debitMessage = "INR 850 debited from your account.";

test("rejects auto-detected messages from numeric phone senders", async () => {
  const senders = [
    "+91 56561254505",
    "56561254505",
    "9156561254505",
  ];

  for (const senderId of senders) {
    const result = await parseSmsMessageResult(
      { body: creditMessage, senderId },
      "sms-auto",
    );

    assert.equal(result.transaction, null);
    assert.equal(result.reason, "untrusted-sender");
    assert.equal(isPhoneNumberSender(senderId), true);
  }
});

test("accepts an alphanumeric bank sender credit", async () => {
  const result = await parseSmsMessageResult(
    { body: creditMessage, senderId: "ICICIT-S" },
    "sms-auto",
  );

  assert.equal(result.transaction?.type, "income");
  assert.equal(result.transaction?.amount, 2_500);
  assert.equal(result.transaction?.senderId, "ICICIT-S");
  assert.equal(isPhoneNumberSender("ICICIT-S"), false);
});

test("keeps debit detection unchanged for a bank sender", async () => {
  const result = await parseSmsMessageResult(
    { body: debitMessage, senderId: "VK-HDFCBK" },
    "sms-auto",
  );

  assert.equal(result.transaction?.type, "expense");
  assert.equal(result.transaction?.amount, 850);
});

test("manual paste remains available without sender metadata", async () => {
  const result = await parseSmsMessageResult(creditMessage, "manual-paste");

  assert.equal(result.transaction?.type, "income");
  assert.equal(result.transaction?.amount, 2_500);
});
