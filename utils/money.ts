const moneyNumber = (value: number) => (Number.isFinite(value) ? value : 0);

/** Exact rupee display: Indian grouping, at most two decimal places. */
export const formatMoney = (value: number) => {
  const amount = moneyNumber(Number(value));
  const rounded = Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  return `${amount < 0 && rounded !== "0" ? "-" : ""}₹${rounded}`;
};

/** Short labels for charts; the surrounding ledger retains exact amounts. */
export const formatCompactMoney = (value: number) => {
  const amount = moneyNumber(Number(value));
  const magnitude = Math.abs(amount);
  if (magnitude < 1000) return formatMoney(amount);
  if (magnitude >= 1e17)
    return `${amount < 0 ? "-" : ""}₹${magnitude.toExponential(2)}`;
  const [divisor, suffix] =
    magnitude >= 1e12
      ? [1e12, " L Cr"]
      : magnitude >= 10000000
        ? [10000000, " Cr"]
        : magnitude >= 100000
          ? [100000, " L"]
          : magnitude >= 1000
            ? [1000, "k"]
            : [1, ""];
  return `${amount < 0 ? "-" : ""}₹${(
    magnitude / Number(divisor)
  ).toLocaleString("en-IN", {
    maximumFractionDigits: divisor === 1 ? 2 : 1,
  })}${suffix}`;
};

/** Avoid enormous prose labels while retaining full values in amount details. */
export const formatReadableMoney = (value: number) =>
  formatMoney(value).length > 20
    ? formatCompactMoney(value)
    : formatMoney(value);
