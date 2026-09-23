# Liflow vNext Phase 1 完了報告

更新日: 2026-09-23
対象: `Liflow_vNext_Phase0指示2.md`（内容はPhase 1 / Now Engine / Daily Execution MVP）
基準ブランチ: `main`

## 1. Now Engineのファイル構成

- `domain/now-engine.ts`: 現在の状態から`NowDecision`を純粋関数で決定する。
- `domain/scheduling.ts`: Anchor、usable window、空き時間、Deadline Reservationを扱う。
- `domain/directions.ts`: Direction継承、Actual集計、Direction Needを扱う。
- `domain/execution.ts`: ExecutionSessionとRoutineRunのpayload生成・完了計算を扱う。
- `app/now-view.tsx`: 1つの主行動、開始・終了、Start Assist、Routine Runnerを表示する。
- `app/firebase-store.ts`: Session開始・完了、Actual作成、残時間更新、起床記録をtransactionで保存する。

判断ロジックは保存層やReactから分離し、AIを使わない決定的なDomain Functionとして実装した。`NowDecision`自体は保存せず、Entityから毎回再計算する。

## 2. NowMode一覧

- `morning`: 起床直後またはMorning Flow実行中。
- `fixed`: 現在時刻にFixed Planがある。
- `focus`: critical / tightな期限、または通常のTaskを進める。
- `recovery`: 疲労記録があり、criticalな作業がない。
- `windDown`: 就寝準備開始時刻以降。
- `free`: 今すぐ勧めるべき作業がない。

優先順は、実行中Session → morning → 現在のFixed → criticalを考慮したrecovery / windDown → deadline → Direction Need → 通常Task → freeとした。

## 3. Anchor判定

`getCurrentFixedPlan()`と`getNextAnchor()`を追加した。Anchor候補は、active、未削除、未解決、非all-day、有効な時間範囲、`fixed`、非containerのPlanに限定する。柔軟Plan、終了済み・skip済みPlan、all-day、containerはAnchorにしない。

## 4. usableWindow計算

`getUsableWindow()`は現在時刻から次の境界までを計算する。境界には次のAnchor、途中の別Plan、設定した一日の終了、Morning Flowの残り時間を使い、次の移動に必要なtransition bufferを差し引く。終了時刻を過ぎた場合は翌日へ誤って延長せず0分にする。

## 5. Deadline Reservationアルゴリズム

`reserveDeadlines()`は期限の近いTaskを対象に、既存のTask Planを予約済み時間として差し引き、残り必要時間へ安全係数を掛ける。今日からdeadlineまでの空き区間を共有プールにし、deadline側から逆向きに予約する。予約した区間は分割してプールから除くため、複数Taskが同じ空き時間を二重利用しない。

## 6. critical / tight / safe判定

- `critical`: 期限までの共有空き容量で安全係数込み必要時間を確保できない。
- `tight`: 確保できるが余裕が小さい。
- `safe`: 必要時間を確保しても余裕がある。
- `unknown`: Taskの残時間が未入力で、圧力を数値判定できない。

残時間は`estimatedRemainingMinutes`を最優先し、次に`estimateMinutes`、どちらもなければunknownとする。

## 7. Direction Need Policy

ActualをDirection別に7日・14日で集計し、同一Direction内の重複時間はmergeして二重計上しない。Direction解決順はActual明示 → Plan → Task → 未分類で、Projectには依存しない。初期Policyは固定のDomain定義とし、最低実行時間との不足からNeedを算出する。

## 8. NowDecision型

`NowDecision`は`mode`、表示用title / reason、`primaryAction`、usable minutes、次Anchor、departure、deadline pressureなどを持つ。`primaryAction`は`session`、`wake`、`plan`、`task`、`routine`、`rest`のいずれか1つだけ返す。UIはこの結果を表示し、別の独自推薦ロジックを持たない。

## 9. ExecutionSessionのSchemaとmigration

Core Entityへ`executionSession`を追加し、schemaをv5へ更新した。Sessionは対象種別・対象ID・title・Direction・開始時刻・終了時刻・状態・生成Actual IDを保持する。v4→v5 migrationでは既存Entityを失わず、SettingsのPhase 1項目を補完し、ExecutionSessionを登録する。

## 10. Task開始からActual保存までの流れ

1. TaskまたはPlanの主ボタンでExecutionSessionを作る。
2. Firestore transaction内のユーザー別runtime lockで、実行中Sessionを1件に制限する。
3. 再読込後もrunning Sessionを復元し、Nowの最優先に表示する。
4. 終了時transactionでSessionをcompletedにし、決定的IDのActualを1件作る。
5. 同じ終了処理を再送してもActualを重複作成しない。
6. 途中で残ったstale lockは、参照Sessionが存在しない・削除済み・完了済みなら新Sessionで置き換える。

## 11. estimatedRemainingMinutesの更新方法

Session終了時の実測分数を、既存の`estimatedRemainingMinutes`から0未満にならないよう減算する。値がnullなら推測して新規設定しない。Session終了だけではTaskを自動完了にせず、`Taskも完了`を選んだ場合だけstatusとcompletedAtを更新する。

## 12. Start Assistの実装

