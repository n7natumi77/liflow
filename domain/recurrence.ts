import {
  routineOccurs,
  type CoreEntity,
  type PlanData,
  type RecurringActivityRuleData,
} from "./core.ts";
import { localDateKey } from "./wake.ts";

export const RECURRING_HORIZON_DAYS = 45;

const occurrenceKey = (ruleId: string, date: string) => `${ruleId}:${date}`;
export const recurringPlanId = (ruleId: string, date: string) =>
  `recurring_${ruleId.replace(/[^A-Za-z0-9_-]/g, "_")}_${date}`;

const atLocalTime = (date: Date, time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

export function recurringPlanPayload(
  rule: CoreEntity<RecurringActivityRuleData>,
  date: Date,
): PlanData {
  const start = atLocalTime(date, rule.payload.startTime);
  const end = new Date(start.getTime() + Math.max(1, rule.payload.durationMinutes) * 60000);
  const day = localDateKey(date);
  return {
    title: rule.payload.title,
    taskId: rule.payload.taskId || null,
    projectId: null,
    calendarCategoryId: rule.payload.calendarCategoryId || null,
    directionId: rule.payload.directionId || null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    type: rule.payload.planType || "personal",
    flexibility: rule.payload.flexibility || "fixed",
    allDay: false,
    actualId: null,
    resolution: null,
    rescheduledFromPlanId: null,
    rescheduledToPlanId: null,
    source: "recurring",
    generationState: "generated",
    recurringRuleId: rule.id,
    recurrenceKey: occurrenceKey(rule.id, day),
    futureBlockDirectionId: null,
    protection: null,
  };
}

export type RecurringMutation = {
  kind: "create" | "update" | "cancel";
  id: string;
  payload: PlanData;
  existing: CoreEntity<PlanData> | null;
};

const generated = (plan: CoreEntity<PlanData>) =>
  plan.payload.source === "recurring" && plan.payload.generationState === "generated";

const sameGeneratedPlan = (a: PlanData, b: PlanData) =>
  [
    "title",
    "taskId",
    "calendarCategoryId",
    "directionId",
    "startAt",
    "endAt",
    "type",
    "flexibility",
    "resolution",
    "recurringRuleId",
    "recurrenceKey",
  ].every((key) => a[key as keyof PlanData] === b[key as keyof PlanData]);

export function planRecurringMutations(
  entities: CoreEntity[],
  now: Date,
  horizonDays = RECURRING_HORIZON_DAYS,
) {
  const rules = entities.filter(
    (item): item is CoreEntity<RecurringActivityRuleData> => item.type === "recurringActivityRule",
  );
  const plans = entities.filter((item): item is CoreEntity<PlanData> => item.type === "plan");
  const mutations: RecurringMutation[] = [];
  for (const rule of rules) {
    const desiredKeys = new Set<string>();
    if (!rule.deletedAt && rule.payload.active) {
      for (let offset = 0; offset <= horizonDays; offset++) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        if (!routineOccurs(rule.payload.scheduleRule, date)) continue;
        const payload = recurringPlanPayload(rule, date);
        if (new Date(payload.endAt) <= now) continue;
        desiredKeys.add(payload.recurrenceKey!);
        const existing = plans.find(
          (plan) =>
            plan.payload.recurrenceKey === payload.recurrenceKey ||
            plan.id === recurringPlanId(rule.id, localDateKey(date)),
        );
        if (!existing) {
          mutations.push({ kind: "create", id: recurringPlanId(rule.id, localDateKey(date)), payload, existing: null });
        } else if (!existing.deletedAt && generated(existing) && !sameGeneratedPlan(existing.payload, payload)) {
          mutations.push({ kind: "update", id: existing.id, payload: { ...existing.payload, ...payload }, existing });
        }
      }
    }
    for (const plan of plans) {
      if (
        plan.payload.recurringRuleId !== rule.id ||
        plan.deletedAt ||
        !generated(plan) ||
        new Date(plan.payload.startAt) <= now ||
        desiredKeys.has(plan.payload.recurrenceKey || "")
      ) continue;
      mutations.push({
        kind: "cancel",
        id: plan.id,
        existing: plan,
        payload: { ...plan.payload, resolution: "cancelled", generationState: "cancelled" },
      });
    }
  }
  return mutations;
}

export function protectGeneratedPlanEdit(entity: CoreEntity<PlanData>, payload: PlanData) {
  if (entity.payload.generationState !== "generated" || !entity.payload.source) return payload;
  if (payload.resolution === "cancelled") return { ...payload, generationState: "cancelled" as const };
  return { ...payload, generationState: "overridden" as const };
}
