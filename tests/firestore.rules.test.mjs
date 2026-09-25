import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let environment;
const projectId = "demo-liflow-rules";
const rules = readFileSync(new URL("../firebase/firestore.rules", import.meta.url), "utf8");
const now = "2026-09-25T00:00:00.000Z";

const entity = (id, extra = {}) => ({
  id,
  type: "task",
  payload: { title: id, status: "open" },
  schemaVersion: 7,
  revision: 1,
  createdAt: now,
  updatedAt: now,
  updatedBy: "test",
  deletedAt: null,
  ...extra,
});

const device = id => ({
  deviceId: id,
  token: "token",
  platform: "test",
  createdAt: now,
  updatedAt: now,
  lastSeenAt: now,
  enabled: true,
});

const job = (uid, extra = {}) => ({
  uid,
  dedupeKey: "wake:one",
  type: "wake",
  dueAt: now,
  title: "起床",
  body: "起きる時間です",
  href: "/?notification=wake",
  enabled: true,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { rules } });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

test("unauthenticated and cross-user entity access is denied", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  const guest = environment.unauthenticatedContext().firestore();
  const target = doc(alice, "users/alice/entities/task");
  await assertSucceeds(setDoc(target, entity("task")));
  await assertFails(getDoc(doc(bob, "users/alice/entities/task")));
  await assertFails(setDoc(doc(bob, "users/alice/entities/other"), entity("other")));
  await assertFails(getDoc(doc(guest, "users/alice/entities/task")));
});

test("owner can version-update an entity but cannot hard-delete or rewrite identity", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const target = doc(alice, "users/alice/entities/task");
  await assertSucceeds(setDoc(target, entity("task")));
  await assertSucceeds(updateDoc(target, { payload: { title: "updated", status: "open" }, revision: 2, updatedAt: "later" }));
  await assertFails(updateDoc(target, { id: "another", revision: 3 }));
  await assertFails(updateDoc(target, { type: "plan", revision: 3 }));
  await assertFails(deleteDoc(target));
});

test("malformed entities are denied", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(alice, "users/alice/entities/task"), entity("wrong-id")));
  await assertFails(setDoc(doc(alice, "users/alice/entities/missing"), { payload: {} }));
});

test("legacy entities may receive missing migration metadata without losing stable identity", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const target = doc(alice, "users/alice/entities/legacy");
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "users/alice/entities/legacy"), {
      type: "task",
      payload: { title: "legacy", status: "open" },
      schemaVersion: 1,
    });
  });
  await assertSucceeds(setDoc(target, entity("legacy")));
  await assertFails(updateDoc(target, { type: "plan", revision: 2 }));
});

test("backup metadata is owner-only and backup entities are append-only", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  const metadata = doc(alice, "users/alice/backups/backup");
  const item = doc(alice, "users/alice/backups/backup/entities/task");
  await assertSucceeds(setDoc(metadata, { status: "writing", timestamp: now }));
  await assertSucceeds(updateDoc(metadata, { status: "ready" }));
  await assertSucceeds(setDoc(item, entity("task")));
  await assertSucceeds(getDoc(item));
  await assertFails(updateDoc(item, { revision: 2 }));
  await assertFails(deleteDoc(item));
  await assertFails(getDoc(doc(bob, "users/alice/backups/backup")));
});

test("runtime and device documents validate owner and shape", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  await assertSucceeds(setDoc(doc(alice, "users/alice/runtime/execution"), { status: "running", sessionId: "session", updatedAt: now }));
  await assertFails(setDoc(doc(alice, "users/alice/runtime/bad"), { status: "unknown", sessionId: null, updatedAt: now }));
  await assertSucceeds(setDoc(doc(alice, "users/alice/devices/device"), device("device")));
  await assertFails(setDoc(doc(alice, "users/alice/devices/device-bad"), device("different")));
  await assertFails(getDoc(doc(bob, "users/alice/devices/device")));
});

test("notification jobs are owner-scoped and immutable identity cannot be reassigned", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  const bob = environment.authenticatedContext("bob").firestore();
  const target = doc(alice, "notificationJobs/job-alice");
  await assertSucceeds(setDoc(target, job("alice")));
  await assertSucceeds(updateDoc(target, { title: "更新", updatedAt: "later" }));
  await assertFails(updateDoc(target, { uid: "bob", updatedAt: "later" }));
  await assertFails(updateDoc(target, { dedupeKey: "other", updatedAt: "later" }));
  await assertFails(getDoc(doc(bob, "notificationJobs/job-alice")));
  await assertFails(deleteDoc(target));
  const own = await assertSucceeds(getDocs(query(collection(alice, "notificationJobs"), where("uid", "==", "alice"))));
  assert.equal(own.size, 1);
});

test("unmatched paths are denied by default", async () => {
  const alice = environment.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(alice, "admin/config"), { enabled: true }));
});
