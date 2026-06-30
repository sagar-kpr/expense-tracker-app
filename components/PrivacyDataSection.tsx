import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { deleteUser } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/firebase";
import {
  buildSalaryCycleSnapshot,
  getResolvedCycleBoundary,
  SalaryCycleSnapshot,
  SalaryArrivalEntry,
  SalaryHistoryEntry,
} from "@/services/salaryLedger";

const deleteCollectionInBatches = async (path: string) => {
  const snapshot = await getDocs(collection(db, path));

  if (snapshot.empty) {
    return;
  }

  let batch = writeBatch(db);
  let operationCount = 0;

  for (const item of snapshot.docs) {
    batch.delete(item.ref);
    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }
};

type ExportTransaction = Record<string, unknown> & {
  amount?: unknown;
  category?: unknown;
  createdAt?: unknown;
  description?: unknown;
  id?: unknown;
  source?: unknown;
  status?: unknown;
  transactionDate?: unknown;
  type?: unknown;
};

const stringifyExportValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && "toDate" in value) {
    const dateValue = (value as { toDate?: () => Date }).toDate?.();

    return dateValue ? dateValue.toISOString() : "";
  }

  return String(value);
};

const escapeHtml = (value: unknown) =>
  stringifyExportValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMoney = (value: unknown) =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: unknown) => {
  const stringValue = stringifyExportValue(value);
  const date = new Date(stringValue);

  if (!stringValue || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getExportDate = (value: unknown) => {
  const stringValue = stringifyExportValue(value);
  const date = new Date(stringValue);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getSafeCycleDate = (year: number, month: number, salaryDate: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();

  return new Date(year, month, Math.min(salaryDate, lastDay));
};

const getCurrentSalaryCycle = (salaryDateValue: unknown) => {
  const salaryDate = Number(salaryDateValue || 1);
  const now = new Date();
  let start = getSafeCycleDate(now.getFullYear(), now.getMonth(), salaryDate);

  if (now.getDate() < salaryDate) {
    start = getSafeCycleDate(now.getFullYear(), now.getMonth() - 1, salaryDate);
  }

  const end = getSafeCycleDate(
    start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear(),
    (start.getMonth() + 1) % 12,
    salaryDate,
  );

  return { end, start };
};

const getCategoryTotals = (transactions: ExportTransaction[]) => {
  const totals = transactions.reduce<Record<string, number>>((acc, item) => {
    if ((String(item.type || "expense") || "expense") !== "expense") {
      return acc;
    }

    const category = String(item.category || "Other");
    acc[category] = (acc[category] || 0) + Number(item.amount || 0);

    return acc;
  }, {});

  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

const buildPdfHtml = ({
  expenses,
  pending,
  profile,
  salaryArrivals,
  salaryCycleSnapshots,
  salaryHistory,
}: {
  expenses: ExportTransaction[];
  pending: ExportTransaction[];
  profile: Record<string, unknown>;
  salaryArrivals: SalaryArrivalEntry[];
  salaryCycleSnapshots: SalaryCycleSnapshot[];
  salaryHistory: SalaryHistoryEntry[];
}) => {
  const exportedAt = new Date();
  const accountType = String(profile.type || "");
  const isSalary = accountType === "salary";
  const resolvedCycle = getResolvedCycleBoundary({
    profile,
    salaryArrivals,
    salaryHistory,
    cycleStart: new Date(),
    referenceDate: new Date(),
    preferCurrentProfile: true,
  });
  const salaryCycle = {
    end: resolvedCycle.end,
    start: resolvedCycle.start,
  };
  const cycleKey = resolvedCycle.cycleKey;
  const storedSalarySnapshot = salaryCycleSnapshots.find(
    (item) => item.cycleKey === cycleKey,
  );
  const fallbackSalarySnapshot = buildSalaryCycleSnapshot({
    profile,
    salaryArrivals,
    salaryHistory,
    expenses: expenses.map((item) => ({
      amount: Number(item.amount || 0),
      createdAt: item.createdAt as any,
      type: String(item.type || "expense"),
    })),
    cycleStart: resolvedCycle.start,
    expectedCycleStart: resolvedCycle.expectedStart,
    referenceDate: resolvedCycle.start,
    preferCurrentProfile: true,
  });
  const salarySnapshot = storedSalarySnapshot || fallbackSalarySnapshot;
  const reportExpenses = isSalary
    ? expenses.filter((item) => {
        const date = getExportDate(item.createdAt);

        return (
          !!date &&
          date >= salaryCycle.start &&
          date < salaryCycle.end &&
          String(item.type || "expense") !== "income"
        );
      })
    : expenses;
  const income = isSalary
    ? Number(salarySnapshot.salary || profile.salary || 0)
    : reportExpenses
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const spending = reportExpenses
    .filter((item) => String(item.type || "expense") !== "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = income - spending;
  const usagePercent = income > 0 ? Math.round((spending / income) * 100) : 0;
  const categoryTotals = getCategoryTotals(reportExpenses);
  const topCategoryTotal = Math.max(
    ...categoryTotals.map((item) => item.amount),
    1,
  );
  const firstShare =
    isSalary && income > 0
      ? Math.max(0, Math.min(100, 100 - usagePercent))
      : income + spending > 0
        ? Math.round((income / (income + spending)) * 100)
        : 0;
  const secondShare = 100 - firstShare;
  const recentRows = [...reportExpenses]
    .sort((a, b) => {
      const first = getExportDate(a.createdAt)?.getTime() || 0;
      const second = getExportDate(b.createdAt)?.getTime() || 0;

      return second - first;
    })
    .slice(0, 80);
  const reportTitle = isSalary
    ? "Salary Spending Report"
    : "Business Financial Report";
  const reportSubtitle = isSalary
    ? `Salary cycle ${formatDate(salaryCycle.start)} to ${formatDate(salaryCycle.end)}`
    : "Income, expense, and pending transaction summary";
  const personName = profile.name || profile.email || "User";
  const metricLabels = isSalary
    ? ["Monthly Salary", "Salary Used", "Remaining", "Usage"]
    : ["Income", "Expense", "Net Profit", "Transactions"];
  const chartTitle = isSalary ? "Salary Usage" : "Income vs Expense";
  const ringCircumference = 302;
  const salaryRingUsedLength = Math.round(
    ringCircumference * (secondShare / 100),
  );
  const salaryRingRemainingLength = ringCircumference - salaryRingUsedLength;
  const businessRingExpenseLength = Math.round(
    ringCircumference * (secondShare / 100),
  );
  const businessRingIncomeLength =
    ringCircumference - businessRingExpenseLength;
  const usedAmountLabel = escapeHtml(formatMoney(spending));
  const remainingAmountLabel = escapeHtml(formatMoney(balance));
  const incomeAmountLabel = escapeHtml(formatMoney(income));
  const profitLabel = balance >= 0 ? "Net profit" : "Net loss";
  const usageSummary = isSalary
    ? `
      <div class="usage-panel">
        <div class="usage-hero">
          <svg class="usage-ring" width="138" height="138" viewBox="0 0 138 138" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="salaryUsedGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f97316" />
                <stop offset="100%" stop-color="#ef4444" />
              </linearGradient>
              <linearGradient id="salaryRemainingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#159665" />
              </linearGradient>
            </defs>
            <circle cx="69" cy="69" r="48" fill="#ffffff" stroke="#e7edf3" stroke-width="18" />
            <circle cx="69" cy="69" r="48" fill="none" stroke="url(#salaryRemainingGradient)" stroke-width="18" stroke-linecap="round" />
            <circle cx="69" cy="69" r="48" fill="none" stroke="url(#salaryUsedGradient)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${salaryRingUsedLength} ${salaryRingRemainingLength}" transform="rotate(-90 69 69)" />
            <circle cx="69" cy="69" r="35" fill="#ffffff" />
            <text x="69" y="66" fill="#172033" font-size="24" font-weight="900" text-anchor="middle">${usagePercent}%</text>
            <text x="69" y="84" fill="#667085" font-size="10" font-weight="900" text-anchor="middle">USED</text>
          </svg>
          <div class="usage-copy">
            <div class="usage-eyebrow">Current cycle</div>
            <div class="usage-headline">${usagePercent}% used</div>
            <div class="usage-total">Salary ${escapeHtml(formatMoney(income))}</div>
            <div class="usage-split">
              <div><span class="used-key"></span>Used <strong>${usedAmountLabel}</strong></div>
              <div><span class="remaining-key"></span>Remaining <strong>${remainingAmountLabel}</strong></div>
            </div>
          </div>
        </div>
        <div class="usage-list">
          <div class="usage-item">
            <span>Remaining</span>
            <strong class="${balance >= 0 ? "good" : "bad"}">${escapeHtml(formatMoney(balance))}</strong>
          </div>
          <div class="usage-item">
            <span>Used</span>
            <strong class="bad">${escapeHtml(formatMoney(spending))}</strong>
          </div>
          <div class="usage-item">
            <span>Pending items</span>
            <strong>${pending.length}</strong>
          </div>
        </div>
      </div>
    `
    : `
      <div class="usage-panel">
        <div class="usage-hero">
          <svg class="usage-ring" width="138" height="138" viewBox="0 0 138 138" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="businessIncomeGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#34d399" />
                <stop offset="100%" stop-color="#159665" />
              </linearGradient>
              <linearGradient id="businessExpenseGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f97316" />
                <stop offset="100%" stop-color="#ef4444" />
              </linearGradient>
            </defs>
            <circle cx="69" cy="69" r="48" fill="#ffffff" stroke="#e7edf3" stroke-width="18" />
            <circle cx="69" cy="69" r="48" fill="none" stroke="url(#businessIncomeGradient)" stroke-width="18" stroke-linecap="round" />
            <circle cx="69" cy="69" r="48" fill="none" stroke="url(#businessExpenseGradient)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${businessRingExpenseLength} ${businessRingIncomeLength}" transform="rotate(-90 69 69)" />
            <circle cx="69" cy="69" r="35" fill="#ffffff" />
            <text x="69" y="64" fill="${balance >= 0 ? "#159665" : "#dc2626"}" font-size="12" font-weight="900" text-anchor="middle">${balance >= 0 ? "PROFIT" : "LOSS"}</text>
            <text x="69" y="82" fill="#172033" font-size="11" font-weight="900" text-anchor="middle">${escapeHtml(formatMoney(Math.abs(balance)))}</text>
          </svg>
          <div class="usage-copy">
            <div class="usage-eyebrow">Business summary</div>
            <div class="usage-headline">${escapeHtml(profitLabel)}</div>
            <div class="usage-total">${escapeHtml(formatMoney(balance))}</div>
            <div class="usage-split">
              <div><span class="income-key"></span>Income <strong>${incomeAmountLabel}</strong></div>
              <div><span class="used-key"></span>Expense <strong>${usedAmountLabel}</strong></div>
            </div>
          </div>
        </div>
        <div class="usage-list">
          <div class="usage-item">
            <span>Income</span>
            <strong class="good">${escapeHtml(formatMoney(income))}</strong>
          </div>
          <div class="usage-item">
            <span>Expense</span>
            <strong class="bad">${escapeHtml(formatMoney(spending))}</strong>
          </div>
          <div class="usage-item">
            <span>${escapeHtml(profitLabel)}</span>
            <strong class="${balance >= 0 ? "good" : "bad"}">${escapeHtml(formatMoney(balance))}</strong>
          </div>
          <div class="usage-item">
            <span>Pending items</span>
            <strong>${pending.length}</strong>
          </div>
        </div>
      </div>
    `;

  const categoryRows = categoryTotals
    .slice(0, 8)
    .map(
      (item) => `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(item.category)}</span>
            <strong>${escapeHtml(formatMoney(item.amount))}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${Math.max(
              6,
              Math.round((item.amount / topCategoryTotal) * 100),
            )}%"></div>
          </div>
        </div>
      `,
    )
    .join("");

  const transactionRows = recentRows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.createdAt))}</td>
          <td>${escapeHtml(item.description || item.category || "Transaction")}</td>
          <td>${escapeHtml(item.category || "Other")}</td>
          <td>${escapeHtml(item.type || "expense")}</td>
          <td class="amount ${item.type === "income" ? "income" : "expense"}">
            ${escapeHtml(item.type === "income" ? formatMoney(item.amount) : `-${formatMoney(item.amount)}`)}
          </td>
        </tr>
      `,
    )
    .join("");

  const pendingRows = pending
    .slice(0, 30)
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(formatDate(item.transactionDate))}</td>
          <td>${escapeHtml(item.description || "Pending transaction")}</td>
          <td>${escapeHtml(item.type || "expense")}</td>
          <td class="amount">${escapeHtml(formatMoney(item.amount))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { margin: 24px; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #172033;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f6f8fb;
          }
          .page { padding: 28px; }
          .hero {
            background: #172033;
            border-radius: 18px;
            color: #ffffff;
            padding: 28px;
          }
          .eyebrow { color: #8fe3c7; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
          h1 { font-size: 34px; margin: 8px 0 6px; }
          .muted { color: #667085; font-size: 12px; line-height: 1.5; }
          .hero .muted { color: rgba(255,255,255,0.72); }
          .grid { display: grid; gap: 12px; grid-template-columns: repeat(4, 1fr); margin-top: 16px; }
          .card {
            background: #ffffff;
            border: 1px solid #e7edf3;
            border-radius: 14px;
            padding: 16px;
          }
          .metric-label { color: #667085; font-size: 11px; font-weight: 800; text-transform: uppercase; }
          .metric-value { color: #172033; font-size: 22px; font-weight: 900; margin-top: 8px; }
          .metric-value.good { color: #159665; }
          .metric-value.bad { color: #dc2626; }
          .section { margin-top: 18px; }
          h2 { color: #172033; font-size: 18px; margin: 0 0 12px; }
          .two-col { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
          .usage-panel {
            background: #f8fafc;
            border: 1px solid #e7edf3;
            border-radius: 14px;
            padding: 14px;
          }
          .usage-hero {
            align-items: center;
            display: flex;
            gap: 14px;
          }
          .usage-ring { display: block; flex: 0 0 138px; height: 138px; width: 138px; }
          .usage-copy { flex: 1; min-width: 0; }
          .usage-eyebrow { color: #667085; font-size: 10px; font-weight: 900; text-transform: uppercase; }
          .usage-headline { color: #172033; font-size: 22px; font-weight: 900; margin-top: 2px; }
          .usage-total {
            background: #ffffff;
            border: 1px solid #e7edf3;
            border-radius: 999px;
            color: #172033;
            display: inline-block;
            font-size: 12px;
            font-weight: 900;
            margin-top: 8px;
            padding: 7px 10px;
            white-space: nowrap;
          }
          .usage-split { color: #667085; font-size: 11px; font-weight: 800; line-height: 1.9; margin-top: 10px; }
          .usage-split span {
            border-radius: 999px;
            display: inline-block;
            height: 8px;
            margin-right: 6px;
            width: 8px;
          }
          .usage-split strong { color: #172033; display: block; font-size: 13px; font-weight: 900; margin-left: 14px; }
          .income-key { background: #159665; }
          .used-key { background: #ef4444; }
          .remaining-key { background: #159665; }
          .usage-list { display: grid; gap: 8px; margin-top: 12px; }
          .usage-item {
            align-items: center;
            background: #ffffff;
            border: 1px solid #e7edf3;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            padding: 10px 12px;
          }
          .usage-item span { color: #667085; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          .usage-item strong { color: #172033; font-size: 15px; font-weight: 900; }
          .bar-row { margin-bottom: 12px; }
          .bar-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
          .bar-track { background: #edf2f7; border-radius: 999px; height: 9px; overflow: hidden; }
          .bar-fill { background: #159665; border-radius: 999px; height: 100%; }
          table { border-collapse: collapse; width: 100%; }
          th {
            background: #f0f4f8;
            color: #475467;
            font-size: 10px;
            padding: 9px;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border-bottom: 1px solid #edf2f7;
            color: #344054;
            font-size: 11px;
            padding: 9px;
            vertical-align: top;
          }
          .amount { font-weight: 900; text-align: right; white-space: nowrap; }
          .income { color: #159665; }
          .expense { color: #dc2626; }
          .footer { color: #98a2b3; font-size: 10px; margin-top: 22px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="hero">
            <div class="eyebrow">Expense Tracker</div>
            <h1>${escapeHtml(reportTitle)}</h1>
            <div class="muted">
              ${escapeHtml(reportSubtitle)}. Exported for ${escapeHtml(personName)} on
              ${escapeHtml(exportedAt.toLocaleString("en-IN"))}.
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="metric-label">${escapeHtml(metricLabels[0])}</div>
              <div class="metric-value good">${escapeHtml(formatMoney(income))}</div>
            </div>
            <div class="card">
              <div class="metric-label">${escapeHtml(metricLabels[1])}</div>
              <div class="metric-value bad">${escapeHtml(formatMoney(spending))}</div>
            </div>
            <div class="card">
              <div class="metric-label">${escapeHtml(metricLabels[2])}</div>
              <div class="metric-value ${balance >= 0 ? "good" : "bad"}">${escapeHtml(formatMoney(balance))}</div>
            </div>
            <div class="card">
              <div class="metric-label">${escapeHtml(metricLabels[3])}</div>
              <div class="metric-value">${isSalary ? `${usagePercent}%` : reportExpenses.length}</div>
            </div>
          </div>

          <div class="section two-col">
            <div class="card">
              <h2>${escapeHtml(chartTitle)}</h2>
              ${usageSummary}
            </div>
            <div class="card">
              <h2>Top Spending Categories</h2>
              ${categoryRows || '<div class="muted">No expense categories yet.</div>'}
            </div>
          </div>

          <div class="section card">
            <h2>Profile</h2>
            <table>
              <tr><th>Name</th><td>${escapeHtml(personName)}</td></tr>
              <tr><th>Email</th><td>${escapeHtml(profile.email || "")}</td></tr>
              <tr><th>Account Type</th><td>${escapeHtml(isSalary ? "Salary" : "Self Employed")}</td></tr>
              ${
                isSalary
                  ? `
                    <tr><th>Monthly Salary</th><td>${escapeHtml(formatMoney(salarySnapshot.salary))}</td></tr>
                    <tr><th>Salary Date</th><td>${escapeHtml(salarySnapshot.salaryDate || profile.salaryDate || "")}</td></tr>
                    <tr><th>Cycle</th><td>${escapeHtml(`${formatDate(salaryCycle.start)} to ${formatDate(salaryCycle.end)}`)}</td></tr>
                  `
                  : `
                    <tr><th>Business Name</th><td>${escapeHtml(profile.businessName || "")}</td></tr>
                  `
              }
            </table>
          </div>

          <div class="section card">
            <h2>Transactions</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${transactionRows || '<tr><td colspan="5" class="muted">No transactions found.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section card">
            <h2>Pending Transactions</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${pendingRows || '<tr><td colspan="4" class="muted">No pending transactions.</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Generated by Expense Tracker. Keep this report private; it may contain sensitive financial information.
          </div>
        </div>
      </body>
    </html>
  `;
};

const downloadHtmlReportOnWeb = (html: string) => {
  const documentRef = globalThis.document;
  const urlApi = globalThis.URL;

  if (!documentRef || !urlApi) {
    return false;
  }

  const exportedAt = new Date().toISOString().slice(0, 10);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement("a");

  link.href = url;
  link.download = `expense-tracker-report-${exportedAt}.html`;
  link.style.display = "none";

  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlApi.revokeObjectURL(url);

  return true;
};

export default function PrivacyDataSection() {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "transactions" | "account" | "account-final" | null
  >(null);
  const [notice, setNotice] = useState("");

  const deleteUserFirestoreData = async (uid: string) => {
    await Promise.all([
      deleteCollectionInBatches(`users/${uid}/expenses`),
      deleteCollectionInBatches(`users/${uid}/pendingTransactions`),
      deleteCollectionInBatches(`users/${uid}/salaryHistory`),
      deleteCollectionInBatches(`users/${uid}/salaryArrivals`),
      deleteCollectionInBatches(`users/${uid}/salaryCycleSnapshots`),
    ]);

    await deleteDoc(doc(db, "users", uid));
  };

  const handleDeleteTransactionData = () => {
    setNotice("");
    setConfirmAction("transactions");
  };

  const handleDeleteAccount = () => {
    setNotice("");
    setConfirmAction("account");
  };

  const handleExportData = async () => {
    const user = auth.currentUser;

    if (!user) {
      setNotice("Please log in again to export data.");

      return;
    }

    try {
      setExporting(true);
      setNotice("");

      const [
        profileSnap,
        expensesSnap,
        pendingSnap,
        salaryArrivalsSnap,
        salaryHistorySnap,
        salaryCycleSnapshotsSnap,
      ] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, `users/${user.uid}/expenses`)),
        getDocs(collection(db, `users/${user.uid}/pendingTransactions`)),
        getDocs(collection(db, `users/${user.uid}/salaryArrivals`)),
        getDocs(collection(db, `users/${user.uid}/salaryHistory`)),
        getDocs(collection(db, `users/${user.uid}/salaryCycleSnapshots`)),
      ]);

      const profile = profileSnap.exists()
        ? (profileSnap.data() as Record<string, unknown>)
        : {};
      const expenses = expensesSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Record<string, unknown>[];
      const pending = pendingSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Record<string, unknown>[];
      const salaryArrivals = salaryArrivalsSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SalaryArrivalEntry[];
      const salaryHistory = salaryHistorySnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SalaryHistoryEntry[];
      const salaryCycleSnapshots = salaryCycleSnapshotsSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as SalaryCycleSnapshot[];

      const html = buildPdfHtml({
        expenses,
        pending,
        salaryArrivals,
        salaryCycleSnapshots,
        salaryHistory,
        profile: {
          ...profile,
          email: profile.email || user.email || "",
        },
      });

      if (Platform.OS === "web") {
        if (!downloadHtmlReportOnWeb(html)) {
          setNotice("Could not start download in this browser.");

          return;
        }

        setNotice("Report downloaded. Open it in your browser to print or save as PDF.");

        return;
      }

      const { uri } = await Print.printToFileAsync({
        html,
        width: 612,
        height: 792,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setNotice("PDF created, but sharing is not available on this device.");

        return;
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "Export Expense Tracker Report",
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setNotice("PDF export ready.");
    } catch (error) {
      console.log("Export data error:", error);

      setNotice("Could not export data. Please check your connection.");
    } finally {
      setExporting(false);
    }
  };

  const deleteTransactionData = async () => {
    const user = auth.currentUser;

    if (!user) {
      setNotice("Please log in again to delete data.");

      return;
    }

    try {
      setDeleting(true);

      await Promise.all([
        deleteCollectionInBatches(`users/${user.uid}/expenses`),
        deleteCollectionInBatches(`users/${user.uid}/pendingTransactions`),
        deleteCollectionInBatches(`users/${user.uid}/salaryHistory`),
        deleteCollectionInBatches(`users/${user.uid}/salaryArrivals`),
        deleteCollectionInBatches(`users/${user.uid}/salaryCycleSnapshots`),
      ]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setNotice("Transaction data deleted.");
    } catch (error) {
      console.log("Delete transaction data error:", error);

      setNotice("Could not delete data. Please check your connection.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteAccount = async () => {
    const user = auth.currentUser;

    if (!user) {
      setNotice("Please log in again to delete your account.");

      return;
    }

    const lastSignInTime = user.metadata.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).getTime()
      : 0;
    const recentLoginWindowMs = 5 * 60 * 1000;
    const needsRecentLogin =
      !lastSignInTime || Date.now() - lastSignInTime > recentLoginWindowMs;

    if (needsRecentLogin) {
      setNotice(
        "For security, log out and log in again before deleting your account.",
      );

      return;
    }

    try {
      setDeletingAccount(true);

      await deleteUserFirestoreData(user.uid);
      await deleteUser(user);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.log("Delete account error:", error);

      if (
        error?.code === "auth/requires-recent-login" ||
        error?.message?.includes("requires-recent-login")
      ) {
        setNotice(
          "For security, log out and log in again before deleting your account.",
        );
      } else {
        setNotice("Could not delete account. Please check your connection.");
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmTitle =
    confirmAction === "transactions"
      ? "Delete transaction data?"
      : confirmAction === "account"
        ? "Delete account?"
        : "Are you sure?";
  const confirmMessage =
    confirmAction === "transactions"
      ? "This permanently removes saved expenses and pending SMS transactions. Your login and profile stay active."
      : confirmAction === "account"
        ? "This permanently deletes your profile, expenses, pending transactions, and sign-in account."
        : "All account data will be removed permanently. This cannot be undone.";
  const confirmLabel =
    confirmAction === "transactions"
      ? "Delete data"
      : confirmAction === "account"
        ? "Continue"
        : "Yes, delete";

  const handleConfirm = async () => {
    const action = confirmAction;

    if (action === "account") {
      setConfirmAction("account-final");

      return;
    }

    setConfirmAction(null);

    if (action === "transactions") {
      await deleteTransactionData();
    }

    if (action === "account-final") {
      await deleteAccount();
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(620).duration(700)}
      style={{
        backgroundColor: theme.card,
        borderRadius: 28,
        marginTop: 24,
        padding: 22,
      }}
    >
      <Text
        style={{
          color: theme.text,
          fontSize: 20,
          fontWeight: "900",
          marginBottom: 18,
        }}
      >
        Privacy & Data
      </Text>

      <ActionRow
        icon="shield-checkmark-outline"
        label="Privacy Policy"
        onPress={() => router.push("/privacy" as any)}
      />

      <View
        style={{
          backgroundColor: theme.border,
          height: 1,
          marginVertical: 14,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={exporting || deleting || deletingAccount}
        onPress={handleExportData}
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 48,
          opacity: exporting ? 0.65 : 1,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${theme.primary}18`,
            borderRadius: 14,
            height: 40,
            justifyContent: "center",
            marginRight: 12,
            width: 40,
          }}
        >
          <Ionicons name="download-outline" size={20} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.text,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Export data
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Shares a PDF report with charts.
          </Text>
        </View>
        {exporting ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: theme.border,
          height: 1,
          marginVertical: 14,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={exporting || deleting || deletingAccount}
        onPress={handleDeleteTransactionData}
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 48,
          opacity: deleting ? 0.65 : 1,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${theme.danger}18`,
            borderRadius: 14,
            height: 40,
            justifyContent: "center",
            marginRight: 12,
            width: 40,
          }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.danger,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Delete transaction data
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Removes expenses and pending SMS reviews.
          </Text>
        </View>
        {deleting ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: theme.border,
          height: 1,
          marginVertical: 14,
        }}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={exporting || deleting || deletingAccount}
        onPress={handleDeleteAccount}
        style={{
          alignItems: "center",
          flexDirection: "row",
          minHeight: 48,
          opacity: deletingAccount ? 0.65 : 1,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: `${theme.danger}18`,
            borderRadius: 14,
            height: 40,
            justifyContent: "center",
            marginRight: 12,
            width: 40,
          }}
        >
          <Ionicons
            name="person-remove-outline"
            size={20}
            color={theme.danger}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.danger,
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            Delete account
          </Text>
          <Text
            style={{
              color: theme.subText,
              fontSize: 12,
              marginTop: 3,
            }}
          >
            Removes profile, transactions, and login.
          </Text>
        </View>
        {deletingAccount ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </TouchableOpacity>

      {!!notice && (
        <Text
          style={{
            color:
              notice.includes("deleted") || notice.includes("export ready")
                ? theme.primary
                : theme.danger,
            fontSize: 13,
            fontWeight: "700",
            lineHeight: 20,
            marginTop: 14,
          }}
        >
          {notice}
        </Text>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={!!confirmAction}
        onRequestClose={() => setConfirmAction(null)}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.46)",
            flex: 1,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderRadius: 24,
              borderWidth: 1,
              padding: 22,
              width: "100%",
            }}
          >
            <Text
              style={{
                color: theme.text,
                fontSize: 21,
                fontWeight: "900",
              }}
            >
              {confirmTitle}
            </Text>
            <Text
              style={{
                color: theme.subText,
                fontSize: 14,
                lineHeight: 22,
                marginTop: 10,
              }}
            >
              {confirmMessage}
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setConfirmAction(null)}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.border,
                  borderRadius: 16,
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleConfirm}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.danger,
                  borderRadius: 16,
                  flex: 1,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        minHeight: 48,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: `${theme.primary}18`,
          borderRadius: 14,
          height: 40,
          justifyContent: "center",
          marginRight: 12,
          width: 40,
        }}
      >
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <Text
        style={{
          color: theme.text,
          flex: 1,
          fontSize: 15,
          fontWeight: "800",
        }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={theme.subText} />
    </TouchableOpacity>
  );
}
