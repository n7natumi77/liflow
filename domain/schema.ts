import {
  ENTITY_TYPES,
  type CoreEntity,
  type DirectionData,
  type EntityType,
} from "./core.ts";

export const CURRENT_SCHEMA_VERSION = 7;
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
  taskAction: {},
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
  executionSession: {},
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
  moneyCategory: { appliesTo: "both", sortOrder: 0, archived: false, systemKey: null },
  moneyMethod: { sortOrder: 0, archived: false },
  transfer: { note: "", feeAmount: 0, feeTransactionId: null },
  budget: { period: "month", active: true },
  checkin: {}, // Legacy/reserved: retained for old snapshots; no vNext creation flow.
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
    defaultCalendarCategoryId: null,
  },
  conflict: { status: "open", choice: null, resolvedAt: null },
};

/** Only schema-v4 additions belong here. Legacy fields remain untouched. */
const v4Defaults: Record<EntityType, Record<string, unknown>> = {
  task: { directionId: null, nextAction: null, estimatedRemainingMinutes: null },
  taskAction: {},
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
  executionSession: {
    endedAt: null,
    status: "running",
    suggestedMinutes: null,
    directionId: null,
    actualId: null,
    outcome: null,
  },
  transaction: {},
  moneyCategory: {},
  moneyMethod: {},
  transfer: {},
  budget: {},
  checkin: {}, // Legacy/reserved compatibility only.
  calendarCategory: {},
  direction: { description: "", icon: "", colorToken: "", active: true, sortOrder: 0 },
  project: {},
  settings: {},
  conflict: {},
};

/** Only schema-v5 additions belong here. */
const v5Defaults: Record<EntityType, Record<string, unknown>> = {
  task: {},
  taskAction: {},
  plan: {},
  actual: {},
  inbox: {},
  routine: {},
  routineOccurrence: {},
  recurringActivityRule: {},
  routineFlow: {},
  routineRun: {},
  sleepRecord: {},
  conditionRecord: {},
  executionSession: {
    endedAt: null,
    status: "running",
    suggestedMinutes: null,
    directionId: null,
    actualId: null,
    outcome: null,
  },
  transaction: {},
  moneyCategory: {},
  moneyMethod: {},
  transfer: {},
  budget: {},
  checkin: {}, // Legacy/reserved compatibility only.
  calendarCategory: {},
  direction: {},
  project: {},
  settings: {
    guidanceIntensity: "strong",
    transitionBufferMinutes: 10,
    departureSafetyBufferMinutes: 10,
    targetSleepTime: "23:30",
    windDownMinutes: 45,
  },
  conflict: {},
};

/** Only schema-v6 additions belong here. */
const v6Defaults: Record<EntityType, Record<string, unknown>> = {
  task: {},
  taskAction: {},
  plan: {
    source: null,
    generationState: null,
    recurringRuleId: null,
    recurrenceKey: null,
    futureBlockDirectionId: null,
    protection: null,
  },
  actual: {},
  inbox: {},
  routine: {},
  routineOccurrence: {},
  recurringActivityRule: {},
  routineFlow: {},
  routineRun: {},
  sleepRecord: {},
  conditionRecord: {},
  executionSession: { outcome: null },
  transaction: {},
  moneyCategory: {},
  moneyMethod: {},
  transfer: {},
  budget: {},
  checkin: {}, // Legacy/reserved compatibility only.
  calendarCategory: {},
  direction: {},
  project: {},
  settings: {
    fallbackWakeTime: "08:00",
    wakeWindowMinutes: 180,
    notificationsEnabled: false,
    wakeNotifications: true,
    anchorNotifications: true,
    departureNotifications: true,
    executionNotifications: true,
    windDownNotifications: true,
    directionPolicies: {
      direction_academic: { level: "weak", maxGapDays: 7, targetMinutes: 60 },
      direction_specialty: { level: "strong", maxGapDays: 7, targetMinutes: 120 },
      direction_career: { level: "strong", maxGapDays: 7, targetMinutes: 60 },
      direction_life: { level: "off" },
      direction_world: { level: "off" },
    },
  },
  conflict: {},
};

/** Only schema-v7 additions belong here. */
const v7Defaults: Record<EntityType, Record<string, unknown>> = {
  task: {},
  taskAction: {
    status: "todo", sortOrder: 0, estimatedMinutes: null, minimumUsefulMinutes: null,
    contexts: [], energyLevel: null, interruptible: true, setupCost: null, completedAt: null,
  },
  plan: { taskActionId: null },
  actual: { taskActionId: null },
  inbox: {},
  routine: {},
  routineOccurrence: {},
  recurringActivityRule: {},
  routineFlow: {},
  routineRun: {},
  sleepRecord: {},
  conditionRecord: { startAssist: null, recoveryRequest: null },
  executionSession: { taskActionId: null },
  transaction: { categoryId: null, moneyMethodId: null, transferId: null },
  moneyCategory: { appliesTo: "both", sortOrder: 0, archived: false, systemKey: null },
  moneyMethod: { sortOrder: 0, archived: false },
  transfer: { note: "", feeAmount: 0, feeTransactionId: null },
  budget: { period: "month", active: true },
  checkin: {},
  calendarCategory: {},
  direction: {},
  project: {},
  settings: { defaultCalendarCategoryId: null },
  conflict: {},
};

