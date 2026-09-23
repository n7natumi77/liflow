import test from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentFixedPlan,
  getDepartureAnchor,
  getEarlyStartCandidate,
  getNextAnchor,
  getTaskRemainingEstimate,
  getUsableWindow,
  reserveDeadlines,
  isPlanActivityCompleted,
} from "./scheduling.ts";
import { getDirectionActualSummary, getDirectionNeeds, resolveActualDirection } from "./directions.ts";
import { getNowDecision } from "./now-engine.ts";
import type { ActualData, CoreEntity, EntityType, ExecutionSessionData, PlanData, SettingsData, TaskData } from "./core.ts";

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();
const make = <T>(id: string, type: EntityType, payload: T): CoreEntity<T> => ({
  id, type, payload, schemaVersion: 5, revision: 1,
  createdAt: at("2026-01-01", "00:00"), updatedAt: at("2026-01-01", "00:00"),
  updatedBy: "test", deletedAt: null,
});
const plan = (id: string, start: string, end: string, extra: Partial<PlanData> = {}) => make<PlanData>(id, "plan", {
  title: id, startAt: at("2026-01-01", start), endAt: at("2026-01-01", end),
  type: "appointment", flexibility: "fixed", allDay: false, resolution: null, ...extra,
});
const task = (id: string, extra: Partial<TaskData> = {}) => make<TaskData>(id, "task", {
  title: id, status: "open", projectId: null, ...extra,
});
const now = new Date("2026-01-01T09:00:00");
const settings = make<SettingsData>("settings", "settings", {
  calendarView: "week", visibleCalendarCategories: [], showPlan: true, showActual: true,
  showTaskDeadlines: true, dayStart: "09:00", dayEnd: "17:00", transitionBufferMinutes: 10,
  departureSafetyBufferMinutes: 10, targetSleepTime: "23:30", windDownMinutes: 45, guidanceIntensity: "strong",
});
const awake = make("awake", "sleepRecord", { date: "2026-01-01", actualWakeAt: at("2026-01-01", "07:00"), source: "manual" });

test("current Fixed Plan wins and resolved, flexible, all-day Plans are not anchors", () => {
  const current = plan("current", "08:30", "09:30");
  const resolved = plan("resolved", "09:40", "10:00", { resolution: "cancelled" });
  const flexible = plan("flex", "09:35", "10:00", { flexibility: "flexible" });
  const allDay = plan("all", "00:00", "23:00", { allDay: true });
  const next = plan("next", "10:30", "11:00");
  assert.equal(getCurrentFixedPlan([current, resolved, flexible, allDay, next], now)?.id, "current");
  assert.equal(getNextAnchor([current, resolved, flexible, allDay, next], now)?.id, "next");
  const decision = getNowDecision([settings, awake, current, task("urgent", { deadline: at("2026-01-01", "09:10"), estimatedRemainingMinutes: 60 })], now);
  assert.equal(decision.mode, "fixed");
  assert.equal(decision.primaryAction?.kind, "plan");
});

test("usable window stops before the next anchor, transition buffer, and an intervening Plan", () => {
  const anchor = plan("anchor", "12:00", "13:00");
  const flexible = plan("flexible", "10:00", "10:30", { flexibility: "flexible" });
  const direct = getUsableWindow([anchor], now, settings.payload);
  assert.equal(direct.usableMinutes, 170);
  const blocked = getUsableWindow([anchor, flexible], now, settings.payload);
  assert.equal(blocked.usableMinutes, 50);
  assert.equal(blocked.nextAnchor?.id, "anchor");
});

test("departure is derived only from a future Travel Plan and applies its safety buffer", () => {
  assert.equal(getDepartureAnchor([], now, 10), null);
  const travel = plan("travel", "10:00", "10:30", { type: "travel" });
  const result = getDepartureAnchor([travel], now, 10);
  assert.equal(result?.recommendedDepartureAt, at("2026-01-01", "09:50"));
});

test("remaining estimate respects remaining, estimate, then unknown", () => {
  assert.equal(getTaskRemainingEstimate(task("a", { estimatedRemainingMinutes: 40, estimateMinutes: 90 })), 40);
  assert.equal(getTaskRemainingEstimate(task("b", { estimateMinutes: 90 })), 90);
  assert.equal(getTaskRemainingEstimate(task("c")), null);
});

