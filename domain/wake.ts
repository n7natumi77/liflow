import {
  active,
  validTimeRange,
  type CoreEntity,
  type PlanData,
  type SettingsData,
  type SleepRecordData,
} from "./core.ts";

const pad = (value: number) => String(value).padStart(2, "0");
export const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const localTimeOn = (date: Date, time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
  return result;
};

export type WakeWindow = {
  targetAt: string;
  startsAt: string;
  endsAt: string;
  source: "plannedWakeAt" | "sleepPlan" | "fallback";
  sleepRecordId: string | null;
  shouldPrompt: boolean;
};

export function getWakeWindow(
  entities: CoreEntity[],
  now: Date,
  settings: Partial<SettingsData> = {},
): WakeWindow | null {
  const resolvedSettings = {
    ...active<SettingsData>(entities, "settings")[0]?.payload,
    ...settings,
  };
  const date = localDateKey(now);
  const sleepRecord = active<SleepRecordData>(entities, "sleepRecord").find(
    (item) => item.payload.date === date,
  );
  if (sleepRecord?.payload.actualWakeAt) return null;

  let target: Date | null = null;
  let source: WakeWindow["source"] = "fallback";
  if (sleepRecord?.payload.plannedWakeAt) {
    const planned = new Date(sleepRecord.payload.plannedWakeAt);
    if (Number.isFinite(planned.getTime())) {
      target = planned;
      source = "plannedWakeAt";
    }
  }
  if (!target) {
    const sleepPlan = active<PlanData>(entities, "plan")
      .filter(
        (plan) =>
          !plan.payload.resolution &&
          plan.payload.type === "sleep" &&
          validTimeRange(plan.payload.startAt, plan.payload.endAt) &&
          localDateKey(new Date(plan.payload.endAt)) === date,
      )
      .sort((a, b) => a.payload.endAt.localeCompare(b.payload.endAt))[0];
    if (sleepPlan) {
      target = new Date(sleepPlan.payload.endAt);
      source = "sleepPlan";
    }
  }
  if (!target && resolvedSettings.fallbackWakeTime) {
    target = localTimeOn(now, resolvedSettings.fallbackWakeTime);
    source = "fallback";
  }
  if (!target) return null;

  const starts = new Date(target.getTime() - 60 * 60000);
  const ends = new Date(target.getTime() + Math.max(30, resolvedSettings.wakeWindowMinutes ?? 180) * 60000);
  return {
    targetAt: target.toISOString(),
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    source,
    sleepRecordId: sleepRecord?.id || null,
    shouldPrompt: now >= starts && now <= ends,
  };
}

export function nextPlannedWake(
  entities: CoreEntity[],
  now: Date,
  settings: Partial<SettingsData> = {},
) {
  const records = active<SleepRecordData>(entities, "sleepRecord")
    .filter((item) => !item.payload.actualWakeAt && item.payload.plannedWakeAt)
    .map((item) => ({ item, at: new Date(item.payload.plannedWakeAt!).getTime() }))
    .filter(({ at }) => Number.isFinite(at) && at >= now.getTime() - 60 * 60000)
    .sort((a, b) => a.at - b.at);
  if (records[0]) return { at: new Date(records[0].at), source: "plannedWakeAt" as const };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (!settings.fallbackWakeTime) return null;
  return { at: localTimeOn(tomorrow, settings.fallbackWakeTime), source: "fallback" as const };
}
