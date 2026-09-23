import type { CoreEntity, PlanData } from "../domain/core.ts";
export const pad = (value: number) => String(value).padStart(2, "0");
export const dateKey = (date: Date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
export const minuteLabel = (minute: number) => pad(Math.floor(minute / 60)) + ":" + pad(minute % 60);
export function dayBounds(date: Date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start, end };
}
export function dayRange(startAt: string, endAt: string, date: Date) {
  const { start, end } = dayBounds(date), from = new Date(startAt), to = new Date(endAt);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from || from >= end || to <= start) return null;
  return { start: from < start ? 0 : from.getHours() * 60 + from.getMinutes(), end: to >= end ? 1440 : to.getHours() * 60 + to.getMinutes() };
}
export function scheduledPlans(plans: CoreEntity<PlanData>[]) {
  return plans.filter(plan => !plan.payload.resolution && !plan.payload.allDay && plan.payload.type !== "container");
}
export function freeRanges(plans: CoreEntity<PlanData>[], date: Date, start = 0, end = 1440) {
  const intervals = scheduledPlans(plans).map(plan => dayRange(plan.payload.startAt, plan.payload.endAt, date))
    .filter((range): range is { start: number; end: number } => range !== null).sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let cursor = start;
  for (const range of intervals) {
    if (range.start > cursor) gaps.push({ start: cursor, end: Math.min(end, range.start) });
    cursor = Math.max(cursor, range.end);
    if (cursor >= end) break;
  }
  if (cursor < end) gaps.push({ start: cursor, end });
  return gaps.filter(range => range.end > range.start);
}
export function movedRange(start: number, end: number, delta: number, resize = false) {
  const snap = Math.round(delta / 15) * 15;
  if (resize) return { start, end: Math.min(1440, Math.max(start + Math.min(15, 1440 - start), end + snap)) };
  const duration = end - start, next = Math.max(0, Math.min(1440 - duration, start + snap));
  return { start: next, end: next + duration };
}
export function isoAtMinute(date: Date, minute: number) {
  const value = new Date(date); value.setHours(0, minute, 0, 0); return value.toISOString();
}
