import {
  field,
  fields,
  firestoreBase,
  serviceAccountToken,
  type FirestoreDocument,
  type SchedulerEnv,
} from "./firebase-rest";

const headers = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });

async function dueJobs(env: SchedulerEnv, token: string, now: Date) {
  const response = await fetch(`${firestoreBase(env)}:runQuery`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "notificationJobs" }],
      where: { fieldFilter: { field: { fieldPath: "dueAt" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: now.toISOString() } } },
      orderBy: [{ field: { fieldPath: "dueAt" }, direction: "ASCENDING" }],
      limit: 100,
    } }),
  });
  if (!response.ok) throw new Error(`job_query_failed:${response.status}`);
  const rows = await response.json() as { document?: FirestoreDocument }[];
  const stale = now.getTime() - 15 * 60000;
  return rows.map(row => row.document).filter((document): document is FirestoreDocument => {
    if (!document || field(document, "enabled") !== true || field(document, "sentAt")) return false;
    const status = field(document, "status"), claimedAt = field(document, "claimedAt");
    return status !== "sending" || !claimedAt || new Date(String(claimedAt)).getTime() < stale;
  });
}

async function patchDocument(env: SchedulerEnv, token: string, document: FirestoreDocument, values: Record<string, string | boolean | null>, requireVersion = false) {
  const params = new URLSearchParams();
  for (const key of Object.keys(values)) params.append("updateMask.fieldPaths", key);
  if (requireVersion) params.set("currentDocument.updateTime", document.updateTime);
  const resource = document.name.startsWith("http") ? document.name : `https://firestore.googleapis.com/v1/${document.name}`;
  const response = await fetch(`${resource}?${params}`, { method: "PATCH", headers: headers(token), body: JSON.stringify(fields(values)) });
  if (!response.ok) throw new Error(`document_patch_failed:${response.status}`);
  return response.json() as Promise<FirestoreDocument>;
}

async function devices(env: SchedulerEnv, token: string, uid: string) {
  const response = await fetch(`${firestoreBase(env)}/users/${encodeURIComponent(uid)}/devices?pageSize=100`, { headers: headers(token) });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`device_query_failed:${response.status}`);
  const data = await response.json() as { documents?: FirestoreDocument[] };
  return (data.documents || []).filter(document => field(document, "enabled") === true && field(document, "token"));
}

async function sendFcm(env: SchedulerEnv, token: string, deviceToken: string, job: FirestoreDocument) {
  const href = String(field(job, "href") || "/");
  const link = env.APP_ORIGIN ? new URL(href, env.APP_ORIGIN).href : href;
  return fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ message: {
      token: deviceToken,
      notification: { title: field(job, "title") || "Liflow", body: field(job, "body") || "今を確認しよう。" },
      data: { href, dedupeKey: String(field(job, "dedupeKey") || "liflow"), type: String(field(job, "type") || "push") },
      webpush: env.APP_ORIGIN ? { fcmOptions: { link } } : undefined,
    } }),
  });
}

export async function runNotificationScheduler(env: SchedulerEnv, now = new Date()) {
  const token = await serviceAccountToken(env), jobs = await dueJobs(env, token, now);
  let sent = 0, failed = 0;
  for (const job of jobs) {
    let claimed: FirestoreDocument;
    try { claimed = await patchDocument(env, token, job, { status: "sending", claimedAt: now.toISOString(), updatedAt: now.toISOString() }, true); }
    catch { continue; }
    try {
      const targets = await devices(env, token, String(field(job, "uid") || ""));
      const results = await Promise.all(targets.map(device => sendFcm(env, token, String(field(device, "token")), job)));
      if (!results.length || results.every(result => !result.ok)) throw new Error("push_failed");
      await patchDocument(env, token, claimed, { status: "sent", sentAt: now.toISOString(), enabled: false, updatedAt: now.toISOString() });
      sent++;
    } catch {
      await patchDocument(env, token, claimed, { status: "pending", claimedAt: null, updatedAt: now.toISOString() }).catch(() => undefined);
      failed++;
    }
  }
  return { examined: jobs.length, sent, failed };
}

const scheduler = {
  scheduled(_event: unknown, env: SchedulerEnv, context: { waitUntil(promise: Promise<unknown>): void }) {
    context.waitUntil(runNotificationScheduler(env));
  },
};
export default scheduler;