test("deadline pressure covers critical, tight, safe, unknown and safety factor", () => {
  const entities = [
    settings,
    task("critical", { deadline: at("2026-01-01", "10:00"), estimatedRemainingMinutes: 60 }),
    task("tight", { deadline: at("2026-01-01", "12:00"), estimatedRemainingMinutes: 60 }),
    task("safe", { deadline: at("2026-01-01", "17:00"), estimatedRemainingMinutes: 60 }),
    task("unknown", { deadline: at("2026-01-02", "17:00") }),
  ];
  const result = reserveDeadlines(entities, now, settings.payload);
  assert.equal(result.find(item => item.taskId === "critical")?.pressure, "critical");
  assert.equal(result.find(item => item.taskId === "tight")?.requiredMinutes, 75);
  assert.ok(["tight", "safe"].includes(result.find(item => item.taskId === "tight")!.pressure));
  assert.equal(result.find(item => item.taskId === "safe")?.pressure, "safe");
  assert.equal(result.find(item => item.taskId === "unknown")?.pressure, "unknown");
});

test("multiple deadlines share capacity without double use and reserve backward", () => {
  const result = reserveDeadlines([
    settings,
    task("a", { deadline: at("2026-01-01", "17:00"), estimatedRemainingMinutes: 240 }),
    task("b", { deadline: at("2026-01-01", "17:00"), estimatedRemainingMinutes: 240 }),
  ], now, settings.payload);
  assert.ok(result.reduce((sum, item) => sum + item.reservedMinutes, 0) <= 480);
  assert.ok(result.some(item => item.shortfallMinutes > 0));
  assert.equal(result[0].allocations.at(-1)?.endAt, at("2026-01-01", "17:00"));
  const allocations = result.flatMap(item => item.allocations).sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (let index = 1; index < allocations.length; index++) assert.ok(allocations[index - 1].endAt <= allocations[index].startAt);
});

test("existing future Task Plans count as coverage without changing remaining", () => {
  const linked = plan("linked", "14:00", "15:00", { taskId: "a" });
  const result = reserveDeadlines([
    settings, linked,
    task("a", { deadline: at("2026-01-01", "17:00"), estimatedRemainingMinutes: 120 }),
  ], now, settings.payload)[0];
  assert.equal(result.remainingMinutes, 120);
  assert.equal(result.coveredByPlansMinutes, 60);
  assert.equal(result.requiredMinutes, 90);
});

test("Direction resolution prefers Actual, then Plan, then Task, otherwise unclassified", () => {
  const linkedTask = task("task", { directionId: "task-direction" });
  const linkedPlan = plan("plan", "10:00", "11:00", { taskId: linkedTask.id, directionId: "plan-direction" });
  const actual = make<ActualData>("actual", "actual", { title: "work", startAt: at("2026-01-01", "08:00"), endAt: at("2026-01-01", "08:30"), type: "task", planId: linkedPlan.id, directionId: "actual-direction" });
  assert.equal(resolveActualDirection(actual, [linkedPlan], [linkedTask]), "actual-direction");
  assert.equal(resolveActualDirection({ ...actual, payload: { ...actual.payload, directionId: null } }, [linkedPlan], [linkedTask]), "plan-direction");
  assert.equal(resolveActualDirection({ ...actual, payload: { ...actual.payload, directionId: null, planId: null, taskId: linkedTask.id } }, [], [linkedTask]), "task-direction");
  assert.equal(resolveActualDirection({ ...actual, payload: { ...actual.payload, directionId: null, planId: null, taskId: null } }, [], []), null);
});

test("Direction summaries support 7/14 days and merge overlap inside one Direction", () => {
  const recentA = make<ActualData>("a", "actual", { title: "a", startAt: at("2026-01-01", "08:00"), endAt: at("2026-01-01", "09:00"), type: "task", directionId: "direction_career" });
  const recentB = make<ActualData>("b", "actual", { title: "b", startAt: at("2026-01-01", "08:30"), endAt: at("2026-01-01", "09:30"), type: "task", directionId: "direction_career" });
  const old = make<ActualData>("old", "actual", { title: "old", startAt: at("2025-12-23", "08:00"), endAt: at("2025-12-23", "09:00"), type: "task", directionId: "direction_career" });
  const reference = new Date("2026-01-01T10:00:00");
  assert.equal(getDirectionActualSummary([recentA, recentB, old], reference, 7)[0].minutes, 90);
  assert.equal(getDirectionActualSummary([recentA, recentB, old], reference, 14)[0].minutes, 150);
  assert.ok(getDirectionNeeds([recentA], reference).some(item => item.directionId === "direction_career"));
});

