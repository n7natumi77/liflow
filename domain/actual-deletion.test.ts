import assert from "node:assert/strict";
import test from "node:test";
import { prepareActualDeletion } from "./actual-deletion.ts";
import type { ActualData, CoreEntity, PlanData, TransactionData } from "./core.ts";

const base = { schemaVersion: 7, revision: 2, createdAt: "old", updatedAt: "old", updatedBy: "old", deletedAt: null };
const actual = { ...base, id: "actual", type: "actual", payload: { title: "作業", startAt: "a", endAt: "b", type: "task", planId: "plan", taskId: "task" } } as CoreEntity<ActualData>;
const plan = { ...base, id: "plan", type: "plan", payload: { title: "作業", startAt: "a", endAt: "b", type: "task", actualId: "actual", taskId: "task", resolution: null } } as CoreEntity<PlanData>;
const money = { ...base, id: "money", type: "transaction", payload: { title: "交通費", amount: 100, direction: "expense", category: "交通費", occurredAt: "a", status: "settled", actualId: "actual" } } as CoreEntity<TransactionData>;

test("Actual deletion tombstones only Actual and safely unlinks retained Plan and Money", () => {
  const result = prepareActualDeletion(actual, plan, [money], "now", "device");
  assert.equal(result.deletedActual.deletedAt, "now");
  assert.equal(result.unlinkedPlan?.deletedAt, null);
  assert.equal(result.unlinkedPlan?.payload.actualId, null);
  assert.equal(result.unlinkedPlan?.payload.resolution, null);
  assert.equal(result.unlinkedTransactions[0].deletedAt, null);
  assert.equal(result.unlinkedTransactions[0].payload.actualId, null);
  assert.equal(result.deletedActual.payload.taskId, "task");
});
