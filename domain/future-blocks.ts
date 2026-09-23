import {
  active,
  overlaps,
  validTimeRange,
  type CoreEntity,
  type PlanData,
  type SettingsData,
  type TaskData,
} from "./core.ts";
import { directionPoliciesFromSettings, getDirectionNeeds } from "./directions.ts";
import { getFreeWindows, reserveDeadlines } from "./scheduling.ts";
import { localDateKey } from "./wake.ts";

export const DEFAULT_FUTURE_BLOCK_POLICY = {
  maxPerDay: 1,
  minimumMinutes: 15,
  preferredMinutes: 25,
  maximumMinutes: 45,
  priorityDirectionIds: ["direction_specialty", "direction_career"],
} as const;

export const futureBlockPlanId = (date: string, directionId: string) =>
  `future_block_${date}_${directionId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

export type FutureBlockMutation = {
  kind: "create" | "move" | "cancel";
  id: string;
  payload: PlanData;
  existing: CoreEntity<PlanData> | null;
};

export type FutureBlockPlan = {
  mutations: FutureBlockMutation[];
  missingTaskDirectionIds: string[];
  suppressedByCriticalDeadline: boolean;
};

const isGeneratedBlock = (plan: CoreEntity<PlanData>) =>
  plan.payload.source === "futureBlock" && plan.payload.generationState === "generated";

const dayEnd = (now: Date, value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  return result;
};

export function planFutureBlocks(
  entities: CoreEntity[],
  now: Date,
  settings: Partial<SettingsData> = {},
): FutureBlockPlan {
  const date = localDateKey(now);
  const blocks = active<PlanData>(entities, "plan").filter(
    (plan) => plan.payload.source === "futureBlock" && localDateKey(new Date(plan.payload.startAt)) === date,
  );
  const generatedBlocks = blocks.filter(isGeneratedBlock);
  const withoutGenerated = entities.filter((item) => !generatedBlocks.some((block) => block.id === item.id));
  const critical = reserveDeadlines(withoutGenerated, now, settings).some((item) => item.pressure === "critical");
  const policies = directionPoliciesFromSettings(settings);
  const needs = getDirectionNeeds(withoutGenerated, now, policies);
  const tasks = active<TaskData>(entities, "task").filter((task) => task.payload.status === "open");
  const orderedNeeds = DEFAULT_FUTURE_BLOCK_POLICY.priorityDirectionIds
    .map((directionId) => needs.find((need) => need.directionId === directionId))
    .filter(Boolean);
  const missingTaskDirectionIds = orderedNeeds
    .filter((need) => !tasks.some((task) => task.payload.directionId === need!.directionId))
    .map((need) => need!.directionId);
  const selected = orderedNeeds.find((need) =>
    tasks.some((task) => task.payload.directionId === need!.directionId),
  );
  const existing = selected
    ? blocks.find((block) => block.payload.futureBlockDirectionId === selected.directionId)
    : null;
  const mutations: FutureBlockMutation[] = [];

  if (critical || !selected) {
    for (const block of generatedBlocks) {
      if (new Date(block.payload.startAt) <= now) continue;
      mutations.push({
        kind: "cancel",
        id: block.id,
        existing: block,
        payload: { ...block.payload, resolution: "cancelled", generationState: "cancelled" },
      });
    }
    return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: critical };
  }

  if (blocks.some((block) => block.payload.generationState === "overridden")) {
    return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
  }

  const task = tasks.find((item) => item.payload.directionId === selected.directionId)!;
  const otherPlans = active<PlanData>(entities, "plan").filter(
    (plan) =>
      plan.id !== existing?.id &&
      !plan.payload.resolution &&
      !plan.payload.allDay &&
      plan.payload.type !== "container" &&
      validTimeRange(plan.payload.startAt, plan.payload.endAt),
  );
  const existingStillSafe = existing &&
    !existing.payload.resolution &&
    new Date(existing.payload.endAt) > now &&
    !otherPlans.some((plan) =>
      overlaps(plan.payload.startAt, plan.payload.endAt, existing.payload.startAt, existing.payload.endAt),
    );
  if (existingStillSafe) return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
  if (!existing && blocks.length >= DEFAULT_FUTURE_BLOCK_POLICY.maxPerDay) {
    return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
  }

  const end = dayEnd(now, settings.dayEnd || "23:00");
  if (end <= now) return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
  const window = getFreeWindows(withoutGenerated, now, end, settings).find(
    (item) => item.remainingMinutes >= DEFAULT_FUTURE_BLOCK_POLICY.minimumMinutes,
  );
  if (!window) return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
  const desired = selected.protection === "strong" ? DEFAULT_FUTURE_BLOCK_POLICY.preferredMinutes : DEFAULT_FUTURE_BLOCK_POLICY.minimumMinutes;
  const duration = Math.min(DEFAULT_FUTURE_BLOCK_POLICY.maximumMinutes, desired, window.remainingMinutes);
  const start = new Date(window.start);
  const finish = new Date(window.start + duration * 60000);
  const payload: PlanData = {
    title: task.payload.title,
    taskId: task.id,
    projectId: task.payload.projectId || null,
    calendarCategoryId: task.payload.calendarCategoryId || null,
    directionId: selected.directionId,
    startAt: start.toISOString(),
    endAt: finish.toISOString(),
    type: "task",
    flexibility: "flexible",
    allDay: false,
    actualId: null,
    resolution: null,
    rescheduledFromPlanId: null,
    rescheduledToPlanId: null,
    source: "futureBlock",
    generationState: "generated",
    recurringRuleId: null,
    recurrenceKey: null,
    futureBlockDirectionId: selected.directionId,
    protection: "soft",
  };
  mutations.push({
    kind: existing ? "move" : "create",
    id: existing?.id || futureBlockPlanId(date, selected.directionId),
    existing: existing || null,
    payload,
  });
  return { mutations, missingTaskDirectionIds, suppressedByCriticalDeadline: false };
}
