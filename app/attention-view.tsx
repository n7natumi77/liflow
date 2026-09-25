"use client";
import { BellRing, CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import { active, type AttentionData, type CoreEntity } from "../domain/core";
import { attentionGroup } from "../domain/attention";
import type { CaptureState } from "./diary-types";
import { ActionFeedback, DiaryEmpty, SectionHeading, useDiaryAction, type UpdateEntity } from "./diary-section";

export function AttentionView({ entities, update, setTab, setModal, systemIssues = [] }: {
  entities: CoreEntity[];
  update: UpdateEntity;
  setTab: (tab: string) => void;
  setModal: (modal: CaptureState) => void;
  systemIssues?: string[];
}) {
  const action = useDiaryAction();
  const attentions = active<AttentionData>(entities, "attention").filter(item => item.payload.status === "open")
    .sort((a, b) => attentionGroup(a.payload.kind).localeCompare(attentionGroup(b.payload.kind), "ja"));
  const openTarget = (item: CoreEntity<AttentionData>) => {
    if (item.payload.kind === "directionStale") setTab("directions");
    else if (item.payload.kind === "planningGap") setTab("plan");
    else if (item.payload.kind === "actualMissing" && item.payload.targetId) setModal({ kind: "actual", planId: item.payload.targetId });
    else if (item.payload.kind === "taskDeadline" && item.payload.targetId) setModal({ kind: "task", entityId: item.payload.targetId });
    else if (item.payload.kind === "expectedMoneyOverdue") setTab("money");
  };
  const ignore = (item: CoreEntity<AttentionData>) => action.run(() => update(item, { ...item.payload, status: "ignored", ignoredAt: new Date().toISOString(), resolvedAt: null }), "この状態では再表示しません");
  return <section className="panel notebook attention-notebook">
    <SectionHeading icon={<BellRing/>} title="要確認" description="Liflowが見つけた判断候補です。エラーではなく、このままでよければ閉じられます。"/>
    <ActionFeedback {...action}/>
    {systemIssues.length > 0 && <section className="system-issues" aria-labelledby="system-heading"><h3 id="system-heading"><ShieldAlert size={17}/>System</h3>{systemIssues.map(issue => <p key={issue}>{issue}</p>)}</section>}
    <div className="attention-list">{attentions.map(item => <article className="attention-card" key={item.id} data-kind={item.payload.kind}>
      <span>{attentionGroup(item.payload.kind)}</span><h3>{item.payload.title}</h3><p>{item.payload.message}</p>
      <div><button className="diary-button primary" onClick={() => openTarget(item)}><ExternalLink size={15}/>対応する</button><button className="diary-button" disabled={action.busy} onClick={() => void ignore(item)}><CheckCircle2 size={15}/>このままでOK</button></div>
    </article>)}</div>
    {!attentions.length && !systemIssues.length && <DiaryEmpty title="いま確認が必要なものはありません">状態が変わると、必要な項目だけここに現れます。</DiaryEmpty>}
  </section>;
}
