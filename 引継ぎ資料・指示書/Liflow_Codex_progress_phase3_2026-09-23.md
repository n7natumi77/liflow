# Liflow GUI Phase 3 実装メモ

更新日: 2026-09-23  
対象指示: `指示文phase3.md`

## 完了した範囲

Phase 1 / 2 の機能とデータ境界を維持したまま、Magical Diary の全主要画面へ Visual Polish / Interaction / Asset Pass を実施した。実装前に `artifacts/diary/` のデスクトップ・モバイル・ダイアログ・Simple Theme画像を目視比較し、実装後も `artifacts/diary/phase3/` の22画像を再確認した。

## Visual Auditで見つけた問題

- Task、未整理、Project、Routine、Moneyが「淡い角丸カードの一覧」に寄り、画面の役割を見た目だけで判別しにくかった。
- 未整理は警告一覧、Projectは入れ子カード、Routineは通常のTaskカードに近く、Liflow固有の比喩が弱かった。
- Moneyの数値は読めたが、一般的な集計ダッシュボードに見えた。
- Navigationの選択状態、checkbox、buttonの押下感が通常のWeb UIに近かった。
- Day / Week / Monthは機能的には揃っていたが、同じ手帳の3表示としての紙面・日付・現在時刻表現を強められた。
- 360px / 390pxでは固定下部Navigationと記録ボタンが大きく、長い一覧の表示領域を圧迫していた。
- ダイアログとコマンド入力は読みやすい一方、Magical Diaryの操作盤としては装飾が弱かった。

## 実際にどう修正したか

| 画面 | 修正内容 |
| --- | --- |
| 共通 | 乳白紙面、リボン区切り、二重の紙枠、見出し飾りをTheme層へ追加。buttonのhover / press、入力focus、独自checkbox、空状態の小さな星飾りを統一した。 |
| Navigation | 電子手帳のindexを意識し、選択tabが手前へ出る位置・影・下線へ変更。hover / pressと画面切替時の短いsettle motionを追加した。 |
| Day | 罫線紙面と宝石型の現在時刻マーカーを追加。既存のPlan / Routine / Actualの列と操作性は維持した。 |
| Week | 週手帳として日付見出し、現在日、交互の紙面、予定シールの奥行きを調整した。 |
| Month | 月タイトル面へパール紙とリボン区切り、日付セルへ控えめな折り目、日別agendaへ内枠を追加した。 |
| Task | 左綴じ穴、赤罫、横罫を持つchecklist / indexへ変更。完了行には取り消し可能な「済」印を表示する。 |
| 未整理 | 分類ごとの浅いtrayと、罫線・折り角・種類別の色を持つloose memoへ変更。PCは2列、モバイルは1列で整理操作を保つ。 |
| Project | 左側のリング、親子connector、folder tabを持つbinderへ変更。階層・折りたたみ・進捗の関係を追いやすくした。 |
| Routine | 破線で区切るstamp sheetへ変更。実施済みは丸いink stampが着地し、`DONE`印を表示する。 |
| Money | 集計を連続した家計簿の数値欄へ変更し、支出・収入・収支をtabular numeralで整列。日別明細は罫線ledgerとして表示する。 |
| Command / Modal | パール面、内枠、リボン見出し、操作盤らしい上端を追加し、入力や閉じる操作の可読性を維持した。 |

## 新しく追加したasset

`public/themes/magical-diary/` に以下のコードネイティブSVGを追加した。文字・状態・操作対象は画像へ焼き込んでいない。

- `pearl-paper.svg` — 乳白色と淡いオーロラの紙面。
- `ribbon-divider.svg` — リボン、宝石、細い区切り線。
- `memo-corner.svg` — 未整理メモの折り角。
- `ledger-flourish.svg` — 家計簿集計の罫飾り。

画像生成は行っていない。今回必要だった素材は繰り返し利用する小型の装飾であり、既存UIへ色と寸法を保って組み込めるSVGが適していた。素材一覧と由来は `public/themes/magical-diary/ASSETS.md` に追記した。

## Interaction / Motionで変更した点

- Navigation選択tabの浮き上がり、hover、pressを物理的な短い動きへ統一した。
- 画面切替時に内容が7px下から整列する260msのpage motionを追加した。
- Primary / Secondary buttonへ浮く・沈むfeedbackを追加した。
- 未整理メモはhover時に傾きが整い、手に取る感覚を出した。
- Routine実施済みstampに短い着地motionを追加した。
- 既存のタスク完了、未整理解消、Routine実施時のリフちゃん反応は維持した。
- `prefers-reduced-motion: reduce`では新旧のanimation / transitionを停止する。
- Simple ThemeではNavigationとpage motionも停止する。

## Mobile固有の修正

