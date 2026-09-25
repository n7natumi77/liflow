import {
  active,
  type CoreEntity,
  type ExecutionSessionData,
  type NotificationRuleData,
  type PlanData,
  type RoutineData,
  type RoutineFlowData,
  type RoutineOccurrenceData,
  type SettingsData,
  type SleepRecordData,
  type TaskData,
} from "./core.ts";
import { isPlanActivityCompleted, reserveDeadlines } from "./scheduling.ts";
import { getWakeWindow, localDateKey } from "./wake.ts";
import { deriveAttentionCandidates } from "./attention.ts";

export type NotificationKind = "wake" | "morning" | "anchor" | "departure" | "execution" | "windDown" | "plan" | "task" | "routine" | "dailyMorning" | "dailyEvening";
export const NOTIFICATION_HORIZON_DAYS = 45;
export type NotificationJobData = {
  uid: string;
  dedupeKey: string;
  type: NotificationKind;
  dueAt: string;
  title: string;
  body: string;
  href: string;
  sourceId?: string | null;
  enabled: boolean;
  sentAt?: string | null;
  status?: "pending" | "sending" | "sent";
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceSubscriptionData = {
  deviceId: string;
  token: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  enabled: boolean;
};

export function deviceSubscriptionPayload(
  current: DeviceSubscriptionData | null,
  input: Pick<DeviceSubscriptionData, "deviceId" | "token" | "platform">,
  now: string,
): DeviceSubscriptionData {
  return {
    ...input,
    createdAt: current?.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
    enabled: true,
  };
}

export const disableDeviceSubscription = (current: DeviceSubscriptionData, now: string) => ({
  ...current,
  enabled: false,
  updatedAt: now,
  lastSeenAt: now,
});

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};
export const notificationJobId = (dedupeKey: string) => `notification_${hash(dedupeKey)}`;
export const notificationDeepLink = (type: NotificationKind, sourceId?: string | null) =>
  `/?notification=${encodeURIComponent(type)}${sourceId ? `&source=${encodeURIComponent(sourceId)}` : ""}`;

const atTime = (now: Date, value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  return result;
};

const settingsFor = (entities: CoreEntity[]) => ({
  notificationsEnabled: false,
  wakeNotifications: true,
  anchorNotifications: true,
  departureNotifications: true,
  executionNotifications: true,
  windDownNotifications: true,
  transitionBufferMinutes: 10,
  departureSafetyBufferMinutes: 10,
  targetSleepTime: "23:30" as string | null,
  windDownMinutes: 45,
  fallbackWakeTime: "08:00" as string | null,
  wakeWindowMinutes: 180,
  planNotificationOffsets: [10] as number[],
  taskNotificationOffsets: [1440] as number[],
  routineCheckTime: "20:00",
  routineRepeatIntervalMinutes: 30,
  routineMaxRepeats: 1,
  morningSummaryEnabled: true,
  morningSummaryTime: "08:00",
  eveningSummaryEnabled: true,
  eveningSummaryTime: "21:00",
  ...active<SettingsData>(entities, "settings")[0]?.payload,
});

const makeJob = (
  uid: string,
  now: Date,
  type: NotificationKind,
  dueAt: Date,
  dedupeKey: string,
  title: string,
  body: string,
  sourceId?: string | null,
): NotificationJobData => ({
  uid,
  dedupeKey,
  type,
  dueAt: dueAt.toISOString(),
  title,
  body,
  href: notificationDeepLink(type, sourceId),
  sourceId: sourceId || null,
  enabled: true,
  sentAt: null,
  status: "pending",
  claimedAt: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});

const sourceRules = (entities: CoreEntity[], sourceType: NotificationRuleData["sourceType"], sourceId: string) =>
  active<NotificationRuleData>(entities, "notificationRule").filter(rule => rule.payload.sourceType === sourceType && rule.payload.sourceId === sourceId);
