export const ENTITY_TYPES = [
  "task",
  "taskAction",
  "plan",
  "actual",
  "inbox",
  "routine",
  "routineOccurrence",
  "recurringActivityRule",
  "routineFlow",
  "routineRun",
  "sleepRecord",
  "conditionRecord",
  "executionSession",
  "transaction",
  "moneyCategory",
  "moneyMethod",
  "transfer",
  "budget",
  "checkin",
  "calendarCategory",
  "direction",
  "project",
  "settings",
  "conflict",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type CoreEntity<T = Record<string, unknown>> = {
  id: string;
  type: EntityType;
  payload: T;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
};

export type NextActionData = {
  title: string;
  estimatedMinutes?: number | null;
  minimumUsefulMinutes?: number | null;
  contexts?: string[];
  energyLevel?: "low" | "medium" | "high" | null;
  interruptible?: boolean;
  setupCost?: number | null;
  generatedBy?: "manual" | "ai";
};

export type TaskData = {
  title: string;
  description?: string;
  deadline?: string | null;
  estimateMinutes?: number | null;
  estimatedRemainingMinutes?: number | null;
  nextAction?: NextActionData | null;
  directionId?: string | null;
  /** Legacy organization link. New vNext core logic must not require it. */
  projectId?: string | null;
  /** Legacy hierarchy link. New vNext core logic must not require it. */
  parentTaskId?: string | null;
  calendarCategoryId?: string | null;
  status: "inbox" | "open" | "completed" | "cancelled";
  completedAt?: string | null;
};

export type TaskActionData = {
  taskId: string;
  title: string;
  status: "todo" | "done" | "skipped";
  sortOrder: number;
  estimatedMinutes?: number | null;
  minimumUsefulMinutes?: number | null;
  contexts?: string[];
  energyLevel?: "low" | "medium" | "high" | null;
  interruptible?: boolean;
  setupCost?: number | null;
  completedAt?: string | null;
};

export type PlanResolution = "cancelled" | "postponed" | "unneeded" | "skipped";
export type PlanData = {
  title: string;
  taskId?: string | null;
  taskActionId?: string | null;
  /** Legacy organization link. */
  projectId?: string | null;
  calendarCategoryId?: string | null;
  directionId?: string | null;
  startAt: string;
  endAt: string;
  type: "task" | "appointment" | "travel" | "rest" | "sleep" | "personal" | "container";
  flexibility: "fixed" | "flexible";
  allDay: boolean;
  /**
   * Legacy compatibility pointer. ActualData.planId is the canonical relation in
   * schema v4 and new code must not assume this identifies the only Actual.
   */
  actualId?: string | null;
  resolution?: PlanResolution | null;
  rescheduledFromPlanId?: string | null;
  rescheduledToPlanId?: string | null;
  /** Phase 2 automation provenance. Manual Plans leave this unset. */
  source?: "recurring" | "futureBlock" | null;
  generationState?: "generated" | "overridden" | "cancelled" | null;
  recurringRuleId?: string | null;
  recurrenceKey?: string | null;
  futureBlockDirectionId?: string | null;
  protection?: "soft" | null;
};

export type ActualData = {
  title: string;
  taskId?: string | null;
  taskActionId?: string | null;
  /** Canonical schema-v4 relation. Multiple Actuals may point to one Plan. */
  planId?: string | null;
  /** Legacy organization link. */
  projectId?: string | null;
  calendarCategoryId?: string | null;
  directionId?: string | null;
  startAt: string;
  endAt: string;
  type: string;
  note?: string;
};

export type InboxData = { text: string; sorted: boolean };
export type CalendarCategoryData = {
  name: string;
  colorToken: string;
  icon?: string;
  sortOrder: number;
  archived: boolean;
};
export type DirectionData = {
  name: string;
  description?: string;
  icon?: string;
  colorToken?: string;
  active: boolean;
  sortOrder: number;
};
export type ProjectData = {
  name: string;
  description?: string;
  calendarCategoryId?: string | null;
  parentProjectId?: string | null;
  status: "active" | "completed" | "archived";
};

export type ScheduleRule = {
  kind: "daily" | "weekdays" | "weekends" | "weekly";
  weekdays?: number[];
};
export type RoutineData = {
  title: string;
  description?: string;
  calendarCategoryId?: string | null;
  scheduleRule: ScheduleRule;
  preferredTime?: string | null;
  expectedDuration?: number | null;
  active: boolean;
};
export type RoutineOccurrenceData = {
  routineId: string;
  date: string;
  status: "pending" | "done" | "skipped" | "unknown";
  actualId?: string | null;
};

/** A recurring rule creates Plans; it is deliberately separate from RoutineFlow. */
export type RecurringActivityRuleData = {
  title: string;
  active: boolean;
  scheduleRule: ScheduleRule;
  startTime: string;
  durationMinutes: number;
  taskId?: string | null;
  calendarCategoryId?: string | null;
  directionId?: string | null;
  planType?: PlanData["type"];
  flexibility?: PlanData["flexibility"];
};

export type RoutineFlowTriggerType =
  | "afterWake"
  | "beforeDeparture"
  | "afterReturnHome"
  | "beforeSleep"
  | "manual";
export type RoutineFlowStep = {
  id: string;
  title: string;
  executionMode: "automatic" | "checkOnly" | "softTimer" | "pacedTimer" | "checklist";
  estimatedMinutes?: number | null;
  condition?: Record<string, unknown> | null;
  checklistItems?: { id: string; title: string }[];
};
export type RoutineFlowData = {
  name: string;
  trigger: { type: RoutineFlowTriggerType };
  active: boolean;
  steps: RoutineFlowStep[];
};
export type RoutineRunData = {
  routineFlowId: string;
  startedAt: string;
  endedAt?: string | null;
  status?: "running" | "completed" | "cancelled";
  stepResults: {
    stepId: string;
    startedAt?: string | null;
    endedAt?: string | null;
    status: "completed" | "skipped" | "pending";
    checkedItemIds?: string[];
  }[];
};

export type ObservationSource = "manual" | "notification" | "screenTime" | "health";
export type SleepRecordData = {
  date: string;
  plannedSleepAt?: string | null;
  plannedWakeAt?: string | null;
  estimatedSleepAt?: string | null;
  actualWakeAt?: string | null;
  source: ObservationSource;
  confidence?: number | null;
};
export type ConditionRecordData = {
  recordedAt: string;
  date?: string;
  energyLevel?: "low" | "medium" | "high" | null;
  fatigue?: number | null;
  mood?: number | null;
  note?: string;
  source: ObservationSource;
  confidence?: number | null;
  /** A factual Now mismatch observation. It never changes Task urgency by itself. */
  startAssist?: {
    reason: "occupied" | "contextUnavailable" | "blocked" | "insufficientWindow";
    targetId?: string | null;
    targetKind?: "task" | "plan" | null;
    usableMinutes?: number | null;
    /** Expiry is reason-specific; resolvedAt is the explicit manual restore. */
    expiresAt?: string | null;
    resolvedAt?: string | null;
    windowKey?: string | null;
  } | null;
  /** A short, explicit request for recovery. It is not a half-day fatigue score. */
  recoveryRequest?: {
    requestedAt: string;
    expiresAt: string;
    resolvedAt?: string | null;
  } | null;
};

export type ExecutionOutcome = "activityCompleted" | "paused";
export type ExecutionSessionData = {
  targetKind: "task" | "plan";
  taskId?: string | null;
  taskActionId?: string | null;
  planId?: string | null;
  title: string;
  startedAt: string;
  endedAt?: string | null;
  status: "running" | "completed" | "cancelled";
  suggestedMinutes?: number | null;
  directionId?: string | null;
  actualId?: string | null;
  /** Explicit Activity lifecycle result. An Actual alone never implies completion. */
  outcome?: ExecutionOutcome | null;
};

export type TransactionData = {
  title: string;
  amount: number;
  direction: "income" | "expense";
  category: string;
  categoryId?: string | null;
  moneyMethodId?: string | null;
  transferId?: string | null;
  occurredAt: string;
  expectedAt?: string | null;
  status: "expected" | "settled";
  planId?: string | null;
  actualId?: string | null;
  taskId?: string | null;
  projectId?: string | null;
  note?: string;
};
export type MoneyCategoryData = {
  name: string;
  appliesTo: "expense" | "income" | "both";
  sortOrder: number;
  archived: boolean;
  systemKey?: "other" | "transferFee" | null;
};
export type MoneyMethodData = {
  name: string;
  sortOrder: number;
  archived: boolean;
};
export type TransferData = {
  amount: number;
  sourceMethodId: string;
  destinationMethodId: string;
  occurredAt: string;
  note?: string;
  feeAmount?: number;
  feeTransactionId?: string | null;
};
export type BudgetData = {
  categoryId: string;
  period: "week" | "month";
  amount: number;
  active: boolean;
};
export type SettingsData = {
  calendarView: "day" | "week" | "month";
  visibleCalendarCategories: string[];
  showPlan: boolean;
  showActual: boolean;
  showTaskDeadlines: boolean;
  defaultCalendarCategoryId?: string | null;
  dayStart?: string;
  dayEnd?: string;
  guidanceIntensity?: "strong" | "balanced" | "light";
  transitionBufferMinutes?: number;
  departureSafetyBufferMinutes?: number;
  targetSleepTime?: string | null;
  windDownMinutes?: number;
  fallbackWakeTime?: string | null;
  wakeWindowMinutes?: number;
  notificationsEnabled?: boolean;
  wakeNotifications?: boolean;
  anchorNotifications?: boolean;
  departureNotifications?: boolean;
  executionNotifications?: boolean;
  windDownNotifications?: boolean;
  directionPolicies?: Record<
    string,
    {
      level: "off" | "weak" | "strong";
      maxGapDays?: number;
      targetMinutes?: number;
    }
  >;
};
export type ConflictData = {
  targetId: string;
  targetType: EntityType;
  baseRevision: number;
  remoteRevision: number;
  localPayload: Record<string, unknown>;
  remotePayload: Record<string, unknown>;
  status: "open" | "resolved";
  choice?: "local" | "remote" | null;
  detectedAt: string;
  resolvedAt?: string | null;
};

export const active = <T>(entities: CoreEntity[], type: EntityType) =>
  entities.filter((entity) => entity.type === type && !entity.deletedAt) as CoreEntity<T>[];

export const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
  new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);

