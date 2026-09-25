import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "../.openai/browser-tools/node_modules/playwright/index.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = path.join(root, "artifacts/diary/phase245");
await fs.mkdir(artifacts, { recursive: true });
await fs.rm(path.join(artifacts, "failure.png"), { force: true });

const server = await createServer({
  configFile: false,
  root: path.join(root, "tests/ui"),
  publicDir: path.join(root, "public"),
  plugins: [react()],
  logLevel: "error",
  resolve: {
    alias: [
      { find: "./firebase-store", replacement: path.join(root, "tests/ui/fixture-store.ts") },
      { find: "./discord-client", replacement: path.join(root, "tests/ui/fixture-discord.ts") },
      { find: "./notifications-client", replacement: path.join(root, "tests/ui/fixture-notifications.ts") },
    ],
  },
  server: { host: "127.0.0.1", port: 4176, strictPort: true, fs: { allow: [root] } },
});

await server.listen();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date("2026-09-16T16:42:00+09:00"));

const errors = [];
const checks = [];
page.on("pageerror", error => errors.push(error.message));
const check = name => { checks.push(name); console.log("PASS " + name); };
const screenshot = name => page.screenshot({ path: path.join(artifacts, name + ".png"), fullPage: true, animations: "disabled" });
const snapshot = () => page.evaluate(() => window.__liflowFixture.snapshot());
const waitFor = async predicate => {
  for (let index = 0; index < 60; index++) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for fixture state");
};
const mainTab = async label => {
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("button", { name: label, exact: true }).click();
};
const menuTab = async label => {
  const menu = page.locator(".diary-menu");
  if (!(await menu.evaluate(node => node.open))) await menu.locator("summary").click();
  await menu.locator(".diary-menu-panel").getByRole("button", { name: label, exact: false }).click();
};
const runMoneyCommand = async command => {
  await page.locator(".command-trigger").click();
  const dialog = page.locator("dialog[open]");
  await dialog.waitFor();
  await dialog.getByRole("textbox", { name: "操作を検索、またはコマンドを入力" }).fill(command);
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "detached" });
};
const setGuidance = async value => {
  await menuTab("設定");
  await page.getByLabel("案内の強さ").selectOption(value);
  await page.locator(".settings-panel").first().getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).find(item => item.type === "settings")?.payload.guidanceIntensity === value);
  await mainTab("今");
  await page.locator(`.now-cockpit[data-guidance="${value}"]`).waitFor();
};
const assertNoHorizontalOverflow = async label => {
  const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(metrics.content <= metrics.viewport + 1, `${label}: ${metrics.content}px > ${metrics.viewport}px`);
};

