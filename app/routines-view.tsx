"use client";
import { useState } from "react";
import { Check, Clock3, Edit3, Plus, Repeat2, RotateCcw, Trash2 } from "lucide-react";
import { active, routineOccurs, type CalendarCategoryData, type CoreEntity, type RoutineData, type RoutineFlowData, type RoutineFlowStep, type RoutineOccurrenceData, type RoutineRunData } from "../domain/core";
import { startRoutineRunPayload } from "../domain/execution";
import { dateKey } from "./diary-time";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";
import { RecurringRulesSection } from "./recurring-rules";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const stateLabels = { pending: "未確認", done: "実施済み", skipped: "スキップ", unknown: "未確認" };
function scheduleLabel(routine: RoutineData) {
  const rule = routine.scheduleRule;
  return rule.kind === "daily" ? "毎日" : rule.kind === "weekdays" ? "平日" : rule.kind === "weekends" ? "週末" : (rule.weekdays || []).slice().sort().map(day => weekdays[day]).join("・");
}

export function RoutinesView({ entities, create, update }: SectionProps) {
  const routines = active<RoutineData>(entities, "routine"), occurrences = active<RoutineOccurrenceData>(entities, "routineOccurrence"), categories = active<CalendarCategoryData>(entities, "calendarCategory");
  const flows = active<RoutineFlowData>(entities, "routineFlow");
  const runningFlow = active<RoutineRunData>(entities, "routineRun").find(item => item.payload.status === "running");
  const [editing, setEditing] = useState<CoreEntity<RoutineData> | null | undefined>(undefined), [filter, setFilter] = useState("today");
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [rule, setRule] = useState<RoutineData["scheduleRule"]["kind"]>("daily"), [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState(""), [duration, setDuration] = useState(""), [category, setCategory] = useState(""), [enabled, setEnabled] = useState(true);
  const [flowEditing, setFlowEditing] = useState<CoreEntity<RoutineFlowData> | null | undefined>(undefined), [flowName, setFlowName] = useState(""), [flowTrigger, setFlowTrigger] = useState<RoutineFlowData["trigger"]["type"]>("manual"), [flowEnabled, setFlowEnabled] = useState(true), [flowSteps, setFlowSteps] = useState("");
  const action = useDiaryAction(), today = new Date(), date = dateKey(today);
  const todays = routines.filter(r => r.payload.active && routineOccurs(r.payload.scheduleRule, today));
  const done = todays.filter(r => occurrences.some(o => o.payload.routineId === r.id && o.payload.date === date && o.payload.status === "done")).length;
  const list = (filter === "today" ? todays : routines.filter(r => filter === "paused" ? !r.payload.active : true)).sort((a, b) => (a.payload.preferredTime || "z").localeCompare(b.payload.preferredTime || "z"));
  const begin = (item: CoreEntity<RoutineData> | null = null) => {
    setEditing(item); setTitle(item?.payload.title || ""); setDescription(item?.payload.description || "");
    setRule(item?.payload.scheduleRule.kind || "daily"); setDays(item?.payload.scheduleRule.weekdays || []); setTime(item?.payload.preferredTime || "");
    setDuration(item?.payload.expectedDuration ? String(item.payload.expectedDuration) : ""); setCategory(item?.payload.calendarCategoryId || ""); setEnabled(item?.payload.active ?? true); action.clearError();
  };
  const save = async () => {
    if (!title.trim() || (rule === "weekly" && !days.length)) return;
    const payload = { ...editing?.payload, title: title.trim(), description, scheduleRule: rule === "weekly" ? { kind: rule, weekdays: days } : { kind: rule }, preferredTime: time || null, expectedDuration: duration ? Number(duration) : null, calendarCategoryId: category || null, active: enabled };
    if (await action.run(() => editing ? update(editing, payload) : create("routine", payload))) setEditing(undefined);
  };
  const record = (routine: CoreEntity<RoutineData>, status: RoutineOccurrenceData["status"]) => void action.run(async () => {
    const old = occurrences.find(o => o.payload.routineId === routine.id && o.payload.date === date);
    if (old) await update(old, { ...old.payload, status });
    else await create("routineOccurrence", { routineId: routine.id, date, status, actualId: null });
  }, status === "done" ? "今日の実施を記録しました" : "今日はスキップにしました");
  const beginFlow = (item: CoreEntity<RoutineFlowData> | null = null) => {
    setFlowEditing(item); setFlowName(item?.payload.name || ""); setFlowTrigger(item?.payload.trigger.type || "manual"); setFlowEnabled(item?.payload.active ?? true);
    setFlowSteps((item?.payload.steps || []).map(step => `${step.title}|${step.executionMode}|${step.estimatedMinutes || ""}`).join("\n")); action.clearError();
  };
  const saveFlow = async () => {
    const modes = new Set<RoutineFlowStep["executionMode"]>(["automatic", "checkOnly", "softTimer", "pacedTimer", "checklist"]);
    const steps = flowSteps.split("\n").map((line, index) => {
      const [title, rawMode, rawMinutes] = line.split("|").map(value => value.trim());
      const old = flowEditing?.payload.steps[index];
      const executionMode = modes.has(rawMode as RoutineFlowStep["executionMode"]) ? rawMode as RoutineFlowStep["executionMode"] : "checkOnly";
      return title ? { ...old, id: old?.id || `step-${index + 1}`, title, executionMode, estimatedMinutes: rawMinutes ? Math.max(1, Number(rawMinutes)) : null } : null;
    }).filter(Boolean) as RoutineFlowStep[];
    if (!flowName.trim() || !steps.length) return;
    const payload: RoutineFlowData = { name: flowName.trim(), trigger: { type: flowTrigger }, active: flowEnabled, steps };
    if (await action.run(() => flowEditing ? update(flowEditing, payload) : create("routineFlow", payload))) setFlowEditing(undefined);
  };
  return <section className="panel notebook routines-notebook">
    <SectionHeading icon={<Repeat2/>} title="今日のルーティン" description="毎日のことは、今日の分だけ。無理のないペースで。" action={<button className="diary-button primary" onClick={() => begin()}><Plus size={16}/>ルーティンを追加</button>}/>
    <div className="routine-day-summary"><span>{today.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</span><b>{done}<small> / {todays.length} 実施済み</small></b><progress aria-label="今日のルーティン実施数" value={done} max={todays.length || 1}/></div>
    <div className="notebook-tabs" aria-label="ルーティンの表示">{[["today", "今日"], ["all", "すべて"], ["paused", "休止中"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {editing === undefined && <ActionFeedback {...action} fairy/>}
    <div className="routine-list">{list.length ? list.map(routine => {
      const p = routine.payload, occurrence = occurrences.find(o => o.payload.routineId === routine.id && o.payload.date === date), state = occurrence?.payload.status || "pending";
      const onToday = todays.some(r => r.id === routine.id), group = categories.find(c => c.id === p.calendarCategoryId);
      return <article className={`routine-card ${onToday ? state : "off-day"}`} key={routine.id} data-routine-id={routine.id}>
        <div className="routine-card-header"><span className="routine-stamp" aria-hidden="true">{onToday && state === "done" ? <Check/> : <Repeat2/>}</span><div><h3>{p.title}</h3><span className="entry-meta"><span>{scheduleLabel(p)}</span>{group && <span>{group.payload.name}</span>}</span></div><button className="diary-icon-button" aria-label={`${p.title}を編集`} onClick={() => begin(routine)}><Edit3 size={16}/></button></div>
        <div className="routine-time"><Clock3 size={14}/><time>{p.preferredTime || "時間指定なし"}</time>{p.expectedDuration && <span>{p.expectedDuration}分</span>}<span className="routine-state">{!p.active ? "休止中" : !onToday ? "今日はお休み" : stateLabels[state]}</span></div>
        {p.description && <p className="routine-description">{p.description}</p>}
        {onToday && <div className="routine-card-actions"><button className="diary-button primary" aria-pressed={state === "done"} disabled={action.busy || state === "done"} onClick={() => record(routine, "done")}><Check size={15}/>実施</button><button className="diary-button" aria-pressed={state === "skipped"} disabled={action.busy || state === "skipped"} onClick={() => record(routine, "skipped")}>スキップ</button>{occurrence && <button className="diary-text-button" disabled={action.busy} onClick={() => void action.run(() => update(occurrence, occurrence.payload, true), "今日の記録を戻しました")}><RotateCcw size={13}/>記録を戻す</button>}</div>}
      </article>;
    }) : <DiaryEmpty title={filter === "today" ? "今日のルーティンはありません" : "この表示のルーティンはありません"}>「すべて」から曜日や休止の設定を確認できます。</DiaryEmpty>}</div>
    <RecurringRulesSection entities={entities} create={create} update={update}/>
    <div className="routine-flow-list">
      <SectionHeading icon={<RotateCcw/>} title="生活手順" description="起床後や就寝前の流れを、Now画面で1つずつ案内します。" action={<button className="diary-button" onClick={() => beginFlow()}><Plus size={16}/>手順を追加</button>}/>
      {flows.map(flow => <article className="routine-card" key={flow.id}><div className="routine-card-header"><span className="routine-stamp"><RotateCcw/></span><div><h3>{flow.payload.name}</h3><span className="entry-meta"><span>{flow.payload.trigger.type}</span><span>{flow.payload.steps.length} Step</span>{!flow.payload.active && <span>休止中</span>}</span></div><button className="diary-icon-button" aria-label={`${flow.payload.name}を編集`} onClick={() => beginFlow(flow)}><Edit3 size={16}/></button></div><p className="routine-description">{flow.payload.steps.map(step => step.title).join(" → ")}</p><div className="routine-card-actions"><button className="diary-button primary" disabled={action.busy || !!runningFlow || !flow.payload.active} onClick={() => void action.run(() => create("routineRun", startRoutineRunPayload(flow, new Date()) as unknown as Record<string, unknown>), "生活手順を開始しました")}><Clock3 size={15}/>開始</button></div></article>)}
    </div>
    {editing !== undefined && <SectionDialog title={editing ? "ルーティンを編集" : "ルーティンを追加"} close={() => setEditing(undefined)} busy={action.busy}><form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={action.busy}>
      <label>名前<input autoFocus required value={title} onChange={e => setTitle(e.target.value)}/></label>
      <label>説明<textarea aria-label="説明" rows={2} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <label>繰り返し<select aria-label="繰り返し" value={rule} onChange={e => setRule(e.target.value as typeof rule)}><option value="daily">毎日</option><option value="weekdays">平日</option><option value="weekends">週末</option><option value="weekly">曜日を指定</option></select></label>
      {rule === "weekly" && <div className="routine-weekdays" role="group" aria-label="実施する曜日">{weekdays.map((label, index) => <button type="button" key={label} aria-pressed={days.includes(index)} onClick={() => setDays(old => old.includes(index) ? old.filter(d => d !== index) : [...old, index])}>{label}</button>)}</div>}
      {rule === "weekly" && !days.length && <p className="field-hint">曜日を1つ以上選んでください。</p>}
      <div className="form-pair"><label>目安の時刻<input type="time" value={time} onChange={e => setTime(e.target.value)}/></label><label>所要時間（分）<input type="number" min="1" max="1440" step="1" inputMode="numeric" value={duration} onChange={e => setDuration(e.target.value)}/></label></div>
      <label>カレンダー<select aria-label="カレンダー" value={category} onChange={e => setCategory(e.target.value)}><option value="">なし</option>{categories.filter(c => !c.payload.archived || c.id === category).map(c => <option key={c.id} value={c.id}>{c.payload.name}</option>)}</select></label>
      <label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>有効にする</label>
      <ActionFeedback {...action}/><button className="save" type="submit" disabled={!title.trim() || (rule === "weekly" && !days.length)}>保存する</button>
      {editing && <button className="delete-entity" type="button" onClick={async () => { if (await action.run(() => update(editing, editing.payload, true), "ルーティンを削除しました")) setEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
    {flowEditing !== undefined && <SectionDialog title={flowEditing ? "生活手順を編集" : "生活手順を追加"} close={() => setFlowEditing(undefined)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void saveFlow(); }}><fieldset disabled={action.busy}>
      <label>名前<input autoFocus required value={flowName} onChange={event => setFlowName(event.target.value)}/></label>
      <label>開始条件<select value={flowTrigger} onChange={event => setFlowTrigger(event.target.value as typeof flowTrigger)}><option value="afterWake">起床後</option><option value="beforeDeparture">出発前</option><option value="afterReturnHome">帰宅後</option><option value="beforeSleep">就寝前</option><option value="manual">手動</option></select></label>
      <label>Step（1行1件：名前 | mode | 分）<textarea rows={8} value={flowSteps} onChange={event => setFlowSteps(event.target.value)} placeholder={"顔を洗う | checkOnly | 3\n朝食 | softTimer | 15"}/></label>
      <p className="field-hint">mode: automatic / checkOnly / softTimer / pacedTimer / checklist</p>
      <label className="checkbox-label"><input type="checkbox" checked={flowEnabled} onChange={event => setFlowEnabled(event.target.checked)}/>有効にする</label>
      <ActionFeedback {...action}/><button className="save" type="submit" disabled={!flowName.trim() || !flowSteps.trim()}>保存する</button>
      {flowEditing && <button className="delete-entity" type="button" onClick={async () => { if (await action.run(() => update(flowEditing, flowEditing.payload, true), "生活手順を削除しました")) setFlowEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
  </section>;
}