export const validTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
};

/** Canonical vNext category path: explicit -> linked Plan -> linked Task. */
export const inheritedCategory = (
  explicit?: string | null,
  plan?: string | null,
  task?: string | null,
) => explicit || plan || task || null;

/** Compatibility-only fallback for legacy viewers. New inputs must not use it. */
export const legacyInheritedCategory = (
  explicit?: string | null,
  plan?: string | null,
  task?: string | null,
  project?: string | null,
) => inheritedCategory(explicit, plan, task) || project || null;

/** Direction inheritance intentionally has no Project fallback. */
export const inheritedDirection = (
  explicit?: string | null,
  plan?: string | null,
  task?: string | null,
) => explicit || plan || task || null;

export const shiftedPlan = (plan: PlanData, days: number): PlanData => ({
  ...plan,
  startAt: new Date(new Date(plan.startAt).getTime() + days * 86400000).toISOString(),
  endAt: new Date(new Date(plan.endAt).getTime() + days * 86400000).toISOString(),
  resolution: null,
  rescheduledToPlanId: null,
});

export const actualsForPlan = (entities: CoreEntity[], planId: string) =>
  active<ActualData>(entities, "actual").filter((actual) => actual.payload.planId === planId);

export type PlanState = "unresolved" | "executed" | PlanResolution;
export function planState(plan: CoreEntity<PlanData>, actuals: CoreEntity<ActualData>[]): PlanState {
  if (plan.payload.resolution) return plan.payload.resolution;
  return actuals.some((actual) => !actual.deletedAt && actual.payload.planId === plan.id)
    ? "executed"
    : "unresolved";
}

