import test from "node:test";
import assert from "node:assert/strict";
import { calendarActivities } from "./calendar-activities.ts";
import { active, type CoreEntity, type EntityType, type BudgetData, type TaskActionData, type TransactionData } from "./core.ts";
import { allowedDiscordMutation, mutationCommand, splitDiscordMessage, trustedDiscordContext, type DiscordInteraction } from "./discord-interactions.ts";
import { budgetPace, periodRange } from "./money.ts";
import { migrateSnapshot, type StoredEntity, CURRENT_SCHEMA_VERSION, FALLBACK_CALENDAR_CATEGORY_ID } from "./schema.ts";
import { activeRecoveryRequest, activeUnavailableRecords, unavailableTargets } from "./start-assist.ts";
import { completedTaskActionPayload, currentTaskAction } from "./task-actions.ts";

const entity = <T>(id: string, type: EntityType, payload: T): CoreEntity<T> => ({
  id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", updatedBy: "test", deletedAt: null,
});

test("v7 migration creates canonical TaskAction, calendar category, money category and methods idempotently", () => {
  const source = [
    { ...entity("task", "task", { title: "提出", status: "open", nextAction: { title: "資料を開く", estimatedMinutes: 10 } }), schemaVersion: 6 },
    { ...entity("plan", "plan", { title: "作業", taskId: "task", startAt: "2026-09-20T10:00:00Z", endAt: "2026-09-20T11:00:00Z", type: "task", flexibility: "fixed", allDay: false }), schemaVersion: 6 },
    { ...entity("money", "transaction", { title: "電車", amount: 220, direction: "expense", category: "交通費", occurredAt: "2026-09-20T03:00:00Z", status: "settled" }), schemaVersion: 6 },
  ] as StoredEntity[];
  const first = migrateSnapshot(source), second = migrateSnapshot(first);
  const actions = active<TaskActionData>(first, "taskAction");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].payload.title, "資料を開く");
  assert.equal(first.find(item => item.id === "plan")?.payload.calendarCategoryId, FALLBACK_CALENDAR_CATEGORY_ID);
  assert.ok(first.some(item => item.type === "moneyCategory" && item.payload.name === "交通費"));
  assert.equal(first.filter(item => item.type === "moneyMethod").length, 3);
  assert.equal(second.filter(item => item.type === "taskAction").length, 1);
  assert.equal(second.length, first.length);
});

test("calendar joins only canonical planId and keeps same-task Plans separate", () => {
  const planA = entity("plan-a", "plan", { title: "A", taskId: "task", startAt: "2026-09-20T10:00:00Z", endAt: "2026-09-20T11:00:00Z", type: "task", flexibility: "fixed", allDay: false });
  const planB = entity("plan-b", "plan", { title: "B", taskId: "task", startAt: "2026-09-20T10:30:00Z", endAt: "2026-09-20T11:30:00Z", type: "task", flexibility: "fixed", allDay: false });
  const actual1 = entity("actual-1", "actual", { title: "名前が違う", planId: "plan-a", startAt: "2026-09-20T10:05:00Z", endAt: "2026-09-20T10:20:00Z", type: "task" });
  const actual2 = entity("actual-2", "actual", { title: "A", planId: "plan-a", startAt: "2026-09-20T10:30:00Z", endAt: "2026-09-20T10:45:00Z", type: "task" });
  const planless = entity("actual-3", "actual", { title: "A", taskId: "task", planId: null, startAt: "2026-09-20T12:00:00Z", endAt: "2026-09-20T12:15:00Z", type: "task" });
  const result = calendarActivities([planA, planB, actual1, actual2, planless], new Date("2026-09-20T13:00:00Z"));
  assert.equal(result.length, 3);
  assert.equal(result.find(item => item.id === "plan:plan-a")?.actuals.length, 2);
  assert.equal(result.find(item => item.id === "plan:plan-b")?.actuals.length, 0);
  assert.equal(result.find(item => item.id === "actual:actual-3")?.plan, null);
});

test("running session creates a band through now", () => {
  const plan = entity("plan", "plan", { title: "作業", startAt: "2026-09-20T10:00:00Z", endAt: "2026-09-20T11:00:00Z", type: "task", flexibility: "fixed", allDay: false });
  const session = entity("session", "executionSession", { targetKind: "plan", planId: "plan", title: "作業", startedAt: "2026-09-20T10:15:00Z", status: "running" });
  const result = calendarActivities([plan, session], new Date("2026-09-20T10:40:00Z"));
  assert.equal(result[0].segments[0].endAt, "2026-09-20T10:40:00.000Z");
  assert.equal(result[0].segments[0].running, true);
});

