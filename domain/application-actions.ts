import type { ActualData, CoreEntity, EntityType, PlanData, TransactionData } from "./core.ts";

export type ActualDeleteResult = {
  deletedActual: CoreEntity<ActualData>;
  unlinkedPlan: CoreEntity<PlanData> | null;
  unlinkedTransactions: CoreEntity<TransactionData>[];
};

export type ApplicationActionPort = {
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  createMany?: (inputs: { type: EntityType; payload: Record<string, unknown> }[]) => Promise<CoreEntity[]>;
  update?: (entity: CoreEntity, payload: Record<string, unknown>, softDelete?: boolean) => Promise<CoreEntity>;
  list?: () => Promise<CoreEntity[]>;
  deleteActual?: (
    actual: CoreEntity<ActualData>,
    plan: CoreEntity<PlanData> | null,
    transactions: CoreEntity<TransactionData>[],
  ) => Promise<ActualDeleteResult>;
};

/** The single mutation boundary shared by the GUI, command palette and Discord adapters. */
export const createApplicationEntity = (port: ApplicationActionPort, type: EntityType, payload: Record<string, unknown>) =>
  port.create(type, payload);

export const createApplicationEntities = (port: ApplicationActionPort, inputs: { type: EntityType; payload: Record<string, unknown> }[]) => {
  if (!port.createMany) throw new Error("application_action_batch_unavailable");
  return port.createMany(inputs);
};

export const updateApplicationEntity = (port: ApplicationActionPort, entity: CoreEntity, payload: Record<string, unknown>, softDelete = false) => {
  if (!port.update) throw new Error("application_action_update_unavailable");
  return port.update(entity, payload, softDelete);
};

export const deleteActualApplicationEntity = (
  port: Pick<ApplicationActionPort, "deleteActual">,
  actual: CoreEntity<ActualData>,
  plan: CoreEntity<PlanData> | null,
  transactions: CoreEntity<TransactionData>[],
) => {
  if (!port.deleteActual) throw new Error("application_action_delete_actual_unavailable");
  return port.deleteActual(actual, plan, transactions);
};

export const queryApplicationEntities = async (port: ApplicationActionPort) => {
  if (!port.list) throw new Error("application_action_query_unavailable");
  return port.list();
};
