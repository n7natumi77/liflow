"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
export type FairyExpression = "normal" | "happy" | "excited" | "thinking" | "surprised" | "concerned" | "sleepy" | "proud";
const expressions: FairyExpression[] = ["normal", "happy", "excited", "thinking", "surprised", "concerned", "sleepy", "proud"];
const character = { name: "リフちゃん", atlas: "/themes/magical-diary/fairy-expressions.png", columns: 4, rows: 2, expressions };
export const diaryThemes = {
  magical: { label: "Magical Diary", character, decorations: true },
  simple: { label: "シンプル", character, decorations: false },
} as const;
export type DiaryThemeId = keyof typeof diaryThemes;
const STORAGE_KEY = "liflow_ui_theme_v1", EVENT = "liflow-theme-change";
function readTheme(): DiaryThemeId {
  try { return localStorage.getItem(STORAGE_KEY) === "simple" ? "simple" : "magical"; } catch { return "magical"; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback); };
}
const ThemeContext = createContext<{ id: DiaryThemeId; theme: typeof diaryThemes[DiaryThemeId]; setTheme: (id: DiaryThemeId) => void }>({ id: "magical", theme: diaryThemes.magical, setTheme: () => {} });
export function DiaryThemeProvider({ children }: { children: ReactNode }) {
  const id = useSyncExternalStore(subscribe, readTheme, () => "magical" as DiaryThemeId);
  const setTheme = (next: DiaryThemeId) => {
    try { localStorage.setItem(STORAGE_KEY, next); window.dispatchEvent(new Event(EVENT)); } catch { /* Storage can be unavailable. */ }
  };
  return <ThemeContext.Provider value={{ id, theme: diaryThemes[id], setTheme }}><div className="diary-theme" data-theme={id}>{children}</div></ThemeContext.Provider>;
}
export const useDiaryTheme = () => useContext(ThemeContext);
