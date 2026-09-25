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
  const relevant = transactions.filter(transaction => {
    const effectiveAt = transaction.payload.status === "expected" ? transaction.payload.expectedAt || transaction.payload.occurredAt : transaction.payload.occurredAt;
    return transaction.payload.direction === "expense" && transaction.payload.categoryId === budget.payload.categoryId
      && Date.parse(effectiveAt) >= start.getTime() && Date.parse(effectiveAt) < end.getTime();
  });
  const settled = relevant.filter(item => item.payload.status === "settled").reduce((sum, item) => sum + item.payload.amount, 0);
  const expected = relevant.filter(item => item.payload.status === "expected"
    && Date.parse(item.payload.expectedAt || item.payload.occurredAt) >= now.getTime())
    .reduce((sum, item) => sum + item.payload.amount, 0);
  const remaining = budget.payload.amount - settled, projectedRemaining = remaining - expected;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const remainingDays = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
  return { settled, expected, remaining, projectedRemaining, remainingDays, daily: projectedRemaining > 0 ? projectedRemaining / remainingDays : 0, over: Math.max(0, -remaining), projectedOver: Math.max(0, -projectedRemaining) };
}

export type MoneyHistoryFilter = {
  start: Date;
  end: Date;
  direction?: "income" | "expense" | null;
  categoryId?: string | null;
  methodId?: string | null;
  status?: TransactionData["status"] | null;
  keyword?: string;
};

export function filterTransactions(transactions: CoreEntity<TransactionData>[], filter: MoneyHistoryFilter) {
  const query = (filter.keyword || "").trim().toLocaleLowerCase("ja");
  return transactions.filter(item => {
    const effectiveAt = item.payload.status === "expected" ? item.payload.expectedAt || item.payload.occurredAt : item.payload.occurredAt;
    const time = Date.parse(effectiveAt);
    return time >= filter.start.getTime() && time < filter.end.getTime()
      && (!filter.direction || item.payload.direction === filter.direction)
      && (!filter.categoryId || item.payload.categoryId === filter.categoryId)
      && (!filter.methodId || item.payload.moneyMethodId === filter.methodId)
      && (!filter.status || item.payload.status === filter.status)
      && (!query || `${item.payload.title} ${item.payload.note || ""} ${item.payload.category || ""}`.toLocaleLowerCase("ja").includes(query));
  }).sort((a, b) => {
    const left = a.payload.status === "expected" ? a.payload.expectedAt || a.payload.occurredAt : a.payload.occurredAt;
    const right = b.payload.status === "expected" ? b.payload.expectedAt || b.payload.occurredAt : b.payload.occurredAt;
    return right.localeCompare(left) || b.createdAt.localeCompare(a.createdAt);
  });
}
