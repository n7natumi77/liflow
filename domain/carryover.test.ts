import assert from "node:assert/strict";
import test from "node:test";
import { deriveCarryoverWork } from "./carryover.ts";
import type { CoreEntity, EntityType } from "./core.ts";

const make = (id: string, type: EntityType, payload: Record<string, unknown>): CoreEntity => ({
  id, type, payload, schemaVersion: 7, revision: 1,
  createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z", updatedBy: "test", deletedAt: null,
});
const task = make("task", "task", { title: "提出", status: "open" });
const action = make("action", "taskAction", { taskId: "task", title: "推敲", status: "todo", sortOrder: 0 });
const plan = make("plan", "plan", { title: "提出", taskId: "task", taskActionId: "action", startAt: "2026-09-23T01:00:00.000Z", endAt: "2026-09-23T02:00:00.000Z", resolution: null });
const now = new Date("2026-09-25T03:00:00.000Z");

test("past unresolved work plan is derived without creating another plan", () => {
  const source = [task, action, plan];
  const result = deriveCarryoverWork(source, now);
  assert.equal(result.length, 1);
  assert.equal(result[0].task.id, "task");
  assert.match(result[0].label, /未実施/);
  assert.equal(source.filter(item => item.type === "plan").length, 1);
});

test("actual, resolution, completed task, and skipped action each stop resurfacing", () => {
  const actual = make("actual", "actual", { title: "推敲", taskId: "task", taskActionId: "action", startAt: "2026-09-24T03:00:00.000Z", endAt: "2026-09-24T04:00:00.000Z" });
  assert.equal(deriveCarryoverWork([task, action, plan, actual], now).length, 0);
  assert.equal(deriveCarryoverWork([task, action, { ...plan, payload: { ...plan.payload, resolution: "skipped" } }], now).length, 0);
  assert.equal(deriveCarryoverWork([{ ...task, payload: { ...task.payload, status: "completed" } }, action, plan], now).length, 0);
  assert.equal(deriveCarryoverWork([task, { ...action, payload: { ...action.payload, status: "skipped" } }, plan], now).length, 0);
});

test("appointment without a Task or Task Action is not carried over", () => {
  const appointment = make("appointment", "plan", { title: "診察", type: "appointment", startAt: "2026-09-23T01:00:00.000Z", endAt: "2026-09-23T02:00:00.000Z", resolution: null });
  assert.equal(deriveCarryoverWork([appointment], now).length, 0);
});
