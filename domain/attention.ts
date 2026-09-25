import {
  active,
  actualsForPlan,
  inheritedDirection,
  type ActualData,
  type AttentionData,
  type CoreEntity,
  type DirectionData,
  type PlanData,
  type SettingsData,
  type SleepRecordData,
  type TaskData,
} from "./core.ts";
import { directionPoliciesFromSettings, getDirectionActualSummary } from "./directions.ts";
import { localDateKey } from "./wake.ts";

export type AttentionCandidate = Omit<AttentionData, "status" | "ignoredAt" | "resolvedAt">;
export type AttentionMutation =
  | { kind: "create"; id: string; payload: AttentionData }
  | { kind: "update"; entity: CoreEntity<AttentionData>; payload: AttentionData };

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};
export const attentionEntityId = (key: string) => `attention_${hash(key)}`;

const atTime = (date: Date, value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const result = new Date(date); result.setHours(hour, minute, 0, 0); return result;
};
const dayBounds = (entities: CoreEntity[], date: Date) => {
  const settings = active<SettingsData>(entities, "settings")[0]?.payload;
  const key = localDateKey(date), sleep = active<SleepRecordData>(entities, "sleepRecord").find(item => item.payload.date === key);
  const start = sleep?.payload.plannedWakeAt ? new Date(sleep.payload.plannedWakeAt) : atTime(date, settings?.dayStart || "07:00");
  const end = sleep?.payload.plannedSleepAt ? new Date(sleep.payload.plannedSleepAt) : atTime(date, settings?.dayEnd || "23:00");
  if (end <= start) end.setDate(end.getDate() + 1);
  return { key, start, end };
};
const mergedMinutes = (ranges: [number, number][]) => {
  const sorted = ranges.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0, current: [number, number] | null = null;
  for (const range of sorted) {
    if (!current) current = [...range];
    else if (range[0] <= current[1]) current[1] = Math.max(current[1], range[1]);
    else { total += current[1] - current[0]; current = [...range]; }
  }
  if (current) total += current[1] - current[0];
  return Math.floor(total / 60000);
};

