"use client";
import { useState } from "react";
import { CalendarDays, Check, Clock3, Inbox, MoreHorizontal, RotateCcw, X } from "lucide-react";
import { unresolved, type CoreEntity, type InboxData, type PlanData } from "../domain/core";
import type { CaptureState } from "./diary-types";
import { ActionFeedback, DiaryEmpty, SectionHeading, useDiaryAction, type CreateEntity, type UpdateEntity } from "./diary-section";

const groups = [
  { kind: "plan", title: "終わった予定", note: "実際にどう過ごしたか、記録を合わせよう。" },
  { kind: "task", title: "時間を決めるタスク", note: "期限が近いものから、取りかかる時間を。" },
  { kind: "inbox", title: "書きとめたメモ", note: "やることにするか、整理済みにするかを選べます。" },
  { kind: "conflict", title: "時間の重なり", note: "カレンダーで予定を見比べよう。" },
  { kind: "transaction", title: "入出金の確認", note: "予定していたお金の動きを確認しよう。" },
] as const;

export function InboxView({ entities, checks, update, postpone, recordAsPlanned, create, setModal, openCalendar }: {
  entities: CoreEntity[]; checks: ReturnType<typeof unresolved>; update: UpdateEntity; create: CreateEntity;
  postpone: (plan: CoreEntity<PlanData>, startAt?: string, endAt?: string) => Promise<void>; recordAsPlanned: (plan: CoreEntity<PlanData>) => Promise<void>;
  setModal: (modal: CaptureState) => void; openCalendar: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [rescheduling, setRescheduling] = useState<CoreEntity<PlanData> | null>(null), [moveDate, setMoveDate] = useState(""), [moveStart, setMoveStart] = useState("09:00"), [moveEnd, setMoveEnd] = useState("10:00");
  const action = useDiaryAction();
  // If marking the source note fails, retry only that step during this visit.
  const [converted, setConverted] = useState(new Set<string>());
  return <div className="organize-list"><section className="panel notebook inbox-notebook">
    <SectionHeading icon={<Inbox/>} title="今日を整える" description="できたことも、変わった予定も。ひとつずつ今の生活に合わせよう。"/>
    <div className="notebook-tabs" aria-label="未整理の表示"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>すべて<small>{checks.length}</small></button>
      {groups.filter(group => checks.some(c => c.kind === group.kind)).map(group => <button key={group.kind} aria-pressed={filter === group.kind} onClick={() => setFilter(group.kind)}>{group.title}<small>{checks.filter(c => c.kind === group.kind).length}</small></button>)}
    </div>
    <ActionFeedback {...action} fairy/>
    {checks.length === 0 ? <DiaryEmpty title="いま確認が必要なものはありません">記録は整いました。次のことへ、ゆっくり進もう。</DiaryEmpty> : groups.filter(group => filter === "all" || filter === group.kind).map(group => {
      const items = checks.filter(c => c.kind === group.kind);
      return items.length ? <section className="reconcile-group" key={group.kind}><div className="reconcile-group-heading"><h3>{group.title}<span>{items.length}</span></h3><p>{group.note}</p></div>
        {items.map(c => {
          const entity = entities.find(e => e.id === c.id);
          const run = (fn: () => Promise<void>, message = "記録を整えました") => void action.run(fn, message);
          return <article className={`reconcile-card kind-${c.kind}`} key={`${c.kind}-${c.id}`} data-check-id={c.id}>
            <div className="reconcile-copy"><b>{c.label}</b>{c.kind === "plan" && entity && <time>{new Date((entity.payload as PlanData).startAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}〜{new Date((entity.payload as PlanData).endAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time>}</div>
            <div className="reconcile-actions">
              {c.kind === "plan" && entity && <>
                <button className="diary-button primary" disabled={action.busy} onClick={() => run(() => recordAsPlanned(entity as CoreEntity<PlanData>))}><Check size={15}/>だいたい予定通り</button>
                <button className="diary-button" disabled={action.busy} onClick={() => setModal({ kind: "actual", planId: entity.id })}><Clock3 size={15}/>実際の時間を入力</button>
                <details className="entry-more"><summary aria-label={`${(entity.payload as PlanData).title}のその他の操作`}><MoreHorizontal size={18}/>その他</summary><div>
                  <button disabled={action.busy} onClick={() => { const plan = entity as CoreEntity<PlanData>, next = new Date(plan.payload.startAt); next.setDate(next.getDate() + 1); setRescheduling(plan); setMoveDate(next.toLocaleDateString("sv-SE")); setMoveStart(new Date(plan.payload.startAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })); setMoveEnd(new Date(plan.payload.endAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false })); }}><RotateCcw size={14}/>別日に移す</button>
                  <button disabled={action.busy} onClick={() => run(() => update(entity, { ...entity.payload, resolution: "skipped" }))}>今回はスキップ</button>
                  <button disabled={action.busy} onClick={() => run(() => update(entity, { ...entity.payload, resolution: "unneeded" }))}>不要になった</button>
                </div></details>
              </>}
              {c.kind === "task" && <button className="diary-button primary" disabled={action.busy} onClick={() => setModal({ kind: "plan", taskId: c.id })}><CalendarDays size={15}/>予定を決める</button>}
              {c.kind === "inbox" && entity && <>
                <button className="diary-button primary" disabled={action.busy} onClick={() => run(async () => {
                  if (!converted.has(entity.id)) {
                    await create("task", { title: (entity.payload as InboxData).text, description: "", deadline: null, estimateMinutes: null, estimatedRemainingMinutes: null, nextAction: null, directionId: null, projectId: null, parentTaskId: null, calendarCategoryId: null, status: "open", completedAt: null });
                    setConverted(old => new Set([...old, entity.id]));
                  }
                  await update(entity, { ...entity.payload, sorted: true });
                }, "タスクに追加して、メモを整理しました")}>{converted.has(entity.id) ? "整理を完了する" : "タスクにする"}</button>
                <button className="diary-button" disabled={action.busy} onClick={() => run(() => update(entity, { ...entity.payload, sorted: true }))}>整理済みにする</button>
                <details className="entry-more"><summary>その他</summary><div><button disabled={action.busy} onClick={() => setModal({ kind: "inbox", entityId: entity.id })}>編集</button><button disabled={action.busy} onClick={() => run(() => update(entity, entity.payload, true), "メモを削除しました")}>削除</button></div></details>
              </>}
              {c.kind === "transaction" && entity && <button className="diary-button primary" disabled={action.busy} onClick={() => run(() => update(entity, { ...entity.payload, status: "settled" }))}><Check size={15}/>確認済みにする</button>}
              {c.kind === "conflict" && <button className="diary-button" onClick={openCalendar}><CalendarDays size={15}/>カレンダーで確認</button>}
            </div>
          </article>;
        })}
      </section> : null;
    })}
    {checks.length > 0 && filter !== "all" && !checks.some(c => c.kind === filter) && <DiaryEmpty title="この種類の確認は終わりました">「すべて」から、ほかの項目も確認できます。</DiaryEmpty>}
  </section>{rescheduling && <div className="inline-reschedule panel"><button aria-label="閉じる" onClick={() => setRescheduling(null)}><X size={16}/></button><h3>「{rescheduling.payload.title}」を移す</h3><div className="form-pair"><label>日付<input type="date" value={moveDate} onChange={event => setMoveDate(event.target.value)}/></label><label>開始<input type="time" value={moveStart} onChange={event => setMoveStart(event.target.value)}/></label><label>終了<input type="time" value={moveEnd} onChange={event => setMoveEnd(event.target.value)}/></label></div><button className="diary-button primary" disabled={action.busy || !moveDate || moveStart >= moveEnd} onClick={() => void action.run(async () => { await postpone(rescheduling, new Date(moveDate + "T" + moveStart + ":00").toISOString(), new Date(moveDate + "T" + moveEnd + ":00").toISOString()); setRescheduling(null); }, "元の予定を残して移しました")}>この日時へ移す</button></div>}</div>;
}
