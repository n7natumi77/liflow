import test from "node:test";
import assert from "node:assert/strict";
import type {
  ActualData,
  CoreEntity,
  EntityType,
  PlanData,
  RecurringActivityRuleData,
  SettingsData,
  TaskData,
} from "./core.ts";
import { deriveExecutionRuntimeState } from "./execution.ts";
import { getWakeWindow } from "./wake.ts";
import {
  deviceSubscriptionPayload,
  disableDeviceSubscription,
  buildNotificationJobs,
  findDueNotifications,
  notificationDeepLink,
  type NotificationJobData,
} from "./notifications.ts";
import { planRecurringMutations, protectGeneratedPlanEdit, recurringPlanId } from "./recurrence.ts";
import { futureBlockPlanId, planFutureBlocks } from "./future-blocks.ts";
import { getNowDecision } from "./now-engine.ts";

const now = new Date("2026-09-23T07:00:00+09:00");
const at = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString();
const make = <T>(id: string, type: EntityType, payload: T, extra: Partial<CoreEntity<T>> = {}) => ({
  id, type, payload, schemaVersion: 6, revision: 1, createdAt: now.toISOString(), updatedAt: now.toISOString(), updatedBy: "test", deletedAt: null, ...extra,
}) as CoreEntity<T>;
const task = (id: string, directionId = "direction_specialty", extra: Partial<TaskData> = {}) =>
  make<TaskData>(id, "task", { title: id, status: "open", directionId, ...extra });
const plan = (id: string, startAt: string, endAt: string, extra: Partial<PlanData> = {}) =>
  make<PlanData>(id, "plan", { title: id, startAt, endAt, type: "appointment", flexibility: "fixed", allDay: false, ...extra });
const settings = (extra: Partial<SettingsData> = {}) => make<SettingsData>("settings", "settings", {
  calendarView: "week", visibleCalendarCategories: [], showPlan: true, showActual: true, showTaskDeadlines: true,
  dayStart: "07:00", dayEnd: "23:00", fallbackWakeTime: "08:00", wakeWindowMinutes: 180, ...extra,
});

test("Wake Window prefers plannedWakeAt, supports afternoon wake, and removes the fixed 4-12 rule", () => {
  const afternoon = new Date("2026-09-23T13:30:00+09:00");
  const sleep = make("sleep", "sleepRecord", { date: "2026-09-23", plannedWakeAt: at("2026-09-23", "14:00"), actualWakeAt: null, source: "manual" });
  assert.equal(getWakeWindow([sleep, settings()], afternoon)?.source, "plannedWakeAt");
  assert.equal(getWakeWindow([sleep, settings()], afternoon)?.shouldPrompt, true);
  const early = getWakeWindow([settings({ fallbackWakeTime: "14:00" })], new Date("2026-09-23T05:00:00+09:00"));
  assert.equal(early?.shouldPrompt, false);
});

test("Wake Window falls back through Sleep Plan then configurable wake time", () => {
  const sleepPlan = plan("night", at("2026-09-22", "23:00"), at("2026-09-23", "09:30"), { type: "sleep" });
  assert.equal(getWakeWindow([sleepPlan, settings()], new Date("2026-09-23T09:00:00+09:00"))?.source, "sleepPlan");
  assert.equal(getWakeWindow([settings({ fallbackWakeTime: "10:00" })], new Date("2026-09-23T09:30:00+09:00"))?.source, "fallback");
});

test("runtime lock state is always derived from durable active Sessions", () => {
  const running = make("session", "executionSession", { targetKind: "task", title: "A", startedAt: now.toISOString(), status: "running" });
  const completed = make("done", "executionSession", { targetKind: "task", title: "B", startedAt: now.toISOString(), status: "completed" });
  assert.deepEqual(deriveExecutionRuntimeState([completed]), { status: "completed", sessionId: null });
  assert.deepEqual(deriveExecutionRuntimeState([running]), { status: "running", sessionId: "session" });
  assert.deepEqual(deriveExecutionRuntimeState([{ ...running, deletedAt: now.toISOString() }]), { status: "completed", sessionId: null });
});

test("device subscription registration, refresh, and disable preserve identity safely", () => {
  const first = deviceSubscriptionPayload(null, { deviceId: "device", token: "one", platform: "browser" }, "2026-01-01T00:00:00.000Z");
  const refreshed = deviceSubscriptionPayload(first, { deviceId: "device", token: "two", platform: "browser" }, "2026-01-02T00:00:00.000Z");
  assert.equal(refreshed.createdAt, first.createdAt);
  assert.equal(refreshed.token, "two");
  assert.equal(disableDeviceSubscription(refreshed, "2026-01-03T00:00:00.000Z").enabled, false);
});

