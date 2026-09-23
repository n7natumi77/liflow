import type { CoreEntity, EntityType } from "./core.ts";

export type ApplicationActionPort = {
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  createMany?: (inputs: { type: EntityType; payload: Record<string, unknown> }[]) => Promise<CoreEntity[]>;
  update?: (entity: CoreEntity, payload: Record<string, unknown>, softDelete?: boolean) => Promise<CoreEntity>;
  list?: () => Promise<CoreEntity[]>;
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

export const queryApplicationEntities = async (port: ApplicationActionPort) => {
  if (!port.list) throw new Error("application_action_query_unavailable");
  return port.list();
};
