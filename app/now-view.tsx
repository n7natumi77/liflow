"use client";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Gem, Inbox, ListTodo, Plus, Repeat2, Sparkles } from "lucide-react";
import { active, availableMinutes, layoutOverlaps, routineOccurs, unresolved, type CoreEntity, type EntityType, type PlanData, type TaskData, type ActualData, type RoutineData, type RoutineOccurrenceData, type CalendarCategoryData } from "../domain/core";
import { FairyCharacter } from "./fairy-character";
import { dateKey, dayRange, freeRanges, minuteLabel, scheduledPlans } from "./diary-time";
import type { Capture, CaptureState } from "./diary-types";
const time = (iso: string | Date) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const duration = (minutes: number) => minutes >= 60 ? Math.floor(minutes / 60) + "時間" + (minutes % 60 ? minutes % 60 + "分" : "") : minutes + "分";
type Props = {
  entities: CoreEntity[]; create: (type: EntityType, payload: Record<string, unknown>) => Promise<void>;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
  clock: Date; nowPlan?: CoreEntity<PlanData>; nextPlan?: CoreEntity<PlanData>; plans: CoreEntity<PlanData>[];
  tasks: CoreEntity<TaskData>[]; inboxCount: number; checks: number; dayEnd: string;
  setTab: (tab: string) => void; setModal: (modal: CaptureState) => void;
};
export default function NowView({ entities, create, update, clock, nowPlan, nextPlan, plans, tasks, checks, dayEnd, setTab, setModal }: Props) {
  const [busy, setBusy] = useState<string | null>(null), [celebrating, setCelebrating] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), 2200);
    return () => clearTimeout(timer);
  }, [celebrating]);
  const free = availableMinutes(scheduledPlans(plans), clock, dayEnd), date = dateKey(clock);
  const routines = active<RoutineData>(entities, "routine").filter(r => r.payload.active && routineOccurs(r.payload.scheduleRule, clock));
  const occurrences = active<RoutineOccurrenceData>(entities, "routineOccurrence");
  const status = (id: string) => occurrences.find(o => o.payload.routineId === id && o.payload.date === date)?.payload.status;
  const timed = routines.filter(r => r.payload.preferredTime && status(r.id) !== "done" && status(r.id) !== "skipped").map(r => {
    const start = new Date(date + "T" + r.payload.preferredTime + ":00");
    return { routine: r, start, end: new Date(+start + (r.payload.expectedDuration || 30) * 60000) };
  }).sort((a, b) => +a.start - +b.start);
  const currentRoutine = timed.find(r => r.start <= clock && clock < r.end), nextRoutine = timed.find(r => r.start > clock);
  const nextIsRoutine = !!nextRoutine && (!nextPlan || nextRoutine.start < new Date(nextPlan.payload.startAt));
  const nextStart = nextIsRoutine && nextRoutine ? nextRoutine.start : nextPlan ? new Date(nextPlan.payload.startAt) : null;
  const nextTitle = nextIsRoutine && nextRoutine ? nextRoutine.routine.payload.title : nextPlan?.payload.title;
  const contiguous = !nowPlan && !currentRoutine && nextStart ? Math.max(0, Math.floor((+nextStart - +clock) / 60000)) : 0;
  const due = tasks.filter(t => t.payload.status === "open").sort((a, b) => (a.payload.deadline || "9999").localeCompare(b.payload.deadline || "9999")).slice(0, 3);
  const pending = unresolved(entities, clock).slice(0, 2);
  const fairy = celebrating ? "できたね！ ひとつずつ、この調子。"
    : contiguous > 0 ? "次の予定まで" + duration(contiguous) + "。ちょっとひと息つく？"
    : nowPlan ? "「" + nowPlan.payload.title + "」の時間だね。あなたのペースでいこう。"
    : currentRoutine ? "「" + currentRoutine.routine.payload.title + "」の時間だよ。一緒にやってみよう。"
    : checks > 0 ? "あとで確認したいことがあるみたい。落ち着いたときに、一緒に整えよう。"
    : free > 0 ? "今日はあと" + duration(free) + "空いてるよ。何をしようか？"
    : "今日もおつかれさま。ゆっくり休んでね。";
  const mark = async (r: CoreEntity<RoutineData>) => {
    if (busy) return;
    setBusy(r.id); setNotice("");
    try {
      const occurrence = occurrences.find(o => o.payload.routineId === r.id && o.payload.date === date);
      if (occurrence) await update(occurrence, { ...occurrence.payload, status: "done" });
      else await create("routineOccurrence", { routineId: r.id, date, status: "done", actualId: null });
      setCelebrating(true); setNotice(r.payload.title + "を記録しました。");
    } catch { setNotice("保存できませんでした。同期状態を確認してください。"); }
    finally { setBusy(null); }
  };
  return <div className="diary-now">
    <section className={"diary-hero panel" + (celebrating ? " is-celebrating" : "")} aria-label="今と次の予定">
      <div className="hero-content">
        <div className="hero-clock"><Clock3 size={16} /><time dateTime={clock.toISOString()}>{time(clock)}</time><span>あなたのペースで、今日を。</span></div>
        <div className="focus-sticker">
          <span className="focus-label"><Gem size={15} />{nowPlan ? "いまの予定" : currentRoutine ? "いまのルーティン" : "いまは、自由な時間"}</span>
          <h2>{nowPlan?.payload.title || currentRoutine?.routine.payload.title || "今、やりたいことから。"}</h2>
          <p>{nowPlan ? time(nowPlan.payload.startAt) + " – " + time(nowPlan.payload.endAt) : currentRoutine ? time(currentRoutine.start) + "ごろ" : "ひとつ進めても、少し休んでも大丈夫。"}</p>
          {nowPlan ? <button className="diary-button primary" onClick={() => setModal({ kind: "actual", planId: nowPlan.id })}><Check size={17} />実績を記録</button>
            : currentRoutine ? <button className="diary-button primary" disabled={!!busy} onClick={() => void mark(currentRoutine.routine)}><Check size={17} />{busy ? "保存中…" : "実施した"}</button>
            : <button className="diary-button primary" onClick={() => setModal({ kind: "inbox" })}><Plus size={17} />思いついたことを記録</button>}
        </div>
        <div className="hero-next"><span>このあと</span><div><b>{nextStart ? time(nextStart) + (nextIsRoutine ? "ごろ" : "から") : "予定はまだありません"}</b><p>{nextTitle || "空けておいても大丈夫。"}</p></div>
          <button className="diary-icon-button" onClick={() => setTab("today")} aria-label="今日の予定を見る"><ArrowRight size={19} /></button>
        </div>
        <p className="free-caption"><Clock3 size={14} /><b>{duration(free)}</b><span>{dayEnd}までの空き時間</span></p>
      </div>
      <div className="fairy-companion">
        <div className="fairy-bubble" aria-live="polite">{fairy}</div>
        <button className="fairy-greeting" onClick={() => setCelebrating(true)} aria-label="リフちゃんに話しかける">
          <FairyCharacter size={240} expression={celebrating ? "happy" : clock.getHours() >= 23 || clock.getHours() < 5 ? "sleepy" : "normal"} decorative />
        </button>
        <span className="fairy-name"><Sparkles size={13} />リフちゃん</span>
        {celebrating && <span className="celebration-stars" aria-hidden="true"><Sparkles /><Gem /><Sparkles /></span>}
      </div>
    </section>
    <section className="panel now-tasks">
      <div className="section-title"><h2><ListTodo size={18} />やること</h2><button onClick={() => setTab("tasks")} aria-label="すべてのタスクを見る"><ChevronRight size={17} /></button></div>
      {due.length ? due.map(task => <div className="diary-task-row" key={task.id}>
        <span className="task-dot" aria-hidden="true" /><button onClick={() => setModal({ kind: "task", entityId: task.id })}><b>{task.payload.title}</b><small>{task.payload.deadline ? new Date(task.payload.deadline).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "まで" : "期限なし"}</small></button>
        <button className="diary-icon-button" onClick={() => setModal({ kind: "plan", taskId: task.id })} aria-label={task.payload.title + "を予定に入れる"}><CalendarDays size={16} /></button>
      </div>) : <p className="diary-empty">やることを、ひとつずつ。<br />思いついたらここに残せます。</p>}
      <button className="diary-text-button" onClick={() => setModal({ kind: "task" })}><Plus size={16} />タスクを追加</button>
    </section>
    <TodayFlow entities={entities} clock={clock} plans={plans} setModal={setModal} setTab={setTab} />
    <section className="panel now-unresolved">
      <div className="section-title"><h2><Inbox size={18} />あとで整える</h2><span>{checks}</span></div>
      {pending.length ? pending.map(item => <button className="unresolved-preview" key={item.kind + item.id} onClick={() => setTab("inbox")}><Gem size={15} /><span>{item.label}</span><ChevronRight size={15} /></button>)
        : <p className="diary-empty">確認したいことはありません。<br />今日の流れは、いい感じ。</p>}
      <button className="diary-text-button" onClick={() => setTab("inbox")}>未整理を見る<ChevronRight size={16} /></button>
    </section>
    <section className="panel now-routines">
      <div className="section-title"><h2><Repeat2 size={18} />今日のルーティン</h2><button onClick={() => setTab("routines")}>すべて見る<ChevronRight size={16} /></button></div>
      <div className="routine-chips">{routines.slice(0, 4).map(r => <button key={r.id} className={"routine-chip " + (status(r.id) || "pending")} disabled={!!busy || status(r.id) === "done" || status(r.id) === "skipped"} onClick={() => void mark(r)}>
        <span className="routine-check">{status(r.id) === "done" ? <Check size={16} /> : <Repeat2 size={14} />}</span>
        <span><b>{r.payload.title}</b><small>{busy === r.id ? "保存中…" : status(r.id) === "done" ? "実施済み" : status(r.id) === "skipped" ? "スキップ" : r.payload.preferredTime || "好きなタイミングで"}</small></span>
      </button>)}</div>
      {!routines.length && <p className="diary-empty">今日のルーティンはありません。</p>}
      <p className="diary-feedback" role="status">{notice}</p>
    </section>
    <section className="now-capture" aria-label="すばやく記録"><span>何を残す？</span>{(["task", "plan", "actual", "inbox"] as Capture[]).map((kind, index) => <button className="diary-button" key={kind} onClick={() => setModal({ kind })}><Plus size={15} />{["タスク", "予定", "実績", "メモ"][index]}</button>)}</section>
  </div>;
}
function TodayFlow({ entities, clock, plans, setModal, setTab }: Pick<Props, "entities" | "clock" | "plans" | "setModal" | "setTab">) {
  const from = 7 * 60, to = 24 * 60, length = to - from;
  const categories = active<CalendarCategoryData>(entities, "calendarCategory");
  const color = (id?: string | null) => categories.find(c => c.id === id)?.payload.colorToken || "#bca3d5";
  const items = scheduledPlans(plans).filter(p => { const r = dayRange(p.payload.startAt, p.payload.endAt, clock); return r && r.end > from; });
  const actuals = active<ActualData>(entities, "actual").filter(p => { const r = dayRange(p.payload.startAt, p.payload.endAt, clock); return r && r.end > from; });
  const layout = layoutOverlaps(items), columns = Math.max(1, ...layout.map(x => x.columns));
  const current = clock.getHours() * 60 + clock.getMinutes();
  return <section className="panel today-flow"><div className="section-title"><h2><CalendarDays size={18} />今日の流れ</h2><button onClick={() => setTab("today")} aria-label="日表示カレンダーを開く"><ChevronRight size={17} /></button></div>
    <div className="flow-scale">{[7, 10, 13, 16, 19, 22].map(hour => <span key={hour} style={{ left: (hour * 60 - from) / length * 100 + "%" }}>{hour}</span>)}</div>
    <div className="flow-track" style={{ height: columns * 29 + 24 }}>
      {freeRanges(plans, clock, from, to).map(gap => <span className="flow-free" key={gap.start} style={{ left: (gap.start - from) / length * 100 + "%", width: (gap.end - gap.start) / length * 100 + "%" }} title={minuteLabel(gap.start) + "–" + minuteLabel(gap.end) + " 空き時間"} />)}
      {layout.map(({ item, column }) => { const r = dayRange(item.payload.startAt, item.payload.endAt, clock)!; const start = Math.max(from, r.start), end = Math.min(to, r.end);
        return <button key={item.id} className="flow-block" style={{ top: column * 29 + 5, left: (start - from) / length * 100 + "%", width: (end - start) / length * 100 + "%", backgroundColor: color(item.payload.calendarCategoryId) }} onClick={() => setModal({ kind: "plan", entityId: item.id })} aria-label={item.payload.title + " " + time(item.payload.startAt) + "–" + time(item.payload.endAt)} title={item.payload.title + " " + time(item.payload.startAt) + "–" + time(item.payload.endAt)} />; })}
      {current >= from && current < to && <span className="flow-now" style={{ left: (current - from) / length * 100 + "%" }}><small>今</small></span>}
    </div>
    <div className="flow-actuals" aria-label="今日の実績">{actuals.map(item => { const r = dayRange(item.payload.startAt, item.payload.endAt, clock)!; const start = Math.max(from, r.start);
      return <button key={item.id} style={{ left: (start - from) / length * 100 + "%", width: (Math.min(to, r.end) - start) / length * 100 + "%" }} title={"実績 " + item.payload.title} aria-label={"実績 " + item.payload.title} onClick={() => setModal({ kind: "actual", entityId: item.id })} />; })}</div>
    <div className="flow-legend"><span><i />予定</span><span><i className="actual" />実績</span><span><i className="free" />空き時間</span></div>
    <p className="flow-hint">時間のすきまも、あなたの時間。</p>
  </section>;
}
