import type { BudgetData, CoreEntity, TransactionData } from "./core.ts";

export const periodRange = (period: BudgetData["period"], now = new Date()) => {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setTime(start.getTime()); end.setDate(end.getDate() + 7);
  } else {
    start.setDate(1); end.setFullYear(start.getFullYear(), start.getMonth() + 1, 1);
  }
  return { start, end };
};

export function budgetPace(
  budget: CoreEntity<BudgetData>,
  transactions: CoreEntity<TransactionData>[],
  now = new Date(),
) {
  const { start, end } = periodRange(budget.payload.period, now);
  const relevant = transactions.filter(transaction => transaction.payload.direction === "expense"
    && transaction.payload.categoryId === budget.payload.categoryId
    && Date.parse(transaction.payload.occurredAt) >= start.getTime()
    && Date.parse(transaction.payload.occurredAt) < end.getTime());
  const settled = relevant.filter(item => item.payload.status === "settled").reduce((sum, item) => sum + item.payload.amount, 0);
  const expected = relevant.filter(item => item.payload.status === "expected"
    && Date.parse(item.payload.expectedAt || item.payload.occurredAt) >= now.getTime())
    .reduce((sum, item) => sum + item.payload.amount, 0);
  const remaining = budget.payload.amount - settled - expected;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const remainingDays = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
  return { settled, expected, remaining, remainingDays, daily: remaining > 0 ? remaining / remainingDays : 0, over: Math.max(0, -remaining) };
}

