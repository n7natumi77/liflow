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
- Firestore Rulesをrepository管理し、user isolation・入力shape・tombstone契約を強化
- Firestore Emulator RulesテストとGitHub Actions（Node 22 / Java 21）を追加

## 自動検証結果

- typecheck: 成功
- 全test: 119件成功 / 失敗0
- lint: 成功
- browser UI smoke: 13 checks / page error 0
- Cloudflare production build: 成功（既知の500 KiB chunk warningのみ）
- Wrangler deploy dry-run: 成功、D1/R2 bindingなし、gzip約390 KiB
- local HTTP smoke: root / manifest / SW / 3 PNG icons / health = 200、Discord unsigned POST = 401
- Cloudflare認証確認: 未ログインのため実deployは未実施
- Phase 2.5実装commit後のclean clone: `npm ci` / typecheck / 118 tests / lint / build すべて成功（ignored local fileなし）
- Firestore Rules emulator: 8 tests成功 / 失敗0（cross-user・guest・hard delete等の拒否を含む）
- Firebase Rules deploy: `test-b1f84` へ成功（source commit `319cdd2`、ruleset `d474db41-5653-4f3f-bbff-67be9b7f4250`）
- Cloudflare Production deploy: `https://liflow.errormeg.workers.dev`（source commit `a032528`、Version ID `05ac5157-f6ab-4970-9a5f-8985abbe812f`）
- Production HTTP smoke: root / manifest / SW / 3 PNG icons / health = 200、Discord unsigned POST = 401
- Production Firebase smoke: Auth origin受理 = 200、Firestore未認証read = 403 `PERMISSION_DENIED`

## 外部環境が必要な未完了項目

- Production URLでの実Firebaseログイン・既存データ表示、2端末同期、migration、競合、本番環境でのcross-user拒否確認
- 実スマートフォンへのPWA install、全主要画面、Execution Session、offline/reconnect
- FCM foreground/background/closed delivery、click、sign-out/user切替
- Discord Developer Portal接続、実Server query/mutation/bulk/long output/security

手順と記録項目は `docs/phase25-production.md` を参照。外部確認が終わるまではPhase 2.5全体を「完了」と扱わない。
