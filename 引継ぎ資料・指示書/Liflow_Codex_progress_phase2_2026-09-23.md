# Liflow GUI Phase 2 実装メモ

更新日: 2026-09-23
対象指示: `指示文phase2.md`

## 完了した範囲

Phase 1 の Magical Diary のテーマ・共通外枠・素材を、以下の7画面へ展開した。

| 画面 | 主な変更 |
| --- | --- |
| 週 | PCは7日分の縦時間軸。予定・実績・ルーティンを区別し、終日・期間・締切は上部へ表示。タスクのドラッグで関連する予定の入力画面を開く。スマホは週内の日付を選び、1日分を表示する。 |
| 月 | 期間・終日・締切・時刻付き予定を表示。日付ごとの表示は3件と残り件数に制限し、選択日の一覧から全件を確認・編集できる。スマホではマークと日別一覧を使う。 |
| タスク | 未完了・予定なし・完了・すべての切り替え、検索、プロジェクト絞り込み、親子表示と折りたたみ、完了の記録と取り消し。 |
| 未整理 | 終わった予定、時間を決めるタスク、メモ、時間の重なり、入出金確認に分けて表示。記録を合わせる操作と、その他の操作を整理。 |
| プロジェクト | 親子関係をカードで表示し、タスク完了数を確認できる。共通ダイアログで編集し、完了・アーカイブからも戻せる。非表示の親を持つ子も一覧から到達できる。 |
| ルーティン | 今日・すべて・休止中を切り替えられる。所要時間・説明を保持して編集可能。休止からの再開、実施・スキップ・記録を戻す操作を用意。 |
| お金 | 行動日の月別・全期間表示、確認済み収支と予定の入出金を分けた集計、日別一覧、共通ダイアログでの追加・編集・削除。 |

スマホではカレンダーの表示フィルターと週のタスク候補を折りたたみ、時間軸を見やすくした。タスク・未整理・ルーティンの記録時には小さなリフちゃんの反応を表示する。動きを控える設定にも対応する。

画像は Phase 1 の素材を再利用した。追加の画像生成は行っていない。素材の出典と生成履歴は `public/themes/magical-diary/ASSETS.md` を参照。

## 操作・データ保持の改善

- タスクを週に置いてもタスクは残り、Task ID と関連する別の Plan を作る。
- 表示フィルターで非表示にした予定も空き時間計算には含める。
- 取り消し・延期済みの予定を週・月の有効な予定から除く。
- 日をまたぐ予定を各日の範囲へ切り取って表示。月の期間表示は終了日時を超えて延長しない。
- 予定・実績フォームに終了日を追加した。名前だけを編集した場合、元の開始・終了日時を保持する。終日・期間予定の終了境界も保持する。
- タスクの締切日が変わらなければ、元の締切時刻を保持する。
- プロジェクトの親候補から循環する候補を除外し、保存時にもチェックする。
- ルーティンの編集で説明・所要時間を空値に上書きしない。実施状態は RoutineOccurrence に記録する。
- 収支の編集で Project / Task / Plan / Actual の関連と、日付が変わらない日時を保持する。
- 新しい編集画面では保存中の多重操作を抑制する。保存失敗時には入力内容を残し、画面内にエラーを表示する。

## 変更した主なファイル

- `app/week-calendar.tsx` / `app/month-calendar.tsx` / `app/calendar-overview.ts` — 週・月表示と日付の計算。
- `app/tasks-view.tsx` / `app/inbox-view.tsx` — タスク・未整理。
- `app/projects-view.tsx` / `app/routines-view.tsx` / `app/money-view.tsx` — 各一覧と編集。
- `app/diary-section.tsx` — 共通の見出し・空表示・編集ダイアログ・保存状態。
- `app/diary-sections.css` / `app/diary-calendar.css` / `app/diary.css` — テーマとレスポンシブ表示。
- `app/liflow.tsx` / `app/calendar-view.tsx` / `app/life-sections.tsx` — 既存アプリへの接続。
- `tests/ui/diary-time.test.ts` / `tests/ui/fixture-store.ts` / `scripts/diary-phase2-checks.mjs` / `scripts/diary-smoke.mjs` — 日付境界と実画面の確認。

変更前のソースは `.openai/phase2-backup-20260916/` に `.bak` として保存してある。

## 確認結果

- 型チェック: 成功。
- lint: エラー・警告なし。
- ドメイン・日付境界テスト: **38件成功**。
- ブラウザテスト: **32項目成功**。Phase 1 の操作、Phase 2 の保存・階層・実際のマウスドラッグ、360px / 390px の各画面を含む。
- ブラウザの未処理例外: なし。
- `npm.cmd run build`: **2026-09-23 に成功**。前回の dist 更新時のアクセスエラーは今回の再実行では発生しなかった。
- 最新ビルドをローカルの8795番ポートで起動し、HTTP 200・ログイン画面・ブラウザ例外なしを確認した。確認用サーバーは停止済み。

ビルドには依存ライブラリ由来の非推奨API・チャンクサイズ等の案内が残る。ビルド自体は成功している。

機能のブラウザテストは Firebase をメモリ内のテストストアへ置き換えた別サーバーで実行した。実ユーザーのログイン後の同期・複数端末の通信テストや、Discord送信は行っていない。

## 保存・同期の境界

`domain/core.ts`、`domain/schema.ts`、`domain/commands.ts`、`app/firebase-store.ts`、Firestoreルール、Discord Bot の保存・同期処理は変更していない。既存の entity 単位の create/update、revision、tombstone、関係を使う。スキーマ変更・ストレージ初期化・全データの置換は行っていない。

## 起動・再確認

最新ビルドは `dist/` に生成済み。通常どおり **`START_LIFLOW.bat`** を起動する。すでに起動している場合はそのターミナルで Ctrl+C を押し、バッチを起動し直す。

開くURL: `http://127.0.0.1:8787`

開発後にソースから再ビルドする場合:

```powershell
npm.cmd run build
```

ブラウザテスト:

```powershell
npm.cmd run test:ui
```

テストは Edge と `.openai/browser-tools` 内の Playwright を使用し、一時サーバー4175番を終了時に停止する。

## 画面・結果ファイル

`artifacts/diary/` に PC・スマホの画像を保存してある。

- `desktop-week.png` / `mobile-week.png`
- `desktop-month.png` / `mobile-month.png`
- `desktop-tasks.png` / `mobile-tasks.png`
- `desktop-inbox.png` / `mobile-inbox.png`
- `desktop-projects.png` / `mobile-projects.png`
- `desktop-routines.png` / `mobile-routines.png`
- `desktop-money.png` / `mobile-money.png` / `mobile-money-editor.png`
- `local-login-phase2.png` — 最新ビルドの起動確認。
- `smoke-results.json` — 32項目の結果。
- `production-smoke-phase2.json` — 最新ビルドのHTTP・ログイン画面の確認結果。