test("notification permission off creates no jobs; enabled settings cover all Phase 2 boundaries", () => {
  assert.deepEqual(buildNotificationJobs("u", [settings({ notificationsEnabled: false })], now), []);
  const enabled = settings({ notificationsEnabled: true, targetSleepTime: "23:30", windDownMinutes: 45, transitionBufferMinutes: 10, departureSafetyBufferMinutes: 10 });
  const sleep = make("sleep", "sleepRecord", { date: "2026-09-24", plannedWakeAt: at("2026-09-24", "08:00"), actualWakeAt: null, source: "manual" });
  const anchor = plan("anchor", at("2026-09-23", "10:00"), at("2026-09-23", "11:00"));
  const travel = plan("travel", at("2026-09-23", "12:00"), at("2026-09-23", "12:30"), { type: "travel" });
  const session = make("session", "executionSession", { targetKind: "task", title: "実行", startedAt: now.toISOString(), status: "running" });
  const flow = make("flow", "routineFlow", { name: "朝", active: true, trigger: { type: "afterWake" }, steps: [{ id: "one", title: "支度", executionMode: "checkOnly", estimatedMinutes: 30 }] });
  const jobs = buildNotificationJobs("u", [enabled, sleep, anchor, travel, session, flow], now);
  const types = new Set(jobs.map(job => job.type));
  for (const type of ["wake", "morning", "anchor", "departure", "execution", "windDown"]) assert.ok(types.has(type as never));
  assert.ok(jobs.filter(job => job.type === "wake").length > 1);
  assert.ok(jobs.filter(job => job.type === "windDown").length > 1);
});

test("notification due selection deduplicates, respects quiet suppression, and deep-links to Now", () => {
  const base: NotificationJobData = { uid: "u", dedupeKey: "wake:u:d", type: "wake", dueAt: now.toISOString(), title: "L", body: "B", href: "/", enabled: true, sentAt: null, status: "pending", createdAt: now.toISOString(), updatedAt: now.toISOString() };
  assert.equal(findDueNotifications([base, { ...base }], now).length, 1);
  assert.equal(findDueNotifications([{ ...base, type: "anchor", dedupeKey: "a" }], now, true).length, 0);
  assert.equal(notificationDeepLink("wake"), "/?notification=wake");
});

const rule = (id: string, scheduleRule: RecurringActivityRuleData["scheduleRule"], extra: Partial<RecurringActivityRuleData> = {}) => make<RecurringActivityRuleData>(id, "recurringActivityRule", {
  title: "授業", active: true, scheduleRule, startTime: "09:00", durationMinutes: 60, planType: "appointment", flexibility: "fixed", ...extra,
});

test("recurring rules generate daily, weekdays, weekly, and bounded horizon occurrences", () => {
  assert.equal(planRecurringMutations([rule("daily", { kind: "daily" })], now, 2).filter(item => item.kind === "create").length, 3);
  assert.equal(planRecurringMutations([rule("weekday", { kind: "weekdays" })], now, 4).filter(item => item.kind === "create").length, 3);
  assert.equal(planRecurringMutations([rule("weekly", { kind: "weekly", weekdays: [now.getDay()] })], now, 7).filter(item => item.kind === "create").length, 2);
});

test("recurring occurrence keys are stable across devices and never duplicate", () => {
  const recurring = rule("rule", { kind: "daily" });
  const first = planRecurringMutations([recurring], now, 0)[0];
  assert.equal(first.id, recurringPlanId("rule", "2026-09-23"));
  const stored = make<PlanData>(first.id, "plan", first.payload);
  assert.deepEqual(planRecurringMutations([recurring, stored], now, 0), []);
});

test("recurring generation protects edited and cancelled occurrences", () => {
  const recurring = rule("rule", { kind: "daily" });
  const generated = planRecurringMutations([recurring], now, 0)[0];
  const stored = make<PlanData>(generated.id, "plan", generated.payload);
  const overridden = make<PlanData>(stored.id, "plan", { ...stored.payload, startAt: at("2026-09-23", "11:00"), generationState: "overridden" });
  const cancelled = make<PlanData>(stored.id, "plan", { ...stored.payload, resolution: "cancelled", generationState: "cancelled" });
  assert.deepEqual(planRecurringMutations([recurring, overridden], now, 0), []);
  assert.deepEqual(planRecurringMutations([recurring, cancelled], now, 0), []);
  assert.equal(protectGeneratedPlanEdit(stored, { ...stored.payload, startAt: at("2026-09-23", "12:00") }).generationState, "overridden");
});

