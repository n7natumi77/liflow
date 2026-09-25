"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CalendarPlus, GripVertical } from "lucide-react";
import { layoutOverlaps, planState, type ActualData, type CalendarCategoryData, type CoreEntity, type ExecutionSessionData, type PlanData, type TaskData } from "../domain/core";
import { calendarActivities, type CalendarActivity } from "../domain/calendar-activities";
import DayCalendar from "./day-calendar";
import { categoryColor, monthEntries, weekDates } from "./calendar-overview";
import { dateKey, dayRange, freeRanges, minuteLabel, scheduledPlans } from "./diary-time";
import { placeCalendarItems } from "./calendar-presentation";

const HEIGHT = 56, HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const media = "(max-width: 840px)";
const subscribe = (listener: () => void) => { const query = window.matchMedia(media); query.addEventListener("change", listener); return () => query.removeEventListener("change", listener); };
export function useCompactCalendar() { return useSyncExternalStore(subscribe, () => window.matchMedia(media).matches, () => false); }
type Props = {
  date: Date; plans: CoreEntity<PlanData>[]; capacityPlans: CoreEntity<PlanData>[]; actuals: CoreEntity<ActualData>[]; sessions: CoreEntity<ExecutionSessionData>[];
  cats: CoreEntity<CalendarCategoryData>[];
  tasks: CoreEntity<TaskData>[]; showDeadlines: boolean; setDate: (date: Date) => void; openDay: (date: Date) => void;
  openCapture: (taskId?: string, date?: string, start?: string, end?: string) => void;
  openEntity: (entity: CoreEntity) => void; update: (entity: CoreEntity, payload: Record<string, unknown>) => Promise<void>;
};
export default function WeekCalendar(props: Props) {
  const { date, plans, capacityPlans, actuals, sessions, cats, tasks, showDeadlines, setDate, openDay, openCapture, openEntity } = props;
  const mobile = useCompactCalendar();
  const [shelfOpen, setShelfOpen] = useState(false);
  const [preview, setPreview] = useState<{ date: string; minute: number } | null>(null), [taskFilter, setTaskFilter] = useState("unplaced");
  const scrollRef = useRef<HTMLDivElement>(null), days = weekDates(date), weekId = dateKey(days[0]), today = new Date();
  const unplaced = tasks.filter(t => ["open", "inbox"].includes(t.payload.status) && (taskFilter === "all" || !capacityPlans.some(p => p.payload.taskId === t.id && !p.payload.resolution)));
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 7 * HEIGHT; }, [weekId, mobile]);
  const choose = (taskId?: string) => openCapture(taskId, dateKey(date));
  const point = (clientY: number, top: number) => Math.max(0, Math.min(1425, Math.round((clientY - top) / HEIGHT * 4) * 15));
  return <div className="week-notebook">
    <section className="panel week-task-shelf"><div className="week-shelf-heading"><b><CalendarPlus size={17}/>タスクを予定に入れる</b>{mobile ? <button className="diary-text-button" aria-expanded={shelfOpen} onClick={() => setShelfOpen(!shelfOpen)}>{shelfOpen ? "候補を閉じる" : "タスクを選ぶ"}</button> : <select aria-label="予定に入れるタスクの表示" value={taskFilter} onChange={e => setTaskFilter(e.target.value)}><option value="unplaced">予定なし</option><option value="all">未完了すべて</option></select>}</div>
      {(!mobile || shelfOpen) && <><p>{mobile ? "タスクをタップして、日付と時間を選べます。" : "時間のマスへドラッグ。クリックして日時を選ぶこともできます。"}</p>
      {mobile && <select className="week-mobile-task-filter" aria-label="予定に入れるタスクの表示" value={taskFilter} onChange={e => setTaskFilter(e.target.value)}><option value="unplaced">予定なし</option><option value="all">未完了すべて</option></select>}
      <div className="week-task-chips">{unplaced.map(t => <button className="week-task-chip" draggable={!mobile} key={t.id} data-task-id={t.id} onDragStart={e => { e.dataTransfer.setData("taskId", t.id); e.dataTransfer.effectAllowed = "copy"; }} onDragEnd={() => setPreview(null)} onClick={() => choose(t.id)}><GripVertical size={14}/><span>{t.payload.title}</span>{t.payload.estimateMinutes && <small>{t.payload.estimateMinutes}分</small>}</button>)}{!unplaced.length && <span className="field-hint">この表示のタスクはありません。</span>}</div>
    </>}
    </section>
    {mobile ? <div className="mobile-week"><div className="week-date-strip" aria-label="週内の日付">{days.map(day => <button aria-pressed={dateKey(day) === dateKey(date)} aria-current={dateKey(day) === dateKey(today) ? "date" : undefined} key={dateKey(day)} onClick={() => setDate(day)}><span>{day.toLocaleDateString("ja-JP", { weekday: "short" })}</span><b>{day.getDate()}</b><i className={plans.some(p => !p.payload.resolution && dayRange(p.payload.startAt, p.payload.endAt, day)) ? "has-plan" : ""}/></button>)}</div>
      <DayCalendar {...props} key={dateKey(date)} tasks={showDeadlines ? tasks : []}/>
    </div> : <section className="panel diary-week"><div className="week-legend"><b>1週間の流れ</b><span className="legend-plan">予定の中に実績を表示</span><small>日付をクリックすると日表示へ</small></div>
      <div className="week-desktop-header"><span className="week-header-label">終日<br/>期間<br/>締切</span>{days.map(day => {
        const key = dateKey(day), entries = monthEntries(day, plans, showDeadlines ? tasks : []).filter(e => e.kind !== "plan");
        const free = freeRanges(capacityPlans, day, 7 * 60, 23 * 60).reduce((total, gap) => total + gap.end - gap.start, 0);
        return <div className={"week-date-heading " + (key === dateKey(today) ? "is-today" : "")} key={key}><button onClick={() => openDay(day)} aria-label={`${key}を日表示で開く`}><span>{day.toLocaleDateString("ja-JP", { weekday: "short" })}</span><b>{day.getDate()}</b></button><small title="7:00〜23:00の空き時間。表示フィルターの影響は受けません。">空き {Math.floor(free / 60)}時間{free % 60 ? free % 60 + "分" : ""}</small><div className="week-all-day">{entries.slice(0, 2).map(entry => <button key={entry.kind + entry.entity.id} className={entry.kind} style={{ "--entry-color": categoryColor(entry.entity.payload.calendarCategoryId, cats) } as CSSProperties} title={entry.entity.payload.title} onClick={() => openEntity(entry.entity)}>{entry.kind === "deadline" ? "締切 " : ""}{entry.entity.payload.title}</button>)}{entries.length > 2 && <button onClick={() => openDay(day)}>+{entries.length - 2}件</button>}</div></div>;
      })}</div>
      <div className="week-grid-scroll" ref={scrollRef}><div className="week-time-grid">
        <div className="week-time-axis" style={{ height: 24 * HEIGHT }}>{HOURS.map(hour => <time key={hour} style={{ top: hour * HEIGHT }}>{minuteLabel(hour * 60)}</time>)}</div>
        {days.map(day => {
          const key = dateKey(day);
          const activities = calendarActivities([...scheduledPlans(plans), ...actuals, ...sessions], today).filter(activity => dayRange(activity.startAt, activity.endAt, day));
          const placed = placeCalendarItems(layoutOverlaps(activities.map(activity => ({ id: activity.id, activity, payload: { startAt: activity.startAt, endAt: activity.endAt } }))).map(({ item, column, columns }) => {
            const range = dayRange(item.payload.startAt, item.payload.endAt, day)!;
            return { id: item.id, item: item.activity, startMinute: range.start, endMinute: range.end, column, columns };
          }), HEIGHT / 60);
          const current = key === dateKey(today) ? today.getHours() * 60 + today.getMinutes() : null;
          return <div className="week-day-column" key={key} data-date={key} style={{ height: 24 * HEIGHT }}
            onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setPreview({ date: key, minute: point(event.clientY, event.currentTarget.getBoundingClientRect().top) }); }}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null); }}
            onDrop={event => { event.preventDefault(); const taskId = event.dataTransfer.getData("taskId"); setPreview(null); if (!tasks.some(t => t.id === taskId && ["open", "inbox"].includes(t.payload.status))) return; const minute = point(event.clientY, event.currentTarget.getBoundingClientRect().top); openCapture(taskId, key, minuteLabel(minute)); }}>
            {HOURS.map(hour => <button className="week-hour-slot" key={hour} style={{ top: hour * HEIGHT, height: HEIGHT }} aria-label={`${key} ${minuteLabel(hour * 60)}に予定を追加`} onClick={() => openCapture(undefined, key, minuteLabel(hour * 60))}/>)}
            {placed.map(placement => <WeekBlock key={placement.item.id} placement={placement} day={day} color={categoryColor(placement.item.calendarCategoryId, cats)} openEntity={openEntity}/>)}
            {current !== null && <div className="week-now-line" style={{ top: current / 60 * HEIGHT }} aria-label={`現在 ${minuteLabel(current)}`}/>}
            {preview?.date === key && <div className="week-drop-preview" style={{ top: preview.minute / 60 * HEIGHT, height: HEIGHT / 2 }}>{minuteLabel(preview.minute)}</div>}
          </div>;
        })}
      </div></div><p className="week-caption">タスクを置くと、関連する予定を作れます。タスクはそのまま残ります。</p>
    </section>}
  </div>;
}

