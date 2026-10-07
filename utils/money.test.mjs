import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, formatCompactMoney } from "./money.ts";

test("rupees keep paise and remove floating point noise", () => {
  assert.equal(formatMoney(123408.12000000001), "₹1,23,408.12");
  assert.equal(formatMoney(44545.123456), "₹44,545.12");
  assert.equal(formatMoney(0.1 + 0.2), "₹0.3");
  assert.equal(formatMoney(1.005), "₹1.01");
  assert.equal(formatMoney(-6339.23), "-₹6,339.23");
  assert.equal(formatMoney(-0.001), "₹0");
  assert.equal(formatMoney(Infinity), "₹0");
});
test("large chart labels use consistent Indian units and signs", () => {
  assert.equal(formatCompactMoney(129747.35), "₹1.3 L");
  assert.equal(formatCompactMoney(123456789.12), "₹12.3 Cr");
  assert.equal(formatCompactMoney(-123456789.12), "-₹12.3 Cr");
  assert.equal(formatCompactMoney(6339.23), "₹6.3k");
  assert.equal(formatMoney(123456789.12), "₹12,34,56,789.12");
});

test("extreme chart labels stay bounded and never show negative zero", () => {
  assert.equal(formatCompactMoney(-0.001), "₹0");
  assert.equal(formatCompactMoney(1e12), "₹1 L Cr");
  assert.equal(formatCompactMoney(1e100), "₹1.00e+100");
  assert.equal(formatCompactMoney(-1e100), "-₹1.00e+100");
});
