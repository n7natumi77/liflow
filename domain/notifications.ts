import {
  active,
  type CoreEntity,
  type ExecutionSessionData,
  type PlanData,
  type RoutineFlowData,
  type SettingsData,
  type SleepRecordData,
} from "./core.ts";
import { isPlanActivityCompleted, reserveDeadlines } from "./scheduling.ts";
import { getWakeWindow, localDateKey } from "./wake.ts";

export type NotificationKind = "wake" | "morning" | "anchor" | "departure" | "execution" | "windDown";
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

export function buildNotificationJobs(uid: string, entities: CoreEntity[], now: Date) {
  const settings = settingsFor(entities);
  if (!settings.notificationsEnabled) return [];
  const jobs: NotificationJobData[] = [];
  const horizon = now.getTime() + NOTIFICATION_HORIZON_DAYS * 86400000;

  if (settings.wakeNotifications) {
    for (let offset = 0; offset <= NOTIFICATION_HORIZON_DAYS; offset++) {
      const day = new Date(now); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset);
      const wake = getWakeWindow(entities, day, settings);
      if (!wake) continue;
      const wakeAt = new Date(wake.targetAt);
      if (wakeAt > now && wakeAt.getTime() <= horizon) {
        const key = localDateKey(wakeAt);
        jobs.push(makeJob(uid, now, "wake", wakeAt, `wake:${uid}:${key}`, "Liflow", "おはよう。起きた？"));
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
      const due = new Date(new Date(plan.payload.startAt).getTime() - 15 * 60000);
      if (due > now) jobs.push(makeJob(uid, now, "anchor", due, `anchor:${plan.id}:15min`, "次の予定まで15分", plan.payload.title, plan.id));
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

  return [...new Map(jobs.map((job) => [job.dedupeKey, job])).values()].filter(
    (job) => job.type === "wake" || job.type === "windDown" || !isQuietHours(new Date(job.dueAt), settings),
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
      const quietAllowed = job.type === "wake" || job.type === "windDown";
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
