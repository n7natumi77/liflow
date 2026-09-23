"use client";
import { Compass } from "lucide-react";
import {
  active,
  type CoreEntity,
  type DirectionData,
  type EntityType,
  type SettingsData,
} from "../domain/core";
import {
  DEFAULT_DIRECTION_POLICIES,
  directionPoliciesFromSettings,
  getDirectionActualSummary,
  getDirectionNeeds,
} from "../domain/directions";
import { planFutureBlocks } from "../domain/future-blocks";

const duration = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? ` ${minutes % 60}分` : ""}` : `${minutes}分`;

type Props = {
  entities: CoreEntity[];
  clock: Date;
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
};

export function DirectionInsights({ entities, clock, create, update }: Props) {
  const directions = active<DirectionData>(entities, "direction").sort(
    (a, b) => a.payload.sortOrder - b.payload.sortOrder,
  );
  const settings = active<SettingsData>(entities, "settings")[0];
  const seven = getDirectionActualSummary(entities, clock, 7);
  const fourteen = getDirectionActualSummary(entities, clock, 14);
  const policies = directionPoliciesFromSettings(settings?.payload);
  const needs = getDirectionNeeds(entities, clock, policies);
  const future = planFutureBlocks(entities, clock, settings?.payload);
  const changePolicy = async (directionId: string, level: "off" | "weak" | "strong") => {
    const fallback = DEFAULT_DIRECTION_POLICIES.find((item) => item.directionId === directionId);
    const directionPolicies = {
      ...(settings?.payload.directionPolicies || {}),
      [directionId]: {
        level,
        maxGapDays: settings?.payload.directionPolicies?.[directionId]?.maxGapDays ?? fallback?.maxGapDays,
        targetMinutes: settings?.payload.directionPolicies?.[directionId]?.targetMinutes ?? fallback?.targetMinutes,
      },
    };
    if (settings) await update(settings, { ...settings.payload, directionPolicies });
    else await create("settings", {
      calendarView: "week",
      visibleCalendarCategories: [],
      showPlan: true,
      showActual: true,
      showTaskDeadlines: true,
      directionPolicies,
    });
  };
  return (
    <section className="panel direction-insights" aria-label="方向の実績">
      <div className="section-title"><h2><Compass size={18}/>最近向かっている方向</h2></div>
      <p className="direction-intro">評価ではなく、保存された実績時間をそのまま表示しています。</p>
      <div className="direction-grid">
        {directions.map((direction) => {
          const summary7 = seven.find((item) => item.directionId === direction.id);
          const summary14 = fourteen.find((item) => item.directionId === direction.id);
          const need = needs.find((item) => item.directionId === direction.id);
          const policy = policies.find((item) => item.directionId === direction.id)!;
          const level = policy.protection === "none" ? "off" : policy.protection === "soft" ? "weak" : "strong";
          return <article className="direction-card" key={direction.id}>
            <div><h3>{direction.payload.name}</h3><p>7日 {duration(summary7?.minutes || 0)} · 14日 {duration(summary14?.minutes || 0)}</p></div>
            <p className="direction-fact">{summary14?.lastActualAt ? `最後の実行：${Math.max(0, Math.floor((clock.getTime() - new Date(summary14.lastActualAt).getTime()) / 86400000))}日前` : "最近14日の実行記録はありません"}</p>
            {need && <p className="direction-need">保護候補：直近{need.windowDays}日 {duration(need.minutes)}{need.gapDays !== null ? `、空白${need.gapDays}日` : ""}</p>}
            {future.missingTaskDirectionIds.includes(direction.id) && <p className="direction-missing">この方向のOpen Taskが最近ありません。</p>}
            <label>守り方<select aria-label={`${direction.payload.name}の保護強度`} value={level} onChange={(event) => void changePolicy(direction.id, event.target.value as typeof level)}><option value="off">保護しない</option><option value="weak">弱く守る</option><option value="strong">強く守る</option></select></label>
          </article>;
        })}
      </div>
    </section>
  );
}
