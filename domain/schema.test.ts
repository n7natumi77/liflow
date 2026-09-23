import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DIRECTIONS,
  DEFAULT_MORNING_FLOW_ID,
  assertMigrationCandidate,
  assertNoEntityLoss,
  backfillCanonicalActualPlanLinks,
  countEntities,
  createSnapshotMigrationPlan,
  ensureDefaultDirections,
  ensureDefaultMorningFlow,
  migrateEntity,
  migrateSnapshot,
  type StoredEntity,
} from "./schema.ts";
import { ENTITY_TYPES } from "./core.ts";

const stored = (
  id: string,
  type: StoredEntity["type"],
  payload: Record<string, unknown>,
  schemaVersion: number | undefined = 3,
  extra: Partial<StoredEntity> = {},
): StoredEntity => ({
  id,
  type,
  payload,
  schemaVersion,
  revision: 7,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  updatedBy: "old-device",
  deletedAt: null,
  ...extra,
});

test("v1 to v2 to v3 to v4 to v5 to v6 migration remains available", () => {
  const legacy = stored("p", "project", { name: "研究" });
  delete legacy.schemaVersion;
  const entity = migrateEntity(legacy);
  assert.equal(entity.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(entity.payload.name, "研究");
  assert.equal(entity.payload.parentProjectId, null);
});

test("v3 Task gains only nullable vNext fields without losing legacy links", () => {
  const entity = migrateEntity(
    stored("task", "task", {
      title: "地学レポート",
      estimateMinutes: 90,
      projectId: "legacy-project",
      parentTaskId: "legacy-parent",
      status: "open",
    }),
  );
  assert.equal(entity.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(entity.payload.directionId, null);
  assert.equal(entity.payload.nextAction, null);
  assert.equal(entity.payload.estimatedRemainingMinutes, null);
  assert.equal(entity.payload.estimateMinutes, 90);
  assert.equal(entity.payload.projectId, "legacy-project");
  assert.equal(entity.payload.parentTaskId, "legacy-parent");
});

test("v3 Plan and Actual gain direction while preserving canonical and legacy relations", () => {
  const plan = migrateEntity(
    stored("plan", "plan", { title: "授業", actualId: "legacy-actual", startAt: "a", endAt: "b" }),
  );
  const actual = migrateEntity(
    stored("actual", "actual", { title: "授業", planId: "plan", startAt: "a", endAt: "b" }),
  );
  assert.equal(plan.payload.directionId, null);
  assert.equal(plan.payload.actualId, "legacy-actual");
  assert.equal(plan.payload.rescheduledFromPlanId, null);
  assert.equal(actual.payload.directionId, null);
  assert.equal(actual.payload.planId, "plan");
});

test("a unique v3 Plan.actualId safely backfills the canonical Actual.planId", () => {
  const source = [
    migrateEntity(stored("plan", "plan", { title: "予定", actualId: "actual" })),
    migrateEntity(stored("actual", "actual", { title: "実績", planId: null })),
  ];
  const result = backfillCanonicalActualPlanLinks(source);
  assert.equal(result.find((entity) => entity.id === "actual")?.payload.planId, "plan");
  assert.equal(result.find((entity) => entity.id === "plan")?.payload.actualId, "actual");
});

test("ambiguous legacy Plan.actualId links are preserved without guessing", () => {
  const source = [
    migrateEntity(stored("plan-a", "plan", { title: "A", actualId: "actual" })),
    migrateEntity(stored("plan-b", "plan", { title: "B", actualId: "actual" })),
    migrateEntity(stored("actual", "actual", { title: "実績", planId: null })),
  ];
  const result = backfillCanonicalActualPlanLinks(source);
  assert.equal(result.find((entity) => entity.id === "actual")?.payload.planId, null);
});

test("taskless Plans and planless Actuals remain valid after migration", () => {
  const plan = migrateEntity(
    stored("free-plan", "plan", { title: "散歩", taskId: null, startAt: "a", endAt: "b" }),
  );
  const actual = migrateEntity(
    stored("free-actual", "actual", { title: "写真整理", planId: null, startAt: "a", endAt: "b" }),
  );
  assert.equal(plan.payload.taskId, null);
  assert.equal(actual.payload.planId, null);
});

test("v3 Project and Routine survive unchanged", () => {
  const project = migrateEntity(
    stored("project", "project", { name: "旧プロジェクト", description: "残す", status: "archived" }),
  );
  const routine = migrateEntity(
    stored("routine", "routine", { title: "歯磨き", scheduleRule: { kind: "daily" }, active: true }),
  );
  assert.equal(project.payload.name, "旧プロジェクト");
  assert.equal(project.payload.description, "残す");
  assert.equal(routine.payload.title, "歯磨き");
  assert.deepEqual(routine.payload.scheduleRule, { kind: "daily" });
  assert.equal((routine.payload as Record<string, unknown>).routineFlowId, undefined);
});

test("all registered entity types survive snapshot migration and entity count never decreases", () => {
  const source = ENTITY_TYPES.map((type, index) => stored(String(index), type, {}));
  const result = migrateSnapshot(source);
  assert.equal(result.filter((entity) => source.some((old) => old.id === entity.id)).length, source.length);
  for (const type of ENTITY_TYPES) {
    assert.ok(countEntities(result)[type] >= countEntities(source as CoreEntityLike[])[type]);
  }
});

type CoreEntityLike = Parameters<typeof countEntities>[0][number];

test("migration rejects data loss by type or id", () => {
  const source = [
    stored("task-1", "task", { title: "A" }),
    stored("project-1", "project", { name: "P" }),
  ];
  assert.throws(() => assertNoEntityLoss(source, [migrateEntity(source[0])]), /entity_loss:project/);
});

test("the five stable Directions are initialized exactly once", () => {
  const first = ensureDefaultDirections([], { now: "2026-01-01T00:00:00.000Z" });
  const second = ensureDefaultDirections(first, { now: "2026-02-01T00:00:00.000Z" });
  assert.deepEqual(first.map((entity) => entity.id), DEFAULT_DIRECTIONS.map((item) => item.id));
  assert.equal(first.length, 5);
  assert.equal(second.length, 5);
  assert.deepEqual(second, first);
});

test("a matching legacy Direction name prevents duplicate initialization", () => {
  const existing = migrateEntity(
    stored("user-academic", "direction", { name: "学業", active: true, sortOrder: 20 }, 4),
  );
  const result = ensureDefaultDirections([existing]);
  assert.equal(result.filter((entity) => entity.type === "direction").length, 5);
  assert.equal(result.filter((entity) => entity.payload.name === "学業").length, 1);
});

test("a stable Direction ID collision aborts instead of overwriting an Entity", () => {
  const collidingTask = migrateEntity(
    stored("direction_academic", "task", { title: "既存タスク", status: "open" }, 4),
  );
  assert.throws(
    () => ensureDefaultDirections([collidingTask]),
    /migration_id_collision:direction_academic/,
  );
});

test("the editable morning preset is initialized once and never duplicated", () => {
  const first = ensureDefaultMorningFlow([], { now: "2026-01-01T00:00:00.000Z" });
  const second = ensureDefaultMorningFlow(first, { now: "2026-02-01T00:00:00.000Z" });
  assert.equal(first.length, 1);
  assert.equal(first[0].id, DEFAULT_MORNING_FLOW_ID);
  assert.equal(first[0].type, "routineFlow");
  assert.equal((first[0].payload.steps as unknown[]).length, 6);
  assert.deepEqual(second, first);
});

test("migration plan requires a safety backup and becomes idempotent", () => {
  const source = [stored("task", "task", { title: "A", status: "open" })];
  const first = createSnapshotMigrationPlan(source, { now: "2026-01-01T00:00:00.000Z" });
  assert.equal(first.requiresBackup, true);
  assert.equal(first.addedEntities.length, 6);
  const second = createSnapshotMigrationPlan(first.entities, { now: "2026-02-01T00:00:00.000Z" });
  assert.equal(second.requiresBackup, false);
  assert.equal(second.addedEntities.length, 0);
  assert.equal(second.entities.length, first.entities.length);
});

test("revision and tombstone metadata survive migration", () => {
  const entity = migrateEntity(
    stored("deleted", "task", { title: "消したタスク", status: "cancelled" }, 3, {
      revision: 42,
      deletedAt: "2026-01-03T00:00:00.000Z",
    }),
  );
  assert.equal(entity.revision, 42);
  assert.equal(entity.deletedAt, "2026-01-03T00:00:00.000Z");
  assert.equal(entity.updatedBy, "old-device");
});

test("migration conflict interrupts instead of overwriting a newer revision", () => {
  const original = stored("task", "task", { title: "A" }, 3, { revision: 2 });
  const concurrent = stored("task", "task", { title: "B" }, 3, { revision: 3 });
  assert.throws(() => assertMigrationCandidate(original, concurrent), /migration_conflict:task/);
});

test("an entity already migrated by another device is left alone", () => {
  const original = stored("task", "task", { title: "A" }, 3, { revision: 2 });
  const migrated = stored("task", "task", { title: "A" }, CURRENT_SCHEMA_VERSION, { revision: 3 });
  assert.equal(assertMigrationCandidate(original, migrated), false);
});

test("newer unknown schema is never reset or reinterpreted", () => {
  assert.throws(() => migrateEntity(stored("x", "task", {}, 99)), /newer_schema:99/);
  assert.throws(
    () => createSnapshotMigrationPlan([stored("x", "task", {}, 99)]),
    /newer_schema:99/,
  );
});

test("v4 entity families migrate through v5 to v6 without payload loss", () => {
  const source = [
    stored("rule", "recurringActivityRule", { title: "授業", active: true }, 4),
    stored("flow", "routineFlow", { name: "起床後", active: true, steps: [] }, 4),
    stored("run", "routineRun", { routineFlowId: "flow", startedAt: "now", stepResults: [] }, 4),
    stored("sleep", "sleepRecord", { date: "2026-01-01", source: "manual" }, 4),
    stored("condition", "conditionRecord", { recordedAt: "now", source: "manual" }, 4),
  ];
  const result = migrateSnapshot(source);
  for (const entity of source) {
    assert.deepEqual(result.find((item) => item.id === entity.id)?.payload, entity.payload);
  }
});

test("v4 settings gain the Phase 1 safety controls and execution sessions are registered", () => {
  const settings = migrateEntity(stored("settings", "settings", { calendarView: "week" }, 4));
  const session = migrateEntity(stored("session", "executionSession", { targetKind: "task", taskId: "task", title: "実行", startedAt: "2026-01-01T00:00:00.000Z" }, 4));
  assert.equal(settings.payload.guidanceIntensity, "strong");
  assert.equal(settings.payload.transitionBufferMinutes, 10);
  assert.equal(settings.payload.departureSafetyBufferMinutes, 10);
  assert.equal(settings.payload.targetSleepTime, "23:30");
  assert.equal(settings.payload.windDownMinutes, 45);
  assert.equal(session.payload.status, "running");
  assert.equal(session.payload.actualId, null);
});

test("v5 Plans and Settings gain Phase 2 automation and notification defaults", () => {
  const generated = migrateEntity(stored("plan", "plan", { title: "授業", startAt: "a", endAt: "b" }, 5));
  const settings = migrateEntity(stored("settings", "settings", { calendarView: "week" }, 5));
  assert.equal(generated.payload.source, null);
  assert.equal(generated.payload.generationState, null);
  assert.equal(generated.payload.recurrenceKey, null);
  assert.equal(settings.payload.fallbackWakeTime, "08:00");
  assert.equal(settings.payload.notificationsEnabled, false);
  assert.equal((settings.payload.directionPolicies as Record<string, { level: string }>).direction_career.level, "strong");
});
