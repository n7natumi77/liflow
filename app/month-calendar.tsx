"use client";
import { useState, type CSSProperties } from "react";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import type { CalendarCategoryData, CoreEntity, PlanData, TaskData } from "../domain/core";
import { categoryColor, monthEntries, weekDates, type MonthEntry } from "./calendar-overview";
import { dateKey, dayRange, minuteLabel } from "./diary-time";
import { DiaryEmpty } from "./diary-section";

const entryLabel = (entry: MonthEntry, day: Date) => entry.kind === "deadline" ? "締切" : entry.kind === "period" ? "期間" : entry.kind === "allDay" ? "終日" : minuteLabel(dayRange((entry.entity.payload as PlanData).startAt, (entry.entity.payload as PlanData).endAt, day)!.start);
export default function MonthCalendar({ date, plans, cats, tasks, openDay, openEntity, openCapture }: {
  date: Date; plans: CoreEntity<PlanData>[]; cats: CoreEntity<CalendarCategoryData>[]; tasks: CoreEntity<TaskData>[];
  openDay: (day: Date) => void; openEntity: (entity: CoreEntity) => void; openCapture: (taskId?: string, date?: string) => void;
}) {
  const [selected, setSelected] = useState(date);
  const start = weekDates(new Date(date.getFullYear(), date.getMonth(), 1))[0];
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(day.getDate() + index); return day; });
  const selectedEntries = monthEntries(selected, plans, tasks), today = dateKey(new Date());
  return <section className="panel diary-month"><div className="month-overview-heading"><span><CalendarDays size={18}/>月の見渡し</span><p>日付を選ぶと、その日の予定と締切を確認できます。</p></div>
    <div className="month-layout"><div className="month-board"><div className="month-weekdays">{["月", "火", "水", "木", "金", "土", "日"].map(label => <b key={label}>{label}</b>)}</div><div className="month-grid">
      {days.map(day => { const key = dateKey(day), entries = monthEntries(day, plans, tasks), shown = entries.slice(0, 3);
        return <button key={key} data-date={key} className={`${day.getMonth() === date.getMonth() ? "" : "outside"} ${key === today ? "is-today" : ""}`} aria-label={`${key} 予定と締切 ${entries.length}件`} aria-pressed={key === dateKey(selected)} aria-current={key === today ? "date" : undefined} onClick={() => setSelected(day)}>
          <b className="month-date-number">{day.getDate()}</b>
          <span className="month-desktop-entries">{shown.map(entry => <span key={entry.kind + entry.entity.id} className={`month-entry ${entry.kind}`} style={{ "--entry-color": categoryColor(entry.entity.payload.calendarCategoryId, cats) } as CSSProperties}><i/><small>{entryLabel(entry, day)}</small>{entry.entity.payload.title}</span>)}{entries.length > shown.length && <span className="month-more">+{entries.length - shown.length}件</span>}</span>
          <span className="month-mobile-marks" aria-hidden="true">{shown.map(entry => <i key={entry.kind + entry.entity.id} className={entry.kind} style={{ background: categoryColor(entry.entity.payload.calendarCategoryId, cats) }}/>) }{entries.length > 3 && <small>+{entries.length - 3}</small>}</span>
        </button>;
      })}
    </div></div>
    <aside className="month-agenda"><div className="month-agenda-heading"><span>{selected.toLocaleDateString("ja-JP", { month: "long" })}</span><h3>{selected.getDate()}<small>{selected.toLocaleDateString("ja-JP", { weekday: "long" })}</small></h3><button className="diary-text-button" onClick={() => openDay(selected)}>この日を開く<ArrowRight size={14}/></button></div>
      <div className="month-agenda-items">{selectedEntries.length ? selectedEntries.map(entry => <button key={entry.kind + entry.entity.id} className={`month-agenda-entry ${entry.kind}`} style={{ "--entry-color": categoryColor(entry.entity.payload.calendarCategoryId, cats) } as CSSProperties} onClick={() => openEntity(entry.entity)}><span>{entryLabel(entry, selected)}</span><b>{entry.entity.payload.title}</b></button>) : <DiaryEmpty title="予定と締切はありません"/>}</div>
      <button className="diary-button primary" onClick={() => openCapture(undefined, dateKey(selected))}><Plus size={15}/>この日に予定を追加</button>
    </aside></div>
  </section>;
}