test("rule changes update only future generated instances; disabling preserves past and cancels future", () => {
  const original = rule("rule", { kind: "daily" });
  const generated = planRecurringMutations([original], now, 1).map(item => make<PlanData>(item.id, "plan", item.payload));
  const changed = rule("rule", { kind: "daily" }, { startTime: "11:00" });
  assert.ok(planRecurringMutations([changed, ...generated], now, 1).some(item => item.kind === "update" && item.payload.startAt.includes("02:00:00.000Z")));
  const old = plan("past", at("2026-09-22", "09:00"), at("2026-09-22", "10:00"), { source: "recurring", generationState: "generated", recurringRuleId: "rule", recurrenceKey: "rule:2026-09-22" });
  const disabled = rule("rule", { kind: "daily" }, { active: false });
  const mutations = planRecurringMutations([disabled, old, ...generated], now, 1);
  assert.ok(mutations.some(item => item.kind === "cancel"));
  assert.ok(!mutations.some(item => item.id === old.id));
});

const actual = (id: string, directionId: string, startAt: string, endAt: string) => make<ActualData>(id, "actual", { title: id, directionId, startAt, endAt, type: "task" });

test("Future Block is absent without Need and becomes one soft candidate when Need has an Open Task", () => {
  const enough = actual("a", "direction_specialty", at("2026-09-23", "07:00"), at("2026-09-23", "09:00"));
  assert.equal(planFutureBlocks([settings(), enough], new Date("2026-09-23T10:00:00+09:00"), settings().payload).mutations.length, 0);
  const result = planFutureBlocks([settings(), task("specialty")], new Date("2026-09-23T10:00:00+09:00"), settings().payload);
  assert.equal(result.mutations.length, 1);
  assert.equal(result.mutations[0].payload.protection, "soft");
  assert.equal(result.mutations[0].id, futureBlockPlanId("2026-09-23", "direction_specialty"));
});

test("Future Block yields to critical deadlines and reports a Direction with no Task", () => {
  const critical = task("urgent", "direction_academic", { deadline: at("2026-09-23", "10:10"), estimatedRemainingMinutes: 300 });
  const result = planFutureBlocks([settings(), critical, task("specialty")], new Date("2026-09-23T10:00:00+09:00"), settings().payload);
  assert.equal(result.suppressedByCriticalDeadline, true);
  assert.ok(!result.mutations.some(item => item.kind === "create"));
  const missing = planFutureBlocks([settings()], new Date("2026-09-23T10:00:00+09:00"), settings().payload);
  assert.ok(missing.missingTaskDirectionIds.includes("direction_career"));
});

test("Future Block selects a free window, deduplicates, moves on conflict, and never moves manual overrides", () => {
  const reference = new Date("2026-09-23T10:00:00+09:00"), base = [settings(), task("specialty"), plan("busy", at("2026-09-23", "10:00"), at("2026-09-23", "11:00"))];
  const created = planFutureBlocks(base, reference, settings().payload).mutations[0];
  assert.ok(new Date(created.payload.startAt) >= new Date(at("2026-09-23", "11:00")));
  const stored = make<PlanData>(created.id, "plan", created.payload);
  assert.deepEqual(planFutureBlocks([...base, stored], reference, settings().payload).mutations, []);
  const activeNow = make<PlanData>(stored.id, "plan", { ...stored.payload, startAt: reference.toISOString(), endAt: new Date(reference.getTime() + 25 * 60000).toISOString() });
  assert.deepEqual(planFutureBlocks([settings(), task("specialty"), activeNow], reference, settings().payload).mutations, []);
  const conflict = plan("new-busy", stored.payload.startAt, stored.payload.endAt);
  assert.ok(planFutureBlocks([...base, stored, conflict], reference, settings().payload).mutations.some(item => item.kind === "move"));
  const overridden = make<PlanData>(stored.id, "plan", { ...stored.payload, generationState: "overridden" });
  assert.deepEqual(planFutureBlocks([...base, overridden, conflict], reference, settings().payload).mutations, []);
});

test("Future protection does not destroy Free Mode or mutate Core state when notification delivery fails", () => {
  const reference = new Date("2026-09-23T16:00:00+09:00");
  const awake = make("sleep", "sleepRecord", { date: "2026-09-23", actualWakeAt: at("2026-09-23", "08:00"), source: "manual" });
  assert.equal(getNowDecision([settings(), awake], reference).mode, "free");
  const source = [settings(), awake];
  const before = structuredClone(source);
  findDueNotifications([], reference);
  assert.deepEqual(source, before);
});
