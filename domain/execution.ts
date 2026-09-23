import {
  inheritedDirection,
  type ActualData,
  type CoreEntity,
  type ExecutionSessionData,
  type PlanData,
  type RoutineFlowData,
  type RoutineRunData,
  type TaskData,
} from "./core.ts";

export const executionActualId = (sessionId: string) => `actual_execution_${sessionId}`;

/** Runtime locks are derived from durable Session entities, never the reverse. */
export function deriveExecutionRuntimeState(entities: CoreEntity[]) {
  const running = entities
    .filter(
      (item): item is CoreEntity<ExecutionSessionData> =>
        item.type === "executionSession" &&
        !item.deletedAt &&
        (item.payload as ExecutionSessionData).status === "running",
    )
    .sort((a, b) => b.payload.startedAt.localeCompare(a.payload.startedAt))[0];
  return running
    ? { status: "running" as const, sessionId: running.id }
    : { status: "completed" as const, sessionId: null };
}

export function createExecutionSessionPayload(
  target: CoreEntity<TaskData> | CoreEntity<PlanData>,
  now: Date,
  suggestedMinutes: number | null,
  task?: CoreEntity<TaskData>,
): ExecutionSessionData {
  const isTask = target.type === "task";
  const plan = isTask ? null : target as CoreEntity<PlanData>;
  const targetTask = isTask ? target as CoreEntity<TaskData> : task;
  return {
    targetKind: isTask ? "task" : "plan",
    taskId: targetTask?.id || plan?.payload.taskId || null,
    planId: plan?.id || null,
    title: target.payload.title,
    startedAt: now.toISOString(),
    endedAt: null,
    status: "running",
    suggestedMinutes,
    directionId: inheritedDirection(plan?.payload.directionId, targetTask?.payload.directionId),
    actualId: null,
  };
}

export function completionPayloads(
  session: CoreEntity<ExecutionSessionData>,
  now: Date,
  task?: CoreEntity<TaskData>,
) {
  const elapsed = Math.max(
    1,
    Math.floor((now.getTime() - new Date(session.payload.startedAt).getTime()) / 60000),
  );
  const actual: ActualData = {
    title: session.payload.title,
    taskId: session.payload.taskId || null,
    planId: session.payload.planId || null,
    projectId: task?.payload.projectId || null,
    calendarCategoryId: task?.payload.calendarCategoryId || null,
    directionId: inheritedDirection(session.payload.directionId, task?.payload.directionId),
    startAt: session.payload.startedAt,
    endAt: now.toISOString(),
    type: session.payload.targetKind,
    note: "",
  };
  const nextTask = task
    ? {
        ...task.payload,
        estimatedRemainingMinutes:
          typeof task.payload.estimatedRemainingMinutes === "number"
            ? Math.max(0, task.payload.estimatedRemainingMinutes - elapsed)
            : null,
      }
    : null;
  return { actual, nextTask, elapsedMinutes: elapsed };
}

export function startRoutineRunPayload(
  flow: CoreEntity<RoutineFlowData>,
  now: Date,
): RoutineRunData {
  return {
    routineFlowId: flow.id,
    startedAt: now.toISOString(),
    endedAt: null,
    status: "running",
    stepResults: flow.payload.steps.map((step, index) => ({
      stepId: step.id,
      startedAt: index === 0 ? now.toISOString() : null,
      endedAt: null,
      status: "pending",
      checkedItemIds: [],
    })),
  };
}

export function currentRoutineStep(
  flow: CoreEntity<RoutineFlowData>,
  run: CoreEntity<RoutineRunData>,
) {
  const result = run.payload.stepResults.find((item) => item.status === "pending");
  return result ? flow.payload.steps.find((step) => step.id === result.stepId) || null : null;
}

export function advanceRoutineRun(
  flow: CoreEntity<RoutineFlowData>,
  run: CoreEntity<RoutineRunData>,
  stepId: string,
  outcome: "completed" | "skipped",
  now: Date,
  checkedItemIds: string[] = [],
): RoutineRunData {
  const index = run.payload.stepResults.findIndex((item) => item.stepId === stepId);
  if (index < 0 || run.payload.stepResults[index].status !== "pending") return run.payload;
  const stepResults = run.payload.stepResults.map((item, itemIndex) =>
    itemIndex === index
      ? { ...item, status: outcome, endedAt: now.toISOString(), checkedItemIds }
      : itemIndex === index + 1 && item.status === "pending"
        ? { ...item, startedAt: item.startedAt || now.toISOString() }
        : item,
  );
  const finished = !stepResults.some((item) => item.status === "pending");
  return {
    ...run.payload,
    stepResults,
    status: finished ? "completed" : "running",
    endedAt: finished ? now.toISOString() : null,
  };
}
