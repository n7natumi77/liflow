import {
  ENTITY_TYPES,
  type CoreEntity,
  type DirectionData,
  type EntityType,
} from "./core.ts";

export const CURRENT_SCHEMA_VERSION = 4;
export type StoredEntity = Omit<CoreEntity, "schemaVersion"> & { schemaVersion?: number };
export type EntityCounts = Record<EntityType, number>;

const legacyDefaults: Record<EntityType, Record<string, unknown>> = {
  task: {
    description: "",
    deadline: null,
    estimateMinutes: null,
    projectId: null,
    parentTaskId: null,
    calendarCategoryId: null,
    status: "open",
    completedAt: null,
  },
  plan: {
    taskId: null,
    projectId: null,
    calendarCategoryId: null,
    type: "personal",
    flexibility: "fixed",
    allDay: false,
    actualId: null,
    resolution: null,
  },
  actual: {
    taskId: null,
    planId: null,
    projectId: null,
    calendarCategoryId: null,
    type: "personal",
    note: "",
  },
  inbox: { sorted: false },
  routine: {
    description: "",
    calendarCategoryId: null,
    preferredTime: null,
    expectedDuration: null,
    active: true,
  },
  routineOccurrence: { status: "unknown", actualId: null },
  recurringActivityRule: {},
  routineFlow: {},
  routineRun: {},
  sleepRecord: {},
  conditionRecord: {},
  transaction: {
    category: "その他",
    expectedAt: null,
    status: "settled",
    planId: null,
    actualId: null,
    taskId: null,
    projectId: null,
    note: "",
  },
  checkin: {},
  calendarCategory: { colorToken: "#b9aab6", icon: "", sortOrder: 0, archived: false },
  direction: {},
  project: {
    description: "",
    calendarCategoryId: null,
    parentProjectId: null,
    status: "active",
  },
  settings: {
    calendarView: "week",
    visibleCalendarCategories: [],
    showPlan: true,
    showActual: true,
    showTaskDeadlines: true,
    dayStart: "07:00",
    dayEnd: "23:00",
  },
  conflict: { status: "open", choice: null, resolvedAt: null },
};

/** Only schema-v4 additions belong here. Legacy fields remain untouched. */
const v4Defaults: Record<EntityType, Record<string, unknown>> = {
  task: { directionId: null, nextAction: null, estimatedRemainingMinutes: null },
  plan: {
    directionId: null,
    rescheduledFromPlanId: null,
    rescheduledToPlanId: null,
  },
  actual: { directionId: null },
  inbox: {},
  routine: {},
  routineOccurrence: {},
  recurringActivityRule: {
    active: true,
    scheduleRule: { kind: "weekly", weekdays: [] },
    startTime: "09:00",
    durationMinutes: 60,
    taskId: null,
    calendarCategoryId: null,
    directionId: null,
    planType: "personal",
    flexibility: "fixed",
  },
  routineFlow: { trigger: { type: "manual" }, active: true, steps: [] },
  routineRun: { endedAt: null, status: "running", stepResults: [] },
  sleepRecord: {
    plannedSleepAt: null,
    plannedWakeAt: null,
    estimatedSleepAt: null,
    actualWakeAt: null,
    source: "manual",
    confidence: null,
  },
  conditionRecord: {
    energyLevel: null,
    fatigue: null,
    mood: null,
    note: "",
    source: "manual",
    confidence: null,
  },
  transaction: {},
  checkin: {},
  calendarCategory: {},
  direction: { description: "", icon: "", colorToken: "", active: true, sortOrder: 0 },
  project: {},
  settings: {},
  conflict: {},
};

export const DEFAULT_DIRECTIONS = [
  {
    id: "direction_academic",
    payload: { name: "学業", description: "授業・課題・学習", icon: "book", colorToken: "direction-academic", active: true, sortOrder: 0 },
  },
  {
    id: "direction_specialty",
    payload: { name: "専門", description: "専門性・制作・技術", icon: "sparkles", colorToken: "direction-specialty", active: true, sortOrder: 1 },
  },
  {
    id: "direction_career",
    payload: { name: "進路", description: "将来の選択と準備", icon: "compass", colorToken: "direction-career", active: true, sortOrder: 2 },
  },
  {
    id: "direction_life",
    payload: { name: "生活", description: "暮らし・健康・身の回り", icon: "heart", colorToken: "direction-life", active: true, sortOrder: 3 },
  },
  {
    id: "direction_world",
    payload: { name: "世界", description: "人・社会・外の世界", icon: "globe", colorToken: "direction-world", active: true, sortOrder: 4 },
  },
] as const satisfies readonly { id: string; payload: DirectionData }[];

export const emptyCounts = (): EntityCounts =>
  Object.fromEntries(ENTITY_TYPES.map((type) => [type, 0])) as EntityCounts;

export function countEntities(
  entities: Pick<CoreEntity, "type" | "deletedAt">[],
  includeDeleted = true,
) {
  const counts = emptyCounts();
  for (const entity of entities) {
    if (includeDeleted || !entity.deletedAt) counts[entity.type]++;
  }
  return counts;
}

