/* Only the isolated UI test server aliases firebase-store to this module.
   There is no Firebase import, connection, or persistence in this fixture. */
import { inheritedDirection, type CoreEntity, type EntityType, type PlanData, type ActualData, type ConflictData, type ExecutionOutcome, type ExecutionSessionData, type RoutineFlowData, type RoutineRunData, type SleepRecordData, type TaskData } from "../../domain/core";
import { CURRENT_SCHEMA_VERSION, DEFAULT_DIRECTIONS, DEFAULT_MORNING_FLOW, DEFAULT_MORNING_FLOW_ID, MONEY_OTHER_CATEGORY_ID, MONEY_TRANSFER_FEE_CATEGORY_ID } from "../../domain/schema";
import { completionPayloads, executionActualId, startRoutineRunPayload } from "../../domain/execution";
import { planRecurringMutations, protectGeneratedPlanEdit } from "../../domain/recurrence";
import { planFutureBlocks } from "../../domain/future-blocks";
import type { NotificationJobData } from "../../domain/notifications";
const timestamp = "2026-09-16T07:42:00.000Z";
const at = (time: string) => new Date("2026-09-16T" + time + ":00+09:00").toISOString();
const entity = (id: string, type: EntityType, payload: object): CoreEntity => ({ id, type, payload: payload as Record<string, unknown>, revision: 1, schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: timestamp, updatedAt: timestamp, updatedBy: "fixture", deletedAt: null });
const plan = (id: string, title: string, start: string, end: string, category = "study") => entity(id, "plan", { title, startAt: at(start), endAt: at(end), type: "task", flexibility: "fixed", allDay: false, taskId: null, projectId: null, calendarCategoryId: category, resolution: null, actualId: null });
let entities = [
  ...DEFAULT_DIRECTIONS.map(item => entity(item.id, "direction", item.payload)),
  entity(DEFAULT_MORNING_FLOW_ID, "routineFlow", DEFAULT_MORNING_FLOW),
  entity("study", "calendarCategory", { name: "勉強", colorToken: "#b9a1e3", sortOrder: 0, archived: false }),
  entity("school", "calendarCategory", { name: "大学", colorToken: "#93c5e5", sortOrder: 1, archived: false }),
  entity("life", "calendarCategory", { name: "生活", colorToken: "#eaa6c4", sortOrder: 2, archived: false }),
  entity(MONEY_OTHER_CATEGORY_ID, "moneyCategory", { name: "その他", appliesTo: "both", sortOrder: 0, archived: false, systemKey: "other" }),
  entity(MONEY_TRANSFER_FEE_CATEGORY_ID, "moneyCategory", { name: "振替手数料", appliesTo: "expense", sortOrder: 99, archived: false, systemKey: "transferFee" }),
  entity("money_transport", "moneyCategory", { name: "交通費", appliesTo: "expense", sortOrder: 1, archived: false, systemKey: null }),
  entity("money_study", "moneyCategory", { name: "勉強", appliesTo: "expense", sortOrder: 2, archived: false, systemKey: null }),
  entity("money_salary", "moneyCategory", { name: "給与", appliesTo: "income", sortOrder: 3, archived: false, systemKey: null }),
  entity("money_method_cash", "moneyMethod", { name: "現金", sortOrder: 0, archived: false }),
  entity("money_method_bank", "moneyMethod", { name: "銀行", sortOrder: 1, archived: false }),
  entity("money_method_card", "moneyMethod", { name: "カード", sortOrder: 2, archived: false }),
  entity("project", "project", { name: "秋学期の準備", description: "新しい学期に向けて、授業と自分のペースを整える。", status: "active", calendarCategoryId: "study", parentProjectId: null }),
  entity("subproject", "project", { name: "物理の復習", status: "active", calendarCategoryId: "study", parentProjectId: "project" }),
  entity("task1", "task", { title: "英単語の復習", status: "open", deadline: at("23:59"), projectId: "project", calendarCategoryId: "study", estimateMinutes: 30 }),
  entity("task2", "task", { title: "レポートの下書き", status: "open", deadline: "2026-09-18T14:59:00Z", projectId: "project" }),
  entity("task3", "task", { title: "帰りに買い物", status: "open", deadline: null }),
  entity("task4", "task", { title: "レポートに使う資料を3本読む", status: "open", parentTaskId: "task2", projectId: "project", estimateMinutes: 45, deadline: "2026-09-19T14:59:00Z" }),
  entity("action1", "taskAction", { taskId: "task1", title: "単語帳を開く", status: "todo", sortOrder: 0, estimatedMinutes: 15 }),
  entity("action2", "taskAction", { taskId: "task1", title: "20語確認する", status: "todo", sortOrder: 1, estimatedMinutes: 15 }),
  entity("action3", "taskAction", { taskId: "task2", title: "見出しを書く", status: "todo", sortOrder: 0, estimatedMinutes: 20 }),
  plan("lecture", "物理学の授業", "09:00", "10:30", "school"),
  plan("library", "図書館で資料探し", "11:00", "12:00", "school"),
  plan("review", "今日の復習", "15:00", "16:30"),
  plan("overlap", "レポートの相談", "15:30", "16:00", "school"),
  plan("evening", "過去問を解く", "18:00", "19:00"),
  plan("compact-plan-1", "1分の予定", "20:30", "20:31"),
  plan("compact-plan-2", "2分の予定", "20:31", "20:33"),
  plan("compact-plan-5", "5分の予定", "20:33", "20:38"),
  plan("compact-plan-10", "10分の予定", "20:38", "20:48"),
  plan("compact-plan-30", "30分の予定", "20:48", "21:18"),
  plan("compact-plan-60", "60分の予定", "19:00", "20:00"),
  entity("container", "plan", { title: "秋学期", startAt: at("00:00"), endAt: at("23:59"), type: "container", allDay: false, flexibility: "fixed" }),
  entity("cancelled", "plan", { title: "延期した予定", startAt: at("17:00"), endAt: at("18:00"), type: "task", allDay: false, resolution: "postponed" }),
  entity("overnight", "plan", { title: "夜行バスで移動", startAt: "2026-09-17T14:00:00Z", endAt: "2026-09-17T21:00:00Z", type: "travel", allDay: false, flexibility: "fixed", calendarCategoryId: "life" }),
  entity("trip", "plan", { title: "週末の小旅行", startAt: "2026-09-17T15:00:00Z", endAt: "2026-09-20T15:00:00Z", type: "container", allDay: true, flexibility: "fixed", calendarCategoryId: "life" }),
  entity("seminar", "plan", { title: "ゼミの発表", startAt: "2026-09-17T04:00:00Z", endAt: "2026-09-17T05:30:00Z", type: "appointment", allDay: false, flexibility: "fixed", calendarCategoryId: "school" }),
  entity("actual1", "actual", { title: "物理学の授業", startAt: at("09:05"), endAt: at("10:25"), planId: "lecture", type: "task" }),
  entity("actual2", "actual", { title: "図書館で資料探し", startAt: at("11:10"), endAt: at("12:00"), planId: "library", type: "task" }),
  entity("compact-actual-1", "actual", { title: "1分の実績", startAt: at("20:30"), endAt: at("20:31"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("compact-actual-2", "actual", { title: "2分の実績", startAt: at("20:31"), endAt: at("20:33"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("compact-actual-5", "actual", { title: "5分の実績", startAt: at("20:33"), endAt: at("20:38"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("compact-actual-10", "actual", { title: "10分の実績", startAt: at("20:38"), endAt: at("20:48"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("compact-actual-30", "actual", { title: "30分の実績", startAt: at("20:48"), endAt: at("21:18"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("compact-actual-60", "actual", { title: "60分の実績", startAt: at("19:00"), endAt: at("20:00"), planId: null, type: "task", calendarCategoryId: "study" }),
  entity("routine1", "routine", { title: "ストレッチ", active: true, preferredTime: "16:00", expectedDuration: 5, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("routine2", "routine", { title: "夕食の準備", active: true, preferredTime: "17:30", expectedDuration: 30, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("routine3", "routine", { title: "日記をつける", active: true, preferredTime: "22:00", expectedDuration: 15, scheduleRule: { kind: "daily" } }),
  entity("weekendRoutine", "routine", { title: "部屋を整える", description: "窓を開けて、本棚と机の上を片づける。", active: true, preferredTime: "10:00", expectedDuration: 45, scheduleRule: { kind: "weekly", weekdays: [6] }, calendarCategoryId: "life" }),
  entity("pausedRoutine", "routine", { title: "朝の散歩", active: false, preferredTime: "07:30", expectedDuration: 20, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("note1", "inbox", { text: "来週のゼミの持ち物を確認", sorted: false }),
  entity("money1", "transaction", { title: "電車", amount: 420, direction: "expense", category: "交通費", categoryId: "money_transport", moneyMethodId: "money_method_card", occurredAt: at("08:00"), status: "settled" }),
  entity("money2", "transaction", { title: "参考書の代金", amount: 2000, direction: "expense", category: "勉強", categoryId: "money_study", moneyMethodId: "money_method_card", occurredAt: at("08:00"), expectedAt: at("18:00"), status: "expected", projectId: "project", taskId: "task2", planId: "library", actualId: "actual2", note: "ゼミで使う参考書" }),
  entity("income", "transaction", { title: "アルバイトの給与", amount: 28000, direction: "income", category: "給与", categoryId: "money_salary", moneyMethodId: "money_method_bank", occurredAt: "2026-09-15T03:00:00Z", status: "settled" }),
  entity("budget-study", "budget", { categoryId: "money_study", period: "month", amount: 10000, active: true }),
  entity("settings", "settings", { calendarView: "day", visibleCalendarCategories: [], showPlan: true, showActual: true, showTaskDeadlines: true, defaultCalendarCategoryId: "study", dayStart: "07:00", dayEnd: "23:00", guidanceIntensity: "strong", transitionBufferMinutes: 10, departureSafetyBufferMinutes: 10, targetSleepTime: "23:30", windDownMinutes: 45, fallbackWakeTime: "08:00", wakeWindowMinutes: 180, notificationsEnabled: false, wakeNotifications: true, anchorNotifications: true, departureNotifications: true, executionNotifications: true, windDownNotifications: true }),
];
let notificationJobs: NotificationJobData[] = [];
type Listener = (items: CoreEntity[]) => void;
const listeners = new Set<Listener>();
let failNext = false;
const emit = () => { for (const listener of listeners) listener([...entities]); };
function guard() { if (failNext) { failNext = false; throw new Error("fixture_offline"); } }
export async function prepareUserData() {}
export function subscribeEntities(_uid: string, callback: Listener, state: (value: string) => void) {
  listeners.add(callback); callback([...entities]); state("同期済み"); return () => { listeners.delete(callback); };
}
export async function createEntity(_uid: string, type: EntityType, payload: Record<string, unknown>) {
  guard(); const saved = entity(crypto.randomUUID(), type, payload); entities = [...entities, saved]; emit(); return saved;
}
export async function createEntities(uid: string, inputs: { type: EntityType; payload: Record<string, unknown> }[]) {
  guard(); const saved: CoreEntity[] = [];
  for (const input of inputs) saved.push(await createEntity(uid, input.type, input.payload));
  return saved;
}
export async function startExecutionSession(uid: string, payload: ExecutionSessionData) {
  if (entities.some(item => item.type === "executionSession" && (item.payload as ExecutionSessionData).status === "running")) throw new Error("execution_already_running");
  return createEntity(uid, "executionSession", payload) as Promise<CoreEntity<ExecutionSessionData>>;
}
export async function completeExecutionSession(uid: string, session: CoreEntity<ExecutionSessionData>, endedAt: string, outcome: ExecutionOutcome = "activityCompleted", completeTask = false) {
  const current = entities.find(item => item.id === session.id) as CoreEntity<ExecutionSessionData> | undefined;
  const actualId = executionActualId(session.id);
  const existingActual = entities.find(item => item.id === actualId) as CoreEntity<ActualData> | undefined;
  if (current?.payload.status !== "running" && existingActual) return { session: current, actual: existingActual, task: null, created: false };
  const task = entities.find(item => item.id === current?.payload.taskId) as CoreEntity<TaskData> | undefined;
  const payloads = completionPayloads(current || session, new Date(endedAt), task);
  const actual = existingActual || { ...entity(actualId, "actual", payloads.actual), payload: payloads.actual } as CoreEntity<ActualData>;
  const completed = { ...(current || session), payload: { ...(current || session).payload, status: "completed" as const, endedAt, actualId, outcome: completeTask ? "activityCompleted" as const : outcome }, revision: (current || session).revision + 1 };
  const updatedTask = task ? { ...task, payload: { ...(payloads.nextTask || task.payload), status: completeTask ? "completed" as const : task.payload.status, completedAt: completeTask ? endedAt : task.payload.completedAt }, revision: task.revision + 1 } : null;
  entities = [...entities.filter(item => item.id !== completed.id && item.id !== actual.id && item.id !== updatedTask?.id), completed, actual, ...(updatedTask ? [updatedTask] : [])]; emit();
  return { session: completed, actual, task: updatedTask, created: !existingActual };
}
export async function recordWakeAndStartMorningFlow(uid: string, now: Date, sleep: CoreEntity<SleepRecordData> | undefined, flow: CoreEntity<RoutineFlowData> | undefined, running: CoreEntity<RoutineRunData> | undefined) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const savedSleep = sleep ? await updateEntity(uid, sleep, { ...sleep.payload, actualWakeAt: now.toISOString(), source: "manual" }) as CoreEntity<SleepRecordData> : await createEntity(uid, "sleepRecord", { date, plannedSleepAt: null, plannedWakeAt: null, estimatedSleepAt: null, actualWakeAt: now.toISOString(), source: "manual", confidence: 1 }) as CoreEntity<SleepRecordData>;
  const existingRun = running || (flow ? entities.find(item => item.id === `routine_run_${date}_${flow.id}`) as CoreEntity<RoutineRunData> | undefined : undefined);
  const run = existingRun || (flow ? await createEntity(uid, "routineRun", startRoutineRunPayload(flow, now) as unknown as Record<string, unknown>) as CoreEntity<RoutineRunData> : null);
  return { sleep: savedSleep, run };
}
export async function savePlannedWake(uid: string, date: string, plannedWakeAt: string, existing?: CoreEntity<SleepRecordData>) {
  if (existing) return updateEntity(uid, existing, { ...existing.payload, plannedWakeAt, source: "manual", confidence: 1 }) as Promise<CoreEntity<SleepRecordData>>;
  const saved = { ...entity(`sleep_${date}`, "sleepRecord", { date, plannedSleepAt: null, plannedWakeAt, estimatedSleepAt: null, actualWakeAt: null, source: "manual", confidence: 1 }), payload: { date, plannedSleepAt: null, plannedWakeAt, estimatedSleepAt: null, actualWakeAt: null, source: "manual", confidence: 1 } } as CoreEntity<SleepRecordData>;
  entities = [...entities.filter(item => item.id !== saved.id), saved]; emit(); return saved;
}
export async function updateEntity(_uid: string, old: CoreEntity, payload: Record<string, unknown>, deleted = false) {
  guard(); const current = entities.find(item => item.id === old.id);
  if (!current || current.revision !== old.revision) throw new Error("revision_conflict");
  const safePayload = current.type === "plan" ? protectGeneratedPlanEdit(current as CoreEntity<PlanData>, payload as PlanData) : payload;
  const saved = { ...current, payload: safePayload, revision: current.revision + 1, updatedAt: new Date().toISOString(), deletedAt: deleted ? new Date().toISOString() : current.deletedAt };
  entities = entities.map(item => item.id === saved.id ? saved : item); emit(); return saved;
}
export async function listBackups() { return []; }
export async function restoreBackup() { throw new Error("not_available_in_fixture"); }
export async function resolveConflict(_uid: string, conflict: CoreEntity<ConflictData>) { return { resolvedTarget: conflict, resolvedConflict: conflict }; }
export async function postponePlan(uid: string, old: CoreEntity<PlanData>, destination: number | { startAt: string; endAt: string } = 1) {
  const range = typeof destination === "number" ? { startAt: new Date(+new Date(old.payload.startAt) + destination * 86400000).toISOString(), endAt: new Date(+new Date(old.payload.endAt) + destination * 86400000).toISOString() } : destination;
  const nextPlan = await createEntity(uid, "plan", { ...old.payload, actualId: null, ...range, resolution: null, rescheduledFromPlanId: old.id, rescheduledToPlanId: null });
  const resolved = await updateEntity(uid, old, { ...old.payload, resolution: "postponed", rescheduledToPlanId: nextPlan.id });
  return { nextPlan, resolved };
}
export async function recordActualForPlan(uid: string, old: CoreEntity<PlanData>, payload: ActualData) {
  const actual = await createEntity(uid, "actual", { ...payload, planId: old.id, directionId: inheritedDirection(payload.directionId, old.payload.directionId) });
  return { actual, linkedPlan: old };
}
export async function recordPlanAsActual(uid: string, old: CoreEntity<PlanData>) {
  return recordActualForPlan(uid, old, { title: old.payload.title, startAt: old.payload.startAt, endAt: old.payload.endAt, type: old.payload.type });
}
export async function deleteActualAndUnlinkPlan(uid: string, actual: CoreEntity<ActualData>, old: CoreEntity<PlanData>) {
  const deletedActual = await updateEntity(uid, actual, actual.payload, true);
  const unlinkedPlan = old.payload.actualId === actual.id ? await updateEntity(uid, old, { ...old.payload, actualId: null }) : old;
  return { deletedActual, unlinkedPlan };
}
const persistGenerated = (mutations: ReturnType<typeof planRecurringMutations> | ReturnType<typeof planFutureBlocks>["mutations"]) => {
  const saved: CoreEntity<PlanData>[] = [];
  for (const mutation of mutations) {
    const current = entities.find(item => item.id === mutation.id) as CoreEntity<PlanData> | undefined;
    if (mutation.kind === "create" && !current) {
      const created = { ...entity(mutation.id, "plan", mutation.payload), payload: mutation.payload } as CoreEntity<PlanData>;
      entities = [...entities, created]; saved.push(created);
    } else if (current && current.payload.generationState === "generated") {
      const next = { ...current, payload: mutation.payload, revision: current.revision + 1 };
      entities = entities.map(item => item.id === next.id ? next : item); saved.push(next);
    }
  }
  if (saved.length) emit(); return saved;
};
export async function syncRecurringPlans(_uid: string, source: CoreEntity[], now = new Date()) { return persistGenerated(planRecurringMutations(source, now)); }
export async function syncFutureBlocks(_uid: string, source: CoreEntity[], now = new Date()) { const settings = source.find(item => item.type === "settings")?.payload || {}; const plan = planFutureBlocks(source, now, settings); return { plan, saved: persistGenerated(plan.mutations) }; }
export async function syncNotificationJobs(_uid: string, jobs: NotificationJobData[]) { notificationJobs = structuredClone(jobs); return notificationJobs.length; }
declare global {
  interface Window { __liflowFixture: { snapshot: () => CoreEntity[]; failNext: () => void; emptyTypes: (types: EntityType[]) => void } }
}
window.__liflowFixture = {
  snapshot: () => structuredClone(entities),
  failNext: () => { failNext = true; },
  emptyTypes: types => { entities = entities.filter(item => !types.includes(item.type)); emit(); },
};
