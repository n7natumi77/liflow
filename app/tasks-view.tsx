"use client";
import { useState, type CSSProperties } from "react";
import { CalendarPlus, Check, Edit3, ListTodo, Plus, Trash2 } from "lucide-react";
import { type CalendarCategoryData, type CoreEntity, type EntityType, type PlanData, type TaskActionData, type TaskData } from "../domain/core";
import { completedTaskActionPayload, currentTaskAction, nextTaskActionOrder, taskActionsFor } from "../domain/task-actions";
import { dateKey, freeRanges, minuteLabel } from "./diary-time";
import type { CaptureState } from "./diary-types";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type UpdateEntity } from "./diary-section";
import { deriveCarryoverWork } from "../domain/carryover";

type Props = {
  entities: CoreEntity[];
  tasks: CoreEntity<TaskData>[];
  plans: CoreEntity<PlanData>[];
  categories: CoreEntity<CalendarCategoryData>[];
  setModal: (modal: CaptureState) => void;
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  update: UpdateEntity;
};
const isSoon = (task: CoreEntity<TaskData>) => Boolean(task.payload.deadline && Date.parse(task.payload.deadline) < Date.now() + 3 * 86400000);

export function TasksView({ entities, tasks, plans, categories, setModal, create, update }: Props) {
  const [selected, setSelected] = useState<CoreEntity<TaskData> | null>(null), [newAction, setNewAction] = useState(""), [expanded, setExpanded] = useState<string[]>([]);
  const [finalNotice, setFinalNotice] = useState("");
  const action = useDiaryAction();
  const now = new Date();
  const carryovers = deriveCarryoverWork(entities, now);
  const carryoverByTask = new Map(carryovers.map(item => [item.task.id, item]));
  const carryoverIds = new Set(carryovers.map(item => item.task.id));
  const linked = (id: string) => plans.filter(plan => plan.payload.taskId === id && !plan.payload.resolution && Date.parse(plan.payload.endAt) >= now.getTime());
  const open = tasks.filter(task => ["open", "inbox"].includes(task.payload.status));
  const carryoverTasks = open.filter(task => carryoverIds.has(task.id));
  const organize = open.filter(task => !carryoverIds.has(task.id) && (isSoon(task) || !currentTaskAction(entities, task.id) || task.payload.estimatedRemainingMinutes === null));
  const organizeIds = new Set(organize.map(task => task.id));
  const needs = open.filter(task => !carryoverIds.has(task.id) && !organizeIds.has(task.id) && (!task.payload.calendarCategoryId || !currentTaskAction(entities, task.id)));
  const scheduled = open.filter(task => !carryoverIds.has(task.id) && !organizeIds.has(task.id) && linked(task.id).length);
  const scheduledIds = new Set(scheduled.map(task => task.id));
  const later = open.filter(task => !carryoverIds.has(task.id) && !organizeIds.has(task.id) && !scheduledIds.has(task.id) && !needs.includes(task));
  const completed = tasks.filter(task => task.payload.status === "completed");
  const sections = [
    { id: "carryover", title: "未実施だった作業", hint: "過去の予定から再表示", items: carryoverTasks },
    { id: "organize", title: "いま整える", hint: "次の一手や締切を確認", items: organize },
    { id: "needs", title: "整理が必要", hint: "分類やActionが不足", items: needs },
    { id: "later", title: "あとで", hint: "急がず保留できるもの", items: later },
    { id: "scheduled", title: "予定済み", hint: "カレンダーに置いたもの", items: scheduled },
    { id: "completed", title: "完了済み", hint: "終えたTask", items: completed },
  ];
  const today = new Date(), tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const suggestions = selected ? [today, tomorrow].flatMap(day => freeRanges(plans, day, 8 * 60, 22 * 60)
    .filter(range => range.end - range.start >= 30).slice(0, 2).map(range => ({
      label: (dateKey(day) === dateKey(today) ? "今日 " : "明日 ") + minuteLabel(range.start),
      date: dateKey(day), start: minuteLabel(range.start), end: minuteLabel(Math.min(range.end, range.start + 60)),
    }))) : [];
  const finishAction = async (item: CoreEntity<TaskActionData>) => {
    const remaining = taskActionsFor(entities, item.payload.taskId).filter(candidate => candidate.payload.status === "todo" && candidate.id !== item.id);
    if (await action.run(() => update(item, completedTaskActionPayload(item)), "Actionを完了しました")) {
      setFinalNotice(remaining.length ? "次のActionへ進みました。" : "最後のActionが終わりました。Taskはまだ完了していません。");
    }
  };
  const addAction = async () => {
    if (!selected || !newAction.trim()) return;
    if (await action.run(() => create("taskAction", {
      taskId: selected.id, title: newAction.trim(), status: "todo", sortOrder: nextTaskActionOrder(entities, selected.id),
      estimatedMinutes: null, minimumUsefulMinutes: null, contexts: [], energyLevel: null, interruptible: true, setupCost: null, completedAt: null,
    }), "Actionを追加しました")) setNewAction("");
  };
  return <section className="panel notebook tasks-notebook">
    <SectionHeading icon={<ListTodo/>} title="タスク" description="状態を先に見て、必要なものだけ整えます。" action={<button className="diary-button primary" onClick={() => setModal({ kind: "task" })}><Plus size={16}/>タスクを追加</button>}/>
    <ActionFeedback {...action}/>
    <div className="task-sections">{sections.map(section => {
      const visible = expanded.includes(section.id) ? section.items : section.items.slice(0, 4);
      return <section className="task-section" key={section.id}><div className="task-section-heading"><div><h3>{section.title}</h3><p>{section.hint}</p></div><span>{section.items.length}</span></div>
        <div className="task-card-grid">{visible.map(task => {
          const current = currentTaskAction(entities, task.id), category = categories.find(item => item.id === task.payload.calendarCategoryId);
          return <button className={"task-state-card" + (task.payload.status === "completed" ? " is-complete" : "")} key={task.id} onClick={() => { setSelected(task); setFinalNotice(""); }}
            style={{ "--entry-color": category?.payload.colorToken || "var(--line)" } as CSSProperties}>
            <b>{task.payload.title}</b><span>{carryoverByTask.get(task.id)?.label || (task.payload.deadline ? new Date(task.payload.deadline).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "まで" : "期限なし")}{linked(task.id).length ? " · 予定" + linked(task.id).length + "件" : ""}</span>
            <strong>{current ? "いま：" + current.payload.title : task.payload.status === "completed" ? "完了" : "次のActionを決める"}</strong>
          </button>;
        })}</div>
        {!visible.length && <p className="task-section-empty">ここにあるTaskはありません。</p>}
        {section.items.length > 4 && <button className="diary-text-button" onClick={() => setExpanded(old => old.includes(section.id) ? old.filter(id => id !== section.id) : [...old, section.id])}>{expanded.includes(section.id) ? "折りたたむ" : "すべて見る"}</button>}
      </section>;
    })}</div>
    {!tasks.length && <DiaryEmpty title="最初のやることを書こう">思いついたことを追加して、次の一手をひとつだけ決められます。</DiaryEmpty>}
    {selected && <SectionDialog title="Taskの状態" close={() => setSelected(null)} busy={action.busy}><div className="task-state-detail">
      <div className="task-detail-title"><div><h3>{selected.payload.title}</h3><p>{selected.payload.description || "説明はありません"}</p></div><button className="diary-button" onClick={() => { setSelected(null); setModal({ kind: "task", entityId: selected.id }); }}><Edit3 size={15}/>編集</button></div>
      <dl><div><dt>締切</dt><dd>{selected.payload.deadline ? new Date(selected.payload.deadline).toLocaleString("ja-JP") : "未設定"}</dd></div><div><dt>残り</dt><dd>{selected.payload.estimatedRemainingMinutes ?? selected.payload.estimateMinutes ?? "未見積"}{typeof (selected.payload.estimatedRemainingMinutes ?? selected.payload.estimateMinutes) === "number" ? "分" : ""}</dd></div></dl>
      <section className="task-actions-detail"><h4>Actions</h4>{taskActionsFor(entities, selected.id).map((item, index) => <div className={"task-action-row " + item.payload.status} key={item.id}><span>{index + 1}</span><b>{item.payload.title}</b><small>{item.payload.status === "todo" ? "未完了" : item.payload.status === "done" ? "完了" : "スキップ"}</small>{item.payload.status === "todo" && <button aria-label={item.payload.title + "を完了"} onClick={() => void finishAction(item)}><Check size={16}/></button>}<button aria-label={item.payload.title + "を削除"} onClick={() => void action.run(() => update(item, item.payload, true), "Actionを削除しました")}><Trash2 size={15}/></button></div>)}
        <div className="inline-add"><input value={newAction} onChange={event => setNewAction(event.target.value)} placeholder="次のAction"/><button disabled={!newAction.trim()} onClick={() => void addAction()}><Plus size={15}/>追加</button></div>
        {finalNotice && <p className="task-final-notice" role="status">{finalNotice}</p>}
      </section>
      {selected.payload.status !== "completed" && <section className="task-schedule-suggestions"><h4>空き時間に入れる</h4><div>{suggestions.map(slot => <button className="diary-button" key={slot.date + slot.start} onClick={() => { setSelected(null); setModal({ kind: "plan", taskId: selected.id, date: slot.date, start: slot.start, end: slot.end }); }}><CalendarPlus size={14}/>{slot.label}</button>)}<button className="diary-button" onClick={() => { setSelected(null); setModal({ kind: "plan", taskId: selected.id }); }}>日時を指定</button></div></section>}
      <div className="task-detail-actions">{selected.payload.status !== "completed" ? <button className="diary-button primary" onClick={() => void action.run(() => update(selected, { ...selected.payload, status: "completed", completedAt: new Date().toISOString() }), "Taskを完了しました")}><Check size={16}/>Taskを完了</button> : <button className="diary-button" onClick={() => void action.run(() => update(selected, { ...selected.payload, status: "open", completedAt: null }), "Taskを未完了に戻しました")}>未完了に戻す</button>}</div>
      <ActionFeedback {...action}/>
    </div></SectionDialog>}
  </section>;
}