export function migrateEntity(input: StoredEntity): CoreEntity {
  const version = Number(input.schemaVersion || 1);
  if (version > CURRENT_SCHEMA_VERSION) throw new Error(`newer_schema:${version}`);
  if (!ENTITY_TYPES.includes(input.type)) throw new Error(`unknown_entity_type:${String(input.type)}`);
  let entity = { ...input, payload: { ...input.payload }, schemaVersion: version } as CoreEntity;
  if (entity.schemaVersion === 1) {
    entity = {
      ...entity,
      payload: { ...legacyDefaults[entity.type], ...entity.payload },
      schemaVersion: 2,
    };
  }
  if (entity.schemaVersion === 2) {
    entity = {
      ...entity,
      payload: { ...legacyDefaults[entity.type], ...entity.payload },
      schemaVersion: 3,
    };
  }
  if (entity.schemaVersion === 3) {
    entity = {
      ...entity,
      payload: { ...v4Defaults[entity.type], ...entity.payload },
      schemaVersion: 4,
    };
  }
  if (entity.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`migration_missing:${entity.schemaVersion}`);
  }
  return entity;
}

export function assertNoEntityLoss(before: StoredEntity[], after: CoreEntity[]) {
  const oldCounts = countEntities(before as CoreEntity[]);
  const newCounts = countEntities(after);
  for (const type of ENTITY_TYPES) {
    if (newCounts[type] < oldCounts[type]) {
      throw new Error(`entity_loss:${type}:${oldCounts[type]}:${newCounts[type]}`);
    }
  }
  const oldIds = new Set(before.map((entity) => entity.id));
  for (const entity of after) oldIds.delete(entity.id);
  if (oldIds.size) throw new Error(`entity_loss:ids:${[...oldIds].join(",")}`);
}

type DirectionMetadata = { now?: string; updatedBy?: string };
export function ensureDefaultDirections(entities: CoreEntity[], metadata: DirectionMetadata = {}) {
  const result = [...entities];
  const now = metadata.now || "1970-01-01T00:00:00.000Z";
  const updatedBy = metadata.updatedBy || "migration:schema-v4";
  for (const definition of DEFAULT_DIRECTIONS) {
    const entityWithStableId = result.find((entity) => entity.id === definition.id);
    if (entityWithStableId && entityWithStableId.type !== "direction") {
      throw new Error(`migration_id_collision:${definition.id}`);
    }
    const exists = result.some(
      (entity) =>
        entity.type === "direction" &&
        (entity.id === definition.id || String(entity.payload.name || "") === definition.payload.name),
    );
    if (exists) continue;
    result.push({
      id: definition.id,
      type: "direction",
      payload: { ...definition.payload },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy,
      deletedAt: null,
    });
  }
  return result;
}

/**
 * Schema v3 wrote both Plan.actualId and Actual.planId. If an old snapshot only
 * has the Plan-side pointer, promote that explicit one-to-one fact to the v4
 * canonical Actual.planId. Ambiguous or conflicting links are never guessed.
 */
export function backfillCanonicalActualPlanLinks(entities: CoreEntity[]) {
  const plansByActual = new Map<string, string[]>();
  for (const entity of entities) {
    if (entity.type !== "plan") continue;
    const actualId = typeof entity.payload.actualId === "string" ? entity.payload.actualId : "";
    if (!actualId) continue;
    plansByActual.set(actualId, [...(plansByActual.get(actualId) || []), entity.id]);
  }
  return entities.map((entity) => {
    if (entity.type !== "actual" || entity.payload.planId) return entity;
    const planIds = plansByActual.get(entity.id) || [];
    if (planIds.length !== 1) return entity;
    return { ...entity, payload: { ...entity.payload, planId: planIds[0] } };
  });
}

export function migrateSnapshot(input: StoredEntity[], metadata: DirectionMetadata = {}) {
  const migrated = backfillCanonicalActualPlanLinks(input.map(migrateEntity));
  const initialized = ensureDefaultDirections(migrated, metadata);
  assertNoEntityLoss(input, initialized);
  return initialized;
}

export type SnapshotMigrationPlan = {
  entities: CoreEntity[];
  addedEntities: CoreEntity[];
  requiresBackup: boolean;
  requiresWrite: boolean;
};
export function createSnapshotMigrationPlan(
  source: StoredEntity[],
  metadata: DirectionMetadata = {},
): SnapshotMigrationPlan {
  const entities = migrateSnapshot(source, metadata);
  const sourceIds = new Set(source.map((entity) => entity.id));
  const addedEntities = entities.filter((entity) => !sourceIds.has(entity.id));
  const hasSchemaChanges = source.some(
    (entity) => Number(entity.schemaVersion || 1) !== CURRENT_SCHEMA_VERSION,
  );
  const requiresWrite = hasSchemaChanges || addedEntities.length > 0;
  return { entities, addedEntities, requiresBackup: requiresWrite, requiresWrite };
}

/** Returns false when another device already completed this entity migration. */
export function assertMigrationCandidate(original: StoredEntity, current: StoredEntity) {
  const currentVersion = Number(current.schemaVersion || 1);
  if (currentVersion > CURRENT_SCHEMA_VERSION) throw new Error(`newer_schema:${currentVersion}`);
  if (currentVersion === CURRENT_SCHEMA_VERSION) return false;
  if (current.revision !== original.revision) throw new Error(`migration_conflict:${original.id}`);
  return true;
}
