# Liflow vNext Phase 2.5 作業記録 — 2026-09-25

## 実装済み

- `.openai/hosting.json` / `.sites-runtime` に依存しないportable build構成
- GitHub接続型Cloudflare Workers build/deploy scriptとdry-run
- `/api/health` と設定画面の非秘密診断（App/Schema/Build/SW/Firebase/Network/Notification/config有無）
- Cloudflare向けDiscord Interaction route（Web Crypto署名、Firestore REST、長文follow-up）
- PWA manifest 192/512/maskable PNG、versioned Service Worker、offline shell、更新検出/適用
- foreground/background Pushの受け口、通知クリック導線
- ActualのGUI編集・tombstone削除。Plan/Task/Task Action/Execution Sessionは巻き戻さない
- Actual削除時、関連Moneyは確認後に保持し、Actualリンクだけtransaction内で解除
- 過去の未実施Planを複製せずTask/Nowへ導出表示。Actual、完了、skip、unneeded、postpone等で停止
- Phase 2.5 portability/PWA/Cloudflare/carryover automated tests
- Production runbookと外部手順の分離

## 自動検証結果

- typecheck: 成功
- 全test: 118件成功 / 失敗0
- lint: 成功
- browser UI smoke: 13 checks / page error 0
- Cloudflare production build: 成功（既知の500 KiB chunk warningのみ）
- Wrangler deploy dry-run: 成功、D1/R2 bindingなし、gzip約390 KiB
- local HTTP smoke: root / manifest / SW / 3 PNG icons / health = 200、Discord unsigned POST = 401
- Cloudflare認証確認: 未ログインのため実deployは未実施
- commit後のclean clone: `npm ci` / typecheck / 118 tests / lint / build すべて成功（ignored local fileなし）

## 外部環境が必要な未完了項目

- Cloudflare accountでのProduction deployと実URL smoke
- Firebase実credentialでの2端末同期、migration、競合、Security Rules拒否確認
- 実スマートフォンへのPWA install、全主要画面、Execution Session、offline/reconnect
- FCM foreground/background/closed delivery、click、sign-out/user切替
- Discord Developer Portal接続、実Server query/mutation/bulk/long output/security

手順と記録項目は `docs/phase25-production.md` を参照。外部確認が終わるまではPhase 2.5全体を「完了」と扱わない。
