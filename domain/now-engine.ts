import {
  active,
  type ConditionRecordData,
  type CoreEntity,
  type ExecutionSessionData,
  type RoutineFlowData,
  type RoutineRunData,
  type SettingsData,
  type SleepRecordData,
  type TaskData,
} from "./core.ts";
import { getDirectionNeeds } from "./directions.ts";
import { currentRoutineStep } from "./execution.ts";
import {
  getCurrentFixedPlan,
  getDepartureAnchor,
  getTaskRemainingEstimate,
  getUsableWindow,
  reserveDeadlines,
  type DeadlineReservation,
} from "./scheduling.ts";

export type NowMode = "morning" | "fixed" | "focus" | "recovery" | "windDown" | "free";
export type StartAssistReason = "unknown" | "heavy" | "tired" | "boring";
export type NowPrimaryAction =
  | { kind: "session"; sessionId: string; title: string; startedAt: string; suggestedMinutes: number | null }
  | { kind: "wake"; title: string }
  | { kind: "plan"; planId: string; title: string }
  | { kind: "task"; taskId: string; sourcePlanId?: string | null; title: string; suggestedMinutes: number }
  | { kind: "routine"; routineRunId: string; stepId: string; title: string; executionMode: string; suggestedMinutes: number | null; startedAt: string | null }
  | { kind: "rest"; title: string; suggestedMinutes: number }
  | null;
export type NowReason =
  | "running_session"
  | "wake_check"
  | "morning_routine"
  | "current_fixed_plan"
  | "critical_deadline"
  | "tight_deadline"
  | "direction_need"
  | "continuation"
  | "recovery"
  | "wind_down"
  | "free";
export type NowDecision = {
  mode: NowMode;
  primaryAction: NowPrimaryAction;
  nextAnchorAt: string | null;
  usableUntil: string | null;
  usableMinutes: number | null;
  departureAt: string | null;
  reason: NowReason;
  reasonDetails?: Record<string, unknown>;
};

export type NowEngineOptions = {
  assistReason?: StartAssistReason | null;
  excludedTaskIds?: string[];
};

export const DEFAULT_NOW_SETTINGS: Required<
  Pick<
    SettingsData,
    | "dayStart"
    | "dayEnd"
    | "guidanceIntensity"
    | "transitionBufferMinutes"
    | "departureSafetyBufferMinutes"
    | "targetSleepTime"
    | "windDownMinutes"
  >
> = {
  dayStart: "07:00",
  dayEnd: "23:00",
  guidanceIntensity: "strong",
  transitionBufferMinutes: 10,
  departureSafetyBufferMinutes: 10,
  targetSleepTime: "23:30",
  windDownMinutes: 45,
};

const dateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const todayAt = (now: Date, value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  return result;
};
const settingsFor = (entities: CoreEntity[]) => ({
  ...DEFAULT_NOW_SETTINGS,
  ...active<SettingsData>(entities, "settings")[0]?.payload,
});

function routineContext(entities: CoreEntity[]) {
  const run = active<RoutineRunData>(entities, "routineRun")
    .filter((item) => item.payload.status === "running")
    .sort((a, b) => b.payload.startedAt.localeCompare(a.payload.startedAt))[0];
  if (!run) return null;
  const flow = active<RoutineFlowData>(entities, "routineFlow").find(
    (item) => item.id === run.payload.routineFlowId,
  );
  const step = flow ? currentRoutineStep(flow, run) : null;
  const stepResult = step ? run.payload.stepResults.find((item) => item.stepId === step.id) : null;
  return flow && step ? { run, flow, step, stepResult } : null;
}

function runningSession(entities: CoreEntity[]) {
  return active<ExecutionSessionData>(entities, "executionSession")
    .filter((item) => item.payload.status === "running")
    .sort((a, b) => b.payload.startedAt.localeCompare(a.payload.startedAt))[0] || null;
}

function isWindDown(now: Date, settings: ReturnType<typeof settingsFor>) {
  if (!settings.targetSleepTime) return false;
  const sleep = todayAt(now, settings.targetSleepTime);
  if (sleep.getTime() < todayAt(now, "12:00").getTime()) sleep.setDate(sleep.getDate() + 1);
  const starts = new Date(sleep.getTime() - settings.windDownMinutes * 60000);
  return now >= starts && now < sleep;
}

function highFatigue(entities: CoreEntity[], now: Date) {
  const latest = active<ConditionRecordData>(entities, "conditionRecord")
    .filter((item) => new Date(item.payload.recordedAt).getTime() <= now.getTime())
    .sort((a, b) => b.payload.recordedAt.localeCompare(a.payload.recordedAt))[0];
  return !!latest && (latest.payload.fatigue || 0) >= 3 &&
    now.getTime() - new Date(latest.payload.recordedAt).getTime() <= 12 * 3600000;
}

function taskAction(
  task: CoreEntity<TaskData>,
  usableMinutes: number,
  assistReason?: StartAssistReason | null,
) {
  const remaining = getTaskRemainingEstimate(task);
  const minimum = task.payload.nextAction?.minimumUsefulMinutes || 1;
  let suggested = Math.max(minimum, Math.min(usableMinutes || 5, remaining ?? 25));
  let title = task.payload.nextAction?.title || task.payload.title;
  if (assistReason === "unknown") {
    title = task.payload.nextAction?.title || `まず5分だけ「${task.payload.title}」に触る`;
    suggested = 5;
  } else if (assistReason === "heavy") suggested = 5;
  else if (assistReason === "boring") suggested = 10;
  else if (assistReason === "tired") suggested = 5;
  return {
    kind: "task" as const,
    taskId: task.id,
    title,
    suggestedMinutes: Math.max(1, Math.min(suggested, Math.max(1, usableMinutes))),
  };
}

