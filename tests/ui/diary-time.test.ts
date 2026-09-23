import assert from "node:assert/strict";
import test from "node:test";
import { dayRange, freeRanges, isoAtMinute, movedRange } from "../../app/diary-time.ts";
import type { CoreEntity, PlanData } from "../../domain/core.ts";
import type { TaskData } from "../../domain/core.ts";
import { monthEntries, weekDates } from "../../app/calendar-overview.ts";
const date = new Date(2026, 8, 16);
const plan = (start: number, end: number, extra: Partial<PlanData> = {}) => ({ payload: { startAt: isoAtMinute(date, start), endAt: isoAtMinute(date, end), ...extra } }) as CoreEntity<PlanData>;
test("day clips overnight ranges without losing the next-day segment", () => {
  assert.deepEqual(dayRange(isoAtMinute(date, -60), isoAtMinute(date, 60), date), { start: 0, end: 60 });
  assert.deepEqual(dayRange(isoAtMinute(date, 1380), isoAtMinute(date, 1500), date), { start: 1380, end: 1440 });
  assert.equal(dayRange(isoAtMinute(date, -120), isoAtMinute(date, 0), date), null);
});
test("free ranges merge overlap and ignore all-day, container and resolved plans", () => {
  const plans = [plan(540, 600), plan(570, 630), plan(0, 1440, { allDay: true }), plan(0, 1440, { type: "container" }), plan(630, 660, { resolution: "cancelled" })];
  assert.deepEqual(freeRanges(plans, date, 480, 720), [{ start: 480, end: 540 }, { start: 630, end: 720 }]);
});
test("drag preserves duration, snaps to 15 minutes, and clamps to the day", () => {
  assert.deepEqual(movedRange(540, 600, 19), { start: 555, end: 615 });
  assert.deepEqual(movedRange(30, 90, -90), { start: 0, end: 60 });
  assert.deepEqual(movedRange(1380, 1440, 60), { start: 1380, end: 1440 });
});
test("resize keeps start, enforces positive duration and accepts midnight", () => {
  assert.deepEqual(movedRange(540, 600, -120, true), { start: 540, end: 555 });
  assert.deepEqual(movedRange(1380, 1425, 60, true), { start: 1380, end: 1440 });
  assert.equal(new Date(isoAtMinute(date, 1440)).getDate(), 17);
});

test("resizing a final-minute plan never goes beyond midnight", () => { assert.deepEqual(movedRange(1439, 1440, 15, true), { start: 1439, end: 1440 }); });

test("week stays Monday through Sunday across a year boundary", () => {
  const days = weekDates(new Date(2027, 0, 1));
  assert.equal(days[0].getFullYear(), 2026);
  assert.equal(days[0].getDate(), 28);
  assert.equal(days[6].getFullYear(), 2027);
  assert.equal(days[6].getDate(), 3);
  assert.deepEqual(days.map(day => day.getDay()), [1, 2, 3, 4, 5, 6, 0]);
});
test("month includes continuing periods and overnight plans, with exclusive end dates", () => {
  const period = plan(-1440, 1440, { type: "container" });
  const overnight = plan(-60, 60), ended = plan(-1440, 0), cancelled = plan(600, 660, { resolution: "cancelled" });
  const items = monthEntries(date, [period, overnight, ended, cancelled], []);
  assert.equal(items.length, 2);
  assert.equal(items[0].kind, "period");
  assert.equal(items[1].entity, overnight);
});
test("month combines deadlines with plans before calculating overflow", () => {
  const task = (status: TaskData["status"]) => ({ payload: { title: "締切", status, deadline: isoAtMinute(date, 1380) } }) as CoreEntity<TaskData>;
  const items = monthEntries(date, [plan(600, 660)], [task("open"), task("open"), task("open"), task("completed"), task("cancelled")]);
  assert.equal(items.length, 4);
  assert.deepEqual(items.slice(0, 3).map(entry => entry.kind), ["deadline", "deadline", "deadline"]);
  assert.equal(items.length - items.slice(0, 3).length, 1);
});
