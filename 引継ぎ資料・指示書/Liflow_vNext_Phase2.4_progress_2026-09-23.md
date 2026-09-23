# Liflow vNext Phase 2.4 完了報告

対象は `vNextphase2.4.md`、`Phase2.4追加指示.md`、`phase2.4追加指示2.md`、`phase2.4追加指示3.md`。競合時は後から追加された指示を優先した。

## 1. Projectを退役させたUI一覧

トップナビ、メニュー、通常画面遷移、ProjectsView export、Capture Modal、Task/Plan/Actual入力、Calendar Filter、Tasks Filter/表示、Money入力/表示からProjectを外した。Command PaletteとDiscord共通Command Engineの新規payloadも`projectId: null`であり、Project作成コマンドはない。旧Project用スクリーンショット2枚も成果物から削除した。

## 2. Project互換dataの扱い

Entity type、Project本体、`projectId`、`parentProjectId`は削除していない。既存Task/Plan/Actual/Transactionを編集するときは保存済みProject関連をそのまま保持し、新規データだけ`null`にする。自動変換、自動tombstone、ProjectからDirectionへの推測移行は行わない。設定のLegacy Data Viewerでは件数だけを読み取り表示する。

## 3. Category inheritance変更

通常の継承順を「明示値 → Plan → Task」に限定した。Project fallbackは通常helperから分離し、互換処理で明示的に呼ぶ`legacyInheritedCategory()`にだけ残した。Calendar CategoryとDirectionは別概念のまま維持している。

## 4. Legacy Routineの扱い

旧`routine` Entityと既存データは保持するが、Now、Today、Day/Week Calendar、Routine画面から外した。旧Routineの作成、編集、実施、再開、自動変換は通常UIからできない。設定で旧Routine件数を読み取り確認できる。

## 5. Routine画面再構成

画面名は「繰り返し・生活手順」。時刻ベースのRecurring Activity Ruleと、順序を持つRoutine Flowだけを配置した。Routine Flow triggerとexecution modeは日本語表示・日本語入力に対応し、作成、編集、削除、開始、Nowでのstep実行を維持した。

## 6. RoutineOccurrenceの扱い

`routineOccurrence`はschema/registry/旧snapshot互換のため残したが、新規生成経路と通常表示を削除した。既存記録は削除・変換せず、Legacy Data Viewerで件数だけ確認できる。

## 7. Parent Taskの扱い

Task入力からParent Task欄を外した。既存`parentTaskId`は編集時に保持し、Task一覧では従来の親子表示と折りたたみを互換表示として残した。新規Taskは`parentTaskId: null`で作る。

## 8. Task画面変更

Project filter/labelを削除した。入力の中心を名前と締切に絞り、Next Action、残り見積、Calendar Category、Directionを「詳細を設定」にまとめた。TaskとPlanは別Entityのままで、Task完了はPlanを削除・完了扱いにしない。

## 9. Now strong / balanced / light差分

- strong: 主行動を最優先し、Task一覧とQuick Captureを表示しない。
- balanced: 主行動に加えてTask最大3件と未整理最大2件を表示する。
- light: Task最大5件、未整理最大4件、Quick Captureを表示する。

全modeでToday Flow、Direction、未整理、Free Modeを維持する。Start Assistは「取りかかりにくい」と「今はできない」を分離し、後者を`occupied / contextUnavailable / blocked / insufficientWindow`に分けた。一時的な実行不可はurgencyを変更せずdiagnostic observationとして保存し、「違う」は別操作にした。既存Plan/Taskを選ぶ`occupied`は実時刻のSessionを開始する。Running Sessionとcurrent fixed Planの優先順位は崩していない。

## 10. Legacy dependency audit結果

通常UIからProjectsView import/exportとProject導線を除去した。canonical category、Now、scheduling、recurring/future block、executionの新規payloadはProjectに依存しない。Project関連が残る箇所はcore/schema/migration、休眠中の旧ProjectsViewソース、既存関連の編集保持、Legacy Data Viewer、互換テストに限定した。旧Routine/RoutineOccurrenceもregistry/schema/fixture/Legacy Viewer以外の実行経路から外した。

## 11. `checkin`利用状況

通常UI・Command・Now・Calendar・実行処理に利用箇所はない。旧snapshot互換用のEntity type/defaultとLegacy Data Viewerの件数表示だけを残し、legacy/reservedであることをschema内に明記した。

## 12. Schema version変更有無

変更なし。`CURRENT_SCHEMA_VERSION`は6のまま。`ExecutionSession.outcome`と`ConditionRecord.startAssist`は任意フィールドとして追加し、旧Sessionにはmigration defaultとして`outcome: null`を補う。

## 13. Migration変更有無

version 7 migrationは追加していない。既存v1→v6 migration、backup、未知schema停止、件数減少検出を維持した。Project、旧Routine、RoutineOccurrence、Parent Task、`Plan.actualId`は推測変換しない。

## 14. 追加・更新test

Node testは100件すべて成功。主な追加検証はEarly Start候補と固定予定/Running Session/介在予定の安全性、Activity完了とPauseのderived state、Actual単独では完了しないこと、Pause/Resumeで複数Actualを残すこと、Start Assistでurgencyを消さないこと、1/2/5/10/30/60分の表示判定、近接compact rowの正確なanchorである。ProjectなしNow、schema互換、既存Phase 0〜2回帰も通過した。

## 15. UI smoke結果

Playwright相当の実ブラウザsmokeは54項目、browser error 0。Project導線消失、legacy ID保持、Routine Flow、Legacy Viewer、Early Start、Pause outcome、Start Assist、Day/Week compact表示、44px hit target、390px/360px、Simple Theme、reduced motionを確認した。スクリーンショットは23成果物。`npm run build`成功後、production serverへHTTP GETし`200 text/html`とLiflow本文を確認した。通常の`http://127.0.0.1:8787`も再起動してHTTP 200を確認済み。

## 16. 既存データ互換確認

Project/旧Routineはfixture上でも削除されず、Taskの`projectId`/`parentTaskId`、Transactionの`projectId / taskId / planId / actualId / occurredAt / expectedAt / note`が編集後も同一であることをUI smokeで確認した。schema全Entity種のsnapshot migration、revision、tombstone、legacy linkの既存テストも成功した。

## 17. 既知の問題

Liflow未登録の行動をStart Assistからその場で新規Activity化する機能は今回追加していない。実Firebaseアカウントを使った複数端末同期、実FCM配信、Firestore本番rulesへの書き込みはfixture smokeの範囲外。buildにはFirebase clientを含む500kB超chunkの警告があるが、buildと実行は成功している。

## 18. Phase 2.5へ残したもの

未登録行動を安全に記録してSessionへ接続するad-hoc flow、temporary unavailable observationの期限/解除UI、Legacy Data Viewerの詳細な読み取り画面、旧Project/Routineを将来削除する場合の明示的export/archive手順、client bundleのcode splittingを候補として残す。Activity Entityの新設や破壊的schema削除は前提にしない。