export function layoutOverlaps<T extends { payload: { startAt: string; endAt: string } }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
  const result: { item: T; column: number; columns: number }[] = [];
  const cluster: number[] = [];
  let ends: number[] = [];
  let clusterEnd = -Infinity;
  const finish = () => {
    const columns = Math.max(1, ends.length);
    for (const index of cluster) result[index].columns = columns;
    cluster.length = 0;
    ends = [];
    clusterEnd = -Infinity;
  };
  for (const item of sorted) {
    const start = new Date(item.payload.startAt).getTime();
    const end = new Date(item.payload.endAt).getTime();
    if (cluster.length && start >= clusterEnd) finish();
    let column = ends.findIndex((value) => value <= start);
    if (column < 0) {
      column = ends.length;
      ends.push(end);
    } else ends[column] = end;
    result.push({ item, column, columns: 1 });
    cluster.push(result.length - 1);
    clusterEnd = Math.max(clusterEnd, end);
  }
  finish();
  return result;
}

export function wouldCreateCycle(
  id: string,
  parentId: string | null | undefined,
  parents: Map<string, string | null | undefined>,
) {
  let parent = parentId;
  const seen = new Set<string>();
  while (parent) {
    if (parent === id || seen.has(parent)) return true;
    seen.add(parent);
    parent = parents.get(parent);
  }
  return false;
}

