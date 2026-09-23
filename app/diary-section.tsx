"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { DiaryDialog } from "./diary-dialog";
import { FairyCharacter } from "./fairy-character";
import type { CoreEntity, EntityType } from "../domain/core";

export type CreateEntity = (type: EntityType, payload: Record<string, unknown>) => Promise<CoreEntity>;
export type UpdateEntity = (entity: CoreEntity, payload: Record<string, unknown>, deleted?: boolean) => Promise<void>;
export type SectionProps = { entities: CoreEntity[]; create: CreateEntity; update: UpdateEntity };

export function SectionHeading({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="notebook-heading"><span className="notebook-icon" aria-hidden="true">{icon}</span><div><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

export function DiaryEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="notebook-empty"><span className="diary-emblem" aria-hidden="true"/><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function SectionDialog({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: ReactNode }) {
  const id = useId();
  return <DiaryDialog className="modal section-dialog" labelledBy={id} close={close} busy={busy}>
    <button type="button" className="modal-close" aria-label="閉じる" onClick={close} disabled={busy}><X size={18}/></button>
    <h2 id={id}>{title}</h2>{children}
  </DiaryDialog>;
}

/** One in-flight action per view. A failed save keeps the editor and its draft open. */
export function useDiaryAction() {
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const run = async (action: () => Promise<unknown>, message = "保存しました") => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await action(); setNotice(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(""), 2600);
      return true;
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "revision_conflict"
        ? "別の端末で更新されています。編集を開き直して、最新の内容を確認してください。"
        : "保存できませんでした。入力内容は残っています。通信を確認して、もう一度お試しください。");
      return false;
    } finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, notice, run, clearError: () => setError("") };
}

export function ActionFeedback({ error, notice, fairy = false }: { error: string; notice: string; fairy?: boolean }) {
  return <>{error && <p className="section-error" role="alert">{error}</p>}
    <div className="section-notice" role="status" aria-live="polite">{notice && <span><Check size={15}/>{notice}{fairy && <><Sparkles size={15}/><FairyCharacter expression="happy" size={78} decorative/></>}</span>}</div>
  </>;
}
