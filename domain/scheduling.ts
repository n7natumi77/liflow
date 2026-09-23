import {
  active,
  validTimeRange,
  type CoreEntity,
  type ExecutionSessionData,
  type PlanData,
  type SettingsData,
  type TaskData,
} from "./core.ts";

export type DeadlinePressure = "critical" | "tight" | "safe" | "unknown";
export type SchedulingPolicy = {
  safetyFactor: number;
  criticalSlackMinutes: number;
  tightSlackMinutes: number;
  horizonDays: number;
};
export const DEFAULT_SCHEDULING_POLICY: SchedulingPolicy = {
  safetyFactor: 1.25,
  criticalSlackMinutes: 15,
  tightSlackMinutes: 90,
  horizonDays: 14,
};

const minutes = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 60000));
const usablePlan = (plan: CoreEntity<PlanData>) =>
  !plan.deletedAt &&
  !plan.payload.resolution &&
  !plan.payload.allDay &&
  plan.payload.type !== "container" &&
  validTimeRange(plan.payload.startAt, plan.payload.endAt);

/** Activity completion is explicit Session state; linked Actuals may also be pauses. */
export const isPlanActivityCompleted = (entities: CoreEntity[], planId: string) =>
  active<ExecutionSessionData>(entities, "executionSession").some(
    (session) => session.payload.planId === planId && session.payload.status === "completed" && session.payload.outcome === "activityCompleted",
  );

export const fixedPlans = (entities: CoreEntity[]) =>
  active<PlanData>(entities, "plan").filter(
    (plan) => usablePlan(plan) && plan.payload.flexibility === "fixed" && !isPlanActivityCompleted(entities, plan.id),
  );

export type EarlyStartPolicy = { maximumLeadMinutes: number; minimumWindowMinutes: number };
export const DEFAULT_EARLY_START_POLICY: EarlyStartPolicy = { maximumLeadMinutes: 60, minimumWindowMinutes: 5 };

export function getEarlyStartCandidate(
  entities: CoreEntity[],
  now: Date,
  settings: Partial<SettingsData> = {},
  policy: EarlyStartPolicy = DEFAULT_EARLY_START_POLICY,
) {
  if (active<ExecutionSessionData>(entities, "executionSession").some(session => session.payload.status === "running")) return null;
  if (getCurrentFixedPlan(entities, now)) return null;
  const timestamp = now.getTime(), maximum = timestamp + policy.maximumLeadMinutes * 60000;
  const candidate = active<PlanData>(entities, "plan")
    .filter(plan => usablePlan(plan) && !isPlanActivityCompleted(entities, plan.id))
    .filter(plan => {
      const start = new Date(plan.payload.startAt).getTime();
      const executable = plan.payload.type === "task" || plan.payload.type === "personal";
      return executable && start > timestamp && start <= maximum;
    })
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0];
  if (!candidate) return null;
  const buffer = Math.max(0, settings.transitionBufferMinutes ?? 10);
  const blocker = active<PlanData>(entities, "plan")
    .filter(plan => plan.id !== candidate.id && usablePlan(plan) && !isPlanActivityCompleted(entities, plan.id))
    .filter(plan => new Date(plan.payload.startAt).getTime() > timestamp)
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0];
  if (blocker && new Date(blocker.payload.startAt).getTime() <= new Date(candidate.payload.startAt).getTime()) return null;
  const limit = Math.min(
    new Date(candidate.payload.endAt).getTime(),
    blocker ? new Date(blocker.payload.startAt).getTime() - buffer * 60000 : Number.POSITIVE_INFINITY,
  );
  const usableMinutes = minutes(timestamp, limit);
  const task = candidate.payload.taskId ? active<TaskData>(entities, "task").find(item => item.id === candidate.payload.taskId) : null;
  const minimum = Math.max(policy.minimumWindowMinutes, task?.payload.nextAction?.minimumUsefulMinutes || 1);
  return usableMinutes >= minimum ? { plan: candidate, usableMinutes } : null;
}

export function getCurrentFixedPlan(entities: CoreEntity[], now: Date) {
  const timestamp = now.getTime();
  return fixedPlans(entities)
    .filter(
      (plan) =>
        new Date(plan.payload.startAt).getTime() <= timestamp &&
        timestamp < new Date(plan.payload.endAt).getTime(),
    )
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0] || null;
}

export function getNextAnchor(entities: CoreEntity[], now: Date) {
  const timestamp = now.getTime();
  return fixedPlans(entities)
    .filter((plan) => new Date(plan.payload.startAt).getTime() > timestamp)
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0] || null;
}

