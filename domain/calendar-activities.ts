import { active, type ActualData, type CoreEntity, type ExecutionSessionData, type PlanData } from "./core.ts";

export type ActivitySegment = { id: string; startAt: string; endAt: string; running?: boolean };
export type CalendarActivity = {
  id: string;
  title: string;
  plan: CoreEntity<PlanData> | null;
  actuals: CoreEntity<ActualData>[];
  segments: ActivitySegment[];
  startAt: string;
  endAt: string;
  calendarCategoryId: string | null;
};

/** Group only by the canonical Actual.planId relation. Titles and Task IDs never merge activities. */
export function calendarActivities(entities: CoreEntity[], now = new Date()): CalendarActivity[] {
  const plans = active<PlanData>(entities, "plan");
  const actuals = active<ActualData>(entities, "actual");
  const sessions = active<ExecutionSessionData>(entities, "executionSession").filter(session => session.payload.status === "running");
  const result: CalendarActivity[] = [];
  for (const plan of plans) {
    const linked = actuals.filter(actual => actual.payload.planId === plan.id);
    const running = sessions.filter(session => session.payload.planId === plan.id);
    const segments: ActivitySegment[] = [
      ...linked.map(actual => ({ id: actual.id, startAt: actual.payload.startAt, endAt: actual.payload.endAt })),
      ...running.map(session => ({ id: session.id, startAt: session.payload.startedAt, endAt: now.toISOString(), running: true })),
    ].filter(segment => Date.parse(segment.endAt) > Date.parse(segment.startAt));
    result.push({
      id: `plan:${plan.id}`, title: plan.payload.title, plan, actuals: linked, segments,
      startAt: [plan.payload.startAt, ...segments.map(segment => segment.startAt)].sort()[0],
      endAt: [plan.payload.endAt, ...segments.map(segment => segment.endAt)].sort().at(-1) || plan.payload.endAt,
      calendarCategoryId: plan.payload.calendarCategoryId || null,
    });
  }
  for (const actual of actuals.filter(item => !item.payload.planId || !plans.some(plan => plan.id === item.payload.planId))) {
    result.push({
      id: `actual:${actual.id}`, title: actual.payload.title, plan: null, actuals: [actual],
      segments: [{ id: actual.id, startAt: actual.payload.startAt, endAt: actual.payload.endAt }],
      startAt: actual.payload.startAt, endAt: actual.payload.endAt,
      calendarCategoryId: actual.payload.calendarCategoryId || null,
    });
  }
  for (const session of sessions.filter(item => !item.payload.planId)) {
    const endAt = now.toISOString();
    if (Date.parse(endAt) <= Date.parse(session.payload.startedAt)) continue;
    result.push({
      id: `session:${session.id}`, title: session.payload.title, plan: null, actuals: [],
      segments: [{ id: session.id, startAt: session.payload.startedAt, endAt, running: true }],
      startAt: session.payload.startedAt, endAt, calendarCategoryId: null,
    });
  }
  return result;
}

