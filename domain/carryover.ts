import {
  active,
  actualsForPlan,
  type ActualData,
  type CoreEntity,
  type PlanData,
  type TaskActionData,
  type TaskData,
} from "./core.ts";

export type CarryoverWork = {
  plan: CoreEntity<PlanData>;
  task: CoreEntity<TaskData>;
  taskAction: CoreEntity<TaskActionData> | null;
  daysAgo: number;
  label: string;
};

const localDayStart = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const carryoverLabel = (daysAgo: number) =>
  daysAgo === 1 ? "↩ 昨日の予定で未実施" : `↩ ${daysAgo}日前から未実施`;

/**
 * Derives missed work from existing entities. It never creates or moves Plans.
 * A later Actual for the same Task/Action resolves that historical occurrence.
 */
export function deriveCarryoverWork(entities: CoreEntity[], now = new Date()): CarryoverWork[] {
  const today = localDayStart(now);
  const tasks = active<TaskData>(entities, "task");
  const actions = active<TaskActionData>(entities, "taskAction");
  const actuals = active<ActualData>(entities, "actual");
  return active<PlanData>(entities, "plan")
    .filter(plan => !plan.payload.resolution && Date.parse(plan.payload.endAt) < today.getTime())
    .filter(plan => actualsForPlan(entities, plan.id).length === 0)
    .flatMap(plan => {
      const action = plan.payload.taskActionId
        ? actions.find(item => item.id === plan.payload.taskActionId) || null
        : null;
      const taskId = plan.payload.taskId || action?.payload.taskId || "";
      const task = tasks.find(item => item.id === taskId);
      if (!task || task.payload.status !== "open") return [];
      if (plan.payload.taskActionId && (!action || action.payload.status !== "todo")) return [];
      const executedLater = actuals.some(actual =>
        Date.parse(actual.payload.startAt) >= Date.parse(plan.payload.endAt) &&
        (action ? actual.payload.taskActionId === action.id : actual.payload.taskId === task.id),
      );
      if (executedLater) return [];
      const planDay = localDayStart(new Date(plan.payload.endAt));
      const daysAgo = Math.max(1, Math.round((today.getTime() - planDay.getTime()) / 86_400_000));
      return [{ plan, task, taskAction: action, daysAgo, label: carryoverLabel(daysAgo) }];
    })
    .sort((a, b) => a.plan.payload.endAt.localeCompare(b.plan.payload.endAt));
}