function chooseDeadlineTask(
  tasks: CoreEntity<TaskData>[],
  reservations: DeadlineReservation[],
  pressure: "critical" | "tight",
) {
  return reservations
    .filter((item) => item.pressure === pressure)
    .map((item) => tasks.find((task) => task.id === item.taskId))
    .find(Boolean) || null;
}

export function getNowDecision(
  entities: CoreEntity[],
  now: Date,
  options: NowEngineOptions = {},
): NowDecision {
  const settings = settingsFor(entities);
  const routine = routineContext(entities);
  const remainingRoutineMinutes = routine
    ? routine.flow.payload.steps
        .filter((step) => routine.run.payload.stepResults.find((result) => result.stepId === step.id)?.status === "pending")
        .reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0)
    : 0;
  const window = getUsableWindow(entities, now, settings, remainingRoutineMinutes);
  const departure = getDepartureAnchor(entities, now, settings.departureSafetyBufferMinutes);
  const base = {
    nextAnchorAt: window.nextAnchor?.payload.startAt || null,
    usableUntil: window.usableUntil,
    usableMinutes: window.usableMinutes,
    departureAt: departure?.recommendedDepartureAt || null,
  };
  const session = runningSession(entities);
  if (session) {
    return {
      ...base,
      mode: "focus",
      primaryAction: {
        kind: "session",
        sessionId: session.id,
        title: session.payload.title,
        startedAt: session.payload.startedAt,
        suggestedMinutes: session.payload.suggestedMinutes || null,
      },
      reason: "running_session",
    };
  }

  const hour = now.getHours();
  const sleep = active<SleepRecordData>(entities, "sleepRecord").find(
    (item) => item.payload.date === dateKey(now),
  );
  if (hour >= 4 && hour < 12 && !sleep?.payload.actualWakeAt) {
    return {
      ...base,
      mode: "morning",
      primaryAction: { kind: "wake", title: "起きた？" },
      reason: "wake_check",
    };
  }
  if (routine) {
    const urgent = !!departure &&
      new Date(departure.recommendedDepartureAt).getTime() - now.getTime() <= remainingRoutineMinutes * 60000;
    return {
      ...base,
      mode: routine.flow.payload.trigger.type === "afterWake" ? "morning" : "focus",
      primaryAction: {
        kind: "routine",
        routineRunId: routine.run.id,
        stepId: routine.step.id,
        title: routine.step.title,
        executionMode: routine.step.executionMode,
        suggestedMinutes: routine.step.estimatedMinutes || null,
        startedAt: routine.stepResult?.startedAt || null,
      },
      reason: "morning_routine",
      reasonDetails: { urgent, remainingRoutineMinutes },
    };
  }

  const current = getCurrentFixedPlan(entities, now);
  if (current) {
    return {
      ...base,
      mode: "fixed",
      primaryAction: { kind: "plan", planId: current.id, title: current.payload.title },
      reason: "current_fixed_plan",
    };
  }

  const excluded = new Set(options.excludedTaskIds || []);
  const tasks = active<TaskData>(entities, "task").filter(
    (task) => task.payload.status === "open" && !excluded.has(task.id),
  );
  const reservations = reserveDeadlines(entities, now, settings);
  const critical = chooseDeadlineTask(tasks, reservations, "critical");
  const windDown = isWindDown(now, settings);
  if (options.assistReason === "tired" && !critical || highFatigue(entities, now) && !critical) {
    return {
      ...base,
      mode: "recovery",
      primaryAction: { kind: "rest", title: "15分休もう", suggestedMinutes: 15 },
      reason: "recovery",
    };
  }
  if (critical) {
    const reservation = reservations.find((item) => item.taskId === critical.id)!;
    return {
      ...base,
      mode: "focus",
      primaryAction: taskAction(critical, window.usableMinutes, options.assistReason),
      reason: "critical_deadline",
      reasonDetails: reservation,
    };
  }
  if (windDown) {
    return {
      ...base,
      mode: "windDown",
      primaryAction: null,
      reason: "wind_down",
      reasonDetails: { targetSleepTime: settings.targetSleepTime },
    };
  }
  const tight = chooseDeadlineTask(tasks, reservations, "tight");
  if (tight) {
    return {
      ...base,
      mode: "focus",
      primaryAction: taskAction(tight, window.usableMinutes, options.assistReason),
      reason: "tight_deadline",
      reasonDetails: reservations.find((item) => item.taskId === tight.id),
    };
  }
  for (const need of getDirectionNeeds(entities, now)) {
    const task = tasks.find((item) => item.payload.directionId === need.directionId);
    if (task && window.usableMinutes >= (task.payload.nextAction?.minimumUsefulMinutes || 1)) {
      return {
        ...base,
        mode: "focus",
        primaryAction: taskAction(task, window.usableMinutes, options.assistReason),
        reason: "direction_need",
        reasonDetails: need,
      };
    }
  }
  const safe = reservations
    .filter((item) => item.pressure === "safe" || item.pressure === "unknown")
    .map((item) => tasks.find((task) => task.id === item.taskId))
    .find((task) => task && window.usableMinutes >= (task.payload.nextAction?.minimumUsefulMinutes || 1));
  if (safe) {
    return {
      ...base,
      mode: "focus",
      primaryAction: taskAction(safe, window.usableMinutes, options.assistReason),
      reason: "continuation",
    };
  }
  return { ...base, mode: "free", primaryAction: null, reason: "free" };
}
