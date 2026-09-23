import type { CalendarCategoryData, CoreEntity, PlanData, TaskData } from "../domain/core";
import { dateKey, dayRange } from "./diary-time.ts";

export function weekDates(date: Date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(day.getDate() + index); return day; });
}
export const categoryColor = (id: string | null | undefined, categories: CoreEntity<CalendarCategoryData>[]) => categories.find(c => c.id === id)?.payload.colorToken || "#b9aab6";
export type MonthEntry = { entity: CoreEntity<PlanData | TaskData>; kind: "period" | "allDay" | "plan" | "deadline"; time: string };
export function monthEntries(date: Date, plans: CoreEntity<PlanData>[], tasks: CoreEntity<TaskData>[]): MonthEntry[] {
  const items: MonthEntry[] = plans.filter(p => !p.payload.resolution && dayRange(p.payload.startAt, p.payload.endAt, date)).map(p => ({
    entity: p, kind: p.payload.type === "container" ? "period" : p.payload.allDay ? "allDay" : "plan", time: p.payload.startAt,
  }));
  for (const task of tasks) if (["open", "inbox"].includes(task.payload.status) && task.payload.deadline && dateKey(new Date(task.payload.deadline)) === dateKey(date)) items.push({ entity: task, kind: "deadline", time: task.payload.deadline });
  const order = { period: 0, allDay: 1, deadline: 2, plan: 3 };
  return items.sort((a, b) => order[a.kind] - order[b.kind] || a.time.localeCompare(b.time));
}