export const FALLBACK_CALENDAR_CATEGORY_ID = "calendar_category_other";
export const MONEY_OTHER_CATEGORY_ID = "money_category_other";
export const MONEY_TRANSFER_FEE_CATEGORY_ID = "money_category_transfer_fee";
export const DEFAULT_MONEY_METHODS = [
  { id: "money_method_cash", name: "現金" },
  { id: "money_method_bank", name: "銀行" },
  { id: "money_method_card", name: "カード" },
] as const;

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

export const DEFAULT_MORNING_FLOW_ID = "routine_flow_morning_default";
export const DEFAULT_MORNING_FLOW = {
  name: "朝の支度",
  trigger: { type: "afterWake" as const },
  active: true,
  steps: [
    { id: "wash-face", title: "顔を洗う", executionMode: "checkOnly" as const, estimatedMinutes: 3 },
    { id: "breakfast", title: "朝食", executionMode: "softTimer" as const, estimatedMinutes: 15 },
    { id: "change-clothes", title: "着替える", executionMode: "checkOnly" as const, estimatedMinutes: 5 },
    { id: "makeup", title: "メイク", executionMode: "pacedTimer" as const, estimatedMinutes: 12 },
    { id: "brush-teeth", title: "歯磨き", executionMode: "checkOnly" as const, estimatedMinutes: 3 },
    {
      id: "belongings",
      title: "持ち物確認",
      executionMode: "checklist" as const,
      estimatedMinutes: 2,
      checklistItems: [
        { id: "phone", title: "スマホ" },
        { id: "wallet", title: "財布" },
        { id: "keys", title: "鍵" },
      ],
    },
  ],
};

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
  if (entity.schemaVersion === 4) {
    entity = {
      ...entity,
      payload: { ...v5Defaults[entity.type], ...entity.payload },
      schemaVersion: 5,
    };
  }
  if (entity.schemaVersion === 5) {
    entity = {
      ...entity,
      payload: { ...v6Defaults[entity.type], ...entity.payload },
      schemaVersion: 6,
    };
  }
  if (entity.schemaVersion === 6) {
    entity = {
      ...entity,
      payload: { ...v7Defaults[entity.type], ...entity.payload },
      schemaVersion: 7,
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

export function ensureDefaultMorningFlow(entities: CoreEntity[], metadata: DirectionMetadata = {}) {
  const stable = entities.find((entity) => entity.id === DEFAULT_MORNING_FLOW_ID);
  if (stable && stable.type !== "routineFlow") {
    throw new Error(`migration_id_collision:${DEFAULT_MORNING_FLOW_ID}`);
  }
  if (entities.some((entity) => entity.type === "routineFlow")) return entities;
  const now = metadata.now || "1970-01-01T00:00:00.000Z";
  return [
    ...entities,
    {
      id: DEFAULT_MORNING_FLOW_ID,
      type: "routineFlow" as const,
      payload: structuredClone(DEFAULT_MORNING_FLOW),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: metadata.updatedBy || "migration:schema-v5",
      deletedAt: null,
    },
  ];
}

const migrationEntity = (
  id: string,
  type: EntityType,
  payload: Record<string, unknown>,
  metadata: DirectionMetadata,
): CoreEntity => {
  const now = metadata.now || "1970-01-01T00:00:00.000Z";
  return {
    id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision: 1,
    createdAt: now, updatedAt: now, updatedBy: metadata.updatedBy || "migration:schema-v7", deletedAt: null,
  };
};

const assertStableType = (entities: CoreEntity[], id: string, type: EntityType) => {
  const collision = entities.find(entity => entity.id === id && entity.type !== type);
  if (collision) throw new Error(`migration_id_collision:${id}`);
};

/** v7 makes every schedulable Plan and recurring rule category-explicit. */
export function ensureCalendarCategoryDefaults(entities: CoreEntity[], metadata: DirectionMetadata = {}) {
  let result = [...entities];
  assertStableType(result, FALLBACK_CALENDAR_CATEGORY_ID, "calendarCategory");
  if (!result.some(entity => entity.id === FALLBACK_CALENDAR_CATEGORY_ID)) {
    result.push(migrationEntity(FALLBACK_CALENDAR_CATEGORY_ID, "calendarCategory", {
      name: "その他", colorToken: "#b9aab6", icon: "", sortOrder: 999, archived: false,
    }, metadata));
  }
  result = result.map(entity => {
    if ((entity.type === "plan" || entity.type === "recurringActivityRule") && !entity.payload.calendarCategoryId)
      return { ...entity, payload: { ...entity.payload, calendarCategoryId: FALLBACK_CALENDAR_CATEGORY_ID } };
    if (entity.type === "settings" && !entity.payload.defaultCalendarCategoryId)
      return { ...entity, payload: { ...entity.payload, defaultCalendarCategoryId: FALLBACK_CALENDAR_CATEGORY_ID } };
    return entity;
  });
  return result;
}

/** Preserve legacy nextAction while creating its first-class equivalent once. */
export function ensureLegacyTaskActions(entities: CoreEntity[], metadata: DirectionMetadata = {}) {
  const result = [...entities];
  for (const task of result.filter(entity => entity.type === "task" && !entity.deletedAt)) {
    const next = task.payload.nextAction as Record<string, unknown> | null | undefined;
    if (!next || typeof next.title !== "string" || !next.title.trim()) continue;
    if (result.some(entity => entity.type === "taskAction" && entity.payload.taskId === task.id)) continue;
    const id = `task_action_${task.id}_legacy`;
    assertStableType(result, id, "taskAction");
    result.push(migrationEntity(id, "taskAction", {
      taskId: task.id, title: next.title.trim(), status: "todo", sortOrder: 0,
      estimatedMinutes: next.estimatedMinutes ?? null,
      minimumUsefulMinutes: next.minimumUsefulMinutes ?? null,
      contexts: Array.isArray(next.contexts) ? next.contexts : [],
      energyLevel: next.energyLevel ?? null, interruptible: next.interruptible ?? true,
      setupCost: next.setupCost ?? null, completedAt: null,
    }, metadata));
  }
  return result;
}

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.codePointAt(0) || 0; hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
};

/** Turn legacy free-text money categories into canonical entities and references. */
export function ensureMoneyDefaults(entities: CoreEntity[], metadata: DirectionMetadata = {}) {
  let result = [...entities];
  const categoryDefinitions = [
    { id: MONEY_OTHER_CATEGORY_ID, name: "その他", systemKey: "other", sortOrder: 998 },
    { id: MONEY_TRANSFER_FEE_CATEGORY_ID, name: "振替手数料", systemKey: "transferFee", sortOrder: 999 },
  ];
  for (const definition of categoryDefinitions) {
    assertStableType(result, definition.id, "moneyCategory");
    if (!result.some(entity => entity.id === definition.id)) result.push(migrationEntity(definition.id, "moneyCategory", {
      name: definition.name, appliesTo: "expense", sortOrder: definition.sortOrder,
      archived: false, systemKey: definition.systemKey,
    }, metadata));
  }
  const names = [...new Set(result.filter(entity => entity.type === "transaction")
    .map(entity => String(entity.payload.category || "その他").trim() || "その他"))];
  for (const name of names) {
    if (result.some(entity => entity.type === "moneyCategory" && entity.payload.name === name)) continue;
    const id = `money_category_${stableHash(name)}`;
    assertStableType(result, id, "moneyCategory");
    result.push(migrationEntity(id, "moneyCategory", {
      name, appliesTo: "both", sortOrder: result.filter(entity => entity.type === "moneyCategory").length,
      archived: false, systemKey: null,
    }, metadata));
  }
  for (const [index, method] of DEFAULT_MONEY_METHODS.entries()) {
    assertStableType(result, method.id, "moneyMethod");
    if (!result.some(entity => entity.id === method.id)) result.push(migrationEntity(method.id, "moneyMethod", {
      name: method.name, sortOrder: index, archived: false,
    }, metadata));
  }
  result = result.map(entity => {
    if (entity.type !== "transaction" || entity.payload.categoryId) return entity;
    const name = String(entity.payload.category || "その他").trim() || "その他";
    const category = result.find(candidate => candidate.type === "moneyCategory" && candidate.payload.name === name);
    return { ...entity, payload: { ...entity.payload, categoryId: category?.id || MONEY_OTHER_CATEGORY_ID } };
  });
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
  const initialized = ensureMoneyDefaults(
    ensureLegacyTaskActions(ensureCalendarCategoryDefaults(ensureDefaultDirections(migrated, metadata), metadata), metadata),
    metadata,
  );
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
  const sourceById = new Map(source.map(entity => [entity.id, entity]));
  const hasPayloadChanges = entities.some(entity => {
    const original = sourceById.get(entity.id);
    return Boolean(original && JSON.stringify(original.payload) !== JSON.stringify(entity.payload));
  });
  const requiresWrite = hasSchemaChanges || hasPayloadChanges || addedEntities.length > 0;
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
