"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, BarChart3, ChevronDown, ChevronUp, Edit3, Plus, Trash2, WalletCards } from "lucide-react";
import { active, type ActualData, type BudgetData, type CoreEntity, type MoneyCategoryData, type MoneyMethodData, type TransactionData, type TransferData } from "../domain/core";
import { budgetPace, periodRange } from "../domain/money";
import { MONEY_OTHER_CATEGORY_ID, MONEY_TRANSFER_FEE_CATEGORY_ID } from "../domain/schema";
import { ActionFeedback, DiaryEmpty, SectionDialog, SectionHeading, useDiaryAction, type SectionProps } from "./diary-section";

const dateKey = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
};
const atNoon = (date: string) => new Date(date + "T12:00:00").toISOString();
const yen = (value: number) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
type ReviewPeriod = "week" | "month" | "threeMonths" | "custom";

export function MoneyView({ entities, create, update }: SectionProps) {
  const transactions = active<TransactionData>(entities, "transaction");
  const categories = active<MoneyCategoryData>(entities, "moneyCategory").sort((a, b) => a.payload.sortOrder - b.payload.sortOrder);
  const methods = active<MoneyMethodData>(entities, "moneyMethod").sort((a, b) => a.payload.sortOrder - b.payload.sortOrder);
  const transfers = active<TransferData>(entities, "transfer");
  const budgets = active<BudgetData>(entities, "budget").filter(item => item.payload.active);
  const actuals = active<ActualData>(entities, "actual");
  const action = useDiaryAction();
  const [editing, setEditing] = useState<CoreEntity<TransactionData> | null | undefined>(undefined), [transferOpen, setTransferOpen] = useState(false), [budgetOpen, setBudgetOpen] = useState(false);
  const [title, setTitle] = useState(""), [amount, setAmount] = useState(""), [direction, setDirection] = useState<TransactionData["direction"]>("expense"), [status, setStatus] = useState<TransactionData["status"]>("settled");
  const [categoryId, setCategoryId] = useState(MONEY_OTHER_CATEGORY_ID), [methodId, setMethodId] = useState(""), [occurred, setOccurred] = useState(dateKey(new Date())), [expected, setExpected] = useState(""), [actualId, setActualId] = useState(""), [note, setNote] = useState("");
  const [sourceMethod, setSourceMethod] = useState(""), [destinationMethod, setDestinationMethod] = useState(""), [transferAmount, setTransferAmount] = useState(""), [transferDate, setTransferDate] = useState(dateKey(new Date())), [transferFee, setTransferFee] = useState(""), [transferNote, setTransferNote] = useState("");
  const [budgetCategory, setBudgetCategory] = useState(""), [budgetPeriod, setBudgetPeriod] = useState<BudgetData["period"]>("month"), [budgetAmount, setBudgetAmount] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("month"), [customStart, setCustomStart] = useState(dateKey(new Date())), [customEnd, setCustomEnd] = useState(dateKey(new Date()));
  const [newCategory, setNewCategory] = useState(""), [newMethod, setNewMethod] = useState(""), [mergeSource, setMergeSource] = useState(""), [mergeTarget, setMergeTarget] = useState("");

  const categoryName = (id?: string | null, fallback = "その他") => categories.find(item => item.id === id)?.payload.name || fallback;
  const methodName = (id?: string | null) => methods.find(item => item.id === id)?.payload.name || "未指定";
  const begin = (item: CoreEntity<TransactionData> | null = null) => {
    setEditing(item); setTitle(item?.payload.title || ""); setAmount(item ? String(item.payload.amount) : ""); setDirection(item?.payload.direction || "expense"); setStatus(item?.payload.status || "settled");
    setCategoryId(item?.payload.categoryId || categories.find(category => !category.payload.archived)?.id || MONEY_OTHER_CATEGORY_ID); setMethodId(item?.payload.moneyMethodId || methods.find(method => !method.payload.archived)?.id || "");
    setOccurred(item ? dateKey(new Date(item.payload.occurredAt)) : dateKey(new Date())); setExpected(item?.payload.expectedAt ? dateKey(new Date(item.payload.expectedAt)) : ""); setActualId(item?.payload.actualId || ""); setNote(item?.payload.note || ""); action.clearError();
  };
  const saveTransaction = async () => {
    const number = Number(amount), category = categories.find(item => item.id === categoryId);
    if (!title.trim() || !Number.isFinite(number) || number <= 0 || !occurred || !category) return;
    const payload: TransactionData = {
      ...editing?.payload, title: title.trim(), amount: number, direction, status, category: category.payload.name, categoryId, moneyMethodId: methodId || null, transferId: editing?.payload.transferId || null,
      occurredAt: atNoon(occurred), expectedAt: expected ? atNoon(expected) : null, projectId: editing?.payload.projectId || null, actualId: actualId || null, planId: editing?.payload.planId || null, taskId: editing?.payload.taskId || null, note,
    };
    if (await action.run(() => editing ? update(editing, payload) : create("transaction", payload), "収支を保存しました")) setEditing(undefined);
  };
  const saveTransfer = async () => {
    const number = Number(transferAmount), fee = Math.max(0, Number(transferFee) || 0);
    if (!Number.isFinite(number) || number <= 0 || !sourceMethod || !destinationMethod || sourceMethod === destinationMethod) return;
    const saved = await create("transfer", { amount: number, sourceMethodId: sourceMethod, destinationMethodId: destinationMethod, occurredAt: atNoon(transferDate), note: transferNote, feeAmount: fee, feeTransactionId: null } satisfies TransferData);
    if (fee > 0) {
      const feeTransaction = await create("transaction", {
        title: "振替手数料", amount: fee, direction: "expense", category: categoryName(MONEY_TRANSFER_FEE_CATEGORY_ID, "振替手数料"), categoryId: MONEY_TRANSFER_FEE_CATEGORY_ID,
        moneyMethodId: sourceMethod, transferId: saved.id, occurredAt: atNoon(transferDate), expectedAt: null, status: "settled", projectId: null, actualId: null, planId: null, taskId: null, note: transferNote,
      } satisfies TransactionData);
      await update(saved, { ...saved.payload, feeTransactionId: feeTransaction.id });
    }
    setTransferOpen(false); setTransferAmount(""); setTransferFee(""); setTransferNote("");
  };
  const saveBudget = async () => {
    const number = Number(budgetAmount);
    if (!budgetCategory || !Number.isFinite(number) || number <= 0) return;
    const existing = budgets.find(item => item.payload.categoryId === budgetCategory && item.payload.period === budgetPeriod);
    const payload: BudgetData = { categoryId: budgetCategory, period: budgetPeriod, amount: number, active: true };
    if (await action.run(() => existing ? update(existing, payload) : create("budget", payload), "予算を保存しました")) setBudgetOpen(false);
  };
  const move = async (item: CoreEntity<MoneyCategoryData> | CoreEntity<MoneyMethodData>, delta: number, list: typeof categories | typeof methods) => {
    const index = list.findIndex(candidate => candidate.id === item.id), other = list[index + delta];
    if (!other) return;
    await Promise.all([update(item, { ...item.payload, sortOrder: other.payload.sortOrder }), update(other, { ...other.payload, sortOrder: item.payload.sortOrder })]);
  };
  const rename = async (item: CoreEntity<MoneyCategoryData> | CoreEntity<MoneyMethodData>) => {
    const next = window.prompt("新しい名前", item.payload.name)?.trim();
    if (next && next !== item.payload.name) await action.run(() => update(item, { ...item.payload, name: next }), "名前を変更しました");
  };
  const mergeCategory = async () => {
    const source = categories.find(item => item.id === mergeSource), target = categories.find(item => item.id === mergeTarget);
    if (!source || !target || source.id === target.id) return;
    for (const transaction of transactions.filter(item => item.payload.categoryId === source.id)) await update(transaction, { ...transaction.payload, categoryId: target.id, category: target.payload.name });
    for (const budget of budgets.filter(item => item.payload.categoryId === source.id)) {
      const duplicate = budgets.find(item => item.id !== budget.id && item.payload.categoryId === target.id && item.payload.period === budget.payload.period);
      await update(budget, duplicate ? { ...budget.payload, active: false } : { ...budget.payload, categoryId: target.id });
    }
    await update(source, source.payload, true); setMergeSource(""); setMergeTarget("");
  };
  const now = new Date();
  const budgetCards = budgets.map(budget => ({ budget, pace: budgetPace(budget, transactions, now) }));
  const expectedItems = transactions.filter(item => item.payload.status === "expected").sort((a, b) => (a.payload.expectedAt || a.payload.occurredAt).localeCompare(b.payload.expectedAt || b.payload.occurredAt));
  const reviewRange = (() => {
    if (reviewPeriod === "week" || reviewPeriod === "month") return periodRange(reviewPeriod, now);
    if (reviewPeriod === "threeMonths") { const start = new Date(now.getFullYear(), now.getMonth() - 2, 1), end = new Date(now.getFullYear(), now.getMonth() + 1, 1); return { start, end }; }
    const start = new Date(customStart + "T00:00:00"), end = new Date(customEnd + "T00:00:00"); end.setDate(end.getDate() + 1); return { start, end };
  })();
  const reviewItems = transactions.filter(item => item.payload.status === "settled" && Date.parse(item.payload.occurredAt) >= reviewRange.start.getTime() && Date.parse(item.payload.occurredAt) < reviewRange.end.getTime());
  const expenseTotal = reviewItems.filter(item => item.payload.direction === "expense").reduce((sum, item) => sum + item.payload.amount, 0);
  const categoryTotals = categories.map(category => ({ category, total: reviewItems.filter(item => item.payload.direction === "expense" && item.payload.categoryId === category.id).reduce((sum, item) => sum + item.payload.amount, 0) })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  const recent = [...transactions, ...transfers].sort((a, b) => String(b.payload.occurredAt).localeCompare(String(a.payload.occurredAt))).slice(0, 12);

  return <section className="panel notebook money-notebook">
    <SectionHeading icon={<WalletCards/>} title="お金" description="予算のペースと、これから・これまでのお金を同じ順番で見渡します。" action={<div className="money-heading-actions"><button className="diary-button primary" onClick={() => begin()}><Plus size={16}/>収支</button><button className="diary-button" onClick={() => { setSourceMethod(methods[0]?.id || ""); setDestinationMethod(methods[1]?.id || ""); setTransferOpen(true); }}><ArrowRightLeft size={16}/>振替</button></div>}/>
    <ActionFeedback {...action}/>
    <section className="money-section budget-pace"><div className="money-section-heading"><div><h3>予算ペース</h3><p>確認済み支出と、これからの予定支出を差し引きます。</p></div><button className="diary-button" onClick={() => { setBudgetCategory(categories.find(item => !item.payload.archived && item.payload.appliesTo !== "income")?.id || ""); setBudgetOpen(true); }}><Plus size={15}/>予算</button></div>
      <div className="budget-card-grid">{budgetCards.map(({ budget, pace }) => <article className={"budget-card" + (pace.over ? " over" : "")} key={budget.id}><span>{categoryName(budget.payload.categoryId)} · {budget.payload.period === "week" ? "週" : "月"}</span><b>{pace.over ? "1日 0円" : "1日 " + yen(pace.daily)}</b><small>{pace.over ? yen(pace.over) + "超過" : "残り " + yen(pace.remaining) + " / " + pace.remainingDays + "日"}</small><button onClick={() => { setBudgetCategory(budget.payload.categoryId); setBudgetPeriod(budget.payload.period); setBudgetAmount(String(budget.payload.amount)); setBudgetOpen(true); }}><Edit3 size={14}/>編集</button></article>)}</div>
      {!budgetCards.length && <p className="money-empty">カテゴリごとの週・月予算を追加できます。</p>}
    </section>
    <section className="money-section money-expected"><div className="money-section-heading"><div><h3>予定の入出金</h3><p>未来の動きを先に確認します。</p></div></div>{expectedItems.slice(0, 8).map(item => <button className="money-row" key={item.id} onClick={() => begin(item)}><span className={item.payload.direction}>{item.payload.direction === "income" ? <ArrowDownLeft/> : <ArrowUpRight/>}</span><b>{item.payload.title}</b><small>{new Date(item.payload.expectedAt || item.payload.occurredAt).toLocaleDateString("ja-JP")} · {categoryName(item.payload.categoryId, item.payload.category)}</small><strong>{yen(item.payload.amount)}</strong></button>)}{!expectedItems.length && <p className="money-empty">予定の入出金はありません。</p>}</section>
    <section className="money-section money-review"><div className="money-section-heading"><div><h3><BarChart3 size={17}/>見直し</h3><p>カテゴリ別の支出を期間で比較します。</p></div></div><div className="notebook-tabs">{[["week", "週"], ["month", "月"], ["threeMonths", "3か月"], ["custom", "指定"]] .map(([value, label]) => <button key={value} aria-pressed={reviewPeriod === value} onClick={() => setReviewPeriod(value as ReviewPeriod)}>{label}</button>)}</div>
      {reviewPeriod === "custom" && <div className="form-pair"><label>開始<input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)}/></label><label>終了<input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)}/></label></div>}
      <div className="review-total"><span>支出合計</span><b>{yen(expenseTotal)}</b></div><div className="money-bars">{categoryTotals.map(item => <div key={item.category.id}><span>{item.category.payload.name}</span><i><b style={{ width: Math.max(3, item.total / Math.max(1, expenseTotal) * 100) + "%" }}/></i><strong>{yen(item.total)}</strong></div>)}</div>
    </section>
    <section className="money-section recent-money"><div className="money-section-heading"><div><h3>最近の記録</h3><p>振替は収入・支出の合計には含めません。</p></div></div>{recent.map(item => item.type === "transfer" ? <article className="money-row transfer-row" key={item.id}><span><ArrowRightLeft/></span><b>{methodName((item.payload as TransferData).sourceMethodId)} → {methodName((item.payload as TransferData).destinationMethodId)}</b><small>{new Date((item.payload as TransferData).occurredAt).toLocaleDateString("ja-JP")}</small><strong>{yen((item.payload as TransferData).amount)}</strong></article> : <button className="money-row" key={item.id} onClick={() => begin(item as CoreEntity<TransactionData>)}><span className={(item.payload as TransactionData).direction}>{(item.payload as TransactionData).direction === "income" ? <ArrowDownLeft/> : <ArrowUpRight/>}</span><b>{String((item.payload as TransactionData).title)}</b><small>{categoryName((item.payload as TransactionData).categoryId, (item.payload as TransactionData).category)} · {methodName((item.payload as TransactionData).moneyMethodId)}</small><strong>{yen(Number((item.payload as TransactionData).amount))}</strong></button>)}{!recent.length && <DiaryEmpty title="お金の記録はまだありません">収支または振替を追加できます。</DiaryEmpty>}</section>
    <details className="money-section money-management"><summary>カテゴリ・支払方法を管理</summary><div className="money-management-grid"><section><h3>カテゴリ</h3><div className="inline-add"><input value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="新しいカテゴリ"/><button onClick={() => void action.run(async () => { await create("moneyCategory", { name: newCategory.trim(), appliesTo: "both", sortOrder: categories.length, archived: false, systemKey: null }); setNewCategory(""); }, "カテゴリを追加しました")} disabled={!newCategory.trim()}><Plus size={14}/>追加</button></div>
      {categories.map((item, index) => <div className="management-row" key={item.id}><span>{item.payload.name}{item.payload.archived ? "（非表示）" : ""}</span><button disabled={index === 0} onClick={() => void move(item, -1, categories)}><ChevronUp/></button><button disabled={index === categories.length - 1} onClick={() => void move(item, 1, categories)}><ChevronDown/></button><button onClick={() => void rename(item)}><Edit3/></button><button disabled={Boolean(item.payload.systemKey)} onClick={() => void update(item, { ...item.payload, archived: !item.payload.archived })}>{item.payload.archived ? "戻す" : "非表示"}</button></div>)}
      <div className="merge-category"><select value={mergeSource} onChange={event => setMergeSource(event.target.value)}><option value="">統合元</option>{categories.filter(item => !item.payload.systemKey).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select><select value={mergeTarget} onChange={event => setMergeTarget(event.target.value)}><option value="">統合先</option>{categories.filter(item => item.id !== mergeSource).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select><button disabled={!mergeSource || !mergeTarget} onClick={() => void action.run(mergeCategory, "カテゴリを統合しました")}><Trash2 size={14}/>付け替えて削除</button></div>
    </section><section><h3>支払方法</h3><div className="inline-add"><input value={newMethod} onChange={event => setNewMethod(event.target.value)} placeholder="新しい支払方法"/><button onClick={() => void action.run(async () => { await create("moneyMethod", { name: newMethod.trim(), sortOrder: methods.length, archived: false }); setNewMethod(""); }, "支払方法を追加しました")} disabled={!newMethod.trim()}><Plus size={14}/>追加</button></div>
      {methods.map((item, index) => { const used = transactions.some(transaction => transaction.payload.moneyMethodId === item.id) || transfers.some(transfer => transfer.payload.sourceMethodId === item.id || transfer.payload.destinationMethodId === item.id); return <div className="management-row" key={item.id}><span>{item.payload.name}{item.payload.archived ? "（非表示）" : ""}</span><button disabled={index === 0} onClick={() => void move(item, -1, methods)}><ChevronUp/></button><button disabled={index === methods.length - 1} onClick={() => void move(item, 1, methods)}><ChevronDown/></button><button onClick={() => void rename(item)}><Edit3/></button><button onClick={() => void update(item, { ...item.payload, archived: !item.payload.archived })}>{item.payload.archived ? "戻す" : "非表示"}</button><button title={used ? "使用中のため削除できません" : "削除"} disabled={used} onClick={() => void update(item, item.payload, true)}><Trash2/></button></div>; })}
    </section></div></details>
    {editing !== undefined && <SectionDialog title={editing ? "収支を編集" : "収支を記録"} close={() => setEditing(undefined)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void saveTransaction(); }}><fieldset disabled={action.busy}><label>内容<input autoFocus required value={title} onChange={event => setTitle(event.target.value)}/></label><div className="form-pair"><label>金額<input type="number" min="1" required value={amount} onChange={event => setAmount(event.target.value)}/></label><label>種類<select value={direction} onChange={event => setDirection(event.target.value as TransactionData["direction"])}><option value="expense">支出</option><option value="income">収入</option></select></label><label>カテゴリ<select required value={categoryId} onChange={event => setCategoryId(event.target.value)}>{categories.filter(item => !item.payload.archived || item.id === categoryId).filter(item => item.payload.appliesTo === "both" || item.payload.appliesTo === direction).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label><label>支払方法<select value={methodId} onChange={event => setMethodId(event.target.value)}><option value="">未指定</option>{methods.filter(item => !item.payload.archived || item.id === methodId).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label><label>状態<select value={status} onChange={event => setStatus(event.target.value as TransactionData["status"])}><option value="settled">確認済み</option><option value="expected">予定</option></select></label><label>行動日<input type="date" required value={occurred} onChange={event => setOccurred(event.target.value)}/></label><label>予定日<input type="date" value={expected} onChange={event => setExpected(event.target.value)}/></label><label>実績<select value={actualId} onChange={event => setActualId(event.target.value)}><option value="">なし</option>{actuals.map(item => <option key={item.id} value={item.id}>{item.payload.title}</option>)}</select></label></div><label>メモ<textarea rows={2} value={note} onChange={event => setNote(event.target.value)}/></label><ActionFeedback {...action}/><button className="save" type="submit">保存する</button>{editing && <button type="button" className="delete-entity" onClick={() => void action.run(async () => { await update(editing, editing.payload, true); setEditing(undefined); }, "収支を削除しました")}><Trash2 size={15}/>削除</button>}</fieldset></form></SectionDialog>}
    {transferOpen && <SectionDialog title="振替を記録" close={() => setTransferOpen(false)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void action.run(saveTransfer, "振替を保存しました"); }}><fieldset disabled={action.busy}><div className="form-pair"><label>振替元<select required value={sourceMethod} onChange={event => setSourceMethod(event.target.value)}>{methods.filter(item => !item.payload.archived).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label><label>振替先<select required value={destinationMethod} onChange={event => setDestinationMethod(event.target.value)}>{methods.filter(item => !item.payload.archived).map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label><label>金額<input required type="number" min="1" value={transferAmount} onChange={event => setTransferAmount(event.target.value)}/></label><label>日付<input required type="date" value={transferDate} onChange={event => setTransferDate(event.target.value)}/></label><label>手数料<input type="number" min="0" value={transferFee} onChange={event => setTransferFee(event.target.value)}/></label></div>{sourceMethod === destinationMethod && <p className="form-error">振替元と振替先は別にしてください。</p>}<label>メモ<textarea rows={2} value={transferNote} onChange={event => setTransferNote(event.target.value)}/></label><button className="save" type="submit" disabled={!transferAmount || sourceMethod === destinationMethod}>保存する</button></fieldset></form></SectionDialog>}
    {budgetOpen && <SectionDialog title="予算を設定" close={() => setBudgetOpen(false)} busy={action.busy}><form onSubmit={event => { event.preventDefault(); void saveBudget(); }}><fieldset disabled={action.busy}><label>カテゴリ<select required value={budgetCategory} onChange={event => setBudgetCategory(event.target.value)}>{categories.filter(item => !item.payload.archived && item.payload.appliesTo !== "income").map(item => <option key={item.id} value={item.id}>{item.payload.name}</option>)}</select></label><label>期間<select value={budgetPeriod} onChange={event => setBudgetPeriod(event.target.value as BudgetData["period"])}><option value="week">週</option><option value="month">月</option></select></label><label>予算額<input required type="number" min="1" value={budgetAmount} onChange={event => setBudgetAmount(event.target.value)}/></label><button className="save" type="submit">保存する</button></fieldset></form></SectionDialog>}
  </section>;
}