test("Action completion advances current Action and never completes Task implicitly", () => {
  const first = entity<TaskActionData>("a", "taskAction", { taskId: "task", title: "A", status: "todo", sortOrder: 0 });
  const second = entity<TaskActionData>("b", "taskAction", { taskId: "task", title: "B", status: "todo", sortOrder: 1 });
  assert.equal(currentTaskAction([first, second], "task")?.id, "a");
  const completed = { ...first, payload: completedTaskActionPayload(first, new Date("2026-09-20T10:00:00Z")) };
  assert.equal(currentTaskAction([completed, second], "task")?.id, "b");
  assert.equal(completed.payload.status, "done");
  assert.equal("taskStatus" in completed.payload, false);
});

test("Start Assist expiry and manual restore apply to Plan and Task", () => {
  const now = new Date("2026-09-20T10:00:00Z");
  const task = entity("condition-task", "conditionRecord", { recordedAt: now.toISOString(), source: "manual", startAssist: { reason: "blocked", targetId: "task", targetKind: "task", expiresAt: "2026-09-20T23:59:00Z", resolvedAt: null } });
  const plan = entity("condition-plan", "conditionRecord", { recordedAt: now.toISOString(), source: "manual", startAssist: { reason: "occupied", targetId: "plan", targetKind: "plan", expiresAt: "2026-09-20T11:00:00Z", resolvedAt: null } });
  const expired = entity("condition-old", "conditionRecord", { recordedAt: now.toISOString(), source: "manual", startAssist: { reason: "insufficientWindow", targetId: "old", targetKind: "task", expiresAt: "2026-09-20T09:00:00Z", resolvedAt: null } });
  assert.equal(activeUnavailableRecords([task, plan, expired], now).length, 2);
  assert.deepEqual(unavailableTargets([task, plan, expired], now), { taskIds: ["task"], planIds: ["plan"] });
  const resolved = { ...task, payload: { ...task.payload, startAssist: { ...task.payload.startAssist, resolvedAt: now.toISOString() } } };
  assert.equal(activeUnavailableRecords([resolved], now).length, 0);
});

test("recovery request is short-lived and budget pace includes future expected expense", () => {
  const now = new Date("2026-09-21T10:00:00Z");
  const recovery = entity("recovery", "conditionRecord", { recordedAt: now.toISOString(), source: "manual", recoveryRequest: { requestedAt: now.toISOString(), expiresAt: "2026-09-21T10:15:00Z", resolvedAt: null } });
  assert.equal(activeRecoveryRequest([recovery], now)?.id, "recovery");
  assert.equal(activeRecoveryRequest([recovery], new Date("2026-09-21T10:16:00Z")), null);
  const budget = entity<BudgetData>("budget", "budget", { categoryId: "food", period: "week", amount: 1000, active: true });
  const transaction = (id: string, amount: number, status: TransactionData["status"], occurredAt: string) => entity<TransactionData>(id, "transaction", { title: id, amount, direction: "expense", category: "食費", categoryId: "food", occurredAt, expectedAt: occurredAt, status });
  const pace = budgetPace(budget, [transaction("settled", 300, "settled", "2026-09-21T03:00:00Z"), transaction("expected", 200, "expected", "2026-09-22T03:00:00Z")], now);
  assert.equal(pace.remaining, 500);
  assert.equal(pace.remainingDays, 7);
  assert.equal(periodRange("week", now).start.getDay(), 1);
});

test("Discord security separates trusted read context and mutation allowlist and splits long replies", () => {
  const interaction: DiscordInteraction = { type: 2, channel_id: "channel", member: { user: { id: "user" } }, data: { name: "t" } };
  assert.equal(trustedDiscordContext(interaction, new Set(["channel"])), true);
  assert.equal(allowedDiscordMutation(interaction, new Set(["user"])), true);
  assert.equal(mutationCommand("t"), true);
  assert.equal(mutationCommand("schedule"), false);
  assert.deepEqual(splitDiscordMessage("a\nbbbb", 3), ["a", "bbb", "b"]);
});