try {
  await page.goto("http://127.0.0.1:4176", { waitUntil: "networkidle" });
  await page.locator(".diary-hero").waitFor();

  assert.deepEqual(
    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("button").allTextContents(),
    ["今", "カレンダー", "タスク", "お金"],
  );
  assert.equal(await page.locator(".direction-insights").count(), 0);
  for (const heading of ["NEXT", "TODAY", "OTHER"]) {
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  assert.equal(await page.locator(".focus-sticker h2").count(), 1);
  await screenshot("desktop-now");
  check("Now has one primary action and the NOW / NEXT / TODAY / OTHER hierarchy");

  await setGuidance("balanced");
  await page.locator(".cockpit-inbox").waitFor();
  await screenshot("desktop-now-balanced");
  await setGuidance("light");
  await page.locator(".now-capture").waitFor();
  assert.deepEqual(await page.locator(".now-capture button").allTextContents(), ["タスク", "予定", "実績", "お金", "メモ"]);
  await screenshot("desktop-now-light");
  await setGuidance("strong");
  assert.equal(await page.locator(".cockpit-helper").count(), 0);
  check("Now Strong, Balanced, and Light expose the intended disclosure levels");

  await page.getByRole("button", { name: "記録する", exact: true }).first().click();
  const capture = page.locator("dialog[open]");
  assert.deepEqual(await capture.locator(".kind-tabs button").allTextContents(), ["タスク", "予定", "実績", "お金", "メモ"]);
  await capture.getByRole("button", { name: "閉じる" }).click();
  check("Global capture exposes Task, Plan, Actual, Money, and Memo");

  await page.getByRole("button", { name: "今むり", exact: true }).click();
  await page.getByRole("button", { name: /取りかかりにくい/ }).click();
  await page.getByRole("button", { name: "疲れた", exact: true }).click();
  await page.getByRole("button", { name: "休憩する", exact: true }).waitFor();
  await page.getByRole("button", { name: "もう大丈夫", exact: true }).waitFor();
  const recovery = (await snapshot()).find(item => item.type === "conditionRecord" && item.payload.recoveryRequest);
  assert.ok(recovery);
  assert.equal(
    Date.parse(recovery.payload.recoveryRequest.expiresAt) - Date.parse(recovery.payload.recoveryRequest.requestedAt),
    15 * 60 * 1000,
  );
  await page.getByRole("button", { name: "もう大丈夫", exact: true }).click();
  await waitFor(async () => {
    const item = (await snapshot()).find(candidate => candidate.id === recovery.id);
    return Boolean(item?.payload.recoveryRequest?.resolvedAt);
  });
  check("Tired creates only a 15-minute recovery request and can be resolved immediately");

  await runMoneyCommand("/m 2026-09-20 220 越中宮崎→泊 --category 交通費");
  await runMoneyCommand("/m 2026-09-18 159 Suica物販 --category その他　");
  await waitFor(async () => (await snapshot()).filter(item => item.type === "transaction" && ["越中宮崎→泊", "Suica物販"].includes(item.payload.title)).length === 2);
  const commandTransactions = (await snapshot()).filter(item => item.type === "transaction" && ["越中宮崎→泊", "Suica物販"].includes(item.payload.title));
  const transport = commandTransactions.find(item => item.payload.title === "越中宮崎→泊");
  const suica = commandTransactions.find(item => item.payload.title === "Suica物販");
  assert.equal(transport?.payload.category, "交通費");
  assert.equal(transport?.payload.categoryId, "money_transport");
  assert.equal(suica?.payload.category, "その他");
  assert.equal(suica?.payload.categoryId, "money_category_other");
  check("Money commands preserve explicit categories, including full-width trailing spaces");

  await mainTab("タスク");
  for (const heading of ["いま整える", "整理が必要", "あとで", "予定済み", "完了済み"]) {
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }
  const taskCard = page.locator(".task-state-card").filter({ hasText: "英単語の復習" });
  assert.match(await taskCard.innerText(), /いま：単語帳を開く/);
  await taskCard.click();
  const taskDialog = page.locator("dialog[open]");
  await taskDialog.getByRole("heading", { name: "Taskの状態", exact: true }).waitFor();
  await taskDialog.getByRole("button", { name: "単語帳を開くを完了", exact: true }).click();
  await waitFor(async () => (await snapshot()).find(item => item.id === "action1")?.payload.status === "done");
  assert.equal((await snapshot()).find(item => item.id === "action2")?.payload.status, "todo");
  assert.equal((await snapshot()).find(item => item.id === "task1")?.payload.status, "open");
  await taskDialog.getByRole("button", { name: "閉じる" }).click();
  await screenshot("desktop-tasks");
  check("Task state sections and Current Action advance without auto-completing the Task");

  await mainTab("カレンダー");
  await page.locator(".diary-day").waitFor();
  assert.equal(await page.locator(".day-actual-lane").count(), 0);
  const lectureActivity = page.locator(".calendar-activity").filter({ hasText: "物理学の授業" });
  assert.equal(await lectureActivity.count(), 1);
  assert.match(await lectureActivity.innerText(), /実績 1件/);
  const compact = page.locator(".calendar-activity.calendar-compact").first();
  assert.ok((await compact.boundingBox()).height >= 44);
  await page.getByRole("button", { name: /アクティビティ 今日の復習/ }).click();
  const planDialog = page.locator("dialog[open]");
  assert.equal(await planDialog.getByText("種類", { exact: true }).count(), 0);
  const calendarSelect = planDialog.getByLabel("カレンダー", { exact: true });
  assert.notEqual(await calendarSelect.inputValue(), "");
  assert.equal(await calendarSelect.locator('option[value=""]').count(), 0);
  await planDialog.getByRole("button", { name: "閉じる" }).click();
  await lectureActivity.getByRole("button", { name: "物理学の授業の実績を編集" }).click();
  const actualDialog = page.locator("dialog[open]");
  await actualDialog.getByRole("heading", { name: "編集する", exact: true }).waitFor();
  await actualDialog.getByLabel("終了", { exact: true }).fill("10:20");
  await actualDialog.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => new Date((await snapshot()).find(item => item.id === "actual1")?.payload.endAt).getMinutes() === 20);
  await lectureActivity.getByRole("button", { name: "物理学の授業の実績を編集" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "削除する", exact: true }).click();
  await waitFor(async () => Boolean((await snapshot()).find(item => item.id === "actual1")?.deletedAt));
  assert.equal((await snapshot()).find(item => item.id === "lecture")?.deletedAt, null);
  check("Actual can be edited and tombstoned from Calendar without deleting its Plan");
  await screenshot("desktop-calendar");
  check("Calendar renders linked Plan and Actual as one activity and requires a category");

  await page.locator(".view-tabs").getByRole("button", { name: "週", exact: true }).click();
  await page.locator(".diary-week").waitFor();
  const weekLecture = page.locator(".week-event.calendar-activity").filter({ hasText: "物理学の授業" });
  assert.equal(await weekLecture.count(), 1);
  assert.equal(await page.locator(".week-event.actual").count(), 0);
  await screenshot("desktop-calendar-week");
  await page.locator(".view-tabs").getByRole("button", { name: "月", exact: true }).click();
  await page.locator(".diary-month").waitFor();
  await screenshot("desktop-calendar-month");
  check("Calendar Day, Week, and Month render, with Week using unified activities");

  await mainTab("お金");
  await page.getByRole("tab", { name: "履歴", exact: true }).waitFor();
  await page.locator(".money-history-table").waitFor();
  assert.equal(await page.getByLabel("種類", { exact: true }).locator("option").count(), 4);
  assert.ok(await page.getByLabel("カテゴリ", { exact: true }).locator("option").count() > 4);
  assert.ok(await page.getByLabel("支払方法", { exact: true }).locator("option").count() > 3);
  assert.equal(await page.getByLabel("状態", { exact: true }).locator("option").count(), 3);
  await page.getByLabel("キーワード検索", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "分析", exact: true }).click();
  await page.getByRole("heading", { name: "カテゴリ別支出", exact: true }).waitFor();
  await page.getByRole("tab", { name: "予算", exact: true }).click();
  await page.getByRole("heading", { name: "予算ペース", exact: true }).waitFor();
  assert.ok(await page.locator(".budget-card").count() >= 1);
  await page.locator(".budget-card").first().getByRole("button", { name: "編集", exact: true }).click();
  const budgetDialog = page.locator("dialog[open]");
  await budgetDialog.getByRole("heading", { name: "予算を設定", exact: true }).waitFor();
  assert.notEqual(await budgetDialog.getByLabel("カテゴリ").inputValue(), "");
  await budgetDialog.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: "振替", exact: true }).click();
  const transferDialog = page.locator("dialog[open]");
  await transferDialog.getByLabel("振替元").selectOption("money_method_bank");
  await transferDialog.getByLabel("振替先").selectOption("money_method_cash");
  await transferDialog.getByLabel("金額").fill("5000");
  await transferDialog.getByLabel("手数料").fill("110");
  await transferDialog.getByRole("button", { name: "保存する", exact: true }).click();
  await transferDialog.waitFor({ state: "detached" });
  await waitFor(async () => (await snapshot()).some(item => item.type === "transfer" && item.payload.amount === 5000));
  const afterTransfer = await snapshot();
  const transfer = afterTransfer.find(item => item.type === "transfer" && item.payload.amount === 5000);
  const fee = afterTransfer.find(item => item.type === "transaction" && item.payload.transferId === transfer?.id);
  assert.equal(fee?.payload.amount, 110);
  assert.equal(fee?.payload.direction, "expense");
  assert.equal(fee?.payload.categoryId, "money_category_transfer_fee");
  assert.equal(transfer?.payload.feeTransactionId, fee?.id);
  await page.getByRole("tab", { name: "管理", exact: true }).click();
  const management = page.locator(".money-management-grid");
  await management.getByRole("heading", { name: "カテゴリ", exact: true }).waitFor();
  await management.getByRole("heading", { name: "支払方法", exact: true }).waitFor();
  await management.locator("section").first().getByPlaceholder("新しいカテゴリ").fill("ブラウザ確認");
  await management.locator("section").first().getByRole("button", { name: "追加", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "moneyCategory" && item.payload.name === "ブラウザ確認"));
  await screenshot("desktop-money");
  check("Money covers budget, category management, and a linked transfer-fee expense");

  await menuTab("繰り返し予定");
  await page.getByRole("heading", { name: "繰り返し予定", exact: true }).first().waitFor();
  assert.equal(await page.getByText("生活手順", { exact: true }).count(), 0);
  await menuTab("方向");
  await page.locator(".direction-insights").waitFor();
  await menuTab("未整理");
  await page.getByRole("heading", { name: "今日を整える", exact: true }).waitFor();
  const unresolvedPlan = page.locator(".reconcile-card.kind-plan").first();
  assert.ok(await unresolvedPlan.count() >= 1);
  await unresolvedPlan.locator(".entry-more summary").click();
  await unresolvedPlan.getByRole("button", { name: "今回はスキップ", exact: true }).waitFor();
  await unresolvedPlan.getByRole("button", { name: "別日に移す", exact: true }).waitFor();
  check("Recurring, Direction, and Inbox secondary flows remain available without Routine Flow UI");

  await page.setViewportSize({ width: 390, height: 844 });
  await mainTab("今");
  await assertNoHorizontalOverflow("mobile Now");
  await screenshot("mobile-now");
  await mainTab("カレンダー");
  await page.locator(".view-tabs").getByRole("button", { name: "日", exact: true }).click();
  await assertNoHorizontalOverflow("mobile Calendar");
  await page.locator(".view-tabs").getByRole("button", { name: "週", exact: true }).click();
  await page.locator(".mobile-week").waitFor();
  await assertNoHorizontalOverflow("mobile Calendar Week");
  await page.locator(".view-tabs").getByRole("button", { name: "月", exact: true }).click();
  await page.locator(".diary-month").waitFor();
  await assertNoHorizontalOverflow("mobile Calendar Month");
  await mainTab("タスク");
  await assertNoHorizontalOverflow("mobile Tasks");
  await mainTab("お金");
  await assertNoHorizontalOverflow("mobile Money");
  await screenshot("mobile-money");
  await menuTab("方向");
  await assertNoHorizontalOverflow("mobile Direction");
  await menuTab("繰り返し予定");
  await assertNoHorizontalOverflow("mobile Recurring");
  await menuTab("未整理");
  await assertNoHorizontalOverflow("mobile Inbox");
  await page.locator(".mobile-capture").click();
  const mobileCapture = page.locator("dialog[open]");
  assert.equal(await mobileCapture.locator(".kind-tabs button").count(), 5);
  await mobileCapture.getByRole("button", { name: "閉じる" }).click();
  check("Phase 2.45 primary and secondary flows fit a 390px mobile viewport");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.locator(".diary-tabs button").first().evaluate(node => {
    const style = getComputedStyle(node);
    return { animation: style.animationName, transition: style.transitionDuration };
  });
  assert.equal(motion.animation, "none");
  assert.match(motion.transition, /(^|, )0s/);
  check("Reduced-motion preference disables animation and transition");

  assert.deepEqual(errors, []);
  console.log(`UI smoke complete: ${checks.length} checks, 0 page errors`);
} catch (error) {
  await screenshot("failure").catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
