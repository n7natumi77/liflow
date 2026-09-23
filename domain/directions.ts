import {
  active,
  inheritedDirection,
  type ActualData,
  type CoreEntity,
  type PlanData,
  type TaskData,
} from "./core.ts";

export type DirectionSummary = {
  directionId: string | null;
  minutes: number;
  lastActualAt: string | null;
};
export type DirectionPolicy = {
  directionId: string;
  windowDays: number;
  maxGapDays?: number;
  targetMinutes?: number;
  protection: "none" | "soft" | "strong";
};
export const DEFAULT_DIRECTION_POLICIES: DirectionPolicy[] = [
  { directionId: "direction_academic", windowDays: 7, protection: "none" },
  { directionId: "direction_specialty", windowDays: 14, maxGapDays: 7, targetMinutes: 120, protection: "soft" },
  { directionId: "direction_career", windowDays: 14, maxGapDays: 7, targetMinutes: 60, protection: "strong" },
  { directionId: "direction_life", windowDays: 7, protection: "none" },
  { directionId: "direction_world", windowDays: 14, protection: "none" },
];

export function resolveActualDirection(
  actual: CoreEntity<ActualData>,
  plans: CoreEntity<PlanData>[],
  tasks: CoreEntity<TaskData>[],
) {
  const plan = plans.find((item) => item.id === actual.payload.planId);
  const task = tasks.find((item) => item.id === (actual.payload.taskId || plan?.payload.taskId));
  return inheritedDirection(actual.payload.directionId, plan?.payload.directionId, task?.payload.directionId);
}

function mergeMinutes(ranges: [number, number][]) {
  const sorted = ranges.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const range of sorted) {
    if (!current) current = [...range];
    else if (range[0] <= current[1]) current[1] = Math.max(current[1], range[1]);
    else {
      total += current[1] - current[0];
      current = [...range];
    }
  }
  if (current) total += current[1] - current[0];
  return Math.floor(total / 60000);
}

export function getDirectionActualSummary(entities: CoreEntity[], now: Date, windowDays: number) {
  const plans = active<PlanData>(entities, "plan");
  const tasks = active<TaskData>(entities, "task");
  const from = now.getTime() - windowDays * 86400000;
  const until = now.getTime();
  const grouped = new Map<string, { ranges: [number, number][]; last: string | null }>();
  for (const actual of active<ActualData>(entities, "actual")) {
    const start = Math.max(from, new Date(actual.payload.startAt).getTime());
    const end = Math.min(until, new Date(actual.payload.endAt).getTime());
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const direction = resolveActualDirection(actual, plans, tasks) || "unclassified";
    const item = grouped.get(direction) || { ranges: [], last: null };
    item.ranges.push([start, end]);
    if (!item.last || actual.payload.endAt > item.last) item.last = actual.payload.endAt;
    grouped.set(direction, item);
  }
  return [...grouped].map(([key, value]) => ({
    directionId: key === "unclassified" ? null : key,
    minutes: mergeMinutes(value.ranges),
    lastActualAt: value.last,
  } satisfies DirectionSummary));
}

export type DirectionNeed = DirectionPolicy & {
  minutes: number;
  lastActualAt: string | null;
  gapDays: number | null;
  score: number;
};
export function getDirectionNeeds(
  entities: CoreEntity[],
  now: Date,
  policies: DirectionPolicy[] = DEFAULT_DIRECTION_POLICIES,
) {
  return policies
    .filter((policy) => policy.protection !== "none")
    .map((policy) => {
      const summary = getDirectionActualSummary(entities, now, policy.windowDays).find(
        (item) => item.directionId === policy.directionId,
      );
      const gapDays = summary?.lastActualAt
        ? Math.floor((now.getTime() - new Date(summary.lastActualAt).getTime()) / 86400000)
        : null;
      const minutesNeed = Math.max(0, (policy.targetMinutes || 0) - (summary?.minutes || 0));
      const gapNeed = gapDays === null
        ? policy.maxGapDays || 0
        : Math.max(0, gapDays - (policy.maxGapDays || Number.POSITIVE_INFINITY));
      return {
        ...policy,
        minutes: summary?.minutes || 0,
        lastActualAt: summary?.lastActualAt || null,
        gapDays,
        score: minutesNeed + gapNeed * 60 + (policy.protection === "strong" ? 30 : 0),
      } satisfies DirectionNeed;
    })
    .filter((need) => need.score > 0)
    .sort((a, b) => b.score - a.score || a.directionId.localeCompare(b.directionId));
}
