/* Only the isolated UI test server aliases firebase-store to this module.
   There is no Firebase import, connection, or persistence in this fixture. */
import type { CoreEntity, EntityType, PlanData, ActualData, ConflictData } from "../../domain/core";
const timestamp = "2026-09-16T07:42:00.000Z";
const at = (time: string) => new Date("2026-09-16T" + time + ":00+09:00").toISOString();
const entity = (id: string, type: EntityType, payload: object): CoreEntity => ({ id, type, payload: payload as Record<string, unknown>, revision: 1, schemaVersion: 3, createdAt: timestamp, updatedAt: timestamp, updatedBy: "fixture", deletedAt: null });
const plan = (id: string, title: string, start: string, end: string, category = "study") => entity(id, "plan", { title, startAt: at(start), endAt: at(end), type: "task", flexibility: "fixed", allDay: false, taskId: null, projectId: null, calendarCategoryId: category, resolution: null, actualId: null });
let entities = [
  entity("study", "calendarCategory", { name: "勉強", colorToken: "#b9a1e3", sortOrder: 0, archived: false }),
  entity("school", "calendarCategory", { name: "大学", colorToken: "#93c5e5", sortOrder: 1, archived: false }),
  entity("life", "calendarCategory", { name: "生活", colorToken: "#eaa6c4", sortOrder: 2, archived: false }),
  entity("project", "project", { name: "秋学期の準備", description: "新しい学期に向けて、授業と自分のペースを整える。", status: "active", calendarCategoryId: "study", parentProjectId: null }),
  entity("subproject", "project", { name: "物理の復習", status: "active", calendarCategoryId: "study", parentProjectId: "project" }),
  entity("task1", "task", { title: "英単語の復習", status: "open", deadline: at("23:59"), projectId: "project", calendarCategoryId: "study", estimateMinutes: 30 }),
  entity("task2", "task", { title: "レポートの下書き", status: "open", deadline: "2026-09-18T14:59:00Z", projectId: "project" }),
  entity("task3", "task", { title: "帰りに買い物", status: "open", deadline: null }),
  entity("task4", "task", { title: "レポートに使う資料を3本読む", status: "open", parentTaskId: "task2", projectId: "project", estimateMinutes: 45, deadline: "2026-09-19T14:59:00Z" }),
  plan("lecture", "物理学の授業", "09:00", "10:30", "school"),
  plan("library", "図書館で資料探し", "11:00", "12:00", "school"),
  plan("review", "今日の復習", "15:00", "16:30"),
  plan("overlap", "レポートの相談", "15:30", "16:00", "school"),
  plan("evening", "過去問を解く", "18:00", "19:00"),
  entity("container", "plan", { title: "秋学期", startAt: at("00:00"), endAt: at("23:59"), type: "container", allDay: false, flexibility: "fixed" }),
  entity("cancelled", "plan", { title: "延期した予定", startAt: at("17:00"), endAt: at("18:00"), type: "task", allDay: false, resolution: "postponed" }),
  entity("overnight", "plan", { title: "夜行バスで移動", startAt: "2026-09-17T14:00:00Z", endAt: "2026-09-17T21:00:00Z", type: "travel", allDay: false, flexibility: "fixed", calendarCategoryId: "life" }),
  entity("trip", "plan", { title: "週末の小旅行", startAt: "2026-09-17T15:00:00Z", endAt: "2026-09-20T15:00:00Z", type: "container", allDay: true, flexibility: "fixed", calendarCategoryId: "life" }),
  entity("seminar", "plan", { title: "ゼミの発表", startAt: "2026-09-17T04:00:00Z", endAt: "2026-09-17T05:30:00Z", type: "appointment", allDay: false, flexibility: "fixed", calendarCategoryId: "school" }),
  entity("actual1", "actual", { title: "物理学の授業", startAt: at("09:05"), endAt: at("10:25"), planId: "lecture", type: "task" }),
  entity("actual2", "actual", { title: "図書館で資料探し", startAt: at("11:10"), endAt: at("12:00"), planId: "library", type: "task" }),
  entity("routine1", "routine", { title: "ストレッチ", active: true, preferredTime: "16:00", expectedDuration: 5, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("routine2", "routine", { title: "夕食の準備", active: true, preferredTime: "17:30", expectedDuration: 30, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("routine3", "routine", { title: "日記をつける", active: true, preferredTime: "22:00", expectedDuration: 15, scheduleRule: { kind: "daily" } }),
  entity("weekendRoutine", "routine", { title: "部屋を整える", description: "窓を開けて、本棚と机の上を片づける。", active: true, preferredTime: "10:00", expectedDuration: 45, scheduleRule: { kind: "weekly", weekdays: [6] }, calendarCategoryId: "life" }),
  entity("pausedRoutine", "routine", { title: "朝の散歩", active: false, preferredTime: "07:30", expectedDuration: 20, scheduleRule: { kind: "daily" }, calendarCategoryId: "life" }),
  entity("note1", "inbox", { text: "来週のゼミの持ち物を確認", sorted: false }),
  entity("money1", "transaction", { title: "電車", amount: 420, direction: "expense", category: "交通", occurredAt: at("08:00"), status: "settled" }),
  entity("money2", "transaction", { title: "参考書の代金", amount: 2000, direction: "expense", category: "勉強", occurredAt: at("08:00"), expectedAt: at("10:00"), status: "expected", projectId: "project", taskId: "task2", planId: "library", actualId: "actual2", note: "ゼミで使う参考書" }),
  entity("income", "transaction", { title: "アルバイトの給与", amount: 28000, direction: "income", category: "給与", occurredAt: "2026-09-15T03:00:00Z", status: "settled" }),
  entity("settings", "settings", { calendarView: "day", visibleCalendarCategories: [], showPlan: true, showActual: true, showTaskDeadlines: true, dayStart: "07:00", dayEnd: "23:00" }),
];
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
export async function updateEntity(_uid: string, old: CoreEntity, payload: Record<string, unknown>, deleted = false) {
  guard(); const current = entities.find(item => item.id === old.id);
  if (!current || current.revision !== old.revision) throw new Error("revision_conflict");
  const saved = { ...current, payload, revision: current.revision + 1, updatedAt: new Date().toISOString(), deletedAt: deleted ? new Date().toISOString() : current.deletedAt };
  entities = entities.map(item => item.id === saved.id ? saved : item); emit(); return saved;
}
export async function listBackups() { return []; }
export async function restoreBackup() { throw new Error("not_available_in_fixture"); }
export async function resolveConflict(_uid: string, conflict: CoreEntity<ConflictData>) { return { resolvedTarget: conflict, resolvedConflict: conflict }; }
export async function postponePlan(uid: string, old: CoreEntity<PlanData>) {
  const nextPlan = await createEntity(uid, "plan", { ...old.payload, startAt: new Date(+new Date(old.payload.startAt) + 86400000).toISOString(), endAt: new Date(+new Date(old.payload.endAt) + 86400000).toISOString() });
  const resolved = await updateEntity(uid, old, { ...old.payload, resolution: "postponed" });
  return { nextPlan, resolved };
}
export async function recordActualForPlan(uid: string, old: CoreEntity<PlanData>, payload: ActualData) {
  const actual = await createEntity(uid, "actual", { ...payload, planId: old.id });
  const linkedPlan = await updateEntity(uid, old, { ...old.payload, actualId: actual.id });
  return { actual, linkedPlan };
}
export async function recordPlanAsActual(uid: string, old: CoreEntity<PlanData>) {
  return recordActualForPlan(uid, old, { title: old.payload.title, startAt: old.payload.startAt, endAt: old.payload.endAt, type: old.payload.type });
}
export async function deleteActualAndUnlinkPlan(uid: string, actual: CoreEntity<ActualData>, old: CoreEntity<PlanData>) {
  const deletedActual = await updateEntity(uid, actual, actual.payload, true);
  const unlinkedPlan = await updateEntity(uid, old, { ...old.payload, actualId: null });
  return { deletedActual, unlinkedPlan };
}
declare global {
  interface Window { __liflowFixture: { snapshot: () => CoreEntity[]; failNext: () => void; emptyTypes: (types: EntityType[]) => void } }
}
window.__liflowFixture = {
  snapshot: () => structuredClone(entities),
  failNext: () => { failNext = true; },
  emptyTypes: types => { entities = entities.filter(item => !types.includes(item.type)); emit(); },
};
