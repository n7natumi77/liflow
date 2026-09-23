"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { layoutOverlaps, planState, type ActualData, type CalendarCategoryData, type CoreEntity, type ExecutionSessionData, type PlanData, type TaskData } from "../domain/core";
import { calendarActivities } from "../domain/calendar-activities";
import { dayRange, dateKey, freeRanges, minuteLabel, scheduledPlans } from "./diary-time";
import { placeCalendarItems } from "./calendar-presentation";

const HEIGHT = 64, PIXEL = HEIGHT / 60, HOURS = Array.from({ length: 24 }, (_, index) => index);
type Props = {
  date: Date;
  plans: CoreEntity<PlanData>[];
  capacityPlans: CoreEntity<PlanData>[];
  actuals: CoreEntity<ActualData>[];
  sessions: CoreEntity<ExecutionSessionData>[];
  cats: CoreEntity<CalendarCategoryData>[];
  tasks: CoreEntity<TaskData>[];
  openEntity: (entity: CoreEntity) => void;
  openCapture: (taskId?: string, date?: string, start?: string, end?: string) => void;
  update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
};

export default function DayCalendar({ date, plans, capacityPlans, actuals, sessions, cats, tasks, openEntity, openCapture }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(new Date());
  const dateId = dateKey(date);
  useEffect(() => {
    const hour = dateId === dateKey(new Date()) ? Math.max(0, new Date().getHours() - 1) : 7;
    if (scrollRef.current) scrollRef.current.scrollTop = hour * HEIGHT;
  }, [dateId]);
  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30_000); return () => clearInterval(timer); }, []);
  const tint = (id?: string | null) => cats.find(category => category.id === id)?.payload.colorToken || "#b6a2c8";
  const current = dateId === dateKey(clock) ? clock.getHours() * 60 + clock.getMinutes() : null;
  const dayPlans = plans.filter(plan => !plan.payload.resolution && dayRange(plan.payload.startAt, plan.payload.endAt, date));
  const containers = dayPlans.filter(plan => plan.payload.allDay || plan.payload.type === "container");
  const timed = scheduledPlans(dayPlans);
  const deadlines = tasks.filter(task => task.payload.deadline && dateKey(new Date(task.payload.deadline)) === dateId);
  const chooseRange = (start: number, end: number) => openCapture(undefined, dateId, minuteLabel(Math.min(1425, start)), minuteLabel(Math.min(1439, end)));
  const activities = calendarActivities([...timed, ...actuals, ...sessions], clock)
    .filter(activity => dayRange(activity.startAt, activity.endAt, date));
  const placed = placeCalendarItems(layoutOverlaps(activities.map(activity => ({
    id: activity.id, activity, payload: { startAt: activity.startAt, endAt: activity.endAt },
  }))).map(({ item, column, columns }) => {
    const range = dayRange(item.payload.startAt, item.payload.endAt, date)!;
    return { id: item.id, item, startMinute: range.start, endMinute: range.end, column, columns };
  }), PIXEL);
  return <section className="panel diary-day" aria-label="日表示カレンダー">
    <div className="day-overview"><span><CalendarPlus size={17}/>{date.toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}の予定と実績</span><button className="diary-button" onClick={() => chooseRange(9 * 60, 10 * 60)}><Plus size={15}/>予定を追加</button></div>
    <div className="day-containers"><small>終日・期間</small>{containers.map(item => <button key={item.id} onClick={() => openEntity(item)} style={{ borderColor: tint(item.payload.calendarCategoryId) }}>{item.payload.title}</button>)}{deadlines.map(task => <button className="deadline" key={task.id} onClick={() => openEntity(task)}>締切 {task.payload.title}</button>)}{!containers.length && !deadlines.length && <span>予定はありません</span>}</div>
    <div className="day-column-headings unified"><span>時刻</span><b>予定と実績</b></div>
    <div className="day-scroll" ref={scrollRef}>
      <div className="day-axis" style={{ height: 24 * HEIGHT }}>{HOURS.map(hour => <time key={hour} style={{ top: hour * HEIGHT }}>{minuteLabel(hour * 60)}</time>)}</div>
      <div className="day-grid unified" style={{ height: 24 * HEIGHT }}>
        {HOURS.map(hour => <i className="day-hour" key={hour} style={{ top: hour * HEIGHT }}/>) }
        <div className="day-lane day-activity-lane">
          {freeRanges(capacityPlans, date).filter(range => range.end - range.start >= 30).map(range => <button className="day-free-slot unified" key={range.start} style={{ top: range.start * PIXEL, height: (range.end - range.start) * PIXEL }} onClick={() => chooseRange(range.start, Math.min(range.end, range.start + 60))}><Plus size={13}/><span>{range.end - range.start}分の空き</span></button>)}
          {placed.map(({ item, column, columns, compact, displayTop, anchorOffset, renderedHeight, hitHeight, startMinute, endMinute }) => {
            const activity = item.activity, range = dayRange(activity.startAt, activity.endAt, date)!;
            const planRange = activity.plan ? dayRange(activity.plan.payload.startAt, activity.plan.payload.endAt, date) : null;
            const state = activity.plan ? planState(activity.plan, activity.actuals) : "executed";
            const target = activity.plan || activity.actuals[0];
            return <article className={`day-sticker calendar-activity ${compact ? "calendar-compact" : "calendar-block"} state-${state}`} key={activity.id}
              style={{ top: compact ? displayTop : range.start * PIXEL, height: compact ? Math.max(44, hitHeight) : Math.max(44, (range.end - range.start) * PIXEL), left: `calc(${column / columns * 100}% + 4px)`, width: `calc(${100 / columns}% - 8px)`, "--category-color": tint(activity.calendarCategoryId), "--anchor-offset": `${anchorOffset}px`, "--duration-height": `${renderedHeight}px` } as CSSProperties}>
              {compact && <span className="calendar-compact-anchor" aria-hidden="true"/>}
              {planRange && (
                <span className="activity-plan-band" aria-hidden="true" style={{ top: Math.max(0, planRange.start - range.start) * PIXEL, height: Math.max(3, (planRange.end - planRange.start) * PIXEL) }}/>
              )}
              {activity.segments.map(segment => { const segmentRange = dayRange(segment.startAt, segment.endAt, date); return segmentRange ? <span key={segment.id} className={`activity-actual-band${segment.running ? " running" : ""}`} aria-hidden="true" style={{ top: Math.max(0, segmentRange.start - range.start) * PIXEL, height: Math.max(5, (segmentRange.end - segmentRange.start) * PIXEL) }}/> : null; })}
              <button className="plan-content" disabled={!target} onClick={() => target && openEntity(target)} aria-label={`アクティビティ ${activity.title} ${minuteLabel(startMinute)}から${minuteLabel(endMinute)}`}>
                <time>{minuteLabel(startMinute)}–{minuteLabel(endMinute)}</time><b>{activity.title}</b>
                {!compact && <small>{activity.segments.some(segment => segment.running) ? "実行中" : activity.actuals.length ? `実績 ${activity.actuals.length}件` : state === "unresolved" ? "未整理" : state}</small>}
              </button>
            </article>;
          })}
        </div>
        {current !== null && <div className="day-now-line" style={{ top: current * PIXEL }}><span>今 {minuteLabel(current)}</span></div>}
      </div>
    </div>
    <div className="day-footer"><p>予定の中に実績を重ねて表示します。実行中の帯は現在時刻まで伸びます。</p></div>
  </section>;
}
