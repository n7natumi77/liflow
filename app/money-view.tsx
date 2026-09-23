"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Link2, Plus, Trash2, WalletCards } from "lucide-react";
import { active, type ActualData, type CoreEntity, type TransactionData } from "../domain/core";
import { dateKey } from "./diary-time";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";

const yen = (value: number) => "¥" + value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
export function MoneyView({ entities, create, update }: SectionProps) {
  const transactions = active<TransactionData>(entities, "transaction"), actuals = active<ActualData>(entities, "actual");
  const [editing, setEditing] = useState<CoreEntity<TransactionData> | null | undefined>(undefined);
  const [title, setTitle] = useState(""), [amount, setAmount] = useState(""), [direction, setDirection] = useState<TransactionData["direction"]>("expense"), [status, setStatus] = useState<TransactionData["status"]>("settled");
  const [category, setCategory] = useState("その他"), [occurred, setOccurred] = useState(dateKey(new Date())), [expected, setExpected] = useState("");
  const [actual, setActual] = useState(""), [note, setNote] = useState("");
  const [month, setMonth] = useState(dateKey(new Date()).slice(0, 7)), [filter, setFilter] = useState("all");
  const action = useDiaryAction();
  const begin = (item: CoreEntity<TransactionData> | null = null) => {
    setEditing(item); setTitle(item?.payload.title || ""); setAmount(item ? String(item.payload.amount) : ""); setDirection(item?.payload.direction || "expense");
    setStatus(item?.payload.status || "settled"); setCategory(item?.payload.category || "その他"); setOccurred(item ? dateKey(new Date(item.payload.occurredAt)) : dateKey(new Date()));
    setExpected(item?.payload.expectedAt ? dateKey(new Date(item.payload.expectedAt)) : ""); setActual(item?.payload.actualId || ""); setNote(item?.payload.note || ""); action.clearError();
  };
  const save = async () => {
    const number = Number(amount);
    if (!title.trim() || !Number.isFinite(number) || number <= 0 || !occurred) return;
    const dateValue = (value: string, previous?: string | null) => previous && dateKey(new Date(previous)) === value ? previous : new Date(`${value}T12:00:00`).toISOString();
    const payload = { ...editing?.payload, title: title.trim(), amount: number, direction, status, category: category.trim() || "その他", occurredAt: dateValue(occurred, editing?.payload.occurredAt), expectedAt: expected ? dateValue(expected, editing?.payload.expectedAt) : null, projectId: editing?.payload.projectId || null, actualId: actual || null, planId: editing?.payload.planId || null, taskId: editing?.payload.taskId || null, note };
    if (await action.run(() => editing ? update(editing, payload) : create("transaction", payload))) setEditing(undefined);
  };
  const monthItems = transactions.filter(t => !month || dateKey(new Date(t.payload.occurredAt)).startsWith(month));
  const totals = (direction: TransactionData["direction"], status: TransactionData["status"]) => monthItems.filter(t => t.payload.direction === direction && t.payload.status === status).reduce((sum, t) => sum + t.payload.amount, 0);
  const list = monthItems.filter(t => filter === "all" || t.payload.status === filter).sort((a, b) => b.payload.occurredAt.localeCompare(a.payload.occurredAt));
  const days = Array.from(new Set(list.map(t => dateKey(new Date(t.payload.occurredAt)))));
  const move = (delta: number) => { const next = new Date(`${month || dateKey(new Date()).slice(0, 7)}-01T12:00:00`); next.setMonth(next.getMonth() + delta); setMonth(dateKey(next).slice(0, 7)); };
  return <section className="panel notebook money-notebook">
    <SectionHeading icon={<WalletCards/>} title="生活とお金" description="使ったお金と、これから動くお金を見渡そう。" action={<button className="diary-button primary" onClick={() => begin()}><Plus size={16}/>収支を記録</button>}/>
    <div className="money-period"><button className="diary-icon-button" aria-label="前の月の収支" onClick={() => move(-1)}><ChevronLeft size={17}/></button><input type="month" aria-label="収支の月" value={month} onChange={e => setMonth(e.target.value)}/><button className="diary-icon-button" aria-label="次の月の収支" onClick={() => move(1)}><ChevronRight size={17}/></button><button className="diary-text-button" onClick={() => setMonth(month ? "" : dateKey(new Date()).slice(0, 7))}>{month ? "全期間を表示" : "今月を表示"}</button></div>
    <div className="money-overview"><div className="expense"><span><ArrowUpRight size={16}/>確認済みの支出</span><b>{yen(totals("expense", "settled"))}</b></div><div className="income"><span><ArrowDownLeft size={16}/>確認済みの収入</span><b>{yen(totals("income", "settled"))}</b></div><div><span>確認済みの収支</span><b>{yen(totals("income", "settled") - totals("expense", "settled"))}</b></div></div>
    <div className="money-expected"><span>予定の入出金</span><span>支出 {yen(totals("expense", "expected"))}</span><span>収入 {yen(totals("income", "expected"))}</span></div>
    <p className="field-hint">{month ? `${month.replace("-", "年")}月` : "全期間"}の行動日で集計しています。</p>
    <div className="notebook-tabs" aria-label="収支の表示">{[["all", "すべて"], ["settled", "確認済み"], ["expected", "予定"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {editing === undefined && <ActionFeedback {...action}/>}
    <div className="money-ledger">{days.length ? days.map(day => <section className="money-day" key={day}><h3>{new Date(day + "T12:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</h3>
      {list.filter(t => dateKey(new Date(t.payload.occurredAt)) === day).map(t => <button className="transaction-entry" key={t.id} data-transaction-id={t.id} onClick={() => begin(t)}>
        <span className={`transaction-icon ${t.payload.direction}`} aria-hidden="true">{t.payload.direction === "income" ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span>
        <span className="transaction-copy"><b>{t.payload.title}</b><span className="entry-meta"><span>{t.payload.category}</span><span>{t.payload.status === "expected" ? "予定" : "確認済み"}</span>{(t.payload.planId || t.payload.actualId || t.payload.taskId) && <span><Link2 size={12}/>関連する記録あり</span>}</span>{t.payload.status === "expected" && t.payload.expectedAt && <small>入出金予定 {new Date(t.payload.expectedAt).toLocaleDateString("ja-JP")}</small>}</span>
        <strong className={t.payload.direction}>{t.payload.direction === "income" ? "+" : "−"}{yen(t.payload.amount)}</strong><ChevronRight size={16}/>
      </button>)}
    </section>) : <DiaryEmpty title="この期間の収支はまだありません">日々の買い物も、これからの入出金予定も記録できます。</DiaryEmpty>}</div>
    {editing !== undefined && <SectionDialog title={editing ? "収支を編集" : "収支を記録"} close={() => setEditing(undefined)} busy={action.busy}><form onSubmit={e => { e.preventDefault(); void save(); }}><fieldset disabled={action.busy}>
      <label>内容<input autoFocus required value={title} onChange={e => setTitle(e.target.value)}/></label><div className="form-pair">
        <label>金額（円）<input type="number" min="0.01" step="any" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></label>
        <label>種類<select aria-label="種類" value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="expense">支出</option><option value="income">収入</option></select></label>
        <label>カテゴリ<input value={category} onChange={e => setCategory(e.target.value)}/></label>
        <label>状態<select aria-label="状態" value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="settled">確認済み</option><option value="expected">予定</option></select></label>
        <label>行動日<input type="date" required value={occurred} onChange={e => setOccurred(e.target.value)}/></label><label>入出金予定日<input type="date" value={expected} onChange={e => setExpected(e.target.value)}/></label>
        <label>実績<select aria-label="実績" value={actual} onChange={e => setActual(e.target.value)}><option value="">なし</option>{actuals.map(a => <option key={a.id} value={a.id}>{a.payload.title}</option>)}</select></label>
      </div>
      {editing && (editing.payload.planId || editing.payload.taskId) && <p className="field-hint">関連する予定・タスク：{[editing.payload.planId, editing.payload.taskId].filter(Boolean).map(id => String(entities.find(e => e.id === id)?.payload.title || "記録あり")).join(" / ")}</p>}
      <label>メモ<textarea aria-label="メモ" rows={2} value={note} onChange={e => setNote(e.target.value)}/></label><ActionFeedback {...action}/><button className="save" type="submit" disabled={!title.trim() || !amount || Number(amount) <= 0}>保存する</button>
      {editing && <button type="button" className="delete-entity" onClick={async () => { if (await action.run(() => update(editing, editing.payload, true), "収支を削除しました")) setEditing(undefined); }}><Trash2 size={15}/>削除</button>}
    </fieldset></form></SectionDialog>}
  </section>;
}
