"use client";
import { useState } from "react";
import { Clock3, Edit3, Plus, Repeat2, RotateCcw, Trash2 } from "lucide-react";
import { active, type CoreEntity, type RoutineFlowData, type RoutineFlowStep, type RoutineRunData } from "../domain/core";
import { startRoutineRunPayload } from "../domain/execution";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";
import { RecurringRulesSection } from "./recurring-rules";

const triggerLabels: Record<RoutineFlowData["trigger"]["type"], string> = {
  afterWake: "起床後", beforeDeparture: "出発前", afterReturnHome: "帰宅後", beforeSleep: "就寝前", manual: "手動",
};
const modeLabels: Record<RoutineFlowStep["executionMode"], string> = {
  automatic: "自動", checkOnly: "確認", softTimer: "やわらかいタイマー", pacedTimer: "ペースタイマー", checklist: "チェックリスト",
};
const modeFromLabel = Object.fromEntries(Object.entries(modeLabels).map(([mode, label]) => [label, mode])) as Record<string, RoutineFlowStep["executionMode"]>;

export function RoutinesView({ entities, create, update }: SectionProps) {
  const flows = active<RoutineFlowData>(entities, "routineFlow");
  const runningFlow = active<RoutineRunData>(entities, "routineRun").find(item => item.payload.status === "running");
  const [flowEditing, setFlowEditing] = useState<CoreEntity<RoutineFlowData> | null | undefined>(undefined);
  const [flowName, setFlowName] = useState(""), [flowTrigger, setFlowTrigger] = useState<RoutineFlowData["trigger"]["type"]>("manual"), [flowEnabled, setFlowEnabled] = useState(true), [flowSteps, setFlowSteps] = useState("");
  const action = useDiaryAction();
  const beginFlow = (item: CoreEntity<RoutineFlowData> | null = null) => {
    setFlowEditing(item); setFlowName(item?.payload.name || ""); setFlowTrigger(item?.payload.trigger.type || "manual"); setFlowEnabled(item?.payload.active ?? true);
    setFlowSteps((item?.payload.steps || []).map(step => `${step.title}|${modeLabels[step.executionMode]}|${step.estimatedMinutes || ""}`).join("\n")); action.clearError();
  };
  const saveFlow = async () => {
    const modes = new Set<RoutineFlowStep["executionMode"]>(["automatic", "checkOnly", "softTimer", "pacedTimer", "checklist"]);
    const steps = flowSteps.split("\n").map((line, index) => {
      const [title, rawMode, rawMinutes] = line.split("|").map(value => value.trim());
      const old = flowEditing?.payload.steps[index], translated = modeFromLabel[rawMode] || rawMode;
      const executionMode = modes.has(translated as RoutineFlowStep["executionMode"]) ? translated as RoutineFlowStep["executionMode"] : "checkOnly";
      return title ? { ...old, id: old?.id || `step-${index + 1}`, title, executionMode, estimatedMinutes: rawMinutes ? Math.max(1, Number(rawMinutes)) : null } : null;
    }).filter(Boolean) as RoutineFlowStep[];
    if (!flowName.trim() || !steps.length) return;
    const payload: RoutineFlowData = { name: flowName.trim(), trigger: { type: flowTrigger }, active: flowEnabled, steps };
    if (await action.run(() => flowEditing ? update(flowEditing, payload) : create("routineFlow", payload), "生活手順を保存しました")) setFlowEditing(undefined);
  };
  return <section className="panel notebook routines-notebook">
    <SectionHeading icon={<Repeat2/>} title="繰り返し・生活手順" description="時刻で繰り返す予定と、生活の流れを分けて整えます。"/>
    <RecurringRulesSection entities={entities} create={create} update={update}/>
    <div className="routine-flow-list">
      <SectionHeading icon={<RotateCcw/>} title="生活手順" description="起床後や就寝前の流れを、Now画面で1つずつ案内します。" action={<button className="diary-button" onClick={() => beginFlow()}><Plus size={16}/>手順を追加</button>}/>
      {flows.length ? flows.map(flow => <article className="routine-card" key={flow.id}><div className="routine-card-header"><span className="routine-stamp"><RotateCcw/></span><div><h3>{flow.payload.name}</h3><span className="entry-meta"><span>{triggerLabels[flow.payload.trigger.type]}</span><span>{flow.payload.steps.length}件</span>{!flow.payload.active && <span>休止中</span>}</span></div><button className="diary-icon-button" aria-label={`${flow.payload.name}を編集`} onClick={() => beginFlow(flow)}><Edit3 size={16}/></button></div><p className="routine-description">{flow.payload.steps.map(step => step.title).join(" → ")}</p><div className="routine-card-actions"><button className="diary-button primary" disabled={action.busy || !!runningFlow || !flow.payload.active} onClick={() => void action.run(() => create("routineRun", startRoutineRunPayload(flow, new Date()) as unknown as Record<string, unknown>), "生活手順を開始しました")}><Clock3 size={15}/>開始</button></div></article>) : <DiaryEmpty title="生活手順はまだありません">起床後や就寝前に、順番に案内してほしい流れを追加できます。</DiaryEmpty>}
    </div>
    {flowEditing === undefined && <ActionFeedback {...action} fairy/>}
    {flowEditing !== undefined && <SectionDialog title={flowEditing ? "生活手順を編集" : "生活手順を追加"} close={() => setFlowEditing(undefined)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void saveFlow(); }}><fieldset disabled={action.busy}>
      <label>名前<input autoFocus required value={flowName} onChange={event => setFlowName(event.target.value)}/></label>
      <label>開始条件<select value={flowTrigger} onChange={event => setFlowTrigger(event.target.value as typeof flowTrigger)}>{Object.entries(triggerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>手順（1行1件：名前 | 種類 | 分）<textarea rows={8} value={flowSteps} onChange={event => setFlowSteps(event.target.value)} placeholder={"顔を洗う | 確認 | 3\n朝食 | やわらかいタイマー | 15"}/></label>
      <p className="field-hint">種類：自動 / 確認 / やわらかいタイマー / ペースタイマー / チェックリスト</p>
      <label className="checkbox-label"><input type="checkbox" checked={flowEnabled} onChange={event => setFlowEnabled(event.target.checked)}/>有効にする</label>
      <ActionFeedback {...action}/><button className="save" type="submit" disabled={!flowName.trim() || !flowSteps.trim()}>保存する</button>
      {flowEditing && <button className="delete-entity" type="button" onClick={async () => { if (await action.run(() => update(flowEditing, flowEditing.payload, true), "生活手順を削除しました")) setFlowEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
  </section>;
}
