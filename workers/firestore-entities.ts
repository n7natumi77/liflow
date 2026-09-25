import { firestoreBase, serviceAccountToken, type SchedulerEnv } from "./firebase-rest";

type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};
type RestDocument = { name: string; fields?: Record<string, FirestoreValue> };

export function serviceAccountEnvironment(raw: string): SchedulerEnv {
  const value = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
  if (!value.project_id || !value.client_email || !value.private_key) throw new Error("firebase_service_account_invalid");
  return { FIREBASE_PROJECT_ID: value.project_id, FIREBASE_CLIENT_EMAIL: value.client_email, FIREBASE_PRIVATE_KEY: value.private_key };
}

const decode = (value: FirestoreValue): unknown => {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  return null;
};

const encode = (value: unknown): FirestoreValue => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encode(item)])) } };
};

export const decodeDocument = (document: RestDocument) => ({
  id: decodeURIComponent(document.name.split("/").at(-1) || ""),
  ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])),
});

export const encodeDocument = (value: Record<string, unknown>) => ({
  fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])),
});

export async function listUserEntities(env: SchedulerEnv, uid: string) {
  const token = await serviceAccountToken(env);
  const response = await fetch(`${firestoreBase(env)}/users/${encodeURIComponent(uid)}/entities?pageSize=1000`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`firestore_list_failed:${response.status}`);
  const result = await response.json() as { documents?: RestDocument[] };
  return { token, entities: (result.documents || []).map(decodeDocument) };
}

export async function createUserEntity(env: SchedulerEnv, uid: string, id: string, value: Record<string, unknown>, token?: string) {
  const accessToken = token || await serviceAccountToken(env);
  const response = await fetch(`${firestoreBase(env)}/users/${encodeURIComponent(uid)}/entities?documentId=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(encodeDocument(value)),
  });
  if (!response.ok) throw new Error(`firestore_create_failed:${response.status}`);
  return decodeDocument(await response.json() as RestDocument);
}
