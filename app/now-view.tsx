"use client";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Gem, Inbox, ListTodo, Play, Plus, Sparkles, Undo2 } from "lucide-react";
import { active, unresolved, type ConditionRecordData, type CoreEntity, type EntityType, type ExecutionOutcome, type PlanData, type SettingsData, type TaskData } from "../domain/core";
import { getNowDecision, type StartAssistReason } from "../domain/now-engine";
import { activeRecoveryRequest, activeUnavailableRecords, endOfLocalDay, unavailableTargets } from "../domain/start-assist";
import { currentTaskAction } from "../domain/task-actions";
import { FairyCharacter } from "./fairy-character";
import type { Capture, CaptureState } from "./diary-types";

const time = (iso: string | Date) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const duration = (minutes: number) => minutes >= 60 ? Math.floor(minutes / 60) + "時間" + (minutes % 60 ? minutes % 60 + "分" : "") : minutes + "分";
type Props = {
  entities: CoreEntity[];
  create: (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
  clock: Date;
  plans: CoreEntity<PlanData>[];
  tasks: CoreEntity<TaskData>[];
  inboxCount: number;
  checks: number;
  setTab: (tab: string) => void;
  setModal: (modal: CaptureState) => void;
  beginExecution: (targetId: string, suggestedMinutes: number | null) => Promise<void>;
  endExecution: (sessionId: string, outcome: ExecutionOutcome, completeTask?: boolean) => Promise<void>;
  recordWake: () => Promise<void>;
  notificationEntry?: string;
};

export default function NowView({ entities, create, update, clock, plans, tasks, inboxCount, checks, setTab, setModal, beginExecution, endExecution, recordWake, notificationEntry }: Props) {
  const [busy, setBusy] = useState<string | null>(null), [notice, setNotice] = useState(""), [celebrating, setCelebrating] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false), [assistPanel, setAssistPanel] = useState<"friction" | "unavailable" | "occupied" | null>(null);
  const [assistReason, setAssistReason] = useState<StartAssistReason | null>(null), [skippedTaskIds, setSkippedTaskIds] = useState<string[]>([]);
  useEffect(() => { if (!celebrating) return; const timer = setTimeout(() => setCelebrating(false), 1800); return () => clearTimeout(timer); }, [celebrating]);
  const unavailable = unavailableTargets(entities, clock);
  const decision = getNowDecision(entities, clock, { assistReason, skippedTaskIds, unavailableTaskIds: unavailable.taskIds, unavailablePlanIds: unavailable.planIds });
  const guidance = active<SettingsData>(entities, "settings")[0]?.payload.guidanceIntensity || "strong";
  const action = decision.primaryAction, pending = unresolved(entities, clock), unavailableRecords = activeUnavailableRecords(entities, clock), recovery = activeRecoveryRequest(entities, clock);
  const currentTarget = action?.kind === "task" ? { id: action.taskId, kind: "task" as const } : action?.kind === "plan" ? { id: action.planId, kind: "plan" as const } : null;
  const elapsed = action?.kind === "session" ? Math.max(0, Math.floor((clock.getTime() - Date.parse(action.startedAt)) / 60000)) : 0;
  const run = async (key: string, operation: () => Promise<unknown>, message = "") => {
    if (busy) return;
    setBusy(key); setNotice("");
    try { await operation(); setNotice(message); setCelebrating(true); setAssistOpen(false); setAssistPanel(null); setAssistReason(null); }
    catch { setNotice("保存できませんでした。同期状態を確認してください。"); }
    finally { setBusy(null); }
  };
  const recordUnavailable = async (reason: "occupied" | "contextUnavailable" | "blocked" | "insufficientWindow", expiresAt?: string) => {
    if (!currentTarget) return;
    const expiry = expiresAt || (reason === "insufficientWindow" ? decision.usableUntil || new Date(clock.getTime() + 15 * 60000).toISOString() : endOfLocalDay(clock));
    await create("conditionRecord", {
      recordedAt: clock.toISOString(), date: clock.toISOString().slice(0, 10), energyLevel: null, fatigue: null, mood: null,
      note: "Nowの現実状態を更新", source: "manual", confidence: 1,
      startAssist: { reason, targetId: currentTarget.id, targetKind: currentTarget.kind, usableMinutes: decision.usableMinutes, expiresAt: expiry, resolvedAt: null, windowKey: decision.usableUntil },
      recoveryRequest: null,
    });
  };
  const chooseFriction = async (reason: StartAssistReason) => {
    if (reason !== "tired") { setAssistReason(reason); setAssistOpen(false); setAssistPanel(null); return; }
    const expiresAt = new Date(clock.getTime() + 15 * 60000).toISOString();
    await run("recovery", () => create("conditionRecord", {
      recordedAt: clock.toISOString(), date: clock.toISOString().slice(0, 10), energyLevel: null, fatigue: null, mood: null,
      note: "短い回復を希望", source: "manual", confidence: 1, startAssist: null,
      recoveryRequest: { requestedAt: clock.toISOString(), expiresAt, resolvedAt: null },
    }), "15分だけ休む時間にしました。");
  };
  const restore = (record: CoreEntity<ConditionRecordData>) => run("restore-" + record.id, () => update(record, {
    ...record.payload, startAssist: record.payload.startAssist ? { ...record.payload.startAssist, resolvedAt: clock.toISOString() } : null,
  }), "候補に戻しました。");
  const resolveRecovery = () => recovery ? run("recovered", () => update(recovery, {
    ...recovery.payload, recoveryRequest: recovery.payload.recoveryRequest ? { ...recovery.payload.recoveryRequest, resolvedAt: clock.toISOString() } : null,
  }), "今の状態でもう一度選び直しました。") : Promise.resolve();
  const occupiedPlans = plans.filter(plan => !plan.payload.resolution && plan.id !== (action?.kind === "plan" ? action.planId : "") && Date.parse(plan.payload.endAt) > clock.getTime()).slice(0, 4);
  const occupiedTasks = tasks.filter(task => task.payload.status === "open" && task.id !== (action?.kind === "task" ? action.taskId : "")).slice(0, 4);
  const nextTitle = decision.nextAnchorAt ? plans.find(plan => plan.payload.startAt === decision.nextAnchorAt)?.payload.title || "次の予定" : "固定予定はありません";
  const localDay = clock.getFullYear() + "-" + String(clock.getMonth() + 1).padStart(2, "0") + "-" + String(clock.getDate()).padStart(2, "0");
  const todayPlans = plans.filter(plan => {
    const date = new Date(plan.payload.startAt);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") === localDay && !plan.payload.resolution;
  }).sort((a, b) => a.payload.startAt.localeCompare(b.payload.startAt));
  const dueTasks = tasks.filter(task => task.payload.status === "open").sort((a, b) => (a.payload.deadline || "9999").localeCompare(b.payload.deadline || "9999")).slice(0, 4);
  const label = action?.kind === "session" ? "実行中" : action?.kind === "wake" ? "起床確認" : action?.kind === "plan" ? "いまの予定" : action?.kind === "task" ? "次はこれ" : action?.kind === "rest" ? "回復" : "自由時間";
  return <div className="diary-now now-cockpit" data-guidance={guidance}>
    {notificationEntry && <div className="notification-entry" role="status">通知から開きました。今の現実に合わせて選び直しています。</div>}
    <section className={"diary-hero panel cockpit-now" + (celebrating ? " is-celebrating" : "")} aria-labelledby="now-heading">
      <div className="hero-content"><div className="hero-clock"><Clock3 size={16}/><time dateTime={clock.toISOString()}>{time(clock)}</time><span>NOW</span></div>
        <div className="focus-sticker"><span className="focus-label"><Gem size={15}/>{label}</span><h2 id="now-heading">{action?.title || "急ぎのものはないよ"}</h2>
          {action?.kind === "session" ? <p>{time(action.startedAt)}から · 経過 {duration(elapsed)}</p> : action?.kind === "task" || action?.kind === "rest" ? <p>{action.suggestedMinutes}分だけ</p> : action?.kind === "plan" ? <p>固定予定を優先しています</p> : <p>何もしない時間も大切です。</p>}
          {action?.kind === "task" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("start", () => beginExecution(action.taskId, action.suggestedMinutes), "始めました。")}><Play size={17}/>開始</button>}
          {action?.kind === "plan" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("start", () => beginExecution(action.planId, null), "始めました。")}><Play size={17}/>開始</button>}
          {action?.kind === "wake" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("wake", recordWake, "起床を記録しました。")}><Check size={17}/>起きた</button>}
          {action?.kind === "session" && <div className="now-session-actions"><button className="diary-button primary" disabled={!!busy} onClick={() => void run("finish", () => endExecution(action.sessionId, "activityCompleted"), "実績を記録しました。")}><Check size={17}/>この作業は終わった</button>{action.taskId && <button className="diary-button" disabled={!!busy} onClick={() => void run("finish-task", () => endExecution(action.sessionId, "activityCompleted", true), "Taskも完了しました。")}>Taskも完了</button>}<button className="diary-text-button" disabled={!!busy} onClick={() => void run("pause", () => endExecution(action.sessionId, "paused"), "いったん止めました。")}>いったん止める</button></div>}
          {action?.kind === "rest" && <div className="now-session-actions"><button className="diary-button primary" onClick={() => setNotice("15分だけ、画面から離れて大丈夫です。")}>休憩する</button><button className="diary-button" disabled={!!busy} onClick={() => void resolveRecovery()}>もう大丈夫</button></div>}
          {(action?.kind === "task" || action?.kind === "plan") && <div className="start-assist"><button className="diary-text-button" onClick={() => { setAssistOpen(value => !value); setAssistPanel(null); }}>今むり</button>{action.kind === "task" && <button className="diary-text-button" onClick={() => setSkippedTaskIds(old => old.includes(action.taskId) ? old : [...old, action.taskId])}>違う</button>}</div>}
          {assistOpen && !assistPanel && <div className="assist-reasons assist-groups"><button onClick={() => setAssistPanel("unavailable")}><b>今はできない</b><small>場所・時間・待ち状態</small></button><button onClick={() => setAssistPanel("friction")}><b>取りかかりにくい</b><small>大きさ・疲れ・気分</small></button></div>}
          {assistPanel === "friction" && <div className="assist-reasons">{[["unknown", "何すればいいかわからない"], ["heavy", "大きすぎる"], ["tired", "疲れた"], ["boring", "つまらない"]].map(([reason, text]) => <button key={reason} onClick={() => void chooseFriction(reason as StartAssistReason)}>{text}</button>)}</div>}
          {assistPanel === "unavailable" && <div className="assist-reasons"><button onClick={() => setAssistPanel("occupied")}>別のことをしている</button><button onClick={() => void run("context", () => recordUnavailable("contextUnavailable"), "今日は候補から外しました。")}>場所・道具がない</button><button onClick={() => void run("blocked", () => recordUnavailable("blocked"), "今日は候補から外しました。")}>誰か／何かを待っている</button><button onClick={() => void run("window", () => recordUnavailable("insufficientWindow"), "次の時間枠まで候補から外しました。")}>今は時間が足りない</button></div>}
          {assistPanel === "occupied" && <div className="assist-occupied"><b>今やっているのは？</b>{occupiedPlans.map(plan => <button key={plan.id} onClick={() => void run("occupied-" + plan.id, async () => { await recordUnavailable("occupied", plan.payload.endAt); await beginExecution(plan.id, null); }, "現実の行動へ切り替えました。")}><span>{time(plan.payload.startAt)}</span>{plan.payload.title}</button>)}{occupiedTasks.map(task => <button key={task.id} onClick={() => void run("occupied-" + task.id, async () => { await recordUnavailable("occupied", endOfLocalDay(clock)); await beginExecution(task.id, currentTaskAction(entities, task.id)?.payload.estimatedMinutes || 25); }, "現実の行動へ切り替えました。")}><span>Task</span>{task.payload.title}</button>)}</div>}
        </div><p className="free-caption"><Clock3 size={14}/><b>{duration(decision.usableMinutes || 0)}</b><span>今、安全に使える時間</span></p>
      </div>
      <div className="fairy-companion compact"><div className="fairy-bubble">{decision.reason === "recovery" ? "まず短く休もう。責めなくて大丈夫。" : action ? "今は「" + action.title + "」だけ見よう。" : "空けておいても大丈夫。"}</div><FairyCharacter size={150} expression={celebrating ? "happy" : "normal"} decorative/><span className="fairy-name"><Sparkles size={13}/>リフちゃん</span></div>
    </section>
    <section className="panel cockpit-next"><div className="section-title"><h2>NEXT</h2></div><b>{decision.nextAnchorAt ? time(decision.nextAnchorAt) + " " + nextTitle : nextTitle}</b><p>{decision.departureAt ? "推奨出発 " + time(decision.departureAt) : decision.usableUntil ? time(decision.usableUntil) + "まで安全" : "固定予定はありません"}</p><button className="diary-text-button" onClick={() => setTab("plan")}>カレンダーを見る<ArrowRight size={16}/></button></section>
    <section className="panel cockpit-today"><div className="section-title"><h2>TODAY</h2><button onClick={() => setTab("plan")}><CalendarDays size={17}/></button></div>{todayPlans.slice(0, 5).map(plan => <button className="today-cockpit-row" key={plan.id} onClick={() => setModal({ kind: "plan", entityId: plan.id })}><time>{time(plan.payload.startAt)}</time><b>{plan.payload.title}</b></button>)}{!todayPlans.length && <p className="diary-empty">今日の固定予定はありません。</p>}</section>
    {guidance !== "strong" && <section className="panel cockpit-helper"><div className="section-title"><h2><ListTodo size={17}/>今日の補助</h2></div>{dueTasks.map(task => <button className="diary-task-row" key={task.id} onClick={() => setModal({ kind: "task", entityId: task.id })}><b>{task.payload.title}</b><small>{currentTaskAction(entities, task.id)?.payload.title || "次の一手を整える"}</small></button>)}</section>}
    {guidance === "balanced" && <section className="panel cockpit-inbox"><div className="section-title"><h2><Inbox size={17}/>未整理</h2><span>{inboxCount}</span></div><button className="diary-text-button" onClick={() => setTab("inbox")}>{checks}件をあとで整える<ArrowRight size={16}/></button></section>}
    <section className="panel cockpit-other"><div className="section-title"><h2>OTHER</h2></div>{unavailableRecords.map(record => <button className="unavailable-restore" key={record.id} disabled={!!busy} onClick={() => void restore(record)}><Undo2 size={15}/><span>{String(entities.find(entity => entity.id === record.payload.startAssist?.targetId)?.payload.title || "候補")}</span><small>候補に戻す</small></button>)}{!unavailableRecords.length && <p className="diary-empty">一時的に外した候補はありません。</p>}{pending.length > 0 && <button className="diary-text-button" onClick={() => setTab("inbox")}>未整理 {pending.length}件<ArrowRight size={16}/></button>}</section>
    {guidance === "light" && <section className="now-capture" aria-label="すばやく記録"><span>すばやく記録</span>{(["task", "plan", "actual", "money", "inbox"] as Capture[]).map((kind, index) => <button className="diary-button" key={kind} onClick={() => setModal({ kind })}><Plus size={15}/>{["タスク", "予定", "実績", "お金", "メモ"][index]}</button>)}</section>}
    {notice && <p className="diary-feedback" role="status">{notice}</p>}
  </div>;
}
