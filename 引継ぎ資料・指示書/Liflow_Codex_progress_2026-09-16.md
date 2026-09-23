# Liflow GUI Phase 1 実装メモ
更新日: 2026-09-16

## 実装した範囲

引継ぎ資料の Phase 1 に沿って、React / TypeScript / Firebase の既存構成に GUI を接続した。

- Magical Diary の共通テーマ、手帳風の外枠・レース・宝石の装飾。
- PC の上部タブ、スマホの下部タブ。「今 / カレンダー / タスク / 未整理」を主ナビに整理。
- プロジェクト・ルーティン・お金・設定・ログアウトはメニュー内。
- テーマをメニューから Magical Diary / シンプルへ切り替え可能。
- リフちゃんの表情8種類を用意した FairyCharacter。通常・笑顔・深夜の眠い表情などを状態に応じて表示。
- 「今」は現在・次の予定、残りの空き時間、今日の時間軸、タスク、未整理、ルーティン、すばやい記録を表示。
- 日表示は予定・ルーティン・実績を別レーンで表示。重なる予定は列に分割。
- 終日・期間の予定は上部に表示。空き時間の計算には含めない。
- 日表示の予定の持ち手で移動、下の持ち手で伸縮。上下キーでも15分単位で操作可能。
- 空き時間のドラッグで範囲を選び、入力画面に開始・終了を引き継ぐ。保存するまでは予定を作成しない。
- 保存失敗時は元の予定を保持し、エラーを表示。
- 保存済み実績に結びついた予定・日をまたぐ予定は、日表示のドラッグ対象から外している。
- 短いルーティンにも読める表示領域を確保。
- コマンド入力・記録画面はネイティブ dialog を使い、フォーカス制御と Escape に対応。
- ボタンの押下、モーダルの開閉、ルーティン記録・予定変更時の妖精の反応。prefers-reduced-motion に対応。

## データ境界

- domain/core.ts、domain/schema.ts、domain/commands.ts、app/firebase-store.ts、Firestoreルール、Discord Bot は変更していない。
- 新しい UI からも既存の create/update/Command Engine を使用する。
- entity ID、revision、履歴、tombstone、Task / Plan / Actual の関係を維持。
- テーマ設定だけをブラウザの liflow_ui_theme_v1 に保存。Entity の schema は変更していない。
- 「今」の現在・次の判定では、取り消し・延期済み、終日、期間の予定を実行中の予定として扱わない。
- 日表示の表示フィルタと空き時間計算を分離し、非表示カテゴリも空き時間の計算に含める。
- 日をまたぐ時間範囲を表示日の範囲に切り取って表示する。

## 主要なファイル

- app/diary-theme.tsx — テーマとキャラクター素材の定義、テーマ設定。
- app/diary-navigation.tsx — 主ナビ・メニュー・テーマ選択。
- app/fairy-character.tsx — 表情差し替え可能な妖精表示。
- app/now-view.tsx — 「今」と今日の時間軸。
- app/day-calendar.tsx — 日表示と直接操作。
- app/diary-time.ts — 表示日の範囲、空き時間、移動・伸縮の計算。
- app/diary-dialog.tsx — 共通ダイアログ。
- app/diary.css / diary-theme.css / diary-views.css / diary-mobile.css — スタイル。
- app/liflow.tsx / calendar-view.tsx / layout.tsx — 既存アプリへの接続。
- public/themes/magical-diary/ — 妖精、宝石エンブレム、レース。詳細は ASSETS.md。
- tests/ui/ — 実データを使わない画面確認用のデータ・エントリ・時間境界テスト。
- scripts/diary-smoke.mjs — Edge のヘッドレスブラウザテスト。

## 確認結果

- 型チェック: 成功（tsc --noEmit --incremental false）。
- lint: 成功、エラー・警告なし。
- npm run test: 35件成功（既存30件 + 時間境界5件）。
- npm run test:ui: 23項目成功。
- npm run build: 成功。依存ライブラリ由来の非推奨API・チャンクサイズの警告は残る。
- 本体を http://127.0.0.1:8787 で起動し、HTTP 200・ログイン画面・ブラウザ例外なしを確認。

ブラウザテストは Firebase をテスト用のメモリ内ストアへ置き換えた別サーバーで実施している。本物のユーザーデータやアカウントにログインして行う同期テストは実施していない。Discord への送信も行っていない。

確認した画面: 今、日、週、月、タスク、プロジェクト、ルーティン、お金、設定、未整理、コマンド入力、記録画面。
確認した操作: ルーティン記録、コマンドからの追加、タスク編集、予定の移動・伸縮・キーボード操作、保存失敗、空き時間からの作成、テーマの切り替えと保存、360px / 390px の画面幅、動きを控える設定。

## 起動・再確認

通常の起動:

```powershell
npm.cmd run local
```

起動済みなら http://127.0.0.1:8787 を開く。二重起動は不要。停止する場合は起動したターミナルで Ctrl+C。

ブラウザテストの再実行（Windows / Edge）:

```powershell
npm.cmd install --prefix .openai/browser-tools --no-save --package-lock=false playwright
npm.cmd run test:ui
```

テストは 127.0.0.1:4175 の一時サーバーを使い、終了時に停止する。

## 画面とバックアップ

画面確認の画像は artifacts/diary/、テスト結果は artifacts/diary/smoke-results.json。

- desktop-now.png / mobile-now.png
- desktop-day.png / mobile-day.png
- desktop-command.png / desktop-modal.png
- desktop-week.png / desktop-month.png / desktop-tasks.png / desktop-simple.png
- local-login.png

変更前の app/liflow.tsx、app/calendar-view.tsx、app/layout.tsx は .openai/diary-backup-20260916/ に .bak として保存した。作業開始時点でこのフォルダに Git リポジトリはなかった。

## 次の段階

Phase 2 の週・月・タスク・未整理・プロジェクト・ルーティン・お金の個別レイアウト刷新は、方向確認後に実装を完了した。詳細と最新の起動・確認結果は [Phase 2 実装メモ](Liflow_Codex_progress_phase2_2026-09-23.md) を参照。

妖精の最終画像は白背景を明るいテーマに合成している。透過PNGではない。暗いテーマを追加するときは、そのテーマ用の画像に差し替えるか、透明背景の素材を別途用意する。現在のキャラクター定義で素材の差し替えが可能。