export function routineOccurs(rule: ScheduleRule, date: Date) {
  const day = date.getDay();
  if (rule.kind === "daily") return true;
  if (rule.kind === "weekdays") return day >= 1 && day <= 5;
  if (rule.kind === "weekends") return day === 0 || day === 6;
  return (rule.weekdays || []).includes(day);
}

export function unresolved(entities: CoreEntity[], now = new Date()) {
  const plans = active<PlanData>(entities, "plan");
  const actuals = active<ActualData>(entities, "actual");
  const tasks = active<TaskData>(entities, "task");
  const inbox = active<InboxData>(entities, "inbox");
  const transactions = active<TransactionData>(entities, "transaction");
  const storedConflicts = active<ConflictData>(entities, "conflict");
  const items: { kind: "plan" | "task" | "inbox" | "conflict" | "transaction"; id: string; label: string }[] = [];

  for (const plan of plans) {
    if (new Date(plan.payload.endAt) < now && planState(plan, actuals) === "unresolved") {
      items.push({ kind: "plan", id: plan.id, label: `「${plan.payload.title}」はどうなった？` });
    }
  }
  const inSevenDays = new Date(now.getTime() + 7 * 86400000);
  for (const task of tasks) {
    if (
      task.payload.status === "open" &&
      task.payload.deadline &&
      new Date(task.payload.deadline) <= inSevenDays &&
      !plans.some((plan) => plan.payload.taskId === task.id && new Date(plan.payload.endAt) >= now)
    ) {
      items.push({ kind: "task", id: task.id, label: `「${task.payload.title}」をいつやる？` });
    }
  }
  for (const note of inbox) {
    if (!note.payload.sorted) items.push({ kind: "inbox", id: note.id, label: note.payload.text });
  }
  for (const conflict of storedConflicts) {
    if (conflict.payload.status === "open") {
      items.push({ kind: "conflict", id: conflict.id, label: "同期の競合を確認する" });
    }
  }
  const conflictPlans = plans.filter(
    (plan) =>
      !plan.payload.resolution &&
      !plan.payload.allDay &&
      plan.payload.type !== "container" &&
      validTimeRange(plan.payload.startAt, plan.payload.endAt) &&
      new Date(plan.payload.endAt) > now,
  );
  for (let first = 0; first < conflictPlans.length; first++) {
    for (let second = first + 1; second < conflictPlans.length; second++) {
      if (
        overlaps(
          conflictPlans[first].payload.startAt,
          conflictPlans[first].payload.endAt,
          conflictPlans[second].payload.startAt,
          conflictPlans[second].payload.endAt,
        )
      ) {
        items.push({
          kind: "conflict",
          id: `${conflictPlans[first].id}:${conflictPlans[second].id}`,
          label: `「${conflictPlans[first].payload.title}」と「${conflictPlans[second].payload.title}」の時間が重なっている`,
        });
      }
    }
  }
  for (const transaction of transactions) {
    if (
      transaction.payload.status === "expected" &&
      transaction.payload.expectedAt &&
      new Date(transaction.payload.expectedAt) < now
    ) {
      items.push({
        kind: "transaction",
        id: transaction.id,
        label: `「${transaction.payload.title}」の入出金を確認する`,
      });
    }
  }
  return items;
}

export function availableMinutes(
  plans: CoreEntity<PlanData>[],
  now: Date,
  dayEnd: string | number = "23:00",
) {
  const [hour, minute] = typeof dayEnd === "number" ? [dayEnd, 0] : dayEnd.split(":").map(Number);
  const end = new Date(now);
  end.setHours(Number.isFinite(hour) ? hour : 23, Number.isFinite(minute) ? minute : 0, 0, 0);
  if (now >= end) return 0;
  const ranges = plans
    .filter(
      (plan) =>
        !plan.payload.allDay &&
        plan.payload.type !== "container" &&
        validTimeRange(plan.payload.startAt, plan.payload.endAt) &&
        new Date(plan.payload.endAt) > now &&
        new Date(plan.payload.startAt) < end,
    )
    .map(
      (plan) =>
        [
          Math.max(now.getTime(), new Date(plan.payload.startAt).getTime()),
          Math.min(end.getTime(), new Date(plan.payload.endAt).getTime()),
        ] as [number, number],
    )
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const occupied = merged.reduce((sum, [start, finish]) => sum + finish - start, 0);
  return Math.max(0, Math.round((end.getTime() - now.getTime() - occupied) / 60000));
}
