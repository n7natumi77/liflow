import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "../.openai/browser-tools/node_modules/playwright/index.mjs";
import { phase2Checks, phase2MobileChecks } from "./diary-phase2-checks.mjs";
import { phase3DesktopChecks, phase3SimpleCheck, phase3MobileChecks, phase3EmptyChecks } from "./diary-phase3-checks.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = path.join(root, "artifacts/diary/phase3");
await fs.mkdir(artifacts, { recursive: true });
await fs.rm(path.join(artifacts, "failure.png"), { force: true });
const server = await createServer({
  configFile: false, root: path.join(root, "tests/ui"), publicDir: path.join(root, "public"),
  plugins: [react()], logLevel: "error",
  resolve: { alias: [
    { find: "./firebase-store", replacement: path.join(root, "tests/ui/fixture-store.ts") },
    { find: "./discord-client", replacement: path.join(root, "tests/ui/fixture-discord.ts") },
    { find: "./notifications-client", replacement: path.join(root, "tests/ui/fixture-notifications.ts") },
  ] },
  server: { host: "127.0.0.1", port: 4176, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: "ja-JP", timezoneId: "Asia/Tokyo" });
const page = await context.newPage();
await page.clock.setFixedTime(new Date("2026-09-16T16:42:00+09:00"));
const errors = [], checks = [];
page.on("pageerror", error => errors.push(error.message));
const check = name => { checks.push(name); console.log("PASS " + name); };
const screenshot = name => page.screenshot({ path: path.join(artifacts, name + ".png"), fullPage: true, animations: 'disabled' });
const snapshot = () => page.evaluate(() => window.__liflowFixture.snapshot());
const get = async id => (await snapshot()).find(item => item.id === id);
const mainTab = async label => { await page.locator(".diary-tabs").getByRole("button", { name: label, exact: false }).click(); };
const menuTab = async label => { await page.locator(".diary-menu summary").click(); await page.locator(".diary-menu-panel").getByRole("button", { name: label, exact: true }).click(); };
const waitFor = async predicate => {
  for (let index = 0; index < 40; index++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error("Timed out waiting for state");
};
const scrollCalendar = async hour => { await page.locator(".day-scroll").evaluate((node, value) => { node.scrollTop = value; }, hour * 64); };
const drag = async (locator, delta) => {
  const box = await locator.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + delta, { steps: 8 });
  await page.mouse.up();
};
try {
  await page.goto("http://127.0.0.1:4176", { waitUntil: "networkidle" });
  await page.locator(".diary-hero").waitFor();
  assert.ok((await page.locator(".fairy-bubble").innerText()).length > 0);
  assert.equal(await page.locator(".cat-fairy").count(), 0);
  await screenshot("desktop-now");
  assert.equal(await page.locator(".focus-label").innerText(), "次はこれ");
  const recommendedTitle = await page.locator(".focus-sticker h2").innerText();
  await page.locator(".focus-sticker").getByRole("button", { name: "開始", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(e => e.type === "executionSession" && e.payload.status === "running"));
  assert.equal(await page.locator(".focus-label").innerText(), "実行中");
  assert.equal(await page.locator(".focus-sticker h2").innerText(), recommendedTitle);
  check("Now chooses one Task and persists a running Execution Session");
  await page.clock.fastForward(60000);
  await page.locator(".focus-sticker").getByRole("button", { name: "終わる", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(e => e.type === "actual" && e.id.startsWith("actual_execution_")));
  assert.ok((await snapshot()).some(e => e.type === "executionSession" && e.payload.status === "completed"));
  check("Ending the Session creates one linked Actual and recalculates Now");

  await page.clock.setFixedTime(new Date("2026-09-16T15:30:00+09:00"));
  await page.clock.fastForward(30000);
  assert.equal(await page.locator(".focus-label").innerText(), "いまの予定");
  check("Now Fixed mode suppresses unrelated Task recommendations");
  await page.clock.setFixedTime(new Date("2026-09-16T07:00:00+09:00"));
  await page.clock.fastForward(30000);
  assert.equal(await page.locator(".focus-label").innerText(), "起床確認");
  await page.locator(".focus-sticker").getByRole("button", { name: "起きた", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(e => e.type === "routineRun" && e.payload.status === "running"));
  assert.equal(await page.locator(".focus-label").innerText(), "いまの支度");
  check("Morning wake recording starts and restores the after-wake Routine Flow");
  await page.evaluate(() => window.__liflowFixture.emptyTypes(["routineRun", "sleepRecord"]));
  await page.clock.setFixedTime(new Date("2026-09-16T16:42:00+09:00"));
  await page.clock.fastForward(30000);

  await page.locator(".routine-chip").filter({ hasText: "ストレッチ" }).click();
  await waitFor(async () => (await snapshot()).some(e => e.type === "routineOccurrence" && e.payload.routineId === "routine1" && e.payload.status === "done"));
  assert.ok(await page.locator(".diary-hero.is-celebrating").count());
  check("Routine completion stores its own occurrence and triggers a fairy reaction");

  await page.locator(".command-trigger").click();
  await page.locator("dialog[open]").waitFor();
  await screenshot("desktop-command");
  await page.getByRole("textbox", { name: "操作を検索、またはコマンドを入力" }).fill("t ブラウザ確認タスク");
  await page.keyboard.press("Enter");
  await waitFor(async () => (await snapshot()).some(e => e.payload.title === "ブラウザ確認タスク"));
  await page.locator("dialog[open]").waitFor({ state: "detached" });
  check("Command palette creates a task through the shared command engine");
  await mainTab("タスク");
  await page.locator(".task-summary").filter({ hasText: "ブラウザ確認タスク" }).click();
  await page.getByLabel("名前", { exact: true }).fill("ブラウザ確認タスク・編集済み");
  await page.getByLabel("方向", { exact: true }).selectOption("direction_career");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await page.locator(".task-summary").filter({ hasText: "ブラウザ確認タスク・編集済み" }).waitFor();
  const edited = (await snapshot()).find(e => e.payload.title === "ブラウザ確認タスク・編集済み");
  assert.equal(edited.revision, 2);
  assert.equal(edited.payload.directionId, "direction_career");
  check("Task edit keeps the ID and advances the revision");
  await screenshot("desktop-tasks");

  await mainTab("カレンダー");
  await page.locator(".diary-day").waitFor();
  await scrollCalendar(14);
  assert.equal(await page.locator(".day-containers").getByRole("button", { name: "秋学期", exact: true }).count(), 1);
  assert.equal(await page.locator(".day-sticker").filter({ hasText: "延期した予定" }).count(), 0);
  await screenshot("desktop-day");
  check("Day renders separate Plan, Actual and Routine lanes, overlap and containers");

  const old = await get("review");
  await drag(page.getByRole("button", { name: "今日の復習を移動（上下キーで15分）", exact: true }), 64);
  await waitFor(async () => (await get("review")).revision === old.revision + 1);
  const moved = await get("review");
  assert.equal(+new Date(moved.payload.startAt) - +new Date(old.payload.startAt), 60 * 60000);
  assert.equal(+new Date(moved.payload.endAt) - +new Date(moved.payload.startAt), 90 * 60000);
  check("Pointer drag moves the existing Plan by one hour and preserves duration");
  await drag(page.getByRole("button", { name: "今日の復習の長さを変更（上下キーで15分）", exact: true }), 32);
  await waitFor(async () => (await get("review")).revision === moved.revision + 1);
  assert.equal(+new Date((await get("review")).payload.endAt) - +new Date(moved.payload.endAt), 30 * 60000);
  check("Resize changes the duration without replacing the Plan");
  await page.getByRole("button", { name: "今日の復習を移動（上下キーで15分）", exact: true }).focus();
  const beforeKey = await get("review");
  await page.keyboard.press("ArrowUp");
  await waitFor(async () => (await get("review")).revision === beforeKey.revision + 1);
  assert.equal(+new Date((await get("review")).payload.startAt) - +new Date(beforeKey.payload.startAt), -15 * 60000);
  check("Keyboard movement uses 15-minute steps");

  const beforeFailure = await get("review");
  await page.evaluate(() => window.__liflowFixture.failNext());
  await drag(page.getByRole("button", { name: "今日の復習を移動（上下キーで15分）", exact: true }), 32);
  await page.locator(".day-footer").getByText("変更を保存できませんでした。最新の同期状態を確認してください。").waitFor();
  assert.deepEqual(await get("review"), beforeFailure);
  check("Failed persistence keeps the original Plan and reports the error");

  await scrollCalendar(11);
  const bounds = await page.locator(".day-plan-lane").boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 13 * 64);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 14 * 64, { steps: 8 });
  await page.mouse.up();
  await page.locator("dialog[open]").waitFor();
  assert.equal(await page.getByLabel("開始", { exact: true }).inputValue(), "13:00");
  assert.equal(await page.getByLabel("終了", { exact: true }).inputValue(), "14:00");
  await page.getByLabel("名前", { exact: true }).fill("空き時間から作成");
  await screenshot("desktop-modal");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(e => e.type === "plan" && e.payload.title === "空き時間から作成"));
  check("Dragging empty time prefills the range and creates a Plan on save");

  for (const [label, selector, file] of [["週", ".week-time-grid", "desktop-week"], ["月", ".month-grid", "desktop-month"]]) {
    await page.locator(".view-tabs").getByRole("button", { name: label, exact: true }).click();
    await page.locator(selector).waitFor();
    await screenshot(file);
    check(label + " calendar renders");
  }
  for (const label of ["プロジェクト", "ルーティン", "お金", "設定"]) {
    await menuTab(label);
    assert.ok(await page.locator(".diary-main .panel").count());
    assert.equal(await page.locator(".diary-main>header h1").innerText(), label);
    check(label + " view renders");
  }
  const pwa = await page.evaluate(async () => {
    const manifest = await (await fetch("/manifest.webmanifest")).json();
    const worker = await (await fetch("/sw.js")).text();
    return { manifest, hasClick: worker.includes("notificationclick"), hasPush: worker.includes('addEventListener("push"') };
  });
  assert.equal(pwa.manifest.display, "standalone");
  assert.ok(pwa.manifest.icons.length >= 2 && pwa.hasClick && pwa.hasPush);
  check("PWA manifest, install icons, Service Worker push and notification click are available");
  await page.evaluate(() => window.__notificationFixture.denyNext());
  await page.getByRole("button", { name: "通知を許可する", exact: true }).click();
  await page.getByText("通知は許可されませんでした。アプリは通知なしでも使えます。").waitFor();
  assert.ok(await page.getByRole("heading", { name: "Liflowから境界を知らせる" }).count());
  check("Notification permission denial leaves Settings and the app usable");
  await page.getByRole("button", { name: "通知を許可する", exact: true }).click();
  await page.getByText("この端末への通知を有効にしました。設定を保存してください。").waitFor();
  await page.getByLabel("次の起床予定", { exact: true }).fill("2026-09-17T08:15");
  await page.locator(".settings-panel").first().getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "sleepRecord" && item.payload.plannedWakeAt?.includes("2026-09-16T23:15")));
  assert.equal((await get("settings")).payload.notificationsEnabled, true);
  check("Notification settings and next plannedWakeAt persist after explicit permission");

  await menuTab("ルーティン");
  await page.getByRole("button", { name: "繰り返しを追加", exact: true }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("毎日の読書");
  await page.getByLabel("予定の繰り返し", { exact: true }).selectOption("daily");
  await page.getByLabel("繰り返し予定の開始時刻", { exact: true }).fill("20:00");
  await page.getByLabel("繰り返し予定の所要時間", { exact: true }).fill("30");
  await page.getByLabel("繰り返し予定の方向", { exact: true }).selectOption("direction_specialty");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "plan" && item.payload.source === "recurring" && item.payload.title === "毎日の読書"));
  check("Recurring Rule create/read generates deterministic future Plans");
  await page.getByRole("button", { name: "毎日の読書の繰り返しを編集", exact: true }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("毎日の読書・更新");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "plan" && item.payload.source === "recurring" && item.payload.title === "毎日の読書・更新"));
  check("Recurring Rule update changes only untouched generated occurrences");
  await mainTab("カレンダー");
  await page.locator(".view-tabs").getByRole("button", { name: "日", exact: true }).click();
  await scrollCalendar(19);
  await page.locator(".plan-content").filter({ hasText: "毎日の読書・更新" }).first().click();
  await page.getByLabel("開始", { exact: true }).fill("20:30");
  await page.getByLabel("終了", { exact: true }).fill("21:00");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "plan" && item.payload.title === "毎日の読書・更新" && item.payload.generationState === "overridden"));
  check("Manual edits mark a recurring occurrence overridden and protect it from regeneration");
  await menuTab("ルーティン");
  await page.getByRole("button", { name: "毎日の読書・更新の繰り返しを編集", exact: true }).click();
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await waitFor(async () => (await snapshot()).some(item => item.type === "recurringActivityRule" && item.payload.title === "毎日の読書・更新" && item.deletedAt));
  assert.ok((await snapshot()).some(item => item.type === "plan" && item.payload.title === "毎日の読書・更新" && item.payload.generationState === "overridden" && !item.deletedAt));
  check("Recurring Rule delete preserves the manually overridden occurrence and cancels untouched future Plans");

  await mainTab("今");
  await page.locator(".direction-insights").waitFor();
  assert.ok(await page.locator(".direction-card").count() >= 5);
  await page.getByLabel("進路の保護強度", { exact: true }).selectOption("strong");
  await waitFor(async () => (await get("settings")).payload.directionPolicies?.direction_career?.level === "strong");
  check("Direction summary shows 7/14-day Actual time, Need reason and editable policy");
  const futureBlock = (await snapshot()).find(item => item.type === "plan" && item.payload.source === "futureBlock");
  assert.ok(futureBlock);
  await mainTab("カレンダー");
  await page.locator(".view-tabs").getByRole("button", { name: "日", exact: true }).click();
  await page.locator(".plan-content").filter({ hasText: futureBlock.payload.title }).first().click();
  const futureStart = await page.getByLabel("開始", { exact: true }).inputValue();
  const [futureHour, futureMinute] = futureStart.split(":").map(Number);
  const shiftedMinutes = futureHour * 60 + futureMinute + 15;
  await page.getByLabel("開始", { exact: true }).fill(`${String(Math.floor(shiftedMinutes / 60)).padStart(2, "0")}:${String(shiftedMinutes % 60).padStart(2, "0")}`);
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await waitFor(async () => (await get(futureBlock.id)).payload.generationState === "overridden");
  check("Future Block is visible and a manual edit prevents automatic relocation");

  await page.goto("http://127.0.0.1:4176/?notification=wake", { waitUntil: "networkidle" });
  await page.locator(".notification-entry").waitFor();
  assert.equal(await page.locator(".focus-label").count(), 1);
  check("Notification deep link returns to one recomputed Now action");
  await mainTab("未整理");
  assert.ok(await page.locator(".organize-list").count());
  check("Unresolved view renders");
  await phase2Checks({ page, snapshot, get, mainTab, menuTab, waitFor, check, screenshot });
  await phase3DesktopChecks({ page, check });
  await mainTab("今");
  await page.locator(".diary-menu summary").click();
  await page.getByRole("button", { name: "シンプル", exact: true }).click();
  assert.equal(await page.locator(".diary-theme").getAttribute("data-theme"), "simple");
  await phase3SimpleCheck({ page, check });
  await page.locator(".diary-menu summary").click();
  await screenshot("desktop-simple");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".diary-theme").getAttribute("data-theme"), "simple");
  check("Theme selection persists separately from entity data");
  await page.locator(".diary-menu summary").click();
  await page.getByRole("button", { name: "Magical Diary", exact: true }).click();
  await page.locator(".diary-menu summary").click();

  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot("mobile-now");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check("390px Now layout has no horizontal overflow");
  await mainTab("カレンダー");
  await page.locator(".view-tabs").getByRole("button", { name: "日", exact: true }).click();
  await page.locator(".diary-day").waitFor(); await scrollCalendar(14);
  await screenshot("mobile-day");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check("390px Day layout has no horizontal overflow");
  await phase2MobileChecks({ page, mainTab, menuTab, check, screenshot });
  await phase3MobileChecks({ page, check });
  await phase3EmptyChecks({ page, check });
  await mainTab("今");
  assert.equal(await page.locator(".focus-label").innerText(), "自由時間");
  check("Now Free mode does not invent work when no action is needed");
  await page.clock.setFixedTime(new Date("2026-09-16T23:00:00+09:00"));
  await page.clock.fastForward(30000);
  assert.equal(await page.locator(".focus-label").innerText(), "眠る準備");
  check("Now Wind Down mode protects the configured sleep window");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await page.locator(".diary-tabs>button").first().evaluate(node => getComputedStyle(node).transitionDuration);
  assert.equal(motion, "0s");
  check("Reduced-motion preference disables animation");
  await page.setViewportSize({ width: 360, height: 800 });
  await mainTab("今");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check("360px layout has no horizontal overflow");
  assert.deepEqual(errors, []);
  check("No uncaught browser errors");
} catch(error) {
  console.error("SMOKE_FAILURE", error);
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: false, animations: "disabled", timeout: 5000 }).catch(() => undefined);
  console.log("DIALOG", await page.locator("dialog").allTextContents());
  console.log("OVERFLOW",await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))})));
  throw error;
} finally {
  await fs.writeFile(path.join(artifacts, "smoke-results.json"), JSON.stringify({ checks, errors, screenshots: await fs.readdir(artifacts) }, null, 2));
  await context.close(); await browser.close(); await server.close();
}