export function deriveAttentionCandidates(entities: CoreEntity[], now = new Date()): AttentionCandidate[] {
  const candidates: AttentionCandidate[] = [], settings = active<SettingsData>(entities, "settings")[0]?.payload;
  const tasks = active<TaskData>(entities, "task"), plans = active<PlanData>(entities, "plan");
  const directions = active<DirectionData>(entities, "direction"), today = dayBounds(entities, now);

  const staleDays = Math.max(1, settings?.directionStaleDays ?? 3);
  const summaries = getDirectionActualSummary(entities, now, Math.max(staleDays + 1, 30));
  for (const policy of directionPoliciesFromSettings(settings).filter(item => item.protection !== "none")) {
    const openTasks = tasks.filter(task => task.payload.status === "open" && task.payload.directionId === policy.directionId);
    const summary = summaries.find(item => item.directionId === policy.directionId);
    const stale = !openTasks.length && (!summary?.lastActualAt || now.getTime() - Date.parse(summary.lastActualAt) >= staleDays * 86400000);
    if (!stale) continue;
    const direction = directions.find(item => item.id === policy.directionId);
    const name = direction?.payload.name || "保護中のDirection";
    candidates.push({ key: `directionStale:${policy.directionId}`, kind: "directionStale", targetType: "direction", targetId: policy.directionId, targetDate: null,
      title: `🧭 ${name}を確認`, message: `Open Taskまたは活動が${staleDays}日間ありません。`, stateKey: summary?.lastActualAt || "no-activity", metadata: { staleDays } });
  }

  if (now < today.end) {
    for (const plan of plans.filter(item => !item.payload.resolution && !item.payload.allDay && localDateKey(new Date(item.payload.startAt)) === today.key && Date.parse(item.payload.endAt) <= now.getTime())) {
      if (actualsForPlan(entities, plan.id).length) continue;
      candidates.push({ key: `actualMissing:${plan.id}:${today.key}`, kind: "actualMissing", targetType: "plan", targetId: plan.id, targetDate: today.key,
        title: "実績を確認", message: `「${plan.payload.title}」の実績がまだ記録されていません。`, stateKey: `${plan.revision}:${plan.payload.endAt}`, metadata: { expiresAt: today.end.toISOString() } });
    }
  }

  for (let offset = 0; offset <= 1; offset++) {
    const date = new Date(now); date.setDate(date.getDate() + offset); const bounds = dayBounds(entities, date);
    if (offset === 0 && now >= bounds.end) continue;
    const relevant = plans.filter(plan => !plan.payload.resolution && !plan.payload.allDay && plan.payload.type !== "container" && Date.parse(plan.payload.endAt) > bounds.start.getTime() && Date.parse(plan.payload.startAt) < bounds.end.getTime());
    const planned = mergedMinutes(relevant.map(plan => [Math.max(bounds.start.getTime(), Date.parse(plan.payload.startAt)), Math.min(bounds.end.getTime(), Date.parse(plan.payload.endAt))]));
    const awake = Math.max(1, Math.floor((bounds.end.getTime() - bounds.start.getTime()) / 60000)), unplannedRatio = 1 - planned / awake;
    if (unplannedRatio <= .5) continue;
    const percent = Math.round(unplannedRatio * 100);
    candidates.push({ key: `planningGap:${bounds.key}`, kind: "planningGap", targetType: "date", targetId: null, targetDate: bounds.key,
      title: offset ? "🌙 明日の計画を確認" : "今日の計画を確認", message: `起きている時間の${percent}%が未計画です。このままでも問題ありません。`,
      stateKey: relevant.map(plan => `${plan.id}:${plan.revision}`).sort().join("|") || "no-plans", metadata: { plannedMinutes: planned, awakeMinutes: awake, unplannedRatio } });
  }

  for (const task of tasks.filter(item => item.payload.status === "open" && item.payload.deadline)) {
    const leadDays = task.payload.attentionLeadDays === null ? null : Math.max(0, task.payload.attentionLeadDays ?? 7);
    if (leadDays === null) continue;
    const deadline = Date.parse(task.payload.deadline!);
    if (!Number.isFinite(deadline) || deadline > now.getTime() + leadDays * 86400000) continue;
    candidates.push({ key: `taskDeadline:${task.id}`, kind: "taskDeadline", targetType: "task", targetId: task.id, targetDate: localDateKey(new Date(deadline)),
      title: "Taskの期限を確認", message: `「${task.payload.title}」の期限が近づいています。`, stateKey: `${task.payload.deadline}:${leadDays}`, metadata: { leadDays } });
  }
  return candidates;
}

export function reconcileAttentions(entities: CoreEntity[], now = new Date()): AttentionMutation[] {
  const desired = deriveAttentionCandidates(entities, now), existing = active<AttentionData>(entities, "attention"), mutations: AttentionMutation[] = [];
  const desiredKeys = new Set(desired.map(item => item.key));
  for (const candidate of desired) {
    const current = existing.find(item => item.payload.key === candidate.key), base: AttentionData = { ...candidate, status: "open", ignoredAt: null, resolvedAt: null };
    if (!current) mutations.push({ kind: "create", id: attentionEntityId(candidate.key), payload: base });
    else if (current.payload.status === "ignored" && current.payload.stateKey === candidate.stateKey) continue;
    else if (current.payload.status !== "open" || current.payload.stateKey !== candidate.stateKey || current.payload.message !== candidate.message)
      mutations.push({ kind: "update", entity: current, payload: base });
  }
  for (const current of existing.filter(item => item.payload.status === "open" && !desiredKeys.has(item.payload.key)))
    mutations.push({ kind: "update", entity: current, payload: { ...current.payload, status: "resolved", resolvedAt: now.toISOString() } });
  return mutations;
}

export const attentionGroup = (kind: AttentionData["kind"]) => kind === "directionStale" ? "Direction" : kind === "planningGap" ? "計画" : kind === "actualMissing" ? "実績" : kind === "taskDeadline" ? "Task" : "お金";
export const directionForActual = (actual: CoreEntity<ActualData>, plans: CoreEntity<PlanData>[], tasks: CoreEntity<TaskData>[]) => {
  const plan = plans.find(item => item.id === actual.payload.planId), task = tasks.find(item => item.id === (actual.payload.taskId || plan?.payload.taskId));
  return inheritedDirection(actual.payload.directionId, plan?.payload.directionId, task?.payload.directionId);
};