type PlacedWeekItem = ReturnType<typeof placeCalendarItems<CalendarActivity>>[number];
function WeekBlock({ placement, day, color, openEntity }: { placement: PlacedWeekItem; day: Date; color: string; openEntity: (entity: CoreEntity) => void }) {
  const { item: activity, column, columns, compact, displayTop, anchorOffset, renderedHeight, hitHeight, startMinute, endMinute } = placement;
  const range = dayRange(activity.startAt, activity.endAt, day)!;
  const planRange = activity.plan ? dayRange(activity.plan.payload.startAt, activity.plan.payload.endAt, day) : null;
  const target = activity.actuals[0] || activity.plan;
  const state = activity.plan ? planState(activity.plan, activity.actuals) : "executed";
  const width = 100 / columns, left = column * width;
  return <button className={`week-event calendar-activity state-${state} ${compact ? "calendar-compact" : "calendar-block"}`} style={{ top: displayTop, height: compact ? hitHeight : renderedHeight, left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)`, "--entry-color": color, "--category-color": color, "--anchor-offset": `${anchorOffset}px`, "--duration-height": `${renderedHeight}px` } as CSSProperties}
    disabled={!target} aria-label={`アクティビティ ${activity.title} ${minuteLabel(startMinute)}から${minuteLabel(endMinute)}`} title={`${activity.title}\n${minuteLabel(startMinute)}〜${minuteLabel(endMinute)}`} onClick={() => target && openEntity(target)}>
    {compact && <><span className="calendar-compact-anchor" aria-hidden="true"/><i className="calendar-compact-dot" aria-hidden="true"/></>}
    {planRange && (
      <span className="activity-plan-band" aria-hidden="true" style={{ top: Math.max(0, planRange.start - range.start) / 60 * HEIGHT, height: Math.max(3, (planRange.end - planRange.start) / 60 * HEIGHT) }}/>
    )}
    {activity.segments.map(segment => { const segmentRange = dayRange(segment.startAt, segment.endAt, day); return segmentRange ? <span key={segment.id} className={`activity-actual-band${segment.running ? " running" : ""}`} aria-hidden="true" style={{ top: Math.max(0, segmentRange.start - range.start) / 60 * HEIGHT, height: Math.max(4, (segmentRange.end - segmentRange.start) / 60 * HEIGHT) }}/> : null; })}
    <time>{minuteLabel(startMinute)}{compact ? `–${minuteLabel(endMinute)}` : ""}</time><b>{activity.title}</b>
  </button>;
}
