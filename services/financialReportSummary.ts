import {
  resolveSalaryCycleSummary,
  getResolvedCycleBoundary,
  type SalaryCycleSnapshot,
  type SalaryArrivalEntry,
  type SalaryHistoryEntry,
} from "@/services/salaryLedger";
import { addMoney, subtractMoney } from "@/services/salaryMath";
import { formatPercent, getBudgetMetrics } from "@/services/financialMetrics";

type ReportTransaction = Record<string, unknown> & {
  amount?: unknown;
  createdAt?: unknown;
  type?: unknown;
};
export const buildFinancialReportSummary = ({
  expenses,
  profile,
  salaryArrivals,
  salaryHistory,
  salaryCycleSnapshots,
  selectedSalaryCycleKey,
  referenceDate = new Date(),
}: {
  expenses: ReportTransaction[];
  profile: Record<string, unknown>;
  salaryArrivals: SalaryArrivalEntry[];
  salaryHistory: SalaryHistoryEntry[];
  salaryCycleSnapshots: SalaryCycleSnapshot[];
  selectedSalaryCycleKey?: string | null;
  referenceDate?: Date;
}) => {
  const isSalary = profile.type === "salary";
  const exportedAt = referenceDate;
  const getExportDate = (value: unknown) => {
    const raw = value as { toDate?: () => Date } | undefined;
    const date = raw?.toDate ? raw.toDate() : new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const explicitSnapshot =
    isSalary && selectedSalaryCycleKey
      ? salaryCycleSnapshots.find(
          (item) => item.cycleKey === selectedSalaryCycleKey,
        )
      : null;
  const selectedSnapshot =
    explicitSnapshot ||
    (isSalary
      ? [...salaryCycleSnapshots]
          .filter(
            (item) =>
              item.status === "open" &&
              item.cycleStartMs <= referenceDate.getTime(),
          )
          .sort((left, right) => right.cycleStartMs - left.cycleStartMs)[0]
      : undefined);
  const isCurrentReport =
    !selectedSnapshot || selectedSnapshot.status === "open";
  const currentBoundary = getResolvedCycleBoundary({
    profile,
    salaryArrivals,
    salaryHistory,
    cycleStart: referenceDate,
    referenceDate,
    preferCurrentProfile: true,
  });
  const fallbackCycleStart = selectedSnapshot
    ? new Date(selectedSnapshot.cycleStartMs)
    : currentBoundary.start;
  const storedEnd = selectedSnapshot
    ? new Date(selectedSnapshot.cycleEndMs)
    : currentBoundary.end;
  const fallbackCycleEnd =
    isCurrentReport && referenceDate >= storedEnd
      ? new Date(referenceDate.getTime() + 1)
      : storedEnd;
  const salaryCycle = selectedSnapshot
    ? {
        start: fallbackCycleStart,
        end: fallbackCycleEnd,
      }
    : {
        start: currentBoundary.start,
        end: currentBoundary.end,
      };
  const fallbackSalarySnapshot = resolveSalaryCycleSummary({
    profile,
    salaryArrivals,
    salaryHistory,
    expenses: expenses.map((item) => ({
      amount: Number(item.amount || 0),
      createdAt: item.createdAt as any,
      type: String(item.type || "expense"),
    })),
    cycleStart: salaryCycle.start,
    expectedCycleStart: selectedSnapshot?.expectedCycleKey
      ? new Date(`${selectedSnapshot.expectedCycleKey}T00:00:00`)
      : currentBoundary.expectedStart,
    salaryCycleSnapshots,
    referenceDate: isCurrentReport ? exportedAt : salaryCycle.start,
    preferCurrentProfile: isCurrentReport,
  });
  const salarySnapshot = fallbackSalarySnapshot;
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
    ? salarySnapshot.availableTotal
    : reportExpenses
        .filter((item) => item.type === "income")
        .reduce((sum, item) => addMoney(sum, Number(item.amount || 0)), 0);
  const spending = reportExpenses
    .filter((item) => String(item.type || "expense") !== "income")
    .reduce((sum, item) => addMoney(sum, Number(item.amount || 0)), 0);
  const balance = subtractMoney(income, spending);
  const usageRatio = getBudgetMetrics(income, spending).usagePercent;
  const usagePercent = usageRatio ?? 0;
  const usageLabel = formatPercent(usageRatio);
  return {
    salaryCycle,
    salarySnapshot,
    reportExpenses,
    income,
    spending,
    balance,
    usagePercent,
    usageLabel,
  };
};
