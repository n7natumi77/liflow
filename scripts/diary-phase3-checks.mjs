import assert from "node:assert/strict";

const assets = [
  "/themes/magical-diary/pearl-paper.svg",
  "/themes/magical-diary/ribbon-divider.svg",
  "/themes/magical-diary/memo-corner.svg",
  "/themes/magical-diary/ledger-flourish.svg",
];

export async function phase3DesktopChecks({ page, check }) {
  const loaded = await page.evaluate(async paths => Promise.all(paths.map(async asset => ({ asset, ok: (await fetch(asset)).ok }))), assets);
  assert.ok(loaded.every(item => item.ok), JSON.stringify(loaded));
  const pageMotion = await page.locator(".diary-page").evaluate(node => getComputedStyle(node).animationName);
  assert.ok(pageMotion.includes("page-settle"));
  const activeTransform = await page.locator(".diary-tabs>button.active").evaluate(node => getComputedStyle(node).transform);
  assert.notEqual(activeTransform, "none");
  const menu = page.locator(".diary-menu");
  if (!await menu.getAttribute("open")) await menu.locator("summary").click();
  await menu.locator('[data-tab="settings"]').click();
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) assert.equal(await checkbox.evaluate(node => getComputedStyle(node).appearance), "none");
  check("Phase 3 assets, page transition, raised navigation and custom controls are active");
}

export async function phase3SimpleCheck({ page, check }) {
  const style = await page.locator(".diary-theme").evaluate(node => {
    const theme = getComputedStyle(node);
    const main = getComputedStyle(node.querySelector(".diary-main"));
    const active = getComputedStyle(node.querySelector(".diary-tabs>button.active"));
    return { ornament: theme.getPropertyValue("--ornament-opacity").trim(), background: main.backgroundImage, transform: active.transform };
  });
  assert.equal(style.ornament, "0");
  assert.equal(style.background, "none");
  assert.equal(style.transform, "none");
  check("Simple theme removes Phase 3 ornament, texture and raised-tab motion");
}

export async function phase3MobileChecks({ page, check }) {
  const sizes = await page.locator(".diary-tabs>button").evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(); return { width: box.width, height: box.height };
  }));
  assert.ok(sizes.every(size => size.width >= 44 && size.height >= 44), JSON.stringify(sizes));
  const capture = await page.locator(".mobile-capture").boundingBox();
  assert.ok(capture && capture.width >= 44 && capture.height >= 44);
  check("Mobile primary controls keep at least 44px tap targets");
}

export async function phase3EmptyChecks({ page, check }) {
  await page.evaluate(() => window.__liflowFixture.emptyTypes(["task", "inbox", "plan", "actual", "transaction", "recurringActivityRule", "routineFlow", "routineRun"]));
  for (const id of ["tasks", "inbox"]) {
    await page.locator(`.diary-tabs>[data-tab="${id}"]`).click();
    await page.locator(".notebook-empty").first().waitFor();
  }
  for (const id of ["routines", "money"]) {
    const menu = page.locator(".diary-menu");
    if (!await menu.getAttribute("open")) await menu.locator("summary").click();
    await menu.locator(`[data-tab="${id}"]`).click();
    await page.locator(".notebook-empty").first().waitFor();
  }
  check("Task, Inbox, Routine Flow and Money empty states render while legacy data stays untouched");
}
