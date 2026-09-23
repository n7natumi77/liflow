# Liflow vNext Phase 0 完了報告

更新日: 2026-09-23
対象: `Liflow_vNext_Phase0指示.md`
基準ブランチ: `main`

## 1. 変更したEntity type

- `task`
  - 任意の`directionId`、`nextAction`、`estimatedRemainingMinutes`を追加した。
  - `projectId`、`parentTaskId`、`estimateMinutes`は既存データ互換のため保持した。
- `plan`
  - 任意の`directionId`、`rescheduledFromPlanId`、`rescheduledToPlanId`を追加した。
  - `resolution`へ`skipped`を追加した。
  - `actualId`はlegacy互換フィールドとして保持した。
- `actual`
  - 任意の`directionId`を追加した。
  - `planId`をPlanとの正規参照として明示した。
- `conflict`
  - schema形状は維持し、未解決Conflictを`unresolved()`の候補へ含めた。

## 2. 新しく追加したEntity type

- `direction`
- `recurringActivityRule`
- `routineFlow`
- `routineRun`
- `sleepRecord`
- `conditionRecord`

すべて既存のCore Entity registryへ追加している。独立した保存基盤は作っていないため、Firestore Entity単位保存、revision、tombstone、backup / restore、conflict処理の対象になる。

## 3. schema v3→v4 migration内容

- `CURRENT_SCHEMA_VERSION`を4へ更新した。
- `v1 → v2 → v3`を残し、その後に`v3 → v4`を追加した。
- Task / Plan / Actualへ新しい任意fieldの安全なdefaultを追加した。
- Projectと旧Routineは内容を保持し、自動変換していない。
- migration後も種類別件数と全IDを検査し、減少時は停止する。
- revision、createdAt、updatedAt、updatedBy、deletedAtはmigrationで保持する。
- v3 Planの`actualId`だけが一意な関連を示し、対象Actualの`planId`が空の場合だけ、v4正規参照を補完する。複数Planが同じActualを指す曖昧な場合や、Actual側に既存`planId`がある場合は推測しない。
- Firebaseではmigration計画を作った後、書き込み前に既存Safety Backupを作成する。
- migration中のrevision不一致、新しい未知schema、固定ID衝突は上書きせず停止する。

## 4. 1 Plan : 複数Actualをどう実装したか

`Actual.payload.planId === Plan.id`を正規関連にした。Planに紐づくActualは`actualsForPlan()`またはActual一覧の`planId`検索で取得する。

`recordPlanAsActual()`と`recordActualForPlan()`はActual Entityだけを新規作成し、Planの`actualId`やrevisionを変更しない。同じPlan revisionを基準に複数Actualを追加できる。Calendarは既存どおり全Actual Entityを個別表示する。

Actual削除時はActualをtombstone化する。旧`Plan.actualId`が削除対象を指す場合だけ互換処理としてPlan側をunlinkする。

## 5. 旧actualIdをどう扱ったか

- field自体は削除していない。
- v3→v4 migrationで値を保持する。
- 新規Actual記録では設定・更新しない。
- Coreの実行済み判定とunresolved判定では参照しない。
- legacy Plan側pointerしかない安全で一意な関係は、migration時にActual側`planId`へ補完する。
- 旧pointerの削除互換処理だけFirebase StoreとUI fixtureに残している。

## 6. Project依存をどこまで外したか

- Direction継承は`explicit → Plan → Task`であり、Projectを参照しない。
- CommandによるTask / Plan / Actual作成はProjectなしで成立する。
- 新しいDirection、Recurring Activity Rule、Routine Flow / Run、Record系にProject必須fieldを設けていない。
- 既存画面、category継承、Task階層、Project Entityと既存`projectId`は互換維持のため残した。

## 7. Routineを今回どこまで変更したか

- 既存`routine`と`routineOccurrence`は変更・推測変換していない。
- 繰り返しPlan用の`recurringActivityRule`を別Entityとして追加した。
- 生活手順用の`routineFlow`と実行記録用の`routineRun`を追加した。
- Routine Flowの完成UI、Recurring RuleからのPlan自動生成、旧Routine分類migrationは実装していない。

## 8. Direction初期化方式

以下の固定IDを使用する。

- `direction_academic` — 学業
- `direction_specialty` — 専門
- `direction_career` — 進路
- `direction_life` — 生活
- `direction_world` — 世界

