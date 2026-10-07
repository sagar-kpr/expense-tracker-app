export const normalizeCarryForward = (value: number) =>
  Math.max(Number(value || 0), 0);

export const calculateSalaryCycleTotals = ({
  additionalFunds,
  carryForward,
  salary,
  totalSpent,
}: {
  additionalFunds: number;
  carryForward: number;
  salary: number;
  totalSpent: number;
}) => {
  const availableTotal =
    Number(carryForward || 0) +
    Number(salary || 0) +
    Number(additionalFunds || 0);
  const remaining = availableTotal - Number(totalSpent || 0);
  const usagePercent =
    availableTotal > 0
      ? Math.round((Number(totalSpent || 0) / availableTotal) * 100)
      : 0;

  return {
    availableTotal,
    remaining,
    usagePercent,
  };
};

export const getExpenseShortfall = ({
  expenseAmount,
  remaining,
}: {
  expenseAmount: number;
  remaining: number;
}) => {
  const available = Math.max(Number(remaining || 0), 0);

  return {
    available,
    shortfall: Math.max(Number(expenseAmount || 0) - available, 0),
  };
};
