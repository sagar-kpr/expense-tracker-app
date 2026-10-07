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

const {getSmsTransactionDuplicateKey, getSmsDuplicateId, isSalaryCredit} = await import("./smsParser.ts");

test("duplicate IDs compare transaction identity rather than equal amounts", async () => {
  const parse = async (body, senderId = "VK-HDFCBK") =>
    (await parseSmsMessageResult({body, senderId}, "sms-auto")).transaction;
  const original = await parse("INR 500 debited. Ref 111.");
  const replay = await parse("INR 500 debited.  Ref 111.");
  const otherPayment = await parse("INR 500 debited. Ref 222.");
  const credit = await parse("INR 500 credited. Ref 333.");
  const otherBank = await parse("INR 500 debited. Ref 111.", "VK-ICICIB");
  const id = (transaction) => getSmsDuplicateId(getSmsTransactionDuplicateKey(transaction));
  assert.equal(id(original), id(replay));
  assert.notEqual(id(original), id(otherPayment));
  assert.notEqual(id(original), id(credit));
  assert.notEqual(id(original), id(otherBank));
});

test("only explicitly identified salary credits use the salary arrival flow", () => {
  assert.equal(isSalaryCredit({type: "income", category: "Salary"}), true);
  assert.equal(isSalaryCredit({type: "income", description: "INR 50000 credited as salary"}), true);
  assert.equal(isSalaryCredit({type: "income", category: "Refund", description: "INR 500 credited"}), false);
  assert.equal(isSalaryCredit({type: "expense", description: "salary payment debited"}), false);
});

test("replays within seven seconds are duplicates, but a later identical payment is retained", async () => {
  const {isRecentSmsDuplicate} = await import("./smsParser.ts");
  const now = Date.now();
  const pending = [{duplicateKey: "same-message", createdAt: new Date(now).toISOString()}];
  assert.equal(isRecentSmsDuplicate("same-message", pending, now + 1000), true);
  assert.equal(isRecentSmsDuplicate("different-reference", pending, now + 1000), false);
  assert.equal(isRecentSmsDuplicate("same-message", pending, now + 7001), false);
});
