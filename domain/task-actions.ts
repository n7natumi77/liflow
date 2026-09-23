import { active, type CoreEntity, type TaskActionData } from "./core.ts";

export const taskActionsFor = (entities: CoreEntity[], taskId: string) =>
  active<TaskActionData>(entities, "taskAction")
    .filter(action => action.payload.taskId === taskId)
    .sort((a, b) => a.payload.sortOrder - b.payload.sortOrder || a.createdAt.localeCompare(b.createdAt));

export const currentTaskAction = (entities: CoreEntity[], taskId: string) =>
  taskActionsFor(entities, taskId).find(action => action.payload.status === "todo") || null;

export const nextTaskActionOrder = (entities: CoreEntity[], taskId: string) => {
  const actions = taskActionsFor(entities, taskId);
  return actions.length ? Math.max(...actions.map(action => action.payload.sortOrder)) + 1 : 0;
};

/** Completing the final Action deliberately leaves its Task open. */
export const completedTaskActionPayload = (action: CoreEntity<TaskActionData>, now = new Date()) => ({
  ...action.payload,
  status: "done" as const,
  completedAt: now.toISOString(),
});

