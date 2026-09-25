import assert from "node:assert/strict";
import test from "node:test";
import type { BudgetData, CoreEntity, TransactionData } from "./core.ts";
import { budgetPace, filterTransactions } from "./money.ts";
import { readFileSync } from "node:fs";

const tx = (id: string, payload: Partial<TransactionData>): CoreEntity<TransactionData> => ({ id, type: "transaction", payload: { title: id, amount: 1000, direction: "expense", category: "食費", categoryId: "food", moneyMethodId: "cash", transferId: null, occurredAt: "2026-09-01T12:00:00+09:00", expectedAt: null, status: "settled", ...payload }, schemaVersion: 8, revision: 1, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", updatedBy: "test", deletedAt: null });

test("Money history filters arbitrary period, category, method, status and keyword without truncation", () => {
  const items = Array.from({ length: 20 }, (_, index) => tx(String(index), { title: index === 18 ? "越中宮崎から移動" : `記録${index}`, categoryId: index % 2 ? "food" : "travel", moneyMethodId: index % 3 ? "cash" : "card", status: index === 18 ? "expected" : "settled", expectedAt: index === 18 ? "2026-09-20T12:00:00+09:00" : null }));
  const result = filterTransactions(items, { start: new Date("2026-09-01T00:00:00+09:00"), end: new Date("2026-10-01T00:00:00+09:00"), categoryId: "travel", status: "expected", keyword: "宮崎" });
  assert.deepEqual(result.map(item => item.id), ["18"]);
  assert.equal(filterTransactions(items, { start: new Date("2026-09-01T00:00:00+09:00"), end: new Date("2026-10-01T00:00:00+09:00") }).length, 20);
});

test("Budget pace separates settled spending from future expected spending", () => {
  const budget: CoreEntity<BudgetData> = { id: "budget", type: "budget", payload: { categoryId: "food", period: "month", amount: 30000, active: true }, schemaVersion: 8, revision: 1, createdAt: "", updatedAt: "", updatedBy: "", deletedAt: null };
  const pace = budgetPace(budget, [tx("settled", { amount: 20000 }), tx("future", { amount: 5000, status: "expected", occurredAt: "2026-08-20T12:00:00+09:00", expectedAt: "2026-09-20T12:00:00+09:00" })], new Date("2026-09-15T12:00:00+09:00"));
  assert.equal(pace.settled, 20000); assert.equal(pace.expected, 5000); assert.equal(pace.remaining, 10000); assert.equal(pace.projectedRemaining, 5000); assert.equal(pace.over, 0);
});

test("Money UI keeps History primary, exposes all filters and links aggregates to source rows", () => {
  const view = readFileSync(new URL("../app/money-view.tsx", import.meta.url), "utf8");
  for (const contract of ["履歴", "分析", "予算", "管理", "すべての種類", "すべてのカテゴリ", "すべての支払方法", "キーワード検索", "money-history-table", "件すべてを表示", "drill("]) assert.ok(view.includes(contract), `${contract} is part of the Money workspace`);
  assert.doesNotMatch(view, /history\.slice|filteredTransactions\.slice/);
  assert.match(view, /使用中のため統合または再割当が必要です/);
  assert.match(view, /feeTransactionId/);
  assert.match(view, /Task<select/);
  assert.match(view, /Project<select/);
});
