# Liflow vNext Phase 2.45 完了報告

日付: 2026-09-24

## 結論

`liflowvnext2.45指示.md`の本体再構成を実装し、Phase 2.45のローカル開発範囲を完了した。

- Primary Navigationを「今 / カレンダー / タスク / お金」へ再構成
- NowをNOW / NEXT / TODAY / OTHERのCockpitへ変更
- Calendarの日・週表示をPlan / Actual統合Activityへ変更
- Task Action、Money Category / Method / Transfer / Budgetをschema v7へ追加
- Routine Flowを通常UIから退役し、既存データは互換保持
- GUI / Command / Discordの作成・更新をApplication Action境界へ接続
- Discord Interaction endpointとローカルBotのtrusted channel / mutation allowlistを実装
- Desktop / mobileのPhase 2.45 UIスモークを更新

## 主な変更

### Now / Start Assist

- 現在行動を1件だけPrimaryにし、NEXT、TODAY、OTHERを明確に分離
- Strong / Balanced / Lightの表示差を実装
- LightのQuick CaptureはTask / Plan / Actual / Money / Memoの5種類
- TaskとPlanの一時実行不可を`conditionRecord.startAssist`へ永続化
- 有効期限切れと手動復帰を実装
- 「疲れた」は15分だけの`recoveryRequest`にし、「休憩する / もう大丈夫」を表示
- 起床記録からRoutine Flowを自動開始しない

### Calendar / Task

- `Actual.planId`だけを正規リンクとしてActivityを構成
- 同じTaskでもPlanが違えば別Activity、PlanなしActualは独立Activity
- 日・週ともPlanの時間枠内へActual帯を重ねて表示
- Running Sessionは現在時刻まで伸びるActual帯として表示
- 1〜30分の短時間Activityも44px以上の操作領域を維持
- PlanとRecurring PlanのCalendar Categoryを必須化し、raw Plan Typeを通常UIから削除
- Taskトップを「いま整える / 整理が必要 / あとで / 予定済み / 完了済み」に再構成
- Current Task Actionの追加・完了・次Actionへの移行を実装
- 最後のAction完了時もTaskを暗黙完了しない
- Planリスケは任意日時を指定でき、元Planと新Planの履歴リンクを保持

### Money

- Money CategoryとMoney Methodを選択式Entityへ変更
- Categoryの追加、改名、並べ替え、非表示、統合・付け替えを実装
- Methodの追加、改名、並べ替え、非表示、安全な削除を実装
- 振替は収支合計に含めず、手数料だけをリンクしたExpenseとして保存
- Category別の週/月Budget、expected支出込みの日割りBudget pace、超過表示を実装
- 週 / 月 / 3か月 / 指定期間のCategory別振り返りを実装

### Command / Discord

- 金銭コマンドへ`--category`と`--note`を追加
- 全角空白を正規化し、明細とカテゴリを分離
- 次の指定例をブラウザスモークで実保存して確認済み

```text
/m 2026-09-20 220 越中宮崎→泊 --category 交通費
/m 2026-09-18 159 Suica物販 --category その他　
```

- 1件目は`交通費`、2件目は`その他`の既存Money Category IDへ関連付いた
- Web Command Palette、複数行Batch、Discord Botは共通Command Engineを使用
- `/api/discord/interactions`でEd25519署名、trusted channel、変更User allowlist、予定・Task・Money照会を実装
- 通常Channelへ残る応答と長文分割をローカルBotで実装

## Migration

schema versionをv7へ更新した。

- Calendar CategoryのないPlan / Recurring Planへfallback categoryを設定
- Settingsへ`defaultCalendarCategoryId`を追加
- 旧`Task.nextAction`から決定的IDのTask Actionを一度だけ生成
- 旧Transactionの文字列CategoryからMoney Categoryを生成し`categoryId`を設定
- 初期Money Category / Methodを重複なく追加
- Task Action / Money Category / Method / Transfer / BudgetをEntity registryと同期対象へ追加
- Routine Flow、Project、旧Routineなど既存Entityは削除しない
- revision、tombstone、IDを保持し、migration前backupとデータ減少検査を継続
- 再実行してもEntityやTask Actionを重複生成しないことをテスト済み

## 検証結果

すべて2026-09-24に成功した。

- `npm.cmd run typecheck`: 成功
- `npm.cmd test`: 108 / 108成功
- `npm.cmd run lint`: 成功、警告なし
- `npm.cmd run test:ui`: 12項目成功、page error 0
- `npm.cmd run build`: 成功
- `/api/discord/interactions`を含むroute生成を確認
- ローカルproduction server: `http://127.0.0.1:8787`でHTTP 200とLiflow HTMLを確認

UIスモークはNow Strong / Balanced / Light、Calendar Day / Week / Month、Task top / detail / Action、Money top / Budget / Category / Transfer、Direction、Recurring、Inbox、Quick Captureを対象にし、390px mobileでも横方向overflowがないことを確認した。

スクリーンショットは`artifacts/diary/phase245/`に保存した。

## 残課題・対象外

- Cloudflare配備、Discord Developer PortalへのInteraction endpoint登録、PWA実機通知はPhase 2.5で行う
- 実Discord / 実Firebase credentialを使ったE2Eは未実施。署名・権限・parser・長文分割は自動テスト済み
- 本格的なAccount残高、カード請求サイクル、Safe-to-Spend、長期Forecastは今回対象外
- buildは成功しているが、client chunkが500kBを超えるという非停止warningがある。機能上の失敗ではない

## 起動状態

最終ビルド後に`npm.cmd run local`で再起動し、ブラウザから利用できる状態にする。