export function getDepartureAnchor(
  entities: CoreEntity[],
  now: Date,
  safetyBufferMinutes: number,
) {
  const plan = fixedPlans(entities)
    .filter(
      (item) =>
        item.payload.type === "travel" && new Date(item.payload.startAt).getTime() > now.getTime(),
    )
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0];
  if (!plan) return null;
  return {
    plan,
    travelStartsAt: plan.payload.startAt,
    recommendedDepartureAt: new Date(
      new Date(plan.payload.startAt).getTime() - Math.max(0, safetyBufferMinutes) * 60000,
    ).toISOString(),
  };
}

function localBoundary(now: Date, time: string, addDayWhenPast = false) {
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(now);
  value.setHours(Number.isFinite(hour) ? hour : 23, Number.isFinite(minute) ? minute : 0, 0, 0);
  if (addDayWhenPast && value <= now) value.setDate(value.getDate() + 1);
  return value;
}

export type UsableWindow = {
  nextAnchor: CoreEntity<PlanData> | null;
  usableUntil: string;
  usableMinutes: number;
};
export function getUsableWindow(
  entities: CoreEntity[],
  now: Date,
  settings?: Partial<SettingsData>,
  remainingRoutineMinutes = 0,
): UsableWindow {
  const buffer = Math.max(0, settings?.transitionBufferMinutes ?? 10);
  const dayEnd = localBoundary(now, settings?.dayEnd || "23:00");
  const anchor = getNextAnchor(entities, now);
  const anchorLimit = anchor
    ? new Date(new Date(anchor.payload.startAt).getTime() - buffer * 60000)
    : dayEnd;
  const blocking = active<PlanData>(entities, "plan")
    .filter(
      (plan) =>
        usablePlan(plan) &&
        !isPlanActivityCompleted(entities, plan.id) &&
        new Date(plan.payload.startAt) > now &&
        new Date(plan.payload.startAt) < anchorLimit,
    )
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt))[0];
  const limit = new Date(
    Math.min(
      dayEnd.getTime(),
      anchorLimit.getTime(),
      blocking
        ? new Date(blocking.payload.startAt).getTime() - buffer * 60000
        : Number.POSITIVE_INFINITY,
    ),
  );
  return {
    nextAnchor: anchor,
    usableUntil: limit.toISOString(),
    usableMinutes: Math.max(0, minutes(now.getTime(), limit.getTime()) - remainingRoutineMinutes),
  };
}

export function getTaskRemainingEstimate(task: CoreEntity<TaskData>) {
  if (typeof task.payload.estimatedRemainingMinutes === "number") {
    return Math.max(0, task.payload.estimatedRemainingMinutes);
  }
  if (typeof task.payload.estimateMinutes === "number") {
    return Math.max(0, task.payload.estimateMinutes);
  }
  return null;
}

export type FreeWindow = { start: number; end: number; remainingMinutes: number };
export function getFreeWindows(
  entities: CoreEntity[],
  now: Date,
  end: Date,
  settings?: Partial<SettingsData>,
) {
  const windows: FreeWindow[] = [];
  const plans = active<PlanData>(entities, "plan").filter(plan => usablePlan(plan) && !isPlanActivityCompleted(entities, plan.id));
  const cursorDay = new Date(now);
  cursorDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(end);
  lastDay.setHours(0, 0, 0, 0);
  while (cursorDay <= lastDay) {
    const dayStart = localBoundary(cursorDay, settings?.dayStart || "07:00").getTime();
    const dayEnd = localBoundary(cursorDay, settings?.dayEnd || "23:00").getTime();
    const rangeStart = Math.max(now.getTime(), dayStart);
    const rangeEnd = Math.min(end.getTime(), dayEnd);
    if (rangeEnd > rangeStart) {
      const occupied = plans
        .map((plan) => [
          Math.max(rangeStart, new Date(plan.payload.startAt).getTime()),
          Math.min(rangeEnd, new Date(plan.payload.endAt).getTime()),
        ] as [number, number])
        .filter(([start, finish]) => finish > start)
        .sort((a, b) => a[0] - b[0]);
      let cursor = rangeStart;
      for (const [start, finish] of occupied) {
        if (start > cursor) windows.push({ start: cursor, end: start, remainingMinutes: minutes(cursor, start) });
        cursor = Math.max(cursor, finish);
      }
      if (cursor < rangeEnd) windows.push({ start: cursor, end: rangeEnd, remainingMinutes: minutes(cursor, rangeEnd) });
    }
    cursorDay.setDate(cursorDay.getDate() + 1);
  }
  return windows;
}