test("Now Engine returns one task, supports assist, and can intentionally return Free", () => {
  const urgent = task("urgent", { deadline: at("2026-01-01", "10:00"), estimatedRemainingMinutes: 60, nextAction: { title: "資料を開く", minimumUsefulMinutes: 3 } });
  const decision = getNowDecision([settings, awake, urgent], now);
  assert.equal(decision.primaryAction?.kind, "task");
  assert.equal(decision.reason, "critical_deadline");
  const assisted = getNowDecision([settings, awake, urgent], now, { assistReason: "unknown" });
  assert.equal(assisted.primaryAction?.kind === "task" && assisted.primaryAction.title, "資料を開く");
  const heavy = getNowDecision([settings, awake, urgent], now, { assistReason: "heavy" });
  const boring = getNowDecision([settings, awake, urgent], now, { assistReason: "boring" });
  assert.equal(heavy.primaryAction?.kind === "task" && heavy.primaryAction.suggestedMinutes, 5);
  assert.equal(boring.primaryAction?.kind === "task" && boring.primaryAction.suggestedMinutes, 10);
  assert.equal(getNowDecision([settings, awake], now).mode, "free");
  assert.equal(getNowDecision([settings, awake], now).primaryAction, null);
});

test("fatigue yields recovery unless a critical Task exists", () => {
  const condition = make("condition", "conditionRecord", { recordedAt: now.toISOString(), date: "2026-01-01", fatigue: 3, source: "manual" });
  assert.equal(getNowDecision([settings, awake, condition], now).mode, "recovery");
  const critical = task("critical", { deadline: at("2026-01-01", "09:30"), estimatedRemainingMinutes: 60 });
  assert.equal(getNowDecision([settings, awake, condition, critical], now).reason, "critical_deadline");
});

test("wake, morning Routine, running Session, and wind down follow priority", () => {
  const morning = new Date("2026-01-01T07:00:00");
  assert.equal(getNowDecision([settings], morning).reason, "wake_check");
  const sleep = make("sleep", "sleepRecord", { date: "2026-01-01", actualWakeAt: morning.toISOString(), source: "manual" });
  const flow = make("flow", "routineFlow", { name: "朝", active: true, trigger: { type: "afterWake" }, steps: [{ id: "wash", title: "顔を洗う", executionMode: "checkOnly", estimatedMinutes: 3 }] });
  const run = make("run", "routineRun", { routineFlowId: "flow", startedAt: morning.toISOString(), status: "running", endedAt: null, stepResults: [{ stepId: "wash", status: "pending", startedAt: morning.toISOString(), endedAt: null }] });
  assert.equal(getNowDecision([settings, sleep, flow, run], morning).reason, "morning_routine");
  const session = make("session", "executionSession", { targetKind: "task", taskId: "x", title: "実行中", startedAt: morning.toISOString(), status: "running", endedAt: null });
  assert.equal(getNowDecision([settings, sleep, flow, run, session], morning).reason, "running_session");
  const late = new Date("2026-01-01T23:00:00");
  assert.equal(getNowDecision([settings], late).mode, "windDown");
  const lateCritical = task("late-critical", { deadline: at("2026-01-01", "23:20"), estimatedRemainingMinutes: 40 });
  assert.equal(getNowDecision([settings, lateCritical], late).reason, "critical_deadline");
});

test("Morning Flow reports urgency against Travel departure and returns to Task choice when finished early", () => {
  const morning = new Date("2026-01-01T08:30:00");
  const sleep = make("sleep-morning", "sleepRecord", { date: "2026-01-01", actualWakeAt: at("2026-01-01", "07:00"), source: "manual" });
  const flow = make("flow-morning", "routineFlow", { name: "朝", active: true, trigger: { type: "afterWake" }, steps: [{ id: "prepare", title: "支度", executionMode: "pacedTimer", estimatedMinutes: 25 }] });
  const run = make("run-morning", "routineRun", { routineFlowId: flow.id, startedAt: morning.toISOString(), status: "running", endedAt: null, stepResults: [{ stepId: "prepare", status: "pending", startedAt: morning.toISOString(), endedAt: null }] });
  const travel = plan("morning-travel", "09:00", "09:30", { type: "travel" });
  const urgent = getNowDecision([settings, sleep, flow, run, travel], morning);
  assert.equal(urgent.reason, "morning_routine");
  assert.equal(urgent.reasonDetails?.urgent, true);
  const report = task("morning-task", { deadline: at("2026-01-01", "10:00"), estimatedRemainingMinutes: 30 });
  const afterFlow = getNowDecision([settings, sleep, travel, report], morning);
  assert.equal(afterFlow.primaryAction?.kind, "task");
});

