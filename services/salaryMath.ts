/** Monetary arithmetic is rounded to paise, including each recorded amount. */
const paiseFormatter = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumFractionDigits: 2,
});
export const roundMoney = (value: number) =>
  Number(paiseFormatter.format(Number(value || 0)));
export const addMoney = (left: number, right: number) =>
  roundMoney(roundMoney(left) + roundMoney(right));
export const subtractMoney = (left: number, right: number) =>
  roundMoney(roundMoney(left) - roundMoney(right));
export const normalizeMoneyInput = (value: number) => {
  const cents = Math.round(roundMoney(value) * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error(
      "Enter a positive amount that can be represented accurately in paise.",
    );
  }
  return cents / 100;
};

export const normalizeCarryForward = (value: number) =>
  Math.max(roundMoney(value), 0);

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
  const availableTotal = addMoney(
    addMoney(carryForward, salary),
    additionalFunds,
  );
  const remaining = subtractMoney(availableTotal, totalSpent);
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
  const available = Math.max(roundMoney(remaining), 0);

  return {
    available,
    shortfall: Math.max(subtractMoney(expenseAmount, available), 0),
  };
};