export type DeadlineReservation = {
  taskId: string;
  pressure: DeadlinePressure;
  remainingMinutes: number | null;
  requiredMinutes: number | null;
  coveredByPlansMinutes: number;
  reservedMinutes: number;
  shortfallMinutes: number;
  slackMinutes: number | null;
  allocations: { startAt: string; endAt: string; minutes: number }[];
};

export function reserveDeadlines(
  entities: CoreEntity[],
  now: Date,
  settings?: Partial<SettingsData>,
  policy: SchedulingPolicy = DEFAULT_SCHEDULING_POLICY,
) {
  const tasks = active<TaskData>(entities, "task")
    .filter((task) => task.payload.status === "open" && task.payload.deadline)
    .sort((a, b) => String(a.payload.deadline).localeCompare(String(b.payload.deadline)));
  const plans = active<PlanData>(entities, "plan").filter(plan => usablePlan(plan) && !isPlanActivityCompleted(entities, plan.id));
  const finalDeadline = tasks.reduce(
    (latest, task) => Math.max(latest, new Date(task.payload.deadline!).getTime()),
    now.getTime(),
  );
  const horizon = Math.min(
    finalDeadline,
    now.getTime() + policy.horizonDays * 86400000,
  );
  const free = getFreeWindows(entities, now, new Date(horizon), settings);
  const result: DeadlineReservation[] = [];
  for (const task of tasks) {
    const deadline = new Date(task.payload.deadline!).getTime();
    const remaining = getTaskRemainingEstimate(task);
    const coverage = plans
      .filter(
        (plan) =>
          plan.payload.taskId === task.id &&
          new Date(plan.payload.startAt).getTime() < deadline &&
          new Date(plan.payload.endAt).getTime() > now.getTime(),
      )
      .reduce(
        (sum, plan) =>
          sum +
          minutes(
            Math.max(now.getTime(), new Date(plan.payload.startAt).getTime()),
            Math.min(deadline, new Date(plan.payload.endAt).getTime()),
          ),
        0,
      );
    if (remaining === null) {
      result.push({
        taskId: task.id,
        pressure: "unknown",
        remainingMinutes: null,
        requiredMinutes: null,
        coveredByPlansMinutes: coverage,
        reservedMinutes: 0,
        shortfallMinutes: 0,
        slackMinutes: null,
        allocations: [],
      });
      continue;
    }
    const required = Math.max(0, Math.ceil(remaining * policy.safetyFactor) - coverage);
    const availableBefore = free
      .filter((window) => window.start < deadline)
      .reduce((sum, window) => sum + Math.min(window.remainingMinutes, minutes(window.start, Math.min(window.end, deadline))), 0);
    let needed = required;
    const allocations: DeadlineReservation["allocations"] = [];
    const candidates = free
      .map((window) => ({ window, usableEnd: Math.min(window.end, deadline) }))
      .filter(({ window, usableEnd }) => window.start < usableEnd)
      .sort((a, b) => b.usableEnd - a.usableEnd);
    for (const candidate of candidates) {
      if (needed <= 0) break;
      const currentIndex = free.indexOf(candidate.window);
      if (currentIndex < 0) continue;
      const window = free[currentIndex];
      const usableEnd = Math.min(window.end, deadline);
      const capacity = minutes(window.start, usableEnd);
      const take = Math.min(needed, capacity);
      if (!take) continue;
      const allocationStart = usableEnd - take * 60000;
      allocations.unshift({
        startAt: new Date(allocationStart).toISOString(),
        endAt: new Date(usableEnd).toISOString(),
        minutes: take,
      });
      const replacements: FreeWindow[] = [];
      if (window.start < allocationStart) replacements.push({ start: window.start, end: allocationStart, remainingMinutes: minutes(window.start, allocationStart) });
      if (usableEnd < window.end) replacements.push({ start: usableEnd, end: window.end, remainingMinutes: minutes(usableEnd, window.end) });
      free.splice(currentIndex, 1, ...replacements);
      needed -= take;
    }
    const reserved = required - needed;
    const slack = availableBefore - required;
    const pressure: DeadlinePressure =
      needed > 0 || slack <= policy.criticalSlackMinutes
        ? "critical"
        : slack <= policy.tightSlackMinutes
          ? "tight"
          : "safe";
    result.push({
      taskId: task.id,
      pressure,
      remainingMinutes: remaining,
      requiredMinutes: required,
      coveredByPlansMinutes: coverage,
      reservedMinutes: reserved,
      shortfallMinutes: needed,
      slackMinutes: slack,
      allocations,
    });
  }
  return result;
}