test("Project is never required by Now Engine", () => {
  const noProject = task("standalone", { deadline: at("2026-01-01", "10:00"), estimatedRemainingMinutes: 20 });
  assert.equal(getNowDecision([settings, awake, noProject], now).primaryAction?.kind, "task");
});

test("a startable Plan can begin early without moving the Plan", () => {
  const linkedTask = task("early-task", { nextAction: { title: "下書きを開く", minimumUsefulMinutes: 15 } });
  const early = plan("early-plan", "09:30", "10:30", { type: "task", taskId: linkedTask.id });
  const candidate = getEarlyStartCandidate([settings, awake, linkedTask, early], now, settings.payload);
  assert.equal(candidate?.plan.id, early.id);
  assert.equal(candidate?.usableMinutes, 90);
  assert.equal(early.payload.startAt, at("2026-01-01", "09:30"));
  assert.equal(getNowDecision([settings, awake, linkedTask, early], now).earlyStartCandidate?.planId, early.id);
});

test("Early Start never overrides a current appointment or running Session", () => {
  const current = plan("appointment", "08:50", "09:20", { type: "appointment" });
  const early = plan("early", "09:30", "10:30", { type: "task" });
  assert.equal(getEarlyStartCandidate([current, early], now), null);
  const session = make<ExecutionSessionData>("running", "executionSession", { targetKind: "task", title: "別の作業", startedAt: at("2026-01-01", "08:55"), status: "running" });
  assert.equal(getEarlyStartCandidate([early, session], now), null);
  assert.equal(getNowDecision([settings, awake, task("urgent", { deadline: at("2026-01-01", "09:10"), estimatedRemainingMinutes: 60 }), session], now).reason, "running_session");
  const intervening = plan("intervening", "09:15", "09:25", { type: "appointment" });
  assert.equal(getEarlyStartCandidate([early, intervening], now), null);
  const linkedAppointment = plan("linked-appointment", "09:30", "10:30", { type: "appointment", taskId: "early-task" });
  assert.equal(getEarlyStartCandidate([linkedAppointment], now), null);
});

test("explicit Activity completion frees the remaining Plan window while Pause does not", () => {
  const activePlan = plan("active-plan", "08:30", "10:00", { type: "task" });
  const completed = make<ExecutionSessionData>("completed-session", "executionSession", { targetKind: "plan", planId: activePlan.id, title: activePlan.payload.title, startedAt: at("2026-01-01", "08:30"), endedAt: at("2026-01-01", "08:50"), status: "completed", outcome: "activityCompleted" });
  const paused = make<ExecutionSessionData>("paused-session", "executionSession", { targetKind: "plan", planId: activePlan.id, title: activePlan.payload.title, startedAt: at("2026-01-01", "08:30"), endedAt: at("2026-01-01", "08:50"), status: "completed", outcome: "paused" });
  assert.equal(isPlanActivityCompleted([activePlan, completed], activePlan.id), true);
  assert.equal(getCurrentFixedPlan([activePlan, completed], now), null);
  assert.equal(getNowDecision([settings, awake, activePlan, completed], now).reason, "free");
  assert.equal(isPlanActivityCompleted([activePlan, paused], activePlan.id), false);
  assert.equal(getCurrentFixedPlan([activePlan, paused], now)?.id, activePlan.id);
});

test("an Actual alone never completes Activity and unavailable reasons do not erase urgency", () => {
  const activePlan = plan("actual-plan", "08:30", "10:00", { type: "task" });
  const partial = make<ActualData>("partial", "actual", { title: "途中", planId: activePlan.id, startAt: at("2026-01-01", "08:30"), endAt: at("2026-01-01", "08:45"), type: "task" });
  assert.equal(getCurrentFixedPlan([activePlan, partial], now)?.id, activePlan.id);
  const urgent = task("unavailable", { deadline: at("2026-01-01", "09:20"), estimatedRemainingMinutes: 60 });
  assert.equal(reserveDeadlines([settings, urgent], now, settings.payload)[0].pressure, "critical");
  assert.notEqual(getNowDecision([settings, awake, urgent], now, { unavailableTaskIds: [urgent.id], assistReason: "contextUnavailable" }).primaryAction?.kind, "task");
  assert.equal(getNowDecision([settings, awake, urgent], now).primaryAction?.kind, "task");
});