const offsetsFor = (entities: CoreEntity[], sourceType: NotificationRuleData["sourceType"], sourceId: string, defaults: number[]) => {
  const rules = sourceRules(entities, sourceType, sourceId);
  if (rules.some(rule => rule.payload.triggerType === "disabled")) return [];
  const offsets = rules.filter(rule => rule.payload.enabled && rule.payload.triggerType === "offset" && typeof rule.payload.offsetMinutes === "number")
    .map(rule => ({ id: rule.id, minutes: Math.max(0, rule.payload.offsetMinutes!) }));
  return offsets.length ? offsets : defaults.map(minutes => ({ id: `default-${minutes}`, minutes }));
};
const matchesSchedule = (routine: RoutineData, date: Date) => {
  const day = date.getDay(), rule = routine.scheduleRule;
  if (rule.kind === "daily") return true;
  if (rule.kind === "weekdays") return day >= 1 && day <= 5;
  if (rule.kind === "weekends") return day === 0 || day === 6;
  return (rule.weekdays || []).includes(day);
};
const timeLabel = (value: string) => new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const plansOn = (entities: CoreEntity[], date: Date) => active<PlanData>(entities, "plan")
  .filter(plan => !plan.payload.resolution && localDateKey(new Date(plan.payload.startAt)) === localDateKey(date))
  .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
const morningBody = (entities: CoreEntity[], date: Date) => {
  const lines = plansOn(entities, date).filter(plan => !plan.payload.allDay).slice(0, 6).map(plan => `${timeLabel(plan.payload.startAt)} ${plan.payload.title}`);
  return lines.length ? lines.join(" / ") : "今日は時間付きの予定がありません。";
};
const eveningBody = (entities: CoreEntity[], date: Date) => {
  const key = localDateKey(date), tomorrow = new Date(date); tomorrow.setDate(tomorrow.getDate() + 1);
  const tasks = active<TaskData>(entities, "task"), completed = tasks.filter(task => task.payload.completedAt && localDateKey(new Date(task.payload.completedAt)) === key).length;
  const routines = active<RoutineOccurrenceData>(entities, "routineOccurrence").filter(item => item.payload.date === key), done = routines.filter(item => item.payload.status === "done").length;
  const tomorrowPlans = plansOn(entities, tomorrow).filter(plan => !plan.payload.allDay).slice(0, 5).map(plan => `${timeLabel(plan.payload.startAt)} ${plan.payload.title}`);
  const gap = deriveAttentionCandidates(entities, date).find(item => item.kind === "planningGap" && item.targetDate === localDateKey(tomorrow));
  return [`Task ${completed}件完了`, routines.length ? `Routine ${done}/${routines.length}` : "Routine記録なし", tomorrowPlans.length ? `明日: ${tomorrowPlans.join(" / ")}` : "明日の時間付き予定なし", gap ? `明日は${Math.round(Number(gap.metadata?.unplannedRatio || 0) * 100)}%未計画` : "明日の計画は半分以上あります"].join("。 ");
};

