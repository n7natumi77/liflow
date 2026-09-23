import { active, type ConditionRecordData, type CoreEntity } from "./core.ts";

export const endOfLocalDay = (now: Date) => {
  const end = new Date(now); end.setHours(23, 59, 59, 999); return end.toISOString();
};

export const activeUnavailableRecords = (entities: CoreEntity[], now = new Date()) =>
  active<ConditionRecordData>(entities, "conditionRecord").filter(record => {
    const assist = record.payload.startAssist;
    if (!assist?.targetId || assist.resolvedAt) return false;
    return !assist.expiresAt || Date.parse(assist.expiresAt) > now.getTime();
  });

export const unavailableTargets = (entities: CoreEntity[], now = new Date()) => {
  const taskIds: string[] = [], planIds: string[] = [];
  for (const record of activeUnavailableRecords(entities, now)) {
    const assist = record.payload.startAssist!;
    if (assist.targetKind === "task") taskIds.push(assist.targetId!);
    if (assist.targetKind === "plan") planIds.push(assist.targetId!);
  }
  return { taskIds: [...new Set(taskIds)], planIds: [...new Set(planIds)] };
};

export const activeRecoveryRequest = (entities: CoreEntity[], now = new Date()) =>
  active<ConditionRecordData>(entities, "conditionRecord").find(record => {
    const request = record.payload.recoveryRequest;
    return Boolean(request && !request.resolvedAt && Date.parse(request.expiresAt) > now.getTime());
  }) || null;

