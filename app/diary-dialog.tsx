"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function DiaryDialog({ children, className = "", labelledBy, close, busy = false }: {
  children: ReactNode; className?: string; labelledBy: string; close: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={"diary-dialog " + className} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }}
    onMouseDown={event => {
      if (busy || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>{children}</dialog>;
}
