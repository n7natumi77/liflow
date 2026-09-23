"use client";
import { CalendarClock, Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  active,
  type CalendarCategoryData,
  type CoreEntity,
  type DirectionData,
  type PlanData,
  type RecurringActivityRuleData,
  type ScheduleRule,
} from "../domain/core";
import { ActionFeedback, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function RecurringRulesSection({ entities, create, update }: SectionProps) {
  const rules = active<RecurringActivityRuleData>(entities, "recurringActivityRule");
  const plans = active<PlanData>(entities, "plan");
  const categories = active<CalendarCategoryData>(entities, "calendarCategory");
  const directions = active<DirectionData>(entities, "direction").sort((a, b) => a.payload.sortOrder - b.payload.sortOrder);
  const [editing, setEditing] = useState<CoreEntity<RecurringActivityRuleData> | null | undefined>(undefined);
  const [title, setTitle] = useState(""), [kind, setKind] = useState<ScheduleRule["kind"]>("weekly"), [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("09:00"), [duration, setDuration] = useState("60"), [category, setCategory] = useState(""), [direction, setDirection] = useState("");
  const [planType, setPlanType] = useState<PlanData["type"]>("appointment"), [flexibility, setFlexibility] = useState<PlanData["flexibility"]>("fixed"), [enabled, setEnabled] = useState(true);
  const action = useDiaryAction();
  const begin = (item: CoreEntity<RecurringActivityRuleData> | null = null) => {
    setEditing(item); setTitle(item?.payload.title || ""); setKind(item?.payload.scheduleRule.kind || "weekly"); setDays(item?.payload.scheduleRule.weekdays || []);
    setStartTime(item?.payload.startTime || "09:00"); setDuration(String(item?.payload.durationMinutes || 60)); setCategory(item?.payload.calendarCategoryId || ""); setDirection(item?.payload.directionId || "");
    setPlanType(item?.payload.planType || "appointment"); setFlexibility(item?.payload.flexibility || "fixed"); setEnabled(item?.payload.active ?? true); action.clearError();
  };
  const save = async () => {
    if (!title.trim() || (kind === "weekly" && !days.length)) return;
    const scheduleRule: ScheduleRule = kind === "weekly" ? { kind, weekdays: days } : { kind };
    const payload: RecurringActivityRuleData = {
      title: title.trim(), active: enabled, scheduleRule, startTime, durationMinutes: Math.max(1, Number(duration) || 1), taskId: editing?.payload.taskId || null,
      calendarCategoryId: category || null, directionId: direction || null, planType, flexibility,
    };
    if (await action.run(() => editing ? update(editing, payload as unknown as Record<string, unknown>) : create("recurringActivityRule", payload as unknown as Record<string, unknown>), "繰り返し予定を保存しました")) setEditing(undefined);
  };
  return <div className="recurring-rule-list">
    <SectionHeading icon={<CalendarClock/>} title="繰り返し予定" description="授業やバイトから、未来45日分だけ予定を安全に作ります。" action={<button className="diary-button" onClick={() => begin()}><Plus size={16}/>繰り返しを追加</button>}/>
    {editing === undefined && <ActionFeedback {...action}/>}
    {rules.map(rule => {
      const count = plans.filter(plan => plan.payload.recurringRuleId === rule.id && plan.payload.generationState !== "cancelled").length;
      const schedule = rule.payload.scheduleRule.kind === "daily" ? "毎日" : rule.payload.scheduleRule.kind === "weekdays" ? "平日" : rule.payload.scheduleRule.kind === "weekends" ? "週末" : (rule.payload.scheduleRule.weekdays || []).map(day => weekdayLabels[day]).join("・");
      return <article className="routine-card recurring-rule-card" key={rule.id}><div className="routine-card-header"><span className="routine-stamp"><CalendarClock/></span><div><h3>{rule.payload.title}</h3><span className="entry-meta"><span>{schedule} {rule.payload.startTime}</span><span>{rule.payload.durationMinutes}分</span><span>{count}件生成</span>{!rule.payload.active && <span>無効</span>}</span></div><button className="diary-icon-button" aria-label={`${rule.payload.title}の繰り返しを編集`} onClick={() => begin(rule)}><Edit3 size={16}/></button></div></article>;
    })}
    {editing !== undefined && <SectionDialog title={editing ? "繰り返し予定を編集" : "繰り返し予定を追加"} close={() => setEditing(undefined)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={action.busy}>
      <label>タイトル<input autoFocus required value={title} onChange={event => setTitle(event.target.value)}/></label>
      <label>繰り返し<select aria-label="予定の繰り返し" value={kind} onChange={event => setKind(event.target.value as ScheduleRule["kind"])}><option value="daily">毎日</option><option value="weekdays">平日</option><option value="weekends">週末</option><option value="weekly">曜日を指定</option></select></label>
      {kind === "weekly" && <div className="routine-weekdays" role="group" aria-label="予定を作る曜日">{weekdayLabels.map((label, index) => <button type="button" key={label} aria-pressed={days.includes(index)} onClick={() => setDays(old => old.includes(index) ? old.filter(day => day !== index) : [...old, index])}>{label}</button>)}</div>}
      <div className="form-pair"><label>開始時刻<input aria-label="繰り返し予定の開始時刻" type="time" value={startTime} onChange={event => setStartTime(event.target.value)}/></label><label>所要時間（分）<input aria-label="繰り返し予定の所要時間" type="number" min="1" max="1440" value={duration} onChange={event => setDuration(event.target.value)}/></label></div>
      <label>カレンダー<select value={category} onChange={event => setCategory(event.target.value)}><option value="">なし</option>{categories.filter(item => !item.payload.archived || item.id === category).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label>
      <label>方向<select aria-label="繰り返し予定の方向" value={direction} onChange={event => setDirection(event.target.value)}><option value="">未分類</option>{directions.map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label>
      <div className="form-pair"><label>Plan Type<select value={planType} onChange={event => setPlanType(event.target.value as PlanData["type"])}><option value="appointment">予定</option><option value="task">作業</option><option value="travel">移動</option><option value="rest">休息</option><option value="sleep">睡眠</option><option value="personal">個人</option></select></label><label>動かせる？<select value={flexibility} onChange={event => setFlexibility(event.target.value as PlanData["flexibility"])}><option value="fixed">固定</option><option value="flexible">柔軟</option></select></label></div>
      <label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)}/>有効にする</label>
      <ActionFeedback {...action}/><button className="save" type="submit" disabled={!title.trim() || (kind === "weekly" && !days.length)}>保存する</button>
      {editing && <button className="delete-entity" type="button" onClick={async () => { if (await action.run(() => update(editing, editing.payload as unknown as Record<string, unknown>, true), "繰り返し予定を削除しました")) setEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
  </div>;
}
