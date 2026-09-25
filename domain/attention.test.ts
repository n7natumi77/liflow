import assert from "node:assert/strict";
import test from "node:test";
import { deriveAttentionCandidates, reconcileAttentions } from "./attention.ts";
import type { AttentionData, CoreEntity, EntityType } from "./core.ts";
import { CURRENT_SCHEMA_VERSION } from "./schema.ts";

const entity = (id: string, type: EntityType, payload: Record<string, unknown>, revision = 1): CoreEntity => ({ id, type, payload, schemaVersion: CURRENT_SCHEMA_VERSION, revision, createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z", updatedBy: "test", deletedAt: null });
const now = new Date("2026-09-25T12:00:00+09:00");
const settings = entity("settings", "settings", { dayStart: "07:00", dayEnd: "23:00", directionStaleDays: 3, directionPolicies: { direction_academic: { level: "strong" } } });

test("Attention separates stale Direction, same-day missing Actual, planning gap and Task deadline", () => {
  const source = [settings, entity("direction_academic", "direction", { name: "研究", active: true, sortOrder: 0 }),
    entity("plan", "plan", { title: "授業", startAt: "2026-09-25T09:00:00+09:00", endAt: "2026-09-25T10:00:00+09:00", allDay: false, type: "task", resolution: null }),
    entity("task", "task", { title: "提出", status: "open", deadline: "2026-09-28T23:59:00+09:00", attentionLeadDays: 7 })];
  const kinds = deriveAttentionCandidates(source, now).map(item => item.kind);
  assert.ok(kinds.includes("directionStale")); assert.ok(kinds.includes("actualMissing")); assert.ok(kinds.includes("planningGap")); assert.ok(kinds.includes("taskDeadline"));
});

test("overlapping Plans never create an overlap Attention and planned minutes are merged", () => {
  const source = [settings,
    entity("a", "plan", { title: "A", startAt: "2026-09-26T09:00:00+09:00", endAt: "2026-09-26T13:00:00+09:00", allDay: false, type: "personal", resolution: null }),
    entity("b", "plan", { title: "B", startAt: "2026-09-26T10:00:00+09:00", endAt: "2026-09-26T14:00:00+09:00", allDay: false, type: "personal", resolution: null })];
  const result = deriveAttentionCandidates(source, now);
  assert.equal(result.some(item => String(item.kind).toLowerCase().includes("overlap")), false);
  const gap = result.find(item => item.kind === "planningGap" && item.targetDate === "2026-09-26");
  assert.equal(gap?.metadata?.plannedMinutes, 300);
});

test("ignored Attention is not regenerated until its state changes", () => {
  const source = [settings, entity("task", "task", { title: "提出", status: "open", deadline: "2026-09-28T23:59:00+09:00", attentionLeadDays: 7 })];
  const candidate = deriveAttentionCandidates(source, now).find(item => item.kind === "taskDeadline")!;
  const ignored = entity("attention", "attention", { ...candidate, status: "ignored", ignoredAt: now.toISOString(), resolvedAt: null } satisfies AttentionData) as CoreEntity<AttentionData>;
  assert.equal(reconcileAttentions([...source, ignored], now).some(item => item.kind === "update" && item.entity.id === ignored.id), false);
  const changed = source.map(item => item.id === "task" ? entity("task", "task", { ...item.payload, deadline: "2026-09-27T23:59:00+09:00" }, 2) : item);
  assert.equal(reconcileAttentions([...changed, ignored], now).some(item => item.kind === "update" && item.entity.id === ignored.id), true);
});

test("missing Actual Attention expires after the Liflow day end", () => {
  const plan = entity("plan", "plan", { title: "授業", startAt: "2026-09-25T09:00:00+09:00", endAt: "2026-09-25T10:00:00+09:00", allDay: false, type: "task", resolution: null });
  assert.equal(deriveAttentionCandidates([settings, plan], new Date("2026-09-25T22:00:00+09:00")).some(item => item.kind === "actualMissing"), true);
  assert.equal(deriveAttentionCandidates([settings, plan], new Date("2026-09-25T23:30:00+09:00")).some(item => item.kind === "actualMissing"), false);
});
