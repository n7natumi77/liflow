"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Gem, Inbox, ListTodo, Play, Plus, Sparkles } from "lucide-react";
import { active, layoutOverlaps, unresolved, type CoreEntity, type EntityType, type ExecutionOutcome, type PlanData, type TaskData, type ActualData, type CalendarCategoryData, type RoutineFlowData, type SettingsData } from "../domain/core";
import { getNowDecision, type StartAssistReason } from "../domain/now-engine";
import { FairyCharacter } from "./fairy-character";
import { DirectionInsights } from "./direction-insights";
import { dayRange, freeRanges, minuteLabel, scheduledPlans } from "./diary-time";
import type { Capture, CaptureState } from "./diary-types";
const time = (iso: string | Date) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const duration = (minutes: number) => minutes >= 60 ? Math.floor(minutes / 60) + "時間" + (minutes % 60 ? minutes % 60 + "分" : "") : minutes + "分";
type Props = {
  entities: CoreEntity[]; create: (type: EntityType, payload: Record<string, unknown>) => Promise<void>;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
  clock: Date; nowPlan?: CoreEntity<PlanData>; nextPlan?: CoreEntity<PlanData>; plans: CoreEntity<PlanData>[];
  tasks: CoreEntity<TaskData>[]; inboxCount: number; checks: number; dayEnd: string;
  setTab: (tab: string) => void; setModal: (modal: CaptureState) => void;
  beginExecution: (targetId: string, suggestedMinutes: number | null) => Promise<void>;
  endExecution: (sessionId: string, outcome: ExecutionOutcome, completeTask?: boolean) => Promise<void>;
  recordWake: () => Promise<void>;
  advanceFlow: (runId: string, stepId: string, outcome: "completed" | "skipped", checkedItemIds?: string[]) => Promise<void>;
  recordFatigue: () => Promise<void>;
  notificationEntry?: string;
};
export default function NowView({ entities, create, update, clock, plans, tasks, checks, setTab, setModal, beginExecution, endExecution, recordWake, advanceFlow, recordFatigue, notificationEntry }: Props) {
  const [busy, setBusy] = useState<string | null>(null), [celebrating, setCelebrating] = useState(false), [notice, setNotice] = useState("");
  const [assistOpen, setAssistOpen] = useState(false), [assistPanel, setAssistPanel] = useState<"friction" | "unavailable" | "occupied" | null>(null), [assistReason, setAssistReason] = useState<StartAssistReason | null>(null);
  const [skippedTaskIds, setSkippedTaskIds] = useState<string[]>([]), [unavailableTaskIds, setUnavailableTaskIds] = useState<string[]>([]), [checkedItems, setCheckedItems] = useState<string[]>([]);
  const automaticSteps = useRef(new Set<string>());
  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(false), 2200);
    return () => clearTimeout(timer);
  }, [celebrating]);
  const decision = getNowDecision(entities, clock, { assistReason, skippedTaskIds, unavailableTaskIds });
  const guidance = active<SettingsData>(entities, "settings")[0]?.payload.guidanceIntensity || "strong";
  const due = tasks.filter(t => t.payload.status === "open").sort((a, b) => (a.payload.deadline || "9999").localeCompare(b.payload.deadline || "9999")).slice(0, guidance === "light" ? 5 : 3);
  const pending = unresolved(entities, clock).slice(0, guidance === "light" ? 4 : 2);
  const action = decision.primaryAction;
  const routineFlow = action?.kind === "routine" ? active<RoutineFlowData>(entities, "routineFlow").find(flow => flow.payload.steps.some(step => step.id === action.stepId)) : null;
  const routineStep = action?.kind === "routine" ? routineFlow?.payload.steps.find(step => step.id === action.stepId) : null;
  const elapsed = action?.kind === "session" ? Math.max(0, Math.floor((clock.getTime() - new Date(action.startedAt).getTime()) / 60000)) : 0;
  const sessionRemaining = action?.kind === "session" && action.suggestedMinutes ? Math.max(0, action.suggestedMinutes - elapsed) : null;
  const routineElapsed = action?.kind === "routine" && action.startedAt ? Math.max(0, Math.floor((clock.getTime() - new Date(action.startedAt).getTime()) / 60000)) : 0;
  const routineRemaining = action?.kind === "routine" && action.suggestedMinutes ? action.suggestedMinutes - routineElapsed : null;
  const fairy = celebrating ? "できたね。今の現実から、次を考え直すね。"
    : decision.reason === "critical_deadline" ? "これ以上後ろへ回すと厳しいから、今はこれを少し進めよう。"
    : decision.reason === "tight_deadline" ? "締切までの余裕が少ないよ。今の時間をここに使おう。"
    : decision.reason === "direction_need" ? "最近この方向の時間が空いてるから、今日はひとつだけ。"
    : decision.reason === "recovery" ? "疲れているなら、まず短く休もう。責めなくて大丈夫。"
    : decision.reason === "wind_down" ? "今日はここまで。眠る準備に切り替えよう。"
    : decision.reason === "free" ? "急ぎのものはないよ。次の予定まで自由時間。"
    : decision.reason === "running_session" ? `「${action?.title}」を続けよう。`
    : decision.reason === "morning_routine" ? "支度をひとつずつ進めよう。"
    : decision.reason === "wake_check" ? "おはよう。起きた時刻だけ記録しよう。"
    : `今は「${action?.title || "この予定"}」の時間だよ。`;
  useEffect(() => {
    if (action?.kind !== "routine" || action.executionMode !== "automatic") return;
    const key = `${action.routineRunId}:${action.stepId}`;
    if (automaticSteps.current.has(key)) return;
    automaticSteps.current.add(key);
    void advanceFlow(action.routineRunId, action.stepId, "completed").catch(() => automaticSteps.current.delete(key));
  }, [action, advanceFlow]);
  const run = async (key: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setNotice("");
    try { await operation(); setCelebrating(true); setAssistOpen(false); setAssistPanel(null); setAssistReason(null); setCheckedItems([]); }
    catch { setNotice("保存できませんでした。同期状態を確認してください。"); }
    finally { setBusy(null); }
  };
  const chooseAssist = async (reason: StartAssistReason) => {
    setAssistReason(reason); setAssistOpen(false);
    if (reason === "tired") await run("fatigue", recordFatigue);
  };
  const currentTarget = action?.kind === "task" ? { id: action.taskId, kind: "task" as const } : action?.kind === "plan" ? { id: action.planId, kind: "plan" as const } : null;
  const observeUnavailable = async (reason: "contextUnavailable" | "blocked" | "insufficientWindow") => {
    if (action?.kind === "task") setUnavailableTaskIds(old => old.includes(action.taskId) ? old : [...old, action.taskId]);
    setAssistReason(reason); setAssistOpen(false); setAssistPanel(null);
    await run(`assist-${reason}`, () => create("conditionRecord", { recordedAt: clock.toISOString(), date: clock.toISOString().slice(0, 10), energyLevel: null, fatigue: null, mood: null, note: "Nowの現実状態を更新", source: "manual", confidence: 1, startAssist: { reason, targetId: currentTarget?.id || null, targetKind: currentTarget?.kind || null, usableMinutes: decision.usableMinutes } }));
  };
  const occupiedPlans = plans.filter(plan => !plan.payload.resolution && new Date(plan.payload.endAt) > clock).slice(0, 4);
  const occupiedTasks = tasks.filter(task => task.payload.status === "open" && (action?.kind !== "task" || task.id !== action.taskId)).slice(0, 4);
  const label = action?.kind === "wake" ? "起床確認" : action?.kind === "session" ? "実行中" : action?.kind === "routine" ? "いまの支度" : action?.kind === "plan" ? "いまの予定" : action?.kind === "rest" ? "回復" : action?.kind === "task" ? "次はこれ" : decision.mode === "windDown" ? "眠る準備" : "自由時間";
  return <div className="diary-now" data-guidance={guidance}>
    {notificationEntry && <div className="notification-entry" role="status">通知から開きました。今の現実に合わせて、もう一度判断しています。</div>}
    <section className={"diary-hero panel" + (celebrating ? " is-celebrating" : "")} aria-label="今と次の予定">
      <div className="hero-content">
        <div className="hero-clock"><Clock3 size={16} /><time dateTime={clock.toISOString()}>{time(clock)}</time><span>あなたのペースで、今日を。</span></div>
        <div className="focus-sticker">
          <span className="focus-label"><Gem size={15} />{label}</span>
          <h2>{action?.title || (decision.mode === "windDown" ? "今日はここまで" : "急ぎのものはないよ")}</h2>
          {action?.kind === "session" ? <p>{time(action.startedAt)}から · {sessionRemaining === null ? `経過 ${duration(elapsed)}` : `残り ${duration(sessionRemaining)}`}</p>
            : action?.kind === "task" || action?.kind === "rest" ? <p>{action.suggestedMinutes}分だけ</p>
            : action?.kind === "routine" ? <p className={action.executionMode === "pacedTimer" && routineRemaining !== null && routineRemaining <= 2 ? "routine-timer-urgent" : ""}>{action.executionMode === "softTimer" ? `経過 ${routineElapsed}分 / 目安 ${action.suggestedMinutes || "–"}分` : action.executionMode === "pacedTimer" && routineRemaining !== null ? routineRemaining > 0 ? `残り ${routineRemaining}分` : "そろそろ切り上げよう" : action.suggestedMinutes ? `目安 ${action.suggestedMinutes}分` : "終わったら次へ"}</p>
            : action?.kind === "plan" ? <p>固定予定を優先しています</p>
            : <p>{decision.mode === "windDown" ? "長い作業は始めず、明日に備えよう。" : "何もしない時間も大切です。"}</p>}
          {action?.kind === "task" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("start", () => beginExecution(action.taskId, action.suggestedMinutes))}><Play size={17} />開始</button>}
          {action?.kind === "plan" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("start", () => beginExecution(action.planId, null))}><Play size={17} />開始</button>}
          {action?.kind === "wake" && <button className="diary-button primary now-primary" disabled={!!busy} onClick={() => void run("wake", recordWake)}><Check size={17} />起きた</button>}
          {action?.kind === "session" && <div className="now-session-actions"><button className="diary-button primary" disabled={!!busy} onClick={() => void run("finish", () => endExecution(action.sessionId, "activityCompleted"))}><Check size={17} />この作業は終わった</button>{action.taskId && <button className="diary-button" disabled={!!busy} onClick={() => void run("finish-task", () => endExecution(action.sessionId, "activityCompleted", true))}>Taskも完了</button>}<button className="diary-text-button" disabled={!!busy} onClick={() => void run("pause", () => endExecution(action.sessionId, "paused"))}>いったん止める</button></div>}
          {action?.kind === "routine" && action.executionMode !== "automatic" && <div className="now-routine-actions">
            {Boolean(decision.reasonDetails?.urgent) && <strong className="routine-timer-urgent">支度を優先しよう。出発までの余裕が少なくなっています。</strong>}
            {routineStep?.checklistItems?.map(item => <label className="now-check-item" key={item.id}><input type="checkbox" checked={checkedItems.includes(item.id)} onChange={() => setCheckedItems(old => old.includes(item.id) ? old.filter(id => id !== item.id) : [...old, item.id])}/>{item.title}</label>)}
            <button className="diary-button primary" disabled={!!busy || (!!routineStep?.checklistItems?.length && checkedItems.length < routineStep.checklistItems.length)} onClick={() => void run("step", () => advanceFlow(action.routineRunId, action.stepId, "completed", checkedItems))}><Check size={17}/>完了</button>
            <button className="diary-text-button" disabled={!!busy} onClick={() => void run("skip", () => advanceFlow(action.routineRunId, action.stepId, "skipped"))}>スキップ</button>
          </div>}
          {(action?.kind === "task" || action?.kind === "plan") && <div className="start-assist"><button className="diary-text-button" onClick={() => { setAssistOpen(value => !value); setAssistPanel(null); }}>今むり</button>{action.kind === "task" && <button className="diary-text-button" onClick={() => setSkippedTaskIds(old => old.includes(action.taskId) ? old : [...old, action.taskId])}>違う</button>}</div>}
          {assistOpen && !assistPanel && <div className="assist-reasons assist-groups" aria-label="今むりな理由"><button onClick={() => setAssistPanel("unavailable")}><b>今はできない</b><small>場所・時間・待ち状態など</small></button><button onClick={() => setAssistPanel("friction")}><b>取りかかりにくい</b><small>大きさ・疲れ・気分など</small></button></div>}
          {assistPanel === "friction" && <div className="assist-reasons" aria-label="取りかかりにくい理由">{[["unknown", "何すればいいかわからない"], ["heavy", "大きすぎる"], ["tired", "疲れた"], ["boring", "つまらない"]].map(([reason, text]) => <button key={reason} onClick={() => void chooseAssist(reason as StartAssistReason)}>{text}</button>)}</div>}
          {assistPanel === "unavailable" && <div className="assist-reasons" aria-label="今はできない理由"><button onClick={() => setAssistPanel("occupied")}>別のことをしている</button><button onClick={() => void observeUnavailable("contextUnavailable")}>場所・道具がない</button><button onClick={() => void observeUnavailable("blocked")}>誰か／何かを待っている</button><button onClick={() => void observeUnavailable("insufficientWindow")}>今は時間が足りない</button></div>}
          {assistPanel === "occupied" && <div className="assist-occupied" aria-label="今やっていること"><b>今やっているのは？</b>{occupiedPlans.map(plan => <button key={plan.id} onClick={() => void run(`occupied-${plan.id}`, () => beginExecution(plan.id, null))}><span>{time(plan.payload.startAt)}</span>{plan.payload.title}</button>)}{occupiedTasks.map(task => <button key={task.id} onClick={() => void run(`occupied-${task.id}`, () => beginExecution(task.id, task.payload.nextAction?.estimatedMinutes || 25))}><span>Task</span>{task.payload.title}</button>)}{!occupiedPlans.length && !occupiedTasks.length && <small>開始できる予定・Taskがありません。未登録の行動は今後のPhaseで追加します。</small>}</div>}
        </div>
        <div className="hero-next"><span>このあと</span><div><b>{decision.nextAnchorAt ? time(decision.nextAnchorAt) + "から" : "固定予定はありません"}</b><p>{decision.departureAt ? `推奨出発 ${time(decision.departureAt)}` : decision.usableMinutes !== null ? `安全に使える時間 ${duration(decision.usableMinutes)}` : "空けておいても大丈夫。"}</p>{decision.earlyStartCandidate && <button className="diary-text-button early-start" disabled={!!busy} onClick={() => void run("early-start", () => beginExecution(decision.earlyStartCandidate!.planId, decision.earlyStartCandidate!.usableMinutes))}>{time(decision.earlyStartCandidate.startAt)} {decision.earlyStartCandidate.title}を今から始める</button>}</div>
          <button className="diary-icon-button" onClick={() => setTab("today")} aria-label="今日の予定を見る"><ArrowRight size={19} /></button>
        </div>
        <p className="free-caption"><Clock3 size={14} /><b>{duration(decision.usableMinutes || 0)}</b><span>今、安全に使える時間</span></p>
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
    {guidance !== "strong" && <section className="panel now-tasks">
      <div className="section-title"><h2><ListTodo size={18} />やること</h2><button onClick={() => setTab("tasks")} aria-label="すべてのタスクを見る"><ChevronRight size={17} /></button></div>
      {due.length ? due.map(task => <div className="diary-task-row" key={task.id}>
        <span className="task-dot" aria-hidden="true" /><button onClick={() => setModal({ kind: "task", entityId: task.id })}><b>{task.payload.title}</b><small>{task.payload.deadline ? new Date(task.payload.deadline).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "まで" : "期限なし"}</small></button>
        <button className="diary-icon-button" onClick={() => setModal({ kind: "plan", taskId: task.id })} aria-label={task.payload.title + "を予定に入れる"}><CalendarDays size={16} /></button>
      </div>) : <p className="diary-empty">やることを、ひとつずつ。<br />思いついたらここに残せます。</p>}
      <button className="diary-text-button" onClick={() => setModal({ kind: "task" })}><Plus size={16} />タスクを追加</button>
    </section>}
    <TodayFlow entities={entities} clock={clock} plans={plans} setModal={setModal} setTab={setTab} />
    <DirectionInsights entities={entities} clock={clock} create={create} update={update}/>
    <section className="panel now-unresolved">
      <div className="section-title"><h2><Inbox size={18} />あとで整える</h2><span>{checks}</span></div>
      {pending.length ? pending.map(item => <button className="unresolved-preview" key={item.kind + item.id} onClick={() => setTab("inbox")}><Gem size={15} /><span>{item.label}</span><ChevronRight size={15} /></button>)
        : <p className="diary-empty">確認したいことはありません。<br />今日の流れは、いい感じ。</p>}
      <button className="diary-text-button" onClick={() => setTab("inbox")}>未整理を見る<ChevronRight size={16} /></button>
    </section>
    {notice && <p className="diary-feedback" role="status">{notice}</p>}
    {guidance === "light" && <section className="now-capture" aria-label="すばやく記録"><span>何を残す？</span>{(["task", "plan", "actual", "inbox"] as Capture[]).map((kind, index) => <button className="diary-button" key={kind} onClick={() => setModal({ kind })}><Plus size={15} />{["タスク", "予定", "実績", "メモ"][index]}</button>)}</section>}
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
      return <button key={item.id} style={{ left: (start - from) / length * 100 + "%", width: (Math.min(to, r.end) - start) / length * 100 + "%" }} title={`実績 ${item.payload.title} ${time(item.payload.startAt)}–${time(item.payload.endAt)}`} aria-label={`実績 ${item.payload.title} ${time(item.payload.startAt)}から${time(item.payload.endAt)}`} onClick={() => setModal({ kind: "actual", entityId: item.id })} />; })}</div>
    <div className="flow-legend"><span><i />予定</span><span><i className="actual" />実績</span><span><i className="free" />空き時間</span></div>
    <p className="flow-hint">時間のすきまも、あなたの時間。</p>
  </section>;
}