Task開始前に`わからない`、`重い`、`疲れた`、`退屈`を選べる。選択内容から開始しやすい短い最初の行動へ表示を変えるが、元Taskは維持する。推薦が合わない場合の`違う`も用意した。AI呼び出しや新しい永続Entityは追加していない。

## 13. Routine Flow Runnerの実装

Routine Flowを順番に実行するRunnerを追加した。step modeは`check`、`checklist`、`softTimer`、`pacedTimer`、`automatic`に対応し、完了・skip・自動進行をRoutineRunへ保存する。途中で再読込しても現在stepと結果を復元でき、完了済みstepの再操作は冪等に扱う。

## 14. Morning Flowの挙動

初回migrationで編集可能な`起床後`Flowを1件だけ初期化する。洗顔、朝食、着替え、メイク、歯磨き、持ち物確認を含む。起床ボタンはSleepRecordと当日のRoutineRunを同一transactionで作り、二重操作・複数端末でも同日の起床処理を重複させない。Flow終了後に余裕があれば通常のTask推薦へ戻る。

## 15. Departure判定

将来の`Travel` Planだけをdeparture候補とし、`departureSafetyBufferMinutes`を差し引いた準備期限を表示する。Travel Planがなければ出発時刻を推測しない。Morning Flowの残り時間が出発までの時間を圧迫する場合は急ぎ表示を出す。

## 16. Wind Down判定

`targetSleepTime - windDownMinutes`以降をwindDown候補にする。criticalな期限がある場合はcritical対応を優先し、それ以外は就寝準備を主行動にする。日付をまたぐ就寝時刻にも対応する。

## 17. Settings追加項目

- `guidanceIntensity`
- `transitionBufferMinutes`
- `departureSafetyBufferMinutes`
- `targetSleepTime`
- `windDownMinutes`

既存Settingsにはv5 migrationでdefaultを補完し、設定画面から変更・保存できる。

## 18. 実Firebase検証結果

**実Firebase検証未実施。** 安全に破棄できるテスト用アカウントまたは本番複製データが提供されていないため、実ユーザーデータでのv4→v5 migration、複数端末競合、再ログイン復元、backup / restoreは成功扱いにしていない。Domainテスト、UI fixture、Firestore transaction実装の静的確認までを実施した。

## 19. 追加テスト

- Now priority、全6 mode、1 primary action、Free。
- Anchor除外条件、usable window、transition、day end、departure。
- Deadlineのcritical / tight / safe / unknown、安全係数、Plan coverage、複数Taskの容量非重複、後ろ詰め予約。
- Direction継承、7日・14日集計、重複merge、Need。
- ExecutionSession開始、終了、Actual作成、残時間更新、Task非自動完了、冪等ID。
- Morning Flow、Routine step順序、skip、timer mode、再読込、完了冪等性。
- Start Assist、fatigue、critical優先、windDown、Morning urgency、Project非依存。
- schema v1→v5連続migration、default Morning Flow非重複、Settings補完。

単体・Domainテストは合計78件成功した。

## 20. UI回帰結果

ブラウザスモーク41項目が成功し、未捕捉ブラウザエラーは0件だった。Phase 1では提案→Session開始→再読込→終了→Actual→再計算、Fixed、Morning、Routine、Free、Wind Downを実操作した。既存のDay / Week / Month、Task、Project、Routine、Money、Unresolved、Command、Simple theme、reduced motion、360px / 390px表示も通過した。

追加の最終確認:

- `npm.cmd run typecheck`: 成功
- `npm.cmd run lint`: 成功
- `npm.cmd test`: 78件成功
- `npm.cmd run test:ui`: 41項目成功
- `npm.cmd run build`: 成功
- production smoke (`http://127.0.0.1:8790/`): HTTP 200、HTMLおよびLiflow文字列を確認

## 21. 既知の問題

- 実Firebase環境のmigration、transaction競合、再ログイン、backup / restoreは未検証。
- Direction PolicyはDomainの初期固定値で、設定画面からの編集には未対応。
- Deadline ReservationはLiflow内のPlanと設定上の日内windowを使う。外部カレンダー、交通時刻、タイムゾーン移動は扱わない。
- runtime lockはEntity backupの外にある。stale lockは開始時に自己回復するが、実Firebaseでの多端末検証は残る。
- buildには`module.register()`非推奨警告と500kB超chunk警告が残る。
- UIスモークによりPhase 3の画像と結果JSONを現在の画面へ更新している。

## 22. 次Phaseに残したもの

- 安全なFirebase検証環境でv4→v5 migration、Safety Backup、Restore、同時開始・同時終了を確認する。
- Direction Policyの編集UIと、Needの説明・可視化を改善する。
- Deadline Reservationを週表示などへ可視化し、ユーザーが予約根拠を確認・調整できるようにする。
- Recurring Activity RuleからPlanを冪等生成する処理を実装する。
- push通知、外部交通情報、Money再設計は別Phaseとして扱う。

Phase 1の目的である「今この瞬間の状態に対して、Liflowが1つの実行可能な行動を提示し、開始から実績保存までつなぐ」は、ローカル実装と自動検証の範囲で完了した。
