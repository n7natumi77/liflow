import test from "node:test";
import assert from "node:assert/strict";
import type { CoreEntity, EntityType, ExecutionSessionData, PlanData, RoutineFlowData, RoutineRunData, TaskData } from "./core.ts";
import { advanceRoutineRun, completionPayloads, createExecutionSessionPayload, currentRoutineStep, executionActualId, startRoutineRunPayload } from "./execution.ts";

const make = <T>(id: string, type: EntityType, payload: T): CoreEntity<T> => ({ id, type, payload, schemaVersion: 5, revision: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", updatedBy: "test", deletedAt: null });
const started = new Date("2026-01-01T10:00:00.000Z");

test("Task and Plan starts create persistent running Session payloads with inherited Direction", () => {
  const task = make<TaskData>("task", "task", { title: "レポート", status: "open", directionId: "career" });
  const taskSession = createExecutionSessionPayload(task, started, 25);
  assert.equal(taskSession.status, "running");
  assert.equal(taskSession.taskId, "task");
  assert.equal(taskSession.directionId, "career");
  const plan = make<PlanData>("plan", "plan", { title: "予定", taskId: "task", directionId: "plan-direction", startAt: started.toISOString(), endAt: new Date(+started + 3600000).toISOString(), type: "task", flexibility: "fixed", allDay: false });
  const planSession = createExecutionSessionPayload(plan, started, 30, task);
  assert.equal(planSession.planId, "plan");
  assert.equal(planSession.taskId, "task");
  assert.equal(planSession.directionId, "plan-direction");
});

test("Session completion creates linked Actual, decrements only existing remaining estimate, and keeps Task open", () => {
  const task = make<TaskData>("task", "task", { title: "レポート", status: "open", estimatedRemainingMinutes: 90 });
  const session = make<ExecutionSessionData>("session", "executionSession", createExecutionSessionPayload(task, started, 30));
  const result = completionPayloads(session, new Date("2026-01-01T10:30:00.000Z"), task);
  assert.equal(result.actual.taskId, "task");
  assert.equal(result.actual.planId, null);
  assert.equal(result.nextTask?.estimatedRemainingMinutes, 60);
  assert.equal(result.nextTask?.status, "open");
  assert.equal(executionActualId(session.id), executionActualId(session.id));
  const unknown = make<TaskData>("unknown", "task", { title: "不明", status: "open", estimatedRemainingMinutes: null });
  const unknownSession = make<ExecutionSessionData>("unknown-session", "executionSession", createExecutionSessionPayload(unknown, started, 5));
  assert.equal(completionPayloads(unknownSession, new Date("2026-01-01T10:05:00.000Z"), unknown).nextTask?.estimatedRemainingMinutes, null);
});

test("Routine Flow starts in order, supports skip/check completion, finishes, and resumes from stored Run", () => {
  const flow = make<RoutineFlowData>("flow", "routineFlow", {
    name: "朝", trigger: { type: "afterWake" }, active: true,
    steps: [
      { id: "a", title: "顔", executionMode: "checkOnly", estimatedMinutes: 3 },
      { id: "b", title: "朝食", executionMode: "softTimer", estimatedMinutes: 15 },
      { id: "c", title: "メイク", executionMode: "pacedTimer", estimatedMinutes: 12 },
    ],
  });
  const payload = startRoutineRunPayload(flow, started);
  let run = make<RoutineRunData>("run", "routineRun", payload);
  assert.equal(currentRoutineStep(flow, run)?.id, "a");
  run = { ...run, payload: advanceRoutineRun(flow, run, "a", "completed", new Date("2026-01-01T10:03:00.000Z")) };
  assert.equal(currentRoutineStep(flow, run)?.id, "b");
  run = { ...run, payload: advanceRoutineRun(flow, run, "b", "skipped", new Date("2026-01-01T10:04:00.000Z")) };
  assert.equal(currentRoutineStep(flow, run)?.id, "c");
  run = { ...run, payload: advanceRoutineRun(flow, run, "c", "completed", new Date("2026-01-01T10:16:00.000Z")) };
  assert.equal(run.payload.status, "completed");
  assert.equal(currentRoutineStep(flow, run), null);
});

test("repeating an already finished Routine step is idempotent", () => {
  const flow = make<RoutineFlowData>("flow", "routineFlow", { name: "一歩", trigger: { type: "manual" }, active: true, steps: [{ id: "a", title: "確認", executionMode: "checklist", checklistItems: [{ id: "x", title: "鍵" }] }] });
  const run = make<RoutineRunData>("run", "routineRun", startRoutineRunPayload(flow, started));
  const first = advanceRoutineRun(flow, run, "a", "completed", new Date("2026-01-01T10:01:00.000Z"), ["x"]);
  const repeated = advanceRoutineRun(flow, { ...run, payload: first }, "a", "completed", new Date("2026-01-01T10:02:00.000Z"), ["x"]);
  assert.deepEqual(repeated, first);
});