migration計画時に固定IDまたは同名Directionが既にあれば追加しない。Firebase保存時も固定ID documentをtransactionで確認するため、別端末・再ログイン・migration再実行で二重生成しない。固定IDが別Entityに使われている場合はデータを上書きせずmigrationを停止する。

## 9. 追加したテスト

- v1→v2→v3→v4の連続migration
- v3 Task / Plan / Actualのv4 field追加
- Project / Routine保持
- TaskなしPlan / PlanなしActual
- 1 Planに複数Actual
- legacy`actualId`をCoreの正規判定に使わないこと
- 一意なlegacy linkの`Actual.planId`補完と、曖昧linkを推測しないこと
- 全Plan resolutionのresolved判定
- Direction 5件初期化、同名互換、再実行時の非重複、固定ID衝突停止
- entity数・IDの非減少
- revision / tombstone維持
- migration backup要否
- migration revision conflict停止
- newer schema拒否
- 新Entity群のsnapshot保持
- Project非依存のDirection継承
- 未解決Conflictのunresolved化
- Command Engineのv4 payload
- 既存UI回帰36項目

## 10. 既存機能で互換Adapterを使っている箇所

- `Plan.actualId`の型定義とmigration保持。
- v3 Plan側pointerからActual側`planId`への一意link補完。
- Actual削除時の旧Plan pointer unlink。
- Project画面、Task階層、Project由来Calendar Category継承。
- 既存Routine / RoutineOccurrence画面と保存方式。
- `recordPlanAsActual()` / `recordActualForPlan()`の返却値`linkedPlan`。呼び出し側を壊さないため返すが、新方式ではPlanを更新しない。

## 11. 今後削除可能なlegacy field / code

- 全実データでActual側`planId`が保証された後の`Plan.actualId`。
- `deleteActualAndUnlinkPlan()`内のPlan側pointer解除分岐。
- Project廃止方針が確定した後のTask / Plan / Actual `projectId`とProject必須UI。
- Task階層廃止方針が確定した後の`parentTaskId`と循環検出UI。
- 旧Routine分類migration完了後の旧Routine専用UI。

削除時には別schema migrationとSafety Backupが必要であり、Phase 0では削除していない。

## 12. 既知の問題

- 実ユーザーFirebaseデータを使ったv3→v4 migration、backup / restore、複数端末同時migrationは未実施。Domainテストと既存Store transactionのコード経路で検証した。
- Direction、Recurring Activity Rule、Routine Flow / Run、Sleep / Condition Recordの完成UIはない。
- 既存Project / Routine画面は引き続き表示される。
- Recurring Activity RuleからPlanを生成する処理はまだない。
- `estimatedRemainingMinutes`は既存`estimateMinutes`から推測せずnullで移行する。
- buildには依存ライブラリの非推奨API警告と500kB超chunk警告が残る。
- UI回帰テストによりPhase 3 screenshotとsmoke resultが再生成されているが、Phase 0で意図的な全面UI変更はしていない。

## 13. Phase 1で最初に実装すべき項目

1. 実Firebaseの複製データまたは検証用アカウントでv3→v4 migration、Safety Backup、Restore、競合中断を確認する。
2. Task / Plan / ActualへDirectionを割り当て・変更できる最小UIを追加する。
3. `getNextAnchor`、`getUsableWindow`、`getOpenTasks`、`getTaskRemainingEstimate`をDomain Functionとして実装し、Now Engineの判断入力を作る。
4. Actual集計からDirection別の実行時間を算出する`getDirectionActualSummary`を追加する。
5. Recurring Activity RuleのPlan生成境界と冪等キーを設計し、Routine Flowとは別経路で実装する。

## 検証結果

- `npm.cmd run typecheck`: 成功
- `npm.cmd test`: 58件成功
- `npm.cmd run lint`: 成功
- `npm.cmd run test:ui`: 36項目成功、未処理ブラウザ例外0
- `npm.cmd run build`: 成功
- production smoke (`http://127.0.0.1:8790/`): HTTP 200、HTMLおよびLiflow文字列を確認

旧`dist`はWindows ACLにより削除できなかったため、一時退避後に新しい`dist`を生成した。退避物はLint対象外となるWindows一時フォルダ`%TEMP%/liflow-phase0-dist-before-build-20260923/`へ移動済み。