export function buildNotificationJobs(uid: string, entities: CoreEntity[], now: Date) {
  const settings = settingsFor(entities);
  if (!settings.notificationsEnabled) return [];
  const jobs: NotificationJobData[] = [];
  const horizon = now.getTime() + NOTIFICATION_HORIZON_DAYS * 86400000;

  if (settings.wakeNotifications && settings.morningSummaryEnabled) {
    for (let offset = 0; offset <= NOTIFICATION_HORIZON_DAYS; offset++) {
      const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset);
      const wake = getWakeWindow(entities, day, settings);
      const wakeAt = wake ? new Date(wake.targetAt) : atTime(day, settings.morningSummaryTime);
      if (wakeAt > now && wakeAt.getTime() <= horizon) {
        const key = localDateKey(wakeAt);
        jobs.push(makeJob(uid, now, "dailyMorning", wakeAt, `dailyMorning:${uid}:${key}:${wakeAt.toISOString()}`, "☀️ 今日の予定", morningBody(entities, day)));
      }
    }
  }

  const fixed = active<PlanData>(entities, "plan")
    .filter(
      (plan) =>
        !plan.payload.resolution &&
        !plan.payload.allDay &&
        plan.payload.type !== "container" &&
        plan.payload.flexibility === "fixed" &&
        !isPlanActivityCompleted(entities, plan.id) &&
        new Date(plan.payload.startAt).getTime() > now.getTime() &&
        new Date(plan.payload.startAt).getTime() <= horizon,
    )
    .sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
  if (settings.anchorNotifications) {
    for (const plan of fixed.filter((item) => item.payload.type !== "travel")) {
      for (const rule of offsetsFor(entities, "plan", plan.id, settings.planNotificationOffsets)) {
        const due = new Date(new Date(plan.payload.startAt).getTime() - rule.minutes * 60000);
        if (due > now) jobs.push(makeJob(uid, now, "plan", due, `plan:${plan.id}:${rule.id}:${due.toISOString()}`, rule.minutes ? `予定まで${rule.minutes}分` : "予定の開始時刻", plan.payload.title, plan.id));
      }
    }
  }

  for (const task of active<TaskData>(entities, "task").filter(item => item.payload.status === "open" && item.payload.deadline)) {
    for (const rule of offsetsFor(entities, "task", task.id, settings.taskNotificationOffsets)) {
      const due = new Date(Date.parse(task.payload.deadline!) - rule.minutes * 60000);
      if (rule.minutes >= 1440 && due.getHours() >= 21) due.setHours(9, 0, 0, 0);
      if (due > now && due.getTime() <= horizon) jobs.push(makeJob(uid, now, "task", due, `task:${task.id}:${rule.id}:${due.toISOString()}`, "Taskの期限が近づいています", task.payload.title, task.id));
    }
  }

  for (const routine of active<RoutineData>(entities, "routine").filter(item => item.payload.active)) {
    const rules = sourceRules(entities, "routine", routine.id).filter(rule => rule.payload.enabled && rule.payload.triggerType !== "disabled");
    if (sourceRules(entities, "routine", routine.id).some(rule => rule.payload.triggerType === "disabled")) continue;
    for (let offset = 0; offset <= NOTIFICATION_HORIZON_DAYS; offset++) {
      const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset); if (!matchesSchedule(routine.payload, day)) continue;
      const date = localDateKey(day), occurrence = active<RoutineOccurrenceData>(entities, "routineOccurrence").find(item => item.payload.routineId === routine.id && item.payload.date === date);
      if (occurrence && ["done", "skipped"].includes(occurrence.payload.status)) continue;
      const configured = rules.filter(rule => rule.payload.triggerType === "atTime");
      const times = configured.length ? configured.map(rule => ({ id: rule.id, time: rule.payload.targetTime || routine.payload.preferredTime || settings.routineCheckTime, repeat: rule.payload.repeatEnabled, interval: rule.payload.repeatIntervalMinutes ?? settings.routineRepeatIntervalMinutes, max: rule.payload.maxRepeats ?? settings.routineMaxRepeats }))
        : [{ id: "default", time: routine.payload.preferredTime || settings.routineCheckTime, repeat: true, interval: settings.routineRepeatIntervalMinutes, max: settings.routineMaxRepeats }];
      for (const rule of times) for (let repeat = 0; repeat <= (rule.repeat ? rule.max : 0); repeat++) {
        const due = atTime(day, rule.time); due.setMinutes(due.getMinutes() + repeat * rule.interval);
        if (due > now && due.getTime() <= horizon) jobs.push(makeJob(uid, now, "routine", due, `routine:${routine.id}:${date}:${rule.id}:${repeat}:${due.toISOString()}`, repeat ? `まだなら：${routine.payload.title}` : routine.payload.title, repeat ? "未完了なら、短く取りかかろう。" : "今日のRoutineです。", routine.id));
      }
    }
  }
  if (settings.departureNotifications) {
    for (const travel of fixed.filter((item) => item.payload.type === "travel")) {
      const departure = new Date(new Date(travel.payload.startAt).getTime() - settings.departureSafetyBufferMinutes * 60000);
      const reminder = new Date(departure.getTime() - 10 * 60000);
      if (reminder > now) jobs.push(makeJob(uid, now, "departure", reminder, `departure:${travel.id}:10min`, "推奨出発まで10分", `${departure.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}に出発できるようにしよう。`, travel.id));
    }
  }

  const wakeFlow = active<RoutineFlowData>(entities, "routineFlow").find(
    (flow) => flow.payload.active && flow.payload.trigger.type === "afterWake",
  );
  const nextTravel = fixed.find((item) => item.payload.type === "travel");
  if (settings.wakeNotifications && wakeFlow && nextTravel) {
    const minutes = wakeFlow.payload.steps.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0);
    const departure = new Date(new Date(nextTravel.payload.startAt).getTime() - settings.departureSafetyBufferMinutes * 60000);
    const due = new Date(departure.getTime() - minutes * 60000);
    if (due > now) jobs.push(makeJob(uid, now, "morning", due, `morning:${uid}:${localDateKey(departure)}`, "Liflow", "そろそろ支度を始めよう。", wakeFlow.id));
  }

  if (settings.executionNotifications) {
    const session = active<ExecutionSessionData>(entities, "executionSession").find(
      (item) => item.payload.status === "running",
    );
    const anchor = fixed[0];
    if (session && anchor) {
      const due = new Date(new Date(anchor.payload.startAt).getTime() - (settings.transitionBufferMinutes + 5) * 60000);
      if (due > now) jobs.push(makeJob(uid, now, "execution", due, `execution:${session.id}:${anchor.id}`, "あと5分で終わろう", "次の予定の準備時間です。Sessionは自動終了しません。", session.id));
    }
  }

  if (settings.windDownNotifications && settings.targetSleepTime) {
    const critical = reserveDeadlines(entities, now, settings).some((item) => item.pressure === "critical");
    for (let offset = 0; offset <= NOTIFICATION_HORIZON_DAYS; offset++) {
      const sleep = atTime(now, settings.targetSleepTime); sleep.setDate(sleep.getDate() + offset);
      const due = new Date(sleep.getTime() - settings.windDownMinutes * 60000);
      if (due > now && due.getTime() <= horizon) {
        jobs.push(makeJob(uid, now, "windDown", due, `winddown:${uid}:${localDateKey(sleep)}`, "そろそろ今日を終える時間", critical ? "明日締切の作業が残っています。Nowで現実的な一手を確認しよう。" : "長い作業は始めず、眠る準備へ切り替えよう。"));
      }
    }
  }

  if (settings.eveningSummaryEnabled) {
    for (let offset = 0; offset <= NOTIFICATION_HORIZON_DAYS; offset++) {
      const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset); const due = atTime(day, settings.eveningSummaryTime);
      if (due > now && due.getTime() <= horizon) jobs.push(makeJob(uid, now, "dailyEvening", due, `dailyEvening:${uid}:${localDateKey(day)}:${due.toISOString()}`, "🌙 今日のまとめ", eveningBody(entities, day)));
    }
  }

  return [...new Map(jobs.map((job) => [job.dedupeKey, job])).values()].filter(
    (job) => job.type === "wake" || job.type === "dailyMorning" || job.type === "windDown" || job.type === "dailyEvening" || !isQuietHours(new Date(job.dueAt), settings),
  );
}