- 下部Navigationをviewport幅へ4等分し、360pxでも各buttonを44px以上、実測高さ52pxにした。
- 固定Navigationの高さと余白を減らし、本文末尾へ到達できる下余白を確保した。
- 浮動記録buttonを52pxの円形へ縮小し、文字を省いてアイコンとaria-labelを維持した。
- 未整理のメモtrayを1列、Routineのstamp sheetを1列、Money集計を縦3行へ変更した。
- Projectの綴じ代・子階層indentを狭め、Taskの罫線と操作列を360px向けに調整した。
- 390pxと360pxで横方向overflowなし、主要操作領域44px以上、ダイアログ操作可能を実ブラウザで確認した。

## Simple Themeへの影響

Simple Themeでは今回のパール紙、リボン、メモ折り角、folder tab、家計簿飾り、装飾用疑似要素を表示しない。背景はplain surface、選択tabは平面、メモの傾きとstamp / page motionは停止する。既存の情報配置、リフちゃんの案内、操作機能は維持する。

## Empty State

テスト用メモリストアだけに、指定種別を空にする補助操作を追加した。Task、未整理、Project、Routine、Moneyの5画面で、説明文と小さな手帳visualを持つ既存の空状態が表示されることを実ブラウザで確認した。製品の保存処理・schemaには追加していない。

## 変更した主なファイル

- `app/diary-phase3.css` — Phase 3のTheme層、各画面の比喩、motion、Simple fallback、mobile調整。
- `app/diary.css` — Phase 3 CSSの読込。
- `app/liflow.tsx` — 現在tab識別子とpage transition用の描画境界。
- `app/diary-navigation.tsx` — tab識別子。
- `app/inbox-view.tsx` — 未整理項目の種類別visual識別子。
- `public/themes/magical-diary/*.svg` / `ASSETS.md` — 新規装飾素材と記録。
- `tests/ui/fixture-store.ts` — 空状態を確認するテスト専用操作。
- `scripts/diary-phase3-checks.mjs` / `scripts/diary-smoke.mjs` — Phase 3のasset、Theme、mobile、空状態と成果物出力。

## 確認結果

- `npm.cmd run typecheck`: 成功。
- `npm.cmd run lint`: エラー・警告なし。
- `npm.cmd test`: **38件成功**。
- `npm.cmd run test:ui`: **36項目成功**。Phase 1 / 2の操作回帰、Phase 3 asset、page motion、Simple fallback、390px / 360px、空状態5画面を含む。
- ブラウザの未処理例外: 0件。
- 追加asset 4件: 実ブラウザのfetchですべてHTTP成功。
- 360px / 390px: 横方向overflowなし。
- `prefers-reduced-motion`: animation / transition停止を確認。
- `npm.cmd run build`: 成功。5つのbuild環境を生成した。
- 生成済み`dist`を8790番で一時起動し、トップページ **HTTP 200**、HTML応答を確認。確認用サーバーは停止済み。

ビルドには依存ライブラリ由来の非推奨APIと500kB超chunkの案内が残る。ビルド自体は成功している。

## 画面・結果ファイル

`artifacts/diary/phase3/` に以下を保存した。

- Desktop: Now / Day / Week / Month / Task / 未整理 / Project / Routine / Money / Command / Modal / Simple。
- Mobile: Now / Day / Week / Month / Task / 未整理 / Project / Routine / Money / Money editor。
- `smoke-results.json` — 36項目の結果。
- `production-smoke.log` / `production-smoke-error.log` — 本番出力の起動記録。

## 保存・同期の境界

`domain/core.ts`、`domain/schema.ts`、`domain/commands.ts`、Firebase persistence、Firestore rules、Discord Bot、entity schemaは変更していない。実ブラウザ機能テストはFirebaseをメモリ内ストアへ置き換えた隔離環境で実施した。

実ユーザーのFirebaseログイン、複数端末同期、Discord送信はPhase 3では実施していない。別のData / Integration Verification Phaseで確認する。

## 残っている視覚上の課題

- 360pxの未整理は項目数が多い場合に縦へ長くなる。操作は1列で読めるが、将来は分類ごとの折りたたみを検討できる。
- 固定下部Navigationは実機ではviewport下端に留まるため、full-page screenshotでは長いページの途中に重なって記録される。本文末尾にはNavigation高を含む余白があり、実操作で最後の項目までスクロールできる。
- リフちゃんの反応は既存atlasの表情を使っている。今回の優先範囲では自然に合成できていたため、追加表情・新規bitmapは作成していない。
- 主要motionは静止画と自動検証で確認した。動画captureは追加していない。

## 起動・再確認

最新ビルドは`dist/`に生成済み。検証のために起動していたLiflowのWebサーバーは停止している。`START_LIFLOW.bat`で起動し直す。

開くURL: `http://127.0.0.1:8787`

Discord Botの既存プロセスには触れていない。
