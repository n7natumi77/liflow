import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CoreEntity, EntityType, NotificationRuleData, PlanData, RoutineData, TaskData } from "./core.ts";
import { buildNotificationJobs } from "./notifications.ts";
import { CURRENT_SCHEMA_VERSION } from "./schema.ts";

const now = new Date("2026-09-25T09:00:00+09:00");
const make = <T>(id: string, type: EntityType, payload: T): CoreEntity<T> => ({ id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1, createdAt: now.toISOString(), updatedAt: now.toISOString(), updatedBy: "test", deletedAt: null });
const settings = make("settings", "settings", { notificationsEnabled: true, wakeNotifications: true, anchorNotifications: true, departureNotifications: true, executionNotifications: true, windDownNotifications: false, planNotificationOffsets: [10], taskNotificationOffsets: [1440], routineCheckTime: "20:00", routineRepeatIntervalMinutes: 30, routineMaxRepeats: 1, morningSummaryEnabled: true, morningSummaryTime: "08:00", eveningSummaryEnabled: true, eveningSummaryTime: "21:00", dayStart: "07:00", dayEnd: "23:00", fallbackWakeTime: "08:00", wakeWindowMinutes: 180, transitionBufferMinutes: 10, departureSafetyBufferMinutes: 10 });

test("one Plan can own multiple common NotificationRules", () => {
  const plan = make<PlanData>("plan", "plan", { title: "バイト", startAt: "2026-09-25T18:00:00+09:00", endAt: "2026-09-25T22:00:00+09:00", type: "appointment", flexibility: "fixed", allDay: false, resolution: null });
  const rules = [60, 10, 0].map((offset, index) => make<NotificationRuleData>(`rule-${index}`, "notificationRule", { sourceType: "plan", sourceId: plan.id, enabled: true, triggerType: "offset", offsetMinutes: offset }));
  const jobs = buildNotificationJobs("u", [settings, plan, ...rules], now).filter(job => job.type === "plan");
  assert.equal(jobs.length, 3); assert.equal(new Set(jobs.map(job => job.dedupeKey)).size, 3);
});

test("moving or deleting a Plan changes or removes all desired notification jobs", () => {
  const payload: PlanData = { title: "授業", startAt: "2026-09-25T14:00:00+09:00", endAt: "2026-09-25T15:00:00+09:00", type: "appointment", flexibility: "fixed", allDay: false, resolution: null };
  const plan = make("plan", "plan", payload), before = buildNotificationJobs("u", [settings, plan], now).filter(job => job.sourceId === plan.id);
  const moved = { ...plan, payload: { ...payload, startAt: "2026-09-25T16:00:00+09:00", endAt: "2026-09-25T17:00:00+09:00" }, revision: 2 };
  const after = buildNotificationJobs("u", [settings, moved], now).filter(job => job.sourceId === plan.id);
  assert.notDeepEqual(after.map(job => job.dedupeKey), before.map(job => job.dedupeKey));
  assert.equal(buildNotificationJobs("u", [settings, { ...plan, deletedAt: now.toISOString() }], now).some(job => job.sourceId === plan.id), false);
});

test("Task rules are independent from deadline Attention and Routine repeat stops when done", () => {
  const task = make<TaskData>("task", "task", { title: "提出", status: "open", deadline: "2026-09-27T23:59:00+09:00", attentionLeadDays: 7 });
  const routine = make<RoutineData>("routine", "routine", { title: "日記", scheduleRule: { kind: "daily" }, preferredTime: null, active: true });
  const openJobs = buildNotificationJobs("u", [settings, task, routine], now);
  assert.ok(openJobs.some(job => job.type === "task" && job.sourceId === task.id));
  assert.ok(openJobs.filter(job => job.type === "routine" && job.sourceId === routine.id).length >= 2);
  const occurrence = make("occ", "routineOccurrence", { routineId: routine.id, date: "2026-09-25", status: "done" });
  assert.equal(buildNotificationJobs("u", [settings, task, routine, occurrence], now).some(job => job.type === "routine" && job.sourceId === routine.id && job.dueAt.startsWith("2026-09-25")), false);
});

test("Daily Summary and wake action contracts exist in jobs, worker and scheduler", () => {
  const task = make<TaskData>("task", "task", { title: "完了", status: "completed", completedAt: "2026-09-25T08:00:00+09:00" });
  const jobs = buildNotificationJobs("u", [settings, task], now);
  assert.ok(jobs.some(job => job.type === "dailyEvening" && job.body.includes("Task 1件完了")));
  const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), scheduler = readFileSync(new URL("../workers/notification-scheduler.ts", import.meta.url), "utf8");
  assert.match(worker, /action: "wake"/); assert.match(worker, /action=recordWake/); assert.match(scheduler, /type: String\(field\(job, "type"\)/);
});
