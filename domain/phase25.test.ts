import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateProductionEnvironment } from "./production-config.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("clean build config does not depend on ignored hosting metadata", () => {
  const vite = read("vite.config.ts");
  assert.doesNotMatch(vite, /\.openai\/hosting\.json/);
  assert.doesNotMatch(vite, /\.sites-runtime/);
});

test("production environment validation names missing keys without values", () => {
  const empty = validateProductionEnvironment({});
  assert.equal(empty.valid, false);
  assert.ok(empty.missing.includes("DISCORD_PUBLIC_KEY"));
  const complete = Object.fromEntries(empty.missing.map(name => [name, "configured"]));
  assert.equal(validateProductionEnvironment(complete).valid, true);
});

test("manifest and service worker provide install, update, offline and notification behavior", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon: { sizes: string; purpose?: string }) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon: { sizes: string; purpose?: string }) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  const worker = read("public/sw.js");
  for (const contract of ["SKIP_WAITING", "GET_VERSION", "caches.match", "push", "notificationclick"]) assert.match(worker, new RegExp(contract));
});

test("Cloudflare Discord route uses Web Crypto and REST rather than Node Firebase Admin", () => {
  const route = read("app/api/discord/interactions/route.ts");
  assert.match(route, /runtime = "edge"/);
  assert.doesNotMatch(route, /firebase-admin/);
  assert.match(read("domain/discord-interactions.ts"), /crypto\.subtle/);
});

test("health diagnostics expose configuration booleans and never secret values", () => {
  const route = read("app/api/health/route.ts");
  assert.match(route, /Boolean\(process\.env/);
  assert.doesNotMatch(route, /FIREBASE_SERVICE_ACCOUNT_JSON\s*:/);
});

test("Firestore rules are repository-managed and tested in CI", () => {
  const firebase = JSON.parse(read("firebase.json"));
  assert.equal(firebase.firestore.rules, "firebase/firestore.rules");
  const rules = read("firebase/firestore.rules");
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /allow delete: if false/);
  const workflow = read(".github/workflows/firestore-rules.yml");
  assert.match(workflow, /npm run test:rules/);
});

test("Cloudflare deployment invokes checked-in CLIs without Windows command shims", () => {
  const deploy = read("scripts/deploy-cloudflare.mjs");
  assert.match(deploy, /node_modules\/wrangler\/bin\/wrangler\.js/);
  assert.match(deploy, /process\.execPath/);
  assert.doesNotMatch(deploy, /npx|\.cmd/);
});

test("offline startup enables persistent Firestore cache before non-cacheable preparation", () => {
  const firebase = read("app/firebase-client.ts");
  assert.match(firebase, /initializeFirestore/);
  assert.match(firebase, /persistentLocalCache/);
  assert.match(firebase, /persistentMultipleTabManager/);
  assert.doesNotMatch(firebase, /enableMultiTabIndexedDbPersistence/);
  const app = read("app/liflow.tsx");
  assert.ok(app.indexOf("stop = subscribeEntities(") < app.indexOf("prepareUserData(userId)"));
  assert.match(app, /if \(navigator\.onLine\) void prepareUserData/);
});
