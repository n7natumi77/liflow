import type { ActualData, CoreEntity, PlanData, TransactionData } from "./core.ts";

export function prepareActualDeletion(
  actual: CoreEntity<ActualData>,
  plan: CoreEntity<PlanData> | null,
  transactions: CoreEntity<TransactionData>[],
  now: string,
  updatedBy: string,
) {
  const deletedActual: CoreEntity<ActualData> = { ...actual, revision: actual.revision + 1, updatedAt: now, updatedBy, deletedAt: now };
  const unlinkedPlan = plan?.payload.actualId === actual.id
    ? { ...plan, payload: { ...plan.payload, actualId: null }, revision: plan.revision + 1, updatedAt: now, updatedBy }
    : plan;
  const unlinkedTransactions = transactions.map(transaction => ({
    ...transaction,
    payload: { ...transaction.payload, actualId: null },
    revision: transaction.revision + 1,
    updatedAt: now,
    updatedBy,
  }));
  return { deletedActual, unlinkedPlan, unlinkedTransactions };
}
