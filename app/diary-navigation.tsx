"use client";
import { Home, CalendarDays, ListTodo, Inbox, Repeat2, WalletCards, Settings, Ellipsis, LogOut, Gem, Check, Compass } from "lucide-react";
import { diaryThemes, useDiaryTheme, type DiaryThemeId } from "./diary-theme";
const primary = [["now", "今", Home], ["plan", "カレンダー", CalendarDays], ["tasks", "タスク", ListTodo], ["money", "お金", WalletCards]] as const;
const secondary = [["inbox", "未整理", Inbox], ["recurring", "繰り返し予定", Repeat2], ["directions", "方向", Compass], ["settings", "設定", Settings]] as const;
export function DiaryNavigation({ tab, setTab, checks, userName, syncState, onSignOut }: {
  tab: string; setTab: (tab: string) => void; checks: number; userName: string; syncState: string; onSignOut: () => void;
}) {
  const { id: themeId, setTheme } = useDiaryTheme();
  return <aside className="diary-navigation">
    <a className="diary-brand" href="#main-content" onClick={() => setTab("now")} aria-label="Liflow 今を開く">
      <span className="diary-emblem" aria-hidden="true" />
      <span>Liflow<small>毎日を、ちょっと魔法に。</small></span>
    </a>
    <nav aria-label="メインメニュー" className="diary-tabs">
      {primary.map(([id, label, Icon]) => <button key={id} data-tab={id} className={tab === id ? "active" : ""}
        aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
        <Icon size={19} /><span>{label}</span>
      </button>)}
    </nav>
    <details className="diary-menu">
      <summary><Ellipsis size={21} /><span>メニュー</span></summary>
      <div className="diary-menu-panel">
        <p className="menu-account">{userName.split("@")[0]}<small>{syncState}</small></p>
        {secondary.map(([id, label, Icon]) => <button key={id} data-tab={id} aria-current={tab === id ? "page" : undefined} onClick={event => { setTab(id); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Icon size={17} />{label}{id === "inbox" && checks > 0 && <em>{checks > 99 ? "99+" : checks}</em>}</button>)}
        <div className="theme-picker"><p><Gem size={15} />テーマ</p>
          {(Object.keys(diaryThemes) as DiaryThemeId[]).map(id => <button key={id} aria-pressed={id === themeId} onClick={() => setTheme(id)}>{diaryThemes[id].label}{id === themeId && <Check size={15} />}</button>)}
        </div>
        <button onClick={onSignOut}><LogOut size={17} />ログアウト</button>
      </div>
    </details>
  </aside>;
}
