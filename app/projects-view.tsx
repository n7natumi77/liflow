"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FolderTree, Plus, Trash2 } from "lucide-react";
import { active, wouldCreateCycle, type CalendarCategoryData, type CoreEntity, type ProjectData, type TaskData } from "../domain/core";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";

export function ProjectsView({ entities, create, update }: SectionProps) {
  const projects = active<ProjectData>(entities, "project"), tasks = active<TaskData>(entities, "task"), categories = active<CalendarCategoryData>(entities, "calendarCategory");
  const [editing, setEditing] = useState<CoreEntity<ProjectData> | null | undefined>(undefined);
  const [parent, setParent] = useState(""), [name, setName] = useState(""), [description, setDescription] = useState(""), [category, setCategory] = useState("");
  const [status, setStatus] = useState<ProjectData["status"]>("active"), [filter, setFilter] = useState("active"), [collapsed, setCollapsed] = useState(new Set<string>());
  const action = useDiaryAction();
  const parents = new Map(projects.map(p => [p.id, p.payload.parentProjectId]));
  const begin = (item: CoreEntity<ProjectData> | null = null, parentId = "") => {
    setEditing(item); setParent(item?.payload.parentProjectId || parentId); setName(item?.payload.name || "");
    setDescription(item?.payload.description || ""); setCategory(item?.payload.calendarCategoryId || ""); setStatus(item?.payload.status || "active"); action.clearError();
  };
  const save = async () => {
    if (!name.trim() || (editing && wouldCreateCycle(editing.id, parent, parents))) return;
    const payload = { ...editing?.payload, name: name.trim(), description, parentProjectId: parent || null, calendarCategoryId: category || null, status };
    if (await action.run(() => editing ? update(editing, payload) : create("project", payload))) setEditing(undefined);
  };
  const displayed = projects.filter(p => filter === "all" || p.payload.status === filter);
  const visited = new Set<string>();
  const branch = (p: CoreEntity<ProjectData>, depth = 0): ReactNode => {
    if (visited.has(p.id)) return null;
    visited.add(p.id);
    const children = displayed.filter(c => c.payload.parentProjectId === p.id), group = categories.find(c => c.id === p.payload.calendarCategoryId);
    const ownTasks = tasks.filter(t => t.payload.projectId === p.id && t.payload.status !== "cancelled"), completed = ownTasks.filter(t => t.payload.status === "completed").length;
    const nested = children.map(child => branch(child, depth + 1));
    return <div className="project-branch" key={p.id} style={{ "--project-depth": Math.min(depth, 3), "--entry-color": group?.payload.colorToken || "var(--purple)" } as CSSProperties}>
      <article className="project-card" data-project-id={p.id}><div className="project-card-top">
        <span className="project-folder" aria-hidden="true"><FolderTree size={23}/></span><div className="project-copy">
          {p.payload.parentProjectId && !displayed.some(x => x.id === p.payload.parentProjectId) && <small>{projects.find(x => x.id === p.payload.parentProjectId)?.payload.name || "親プロジェクトは非表示"}</small>}
          <button className="project-name" onClick={() => begin(p)}>{p.payload.name}</button><span className="entry-meta"><span>{group?.payload.name || "カレンダーなし"}</span><span>{p.payload.status === "active" ? "進行中" : p.payload.status === "completed" ? "完了" : "アーカイブ"}</span></span>
        </div>{children.length > 0 && <button className="diary-icon-button" aria-label={`${p.payload.name}の子プロジェクトを${collapsed.has(p.id) ? "展開" : "折りたたむ"}`} aria-expanded={!collapsed.has(p.id)} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}>{collapsed.has(p.id) ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}</button>}
      </div>{p.payload.description && <p className="project-description">{p.payload.description}</p>}
        <div className="project-progress"><span>タスク {completed} / {ownTasks.length} 完了</span><progress aria-label={`${p.payload.name}のタスク完了数`} value={completed} max={ownTasks.length || 1}/></div>
        <div className="project-card-actions"><button className="diary-text-button" onClick={() => begin(null, p.id)}><Plus size={14}/>子プロジェクトを追加</button><button className="diary-button" onClick={() => begin(p)}>編集</button></div>
      </article>{!collapsed.has(p.id) && nested}
    </div>;
  };
  const roots = displayed.filter(p => !displayed.some(parentProject => parentProject.id === p.payload.parentProjectId));
  const tree = roots.map(p => branch(p));
  const orphaned = displayed.filter(p => !visited.has(p.id)).map(p => branch(p));
  return <section className="panel notebook projects-notebook">
    <SectionHeading icon={<FolderTree/>} title="活動のまとまり" description="大きな目的と、その中の小さな活動をつなげよう。" action={<button className="diary-button primary" onClick={() => begin()}><Plus size={16}/>プロジェクトを追加</button>}/>
    <div className="notebook-tabs" aria-label="プロジェクトの表示">{[["active", "進行中"], ["completed", "完了"], ["archived", "アーカイブ"], ["all", "すべて"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {editing === undefined && <ActionFeedback {...action}/>}
    <div className="project-tree">{displayed.length ? <>{tree}{orphaned}</> : <DiaryEmpty title="この表示のプロジェクトはありません">勉強や趣味など、まとめて見たい活動を追加できます。</DiaryEmpty>}</div>
    {editing !== undefined && <SectionDialog title={editing ? "プロジェクトを編集" : "プロジェクトを追加"} busy={action.busy} close={() => setEditing(undefined)}><form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={action.busy}>
      <label>名前<input autoFocus required value={name} onChange={e => setName(e.target.value)}/></label>
      <label>説明<textarea aria-label="説明" rows={3} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <div className="form-pair"><label>親プロジェクト<select aria-label="親プロジェクト" value={parent} onChange={e => setParent(e.target.value)}><option value="">なし</option>{projects.filter(p => !editing || !wouldCreateCycle(editing.id, p.id, parents)).map(p => <option key={p.id} value={p.id}>{p.payload.name}</option>)}</select></label>
        <label>カレンダー<select aria-label="カレンダー" value={category} onChange={e => setCategory(e.target.value)}><option value="">なし</option>{categories.filter(c => !c.payload.archived || c.id === category).map(c => <option key={c.id} value={c.id}>{c.payload.name}</option>)}</select></label></div>
      <label>状態<select aria-label="状態" value={status} onChange={e => setStatus(e.target.value as ProjectData["status"])}><option value="active">進行中</option><option value="completed">完了</option><option value="archived">アーカイブ</option></select></label>
      <ActionFeedback {...action}/><button className="save" type="submit" disabled={!name.trim()}>保存する</button>
      {editing && <button type="button" className="delete-entity" onClick={async () => { if (await action.run(() => update(editing, editing.payload, true), "プロジェクトを削除しました")) setEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
  </section>;
}