export function isQuietHours(at: Date, settings: Partial<SettingsData>) {
  if (!settings.targetSleepTime || !settings.fallbackWakeTime) return false;
  const sleep = atTime(at, settings.targetSleepTime);
  const wake = atTime(at, settings.fallbackWakeTime);
  if (sleep <= wake) return at >= sleep && at < wake;
  return at >= sleep || at < wake;
}

export function findDueNotifications(
  jobs: NotificationJobData[],
  now: Date,
  quiet = false,
) {
  const earliest = now.getTime() - 10 * 60000;
  const seen = new Set<string>();
  return jobs
    .filter((job) => {
      const due = new Date(job.dueAt).getTime();
      const quietAllowed = job.type === "wake" || job.type === "dailyMorning" || job.type === "windDown" || job.type === "dailyEvening";
      return job.enabled && !job.sentAt && job.status !== "sent" && due <= now.getTime() && due >= earliest && (!quiet || quietAllowed);
    })
    .filter((job) => !seen.has(job.dedupeKey) && !!seen.add(job.dedupeKey))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function sleepRecordForPlannedWake(date: string, plannedWakeAt: string): SleepRecordData {
  return {
    date,
    plannedSleepAt: null,
    plannedWakeAt,
    estimatedSleepAt: null,
    actualWakeAt: null,
    source: "manual",
    confidence: 1,
  };
}
