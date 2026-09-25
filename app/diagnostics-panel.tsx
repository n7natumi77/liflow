"use client";
import { useEffect, useState } from "react";
import type { SyncState } from "./firebase-store";
import { applyPwaUpdate, notificationCapability, pwaDiagnostics } from "./notifications-client";

type Health = {
  appVersion: string;
  schemaVersion: number;
  buildId: string;
  runtime: string;
  configuration: Record<string, boolean>;
};

export function DiagnosticsPanel({ syncState, lastSyncedAt }: { syncState: SyncState; lastSyncedAt: string | null }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [serviceWorker, setServiceWorker] = useState({ supported: false, controlled: false, version: "-", updateReady: false });
  const refresh = () => {
    void fetch("/api/health", { cache: "no-store" }).then(response => response.ok ? response.json() as Promise<Health> : Promise.reject()).then(setHealth).catch(() => setHealth(null));
    void pwaDiagnostics().then(setServiceWorker);
  };
  useEffect(refresh, []);
  const configured = health ? Object.entries(health.configuration) : [];
  return <section className="panel settings-panel diagnostics-panel">
    <div><p className="kicker">診断</p><h2>本番環境の状態</h2><p>秘密値そのものは表示せず、設定の有無だけを確認できます。</p></div>
    <dl>
      <div><dt>App / Schema</dt><dd>{health ? `${health.appVersion} / v${health.schemaVersion}` : "確認中"}</dd></div>
      <div><dt>Build</dt><dd>{health?.buildId || "-"}</dd></div>
      <div><dt>Runtime</dt><dd>{health?.runtime || "未接続"}</dd></div>
      <div><dt>Service Worker</dt><dd>{serviceWorker.supported ? `${serviceWorker.version} · ${serviceWorker.controlled ? "制御中" : "登録待ち"}` : "非対応"}</dd></div>
      <div><dt>Firebase</dt><dd>{syncState}{lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleString("ja-JP")}` : ""}</dd></div>
      <div><dt>Network</dt><dd>{typeof navigator !== "undefined" && navigator.onLine ? "オンライン" : "オフライン"}</dd></div>
      <div><dt>Notification</dt><dd>{notificationCapability()}</dd></div>
    </dl>
    <div className="diagnostic-config">{configured.map(([name, value]) => <span className={value ? "configured" : "missing"} key={name}>{name}: {value ? "設定済み" : "未設定"}</span>)}</div>
    <div className="settings-actions"><button className="diary-button" onClick={refresh}>再確認</button>{serviceWorker.updateReady && <button className="diary-button primary" onClick={() => void applyPwaUpdate().then(() => location.reload())}>更新を適用</button>}</div>
  </section>;
}
