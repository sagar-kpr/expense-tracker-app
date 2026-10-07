import { normalizeMoneyInput } from "@/services/salaryMath";
import { listExpenses } from "@/repositories/expenseRepository";
import { saveProfile } from "@/repositories/profileRepository";
import {
  commitSalaryCycleRollover, listSalaryArrivals, listSalaryHistory, listSalarySnapshots,
} from "@/repositories/salaryRepository";
import {
  buildSalaryArrivalRollover, getExpectedCycleForArrival, getSalaryCycleKey,
  type SalaryProfileLike,
} from "@/services/salaryLedger";
import { withUserTransactionLock } from "@/services/transactionLock";

export const confirmSalaryArrivalRecord = async ({
  userId, profile, arrivedAtMs = Date.now(), salary = Number(profile.salary || 0),
  source = "manual-confirm", skipIfConfirmed = false,
}: {
  userId: string;
  profile: SalaryProfileLike;
  arrivedAtMs?: number;
  salary?: number;
  source?: string;
  skipIfConfirmed?: boolean;
}) => withUserTransactionLock(userId, async () => {
  salary = normalizeMoneyInput(salary);
  const [expenses, salaryHistory, salaryArrivals, salaryCycleSnapshots] = await Promise.all([
    listExpenses(userId), listSalaryHistory(userId), listSalaryArrivals(userId),
    listSalarySnapshots(userId),
  ]);
  const expected = getExpectedCycleForArrival(profile, salaryHistory, new Date(arrivedAtMs));
  const existing = salaryArrivals.find(
    (item) => item.expectedCycleKey === getSalaryCycleKey(expected.start),
  );
  if (skipIfConfirmed && existing) return existing;

  const rollover = buildSalaryArrivalRollover({
    profile, expenses, salaryHistory, salaryArrivals, salaryCycleSnapshots,
    arrivedAtMs, salary, source,
  });
  await commitSalaryCycleRollover(userId, rollover);
  if (salary !== Number(profile.salary || 0)) {
    await saveProfile(userId, { salary });
  }
  return rollover.arrival;
});
