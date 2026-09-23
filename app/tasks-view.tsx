"use client";
import { useState, type CSSProperties } from "react";
import { CalendarPlus, Check, ChevronDown, ChevronRight, ListTodo, Plus, Search, Trash2 } from "lucide-react";
import type { CalendarCategoryData, CoreEntity, PlanData, ProjectData, TaskData } from "../domain/core";
import type { CaptureState } from "./diary-types";
import { ActionFeedback, DiaryEmpty, SectionHeading, useDiaryAction, type UpdateEntity } from "./diary-section";

export function TasksView({ tasks, plans, projects, categories, setModal, update }: {
  tasks: CoreEntity<TaskData>[]; plans: CoreEntity<PlanData>[]; projects: CoreEntity<ProjectData>[];
  categories: CoreEntity<CalendarCategoryData>[]; setModal: (modal: CaptureState) => void; update: UpdateEntity;
}) {
  const [filter, setFilter] = useState("open"), [query, setQuery] = useState(""), [project, setProject] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const action = useDiaryAction();
  const linked = (id: string) => plans.filter(p => p.payload.taskId === id && !p.payload.resolution);
  const matches = tasks.filter(t => (!query || (t.payload.title + " " + (t.payload.description || "")).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    && (!project || t.payload.projectId === project)
    && (filter === "all" || (filter === "completed" ? t.payload.status === "completed" : ["open", "inbox"].includes(t.payload.status)))
    && (filter !== "unscheduled" || !linked(t.id).length));
  const ordered = [...matches].sort((a, b) => (a.payload.deadline || "z").localeCompare(b.payload.deadline || "z") || a.createdAt.localeCompare(b.createdAt));
  // Filtered-out or deleted parents become a breadcrumb, never hide their children.
  const visited = new Set<string>();
  const rows: { task: CoreEntity<TaskData>; depth: number; children: boolean }[] = [];
  const visit = (task: CoreEntity<TaskData>, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    const children = ordered.filter(t => t.payload.parentTaskId === task.id);
    rows.push({ task, depth, children: children.length > 0 });
    for (const child of children) visit(child, depth + 1);
  };
  ordered.filter(t => !ordered.some(p => p.id === t.payload.parentTaskId)).forEach(t => visit(t, 0));
  ordered.forEach(t => visit(t, 0));
  const hidden = (task: CoreEntity<TaskData>) => {
    let parent = task.payload.parentTaskId; const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (collapsed.has(parent) && matches.some(t => t.id === parent)) return true;
      seen.add(parent); parent = tasks.find(t => t.id === parent)?.payload.parentTaskId;
    }
    return false;
  };
  return <section className="panel notebook tasks-notebook">
    <SectionHeading icon={<ListTodo/>} title="やること" description="やることを並べて、取りかかる時間を決めよう。"
      action={<button className="diary-button primary" onClick={() => setModal({ kind: "task" })}><Plus size={16}/>タスクを追加</button>}/>
    <div className="notebook-tools"><div className="notebook-tabs" aria-label="タスクの表示">
      {[["open", "未完了"], ["unscheduled", "予定なし"], ["completed", "完了"], ["all", "すべて"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<small>{tasks.filter(t => value === "all" || (value === "completed" ? t.payload.status === "completed" : ["open", "inbox"].includes(t.payload.status) && (value !== "unscheduled" || !linked(t.id).length))).length}</small></button>)}
    </div><div className="notebook-search"><Search size={16}/><input aria-label="タスクを検索" placeholder="タスクを検索" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <select aria-label="タスクのプロジェクト" value={project} onChange={e => setProject(e.target.value)}><option value="">すべてのプロジェクト</option>{projects.map(p => <option key={p.id} value={p.id}>{p.payload.name}</option>)}</select>
    </div>
    <ActionFeedback {...action} fairy/>
    <div className="task-ledger">{rows.length ? rows.filter(({ task }) => !hidden(task)).map(({ task: t, depth, children }) => {
      const parent = tasks.find(p => p.id === t.payload.parentTaskId), group = projects.find(p => p.id === t.payload.projectId);
      const category = categories.find(c => c.id === (t.payload.calendarCategoryId || group?.payload.calendarCategoryId));
      return <article className={"task-entry " + (t.payload.status === "completed" ? "is-complete" : "")} key={t.id} data-task-id={t.id}
        style={{ "--task-depth": Math.min(depth, 4), "--entry-color": category?.payload.colorToken || "var(--line)" } as CSSProperties}>
        <div className="task-checks">{children && <button className="tree-toggle" aria-label={`${t.payload.title}の子タスクを${collapsed.has(t.id) ? "展開" : "折りたたむ"}`} aria-expanded={!collapsed.has(t.id)} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}>{collapsed.has(t.id) ? <ChevronRight/> : <ChevronDown/>}</button>}
          <button className={"check " + (t.payload.status === "completed" ? "done" : "")} aria-label={`${t.payload.title}を${t.payload.status === "completed" ? "未完了に戻す" : "完了にする"}`} aria-pressed={t.payload.status === "completed"} disabled={action.busy}
            onClick={() => void action.run(() => update(t, { ...t.payload, status: t.payload.status === "completed" ? "open" : "completed", completedAt: t.payload.status === "completed" ? null : new Date().toISOString() }), t.payload.status === "completed" ? "未完了に戻しました" : "完了を記録しました")}>{t.payload.status === "completed" && <Check/>}</button></div>
        <button className="task-summary" onClick={() => setModal({ kind: "task", entityId: t.id })}>
          {parent && <span className="task-parent">{parent.payload.title}</span>}<b>{t.payload.title}</b>
          <span className="entry-meta">{group && <span>{group.payload.name}</span>}<span>{t.payload.deadline ? new Date(t.payload.deadline).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "まで" : "期限なし"}</span>{t.payload.estimateMinutes ? <span>{t.payload.estimateMinutes}分</span> : null}{linked(t.id).length > 0 && <span>予定 {linked(t.id).length}件</span>}{t.payload.status === "cancelled" && <span>取り消し</span>}</span>
        </button>
        <button className="diary-button task-schedule" onClick={() => setModal({ kind: "plan", taskId: t.id })}><CalendarPlus size={15}/>予定に入れる</button>
        <button className="diary-icon-button task-delete" aria-label={`${t.payload.title}を削除`} disabled={action.busy} onClick={() => void action.run(() => update(t, t.payload, true), "タスクを削除しました")}><Trash2 size={15}/></button>
      </article>;
    }) : <DiaryEmpty title={tasks.length ? "条件に合うタスクはありません" : "最初のやることを書こう"}>思いついたことを追加して、あとから予定を決められます。</DiaryEmpty>}</div>
  </section>;
}
