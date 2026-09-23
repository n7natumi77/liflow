"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CalendarPlus, Check, GripHorizontal, GripVertical, Plus, Repeat2, Sparkles } from "lucide-react";
import { layoutOverlaps, routineOccurs, type CoreEntity, type PlanData, type ActualData, type CalendarCategoryData, type RoutineData, type RoutineOccurrenceData, type TaskData } from "../domain/core";
import { dayRange, dateKey, dayBounds, freeRanges, isoAtMinute, minuteLabel, movedRange, scheduledPlans } from "./diary-time";
import { FairyCharacter } from "./fairy-character";

const HEIGHT = 64, PIXEL = HEIGHT / 60, HOURS = Array.from({ length: 24 }, (_, i) => i);
type Range = { start: number; end: number };
type Props = {
  date: Date; plans: CoreEntity<PlanData>[]; capacityPlans: CoreEntity<PlanData>[]; actuals: CoreEntity<ActualData>[];
  routines: CoreEntity<RoutineData>[]; occurrences: CoreEntity<RoutineOccurrenceData>[];
  cats: CoreEntity<CalendarCategoryData>[]; tasks: CoreEntity<TaskData>[];
  openEntity: (entity: CoreEntity) => void;
  openCapture: (taskId?: string, date?: string, start?: string, end?: string) => void;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
};
type Gesture = { kind: "create" | "move" | "resize"; entity?: CoreEntity<PlanData>; origin: number; original: Range; range: Range; pointer: number; changed: boolean };
export default function DayCalendar({ date, plans, capacityPlans, actuals, routines, occurrences, cats, tasks, openEntity, openCapture, update }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null), laneRef = useRef<HTMLDivElement>(null), gestureRef = useRef<Gesture | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null), [clock, setClock] = useState(new Date());
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [success, setSuccess] = useState(false);
  const dateId = dateKey(date);
  useEffect(() => {
    const hour = dateId === dateKey(new Date()) ? Math.max(0, new Date().getHours() - 1) : 7;
    if (scrollRef.current) scrollRef.current.scrollTop = hour * HEIGHT;
  }, [dateId]);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!success) return; const timer = setTimeout(() => setSuccess(false), 2400); return () => clearTimeout(timer); }, [success]);
  const tint = (id?: string | null) => cats.find(c => c.id === id)?.payload.colorToken || "#b6a2c8";
  const current = dateId === dateKey(clock) ? clock.getHours() * 60 + clock.getMinutes() : null;
  const dayPlans = plans.filter(p => !p.payload.resolution && dayRange(p.payload.startAt, p.payload.endAt, date));
  const containers = dayPlans.filter(p => p.payload.allDay || p.payload.type === "container");
  const timed = scheduledPlans(dayPlans), timedActuals = actuals.filter(a => dayRange(a.payload.startAt, a.payload.endAt, date));
  const deadlines = tasks.filter(t => t.payload.deadline && dateKey(new Date(t.payload.deadline)) === dateId);
  const slots = routines.filter(r => r.payload.active && r.payload.preferredTime && routineOccurs(r.payload.scheduleRule, date)).map(routine => {
    const start = new Date(dateId + "T" + routine.payload.preferredTime + ":00");
    return { routine, range: dayRange(start.toISOString(), new Date(+start + (routine.payload.expectedDuration || 30) * 60000).toISOString(), date),
      status: occurrences.find(o => o.payload.routineId === routine.id && o.payload.date === dateId)?.payload.status || "pending" };
  });
  const point = (clientY: number) => Math.max(0, Math.min(1440, (clientY - (laneRef.current?.getBoundingClientRect().top || 0)) / PIXEL));
  const chooseRange = (range: Range) => openCapture(undefined, dateId, minuteLabel(Math.min(1425, range.start)), minuteLabel(Math.min(1439, range.end)));
  const assign = (next: Gesture | null) => { gestureRef.current = next; setGesture(next); };
  const begin = (event: PointerEvent<HTMLElement>, kind: Gesture["kind"], entity?: CoreEntity<PlanData>) => {
    if (busy || event.button !== 0 || !event.isPrimary) return;
    // Scrolling stays native on touch. Empty-range creation is available through the visible buttons.
    if (kind === "create" && event.pointerType === "touch") return;
    event.preventDefault(); event.stopPropagation();
    const origin = point(event.clientY), start = Math.min(1425, Math.floor(origin / 15) * 15);
    const original = entity ? dayRange(entity.payload.startAt, entity.payload.endAt, date)! : { start, end: start + 30 };
    event.currentTarget.setPointerCapture(event.pointerId);
    assign({ kind, entity, origin, original, range: original, pointer: event.pointerId, changed: false });
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gestureRef.current;
    if (!active || active.pointer !== event.pointerId) return;
    const position = point(event.clientY);
    const range = active.kind === "create"
      ? { start: Math.max(0, Math.min(active.original.start, Math.floor(position / 15) * 15)), end: Math.min(1440, Math.max(active.original.start + 15, Math.ceil(position / 15) * 15)) }
      : movedRange(active.original.start, active.original.end, position - active.origin, active.kind === "resize");
    assign({ ...active, range, changed: active.changed || Math.abs(position - active.origin) > 4 });
  };
  const save = async (entity: CoreEntity<PlanData>, range: Range) => {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      await update(entity, { ...entity.payload, startAt: isoAtMinute(date, range.start), endAt: isoAtMinute(date, range.end) });
      setNotice(entity.payload.title + "を" + minuteLabel(range.start) + "–" + minuteLabel(range.end) + "に変更しました。");
      setSuccess(true);
    } catch { setNotice("変更を保存できませんでした。最新の同期状態を確認してください。"); }
    finally { setBusy(false); }
  };
  const finish = (event: PointerEvent<HTMLElement>) => {
    const active = gestureRef.current;
    if (!active || active.pointer !== event.pointerId) return;
    assign(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.kind === "create") chooseRange(active.changed ? active.range : active.original);
    else if (active.entity && active.changed && (active.range.start !== active.original.start || active.range.end !== active.original.end)) void save(active.entity, active.range);
  };
  const events = { onPointerMove: move, onPointerUp: finish, onPointerCancel: () => assign(null), onLostPointerCapture: () => assign(null) };
  const style = (range: Range): CSSProperties => ({ top: range.start * PIXEL, height: (range.end - range.start) * PIXEL });
  const { start: dayStart, end: dayEnd } = dayBounds(date);
  const editable = (plan: CoreEntity<PlanData>) => new Date(plan.payload.startAt) >= dayStart && new Date(plan.payload.endAt) <= dayEnd && !plan.payload.actualId;
  const shortcut = (event: React.KeyboardEvent<HTMLButtonElement>, entity: CoreEntity<PlanData>, resize = false) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const range = dayRange(entity.payload.startAt, entity.payload.endAt, date)!;
    const next = movedRange(range.start, range.end, event.key === "ArrowUp" ? -15 : 15, resize);
    if (next.start !== range.start || next.end !== range.end) void save(entity, next);
  };
  return <section className="panel diary-day" aria-label="日表示カレンダー" aria-busy={busy}>
    <div className="day-overview"><span><CalendarPlus size={17} />{date.toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}の予定</span><button className="diary-button" onClick={() => chooseRange({ start: 9 * 60, end: 10 * 60 })}><Plus size={15} />予定を追加</button></div>
    <div className="day-containers"><small>終日・期間</small>{containers.map(item => <button key={item.id} onClick={() => openEntity(item)} style={{ borderColor: tint(item.payload.calendarCategoryId) }}>{item.payload.title}</button>)}{deadlines.map(task => <button className="deadline" key={task.id} onClick={() => openEntity(task)}>締切 {task.payload.title}</button>)}{!containers.length && !deadlines.length && <span>予定はありません</span>}</div>
    <div className="day-column-headings"><span>時刻</span><b>予定</b><b>ルーティン</b><b>実績</b></div>
    <div className="day-scroll" ref={scrollRef}>
      <div className="day-axis" style={{ height: 24 * HEIGHT }}>{HOURS.map(hour => <time key={hour} style={{ top: hour * HEIGHT }}>{minuteLabel(hour * 60)}</time>)}</div>
      <div className="day-grid" style={{ height: 24 * HEIGHT }}>
        {HOURS.map(hour => <i className="day-hour" key={hour} style={{ top: hour * HEIGHT }} />)}
        <div className="day-lane day-plan-lane" ref={laneRef} onPointerDown={event => { if (event.target === event.currentTarget) begin(event, "create"); }} {...events}>
          {freeRanges(capacityPlans, date).filter(range => range.end - range.start >= 30).map(range => <div className="day-free-slot" key={range.start} style={style(range)} onPointerDown={event => { if (event.target === event.currentTarget) begin(event, "create"); }}>
            <button disabled={busy} onClick={() => chooseRange({ start: range.start, end: Math.min(range.end, range.start + 60) })}><Plus size={13} /><span>{range.end - range.start}分の空き</span></button>
          </div>)}
          {layoutOverlaps(timed).map(({ item, column, columns }) => {
            const original = dayRange(item.payload.startAt, item.payload.endAt, date)!;
            const dragging = gesture?.entity?.id === item.id, range = dragging ? gesture.range : original;
            const movable = editable(item), short = range.end - range.start < 45;
            return <article className={"day-sticker " + (dragging ? "dragging " : "") + (short ? "short" : "")} key={item.id}
              style={{ ...style(range), left: "calc(" + column / columns * 100 + "% + 4px)", width: "calc(" + 100 / columns + "% - 8px)", "--category-color": tint(item.payload.calendarCategoryId) } as CSSProperties}>
              {movable && <button className="plan-grab" disabled={busy} aria-label={item.payload.title + "を移動（上下キーで15分）"} onPointerDown={event => begin(event, "move", item)} {...events} onKeyDown={event => shortcut(event, item)}><GripVertical size={13} /></button>}
              <button className="plan-content" onClick={() => openEntity(item)} title={item.payload.title + " " + minuteLabel(range.start) + "–" + minuteLabel(range.end)}><time>{minuteLabel(range.start)}–{minuteLabel(range.end)}</time><b>{item.payload.title}</b>{!short && <small>{cats.find(c => c.id === item.payload.calendarCategoryId)?.payload.name || "未分類"}</small>}</button>
              {movable && <button className="plan-resize" disabled={busy} aria-label={item.payload.title + "の長さを変更（上下キーで15分）"} onPointerDown={event => begin(event, "resize", item)} {...events} onKeyDown={event => shortcut(event, item)}><GripHorizontal size={15} /></button>}
            </article>;
          })}
          {gesture?.kind === "create" && <div className="day-selection" style={style(gesture.range)}><Sparkles size={15} /><b>{minuteLabel(gesture.range.start)}–{minuteLabel(gesture.range.end)}</b><span>新しい予定</span></div>}
        </div>
        <div className="day-lane day-routine-lane">{slots.map(({ routine, range, status }) => range && <div className={"day-routine " + status} key={routine.id} style={style(range)} title={routine.payload.title}><Repeat2 size={14} /><time>{routine.payload.preferredTime}</time><b>{routine.payload.title}</b>{status === "done" && <Check size={14} />}</div>)}</div>
        <div className="day-lane day-actual-lane">{layoutOverlaps(timedActuals).map(({ item, column, columns }) => { const range = dayRange(item.payload.startAt, item.payload.endAt, date)!;
          return <button className="day-actual" key={item.id} style={{ ...style(range), left: "calc(" + column / columns * 100 + "% + 4px)", width: "calc(" + 100 / columns + "% - 8px)" }} onClick={() => openEntity(item)} title={item.payload.title + " " + minuteLabel(range.start) + "–" + minuteLabel(range.end)}><time>{minuteLabel(range.start)}–{minuteLabel(range.end)}</time><b>{item.payload.title}</b></button>;
        })}</div>
        {current !== null && <div className="day-now-line" style={{ top: current * PIXEL }}><span>今 {minuteLabel(current)}</span></div>}
      </div>
    </div>
    <div className="day-footer"><p>空き時間をクリック・ドラッグで予定を追加。予定の持ち手で移動、下の持ち手で長さを調整。</p><span role="status">{busy ? "保存中…" : notice}</span></div>
    {success && <div className="day-fairy-reaction"><FairyCharacter size={88} expression="happy" decorative /><p>予定が整ったね！</p></div>}
  </section>;
}
