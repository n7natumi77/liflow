# Liflow vNext Phase 2.4 実装指示書

## Semantic Cleanup / Legacy Concept Retirement

# 0. 目的

対象Repository：

`https://github.com/n7natumi77/liflow`

`main` 最新状態を使用する。

Phase 0〜2で、LiflowのCoreはかなりvNext設計へ移行している。

現在の中心概念は、

```text
Direction
Task
Plan
Actual
Next Action
Now Engine
ExecutionSession
Recurring Activity Rule
Routine Flow / Run
Sleep / Condition Record
Transaction
```

である。

一方、UIや一部Entityには旧Liflow由来の、

```text
Project
Project hierarchy
Task hierarchy
旧Routine
RoutineOccurrence
Project-based filtering
Project-based category inheritance
```

がまだ現役機能として残っている。

Phase 2.4ではこれらを整理し、

> **vNext Coreと、ユーザーが実際に触るUIの意味を一致させる**

ことを目的とする。

新機能を大量に追加するPhaseではない。

---

# 1. 今回の基本原則

最重要：

> **Legacy dataを消すことと、Legacy conceptを今後も使わせることは別。**

今回は旧データを物理削除しない。

原則：

```text
既存データ
→ 保持する

Migration互換field
→ 保持する

新規UI
→ Legacy conceptを使わせない

vNext Core Logic
→ Legacy conceptへ依存しない
```

。

---

# 2. Schemaの破壊的削除は禁止

Phase 2.4では原則として、

```text
project
projectId
parentProjectId
parentTaskId
routine
routineOccurrence
Plan.actualId
checkin
```

等をSchemaから即削除しない。

削除migrationを行わない。

理由：

* 既存データ互換
* Backup / Restore
* 古いsnapshot
* 複数schema migration
* rollback

を維持するため。

必要ならSchema versionは変更しなくてよい。

---

# 3. ProjectをvNext UIから退役させる

現在 `ProjectData` 自体はCore内でLegacy扱いだが、UIではまだ主要概念として利用されている。

これを整理する。

---

# 4. Projectをトップナビから削除

現在の、

```text
プロジェクト
```

を通常Navigationから削除する。

Primary / Secondary menuのどちらからも除く。

ユーザーがvNextで新しいProjectを作る導線をなくす。

---

# 5. ProjectsViewを通常UIから外す

`ProjectsView` を通常画面遷移から外す。

コード自体はLegacy Viewerとして残してもよい。

ただし通常ユーザーが、

```text
Project追加
子Project追加
Project進捗
```

を使う状態にしない。

---

# 6. Project新規作成を停止

vNext通常UIから、

```text
create("project", ...)
```

を呼ぶ導線をなくす。

Command PaletteやDiscordにもProject作成commandが今後追加されないようにする。

---

# 7. Capture ModalからProjectを削除

Task / Plan / Actual作成・編集画面から、

```text
プロジェクト
```

選択欄を削除する。

新規Entityについては原則、

```text
projectId = null
```

。

既存Entityの `projectId` は編集保存時に勝手に消さなくてもよい。

---

# 8. 既存Project linkを壊さない

既存Task等に、

```text
projectId
```

が存在する場合、それ自体は保持する。

通常編集でProject UIを表示しなくても、

payload spread等で既存値を意図せず消去しないこと。

---

# 9. CalendarからProject Filterを削除

現在の、

```text
プロジェクトで絞る
```

を削除。

Calendarの基本Filterは、

```text
Calendar Category
Plan / Actual
Deadline
```

とする。

将来的なDirection Filter追加余地は残す。

---

# 10. TasksViewからProject Filterを削除

現在の、

```text
すべてのプロジェクト
```

Filterを削除。

Task一覧はProjectに依存せず、

```text
未完了
予定なし
完了
すべて
検索
```

を中心とする。

---

# 11. Task一覧からProject表示を削除

Task entryに表示されるProject名を通常UIから削除。

既存Projectが関連していても、vNextの意味分類として強調しない。

---

# 12. MoneyからProject入力を削除

Transaction編集画面の、

```text
プロジェクト
```

選択を削除。

Transactionの行動リンクとして重要なのは、

```text
Actual
Plan
Task
```

側。

Projectは今後Moneyの主要linkにしない。

既存 `projectId` は互換データとして保持可能。

---

# 13. Project由来Category継承を弱める

現在、

```text
Project.calendarCategoryId
```

からTask / Plan / ActualのCategoryを継承する処理がある。

新規vNext入力ではこれを利用しない。

Category resolutionの新規ルールは、

```text
explicit
↓
linked Plan
↓
linked Task
↓
null
```

程度へ寄せる。

ただしLegacy Entity表示時の互換fallbackとしてProject Categoryを読むこと自体は許容する。

---

# 14. `inheritedCategory()`をLegacy-awareに整理

必要なら、

```ts
inheritedCategory(...)
```

を、

* vNext canonical path
* legacy fallback

がコード上で分かる形へ整理する。

Project fallbackが新規設計の必須依存に見えないようにする。

---

# 15. Project Progress UIを廃止

現在の、

```text
タスク 3 / 5 完了
progress bar
```

のようなProject完成度UIは通常利用から外す。

Liflowは「Project完了率」を人生方向の評価値として使わない。

---

# 16. DirectionをProjectの代替階層にしない

Projectを削ったからといって、

```text
Direction
  └ Task
      └ 子Task
```

のような新階層構造を作らない。

Directionは、

> **実際の行動がどの方向へ向かっているか**

を見るための軸。

Folderではない。

---

# 17. 旧Routineを通常UIから退役

現在以下の二重構造がある。

```text
Legacy Routine
+ RoutineOccurrence

Recurring Activity Rule

Routine Flow / Run
```

vNextでは後者2つを正式な概念とする。

---

# 18. vNext Routineの正式な意味

## Recurring Activity Rule

時刻・曜日に基づいて繰り返すActivity。

例：

```text
授業
バイト
定期通院
毎週のミーティング
```

結果としてPlanを生成する。

---

## Routine Flow

生活状態・triggerに応じた手順。

例：

```text
起床後
↓
顔を洗う
↓
朝食
↓
着替え
↓
メイク
↓
歯磨き
```

。

Planを大量生成するものではない。

---

# 19. Legacy Routineの新規作成を停止

通常UIから、

```text
ルーティンを追加
```

で旧 `routine` Entityを作る機能を削除。

Legacy RoutineのCRUDをvNextメインUIに残さない。

---

# 20. Routine画面を再編

現在のRoutine画面を、

```text
繰り返し予定

生活手順
```

の2セクション中心へ再構成。

---

# 21. 「今日のルーティン」旧UIを削除

旧Routine / RoutineOccurrenceを使う、

```text
今日 ○ / ○ 実施済み
実施
スキップ
記録を戻す
```

UIを通常画面から除く。

この仕組みをvNextの日次習慣トラッカーとして継続しない。

---

# 22. RoutineOccurrenceを新規生成しない

vNext通常操作では、

```text
routineOccurrence
```

を新規作成しない。

既存dataは保持。

---

# 23. Legacy Routine自動変換は禁止

既存Routineを、

```text
Routine
↓
Recurring Activity Rule
```

または、

```text
Routine
↓
Routine Flow
```

へタイトルや時刻だけ見て自動変換しない。

意味が異なるため推測Migrationは禁止。

---

# 24. Legacy Routine Dataのアクセス

既存Legacy Routineがある場合、

必要ならSettings内の、

```text
旧データ
```

または、

```text
Legacy data
```

セクションで確認可能にしてよい。

通常Navigationへは戻さない。

---

# 25. Routineページ名称

トップメニュー名は、

```text
ルーティン
```

のままでも構わない。

ただし内部では明確に、

```text
繰り返し予定
生活手順
```

を分ける。

より意味が明確になるなら、

```text
繰り返し・生活手順
```

等への変更も可。

UI全体とのバランスを優先する。

---

# 26. Now画面からLegacy Routineを削除

現在Now画面下部の、

```text
今日のルーティン
```

がLegacy Routine / RoutineOccurrenceを利用している場合、削除する。

Now Engine上のRoutine Flowとは別物なので混在させない。

---

# 27. Now画面ではRoutine Flowのみ行動指示する

NowのPrimary Actionで、

```text
Routine Flow current step
```

が選ばれた場合のみ、現在の生活手順を表示。

旧Routine trackerを並列表示しない。

---

# 28. Task hierarchyを弱める

現在Task作成画面には、

```text
親タスク
```

が通常fieldとして存在する。

vNextではTask decompositionの中心は、

```text
Task
↓
Next Action
```

へ寄せる。

---

# 29. Parent Taskを通常入力から外す

Task新規作成時の、

```text
親タスク
```

fieldを標準フォームから削除。

既存 `parentTaskId` は保持。

---

# 30. 既存Task hierarchyは表示互換を残してよい

既存Taskに親子関係がある場合、

Task一覧で階層表示を維持してもよい。

ただし、

* 新規親子設定
* 子Task追加を促す
* hierarchyを主要整理手段にする

ことはしない。

---

# 31. Parent Task編集はLegacy Advanced扱い

どうしても既存hierarchy修正が必要なら、

Settings / Legacy / Advanced等へ退避可能。

通常Task Modalには出さない。

---

# 32. Next ActionをvNext分解単位として優先

Task UIでは必要に応じて、

```text
次の一手
```

を親Taskより重要なfieldとして扱う。

ただしTask作成時に必須入力にはしない。

---

# 33. Taskの入力負荷を減らす

新規Task作成時、最初に必要なのは基本、

```text
タイトル
締切（任意）
```

。

以下は詳細設定へ寄せてよい。

```text
Direction
残り見積
Next Action
Calendar Category
```

。

入力時点でユーザーへ分類作業を過剰要求しない。

---

# 34. Task ≠ Scheduleを維持

Taskへ時刻そのものを持たせない。

予定化はPlanを作る。

現在の、

```text
予定に入れる
```

導線は維持。

---

# 35. Plan ≠ Taskを維持

TaskなしPlanを許す。

例：

```text
授業
美容院
移動
休憩
睡眠
人と会う
```

。

すべてをTask化しない。

---

# 36. Actual ≠ Plan Completionを維持

ActualはPlanを上書きしない。

1 Plan → multiple Actualを維持。

Semantic Cleanup中に旧 `Plan.actualId` の単一関係へ戻さない。

---

# 37. Now画面の思想をさらに統一する

現在Now Engine自体はvNextに沿っている。

ただしNow画面下部に、

* Task一覧
* Timeline
* Direction
* 未整理
* Routine
* Quick Capture

が並び、Dashboard的要素が強い。

これをguidanceIntensityと整合させる。

---

# 38. strong mode

`guidanceIntensity === "strong"` の場合、

画面上部で、

> **次に何をするか1件**

を圧倒的に主役にする。

Primary Actionの直下に大量の選択肢を並べない。

---

# 39. strong modeの補助情報

Primary Actionの下は、

最低限、

```text
今日の流れ
Direction概要
あとで整える件数
```

程度。

Task候補一覧や旧Routine一覧は標準表示しない。

---

# 40. balanced mode

現在のNow画面に近い情報量でよい。

Primary Actionを主役にしつつ、補助Task等も確認可能。

---

# 41. light mode

Dashboard的な情報を多めに表示してよい。

guidanceIntensityが単なる設定値ではなく、UI情報量にも反映されるようにする。

---

# 42. Free Modeを守る

Semantic Cleanup後も、

```text
急ぎなし
Direction Needなし
Fixedなし
Routine Flowなし
```

なら、

```text
自由時間
```

を返す。

「Projectを消したから空いた場所へ別の生産性機能を入れる」ことは禁止。

---

# 43. Direction UIは維持

現在の、

```text
直近7日Actual
直近14日Actual
最後の実行
Need理由
```

はvNext思想に合っているので維持。

---

# 44. Directionに完了率を追加しない

以下は禁止。

```text
学業 80%
専門 42%
進路 10%
```

。

DirectionはGoal trackerではない。

---

# 45. DirectionからTask階層を作らない

Direction Cardをクリックして、

```text
Direction配下のProject一覧
```

等へ変換しない。

必要ならそのDirectionのActualやOpen Taskをfilterして見る程度にする。

---

# 46. Calendar Categoryの役割を明確にする

Calendar Categoryは、

> **視覚・表示分類**

として維持。

Directionとは別物。

例：

```text
大学
バイト
個人
移動
```

等。

---

# 47. Calendar CategoryとDirectionを混同しない

例えば、

```text
大学 = 学業Direction
```

と自動固定しない。

同じ大学Calendar内でも、

```text
学業
専門
進路
```

があり得る。

---

# 48. Calendar Filter整理

Project Filterを削除した後、

当面：

```text
Calendar Category
Plan / Actual
Task Deadline
```

だけでよい。

Direction Filterは必要性が明確なら追加可。

Phase 2.4で無理に追加しなくてよい。

---

# 49. Moneyは全面再設計しない

Moneyは後PhaseでvNext化する。

今回は、

```text
Project欄削除
```

を中心にする。

---

# 50. Moneyの行動リンクは維持

Transactionの、

```text
planId
actualId
taskId
```

は保持。

特にActual linkはLiflowの将来設計上重要。

---

# 51. `checkin`を監査

`checkin` EntityがRegistryに存在する。

Repository全体で実利用箇所を調査。

---

# 52. `checkin`が未使用の場合

利用箇所がなく、migration互換以外の役割もない場合、

コードコメントで、

```text
legacy / reserved
```

であることを明記。

新規作成UIやlogicを作らない。

Phase 2.4で物理削除は不要。

---

# 53. Legacy Dependency Audit

Repository全体を検索し、最低限以下を一覧化する。

```text
project
projectId
parentProjectId
parentTaskId
routine
routineOccurrence
actualId legacy Plan pointer
checkin
```

。

用途を、

```text
canonical
compatibility-only
legacy UI
dead
```

へ分類する。

---

# 54. canonical codeからProject依存を除去

最低限以下のDomain LogicがProjectなしで成立することを確認。

```text
Now Engine
Deadline Reservation
Direction
Future Block
Recurring Activity
Execution
Notification
Wake
Routine Flow
```

。

Projectがないことでfallback errorにならない。

---

# 55. New Entity defaults

Command Engine等から作る新規Task / Plan / Actual / Transactionでは、

Legacy fieldsがSchema上必要なら、

```text
projectId: null
parentTaskId: null
```

のままでよい。

Legacy Entityを新規作成しない。

---

# 56. Command Palette

現在の、

```text
Task
Plan
Actual
Money
Now
```

は維持。

Project commandを追加しない。

Routineについて将来Command追加する場合も、

旧Routineではなく、

```text
Recurring Rule
Routine Flow
```

側へ追加する。

---

# 57. Discord

Discord Command EngineもProject不要で成立すること。

Task作成時にProjectを要求しない。

---

# 58. Legacy Data Viewer

必要であればSettings下部へ、

```text
旧データ
```

の折りたたみSectionを追加してよい。

表示例：

```text
旧Project: 3件
旧Routine: 4件
旧Routine記録: 28件
```

。

目的はデータが消えていないことの確認。

通常運用では触らなくてよい。

---

# 59. Legacy Viewerから新規作成は禁止

旧データ画面があっても、

```text
Project追加
旧Routine追加
```

ボタンは置かない。

編集が必要なら最低限にする。

---

# 60. 既存legacy dataを自動tombstoneしない

ProjectやRoutineが不要になったからといって、

migrationで勝手に削除・archiveしない。

---

# 61. UI用語を整理する

ユーザーへ内部technical nameを過剰露出しない。

例：

```text
Recurring Activity Rule
```

をUIでは、

```text
繰り返し予定
```

。

```text
Routine Flow
```

を、

```text
生活手順
```

。

---

# 62. Routine Flow Trigger表示も日本語化

現在UIで、

```text
afterWake
beforeSleep
manual
```

等がそのまま表示される箇所があるなら、

```text
起床後
出発前
帰宅後
就寝前
手動
```

へする。

Internal enumは変更不要。

---

# 63. Nowの文言

Now Engineはユーザーを管理・評価するものではない。

既存の、

```text
今はこれ
あと○分
自由時間
疲れているなら休もう
```

の方向を維持。

---

# 64. Productivity Dashboard化を避ける

Cleanup後に空いたProject領域等へ、

```text
達成率
連続記録
今日の生産性
スコア
ランキング
```

を追加しない。

---

# 65. `Today`と`Calendar`の役割

現在、

```text
今日
カレンダー
```

が存在する。

これは必ずしもLegacyではない。

役割：

```text
今
→ 次の判断

今日
→ 今日の時間軸確認

カレンダー
→ 日 / 週 / 月の編集・把握
```

として維持可能。

---

# 66. Inbox / 未整理は維持

未整理はvNext思想と一致している。

Liflowへ一旦雑に投げて後で整理する入口として残す。

---

# 67. CaptureをQuick Capture寄りにする

ヘッダーの、

```text
記録する
```

は維持。

最初からProject等の分類を求めない。

---

# 68. Capture種類

最低限：

```text
Task
Plan
Actual
メモ
```

。

これは現状どおりでよい。

---

# 69. Plan Typeは維持

```text
task
appointment
travel
rest
sleep
personal
container
```

はNow Engine等で意味を持つため維持。

---

# 70. `container`はUI説明を分かりやすく

内部の `container` をUIで、

```text
期間
```

として扱う現状は問題ない。

---

# 71. テスト — Project退役

最低限：

* NavにProjectがない
* Task ModalにProjectがない
* Plan ModalにProjectがない
* Actual ModalにProjectがない
* Money ModalにProjectがない
* Task FilterにProjectがない
* Calendar FilterにProjectがない
* 既存projectIdが保存時に意図せず消えない
* ProjectなしEntityでNow Engine正常

---

# 72. テスト — Routine整理

最低限：

* Legacy Routine新規作成UIなし
* RoutineOccurrence新規作成UIなし
* Recurring Rule CRUD正常
* Routine Flow CRUD正常
* Routine Run正常
* Morning Flow正常
* CalendarへRecurring generated Plan表示
* Legacy Routine dataは消えない

---

# 73. テスト — Parent Task

最低限：

* 新規Task ModalにParent fieldなし
* 既存parentTaskIdは保持
* hierarchy付き旧Task表示でクラッシュしない
* Next Action正常

---

# 74. テスト — Now strong mode

最低限：

* Primary Actionが1件
* strongではTask候補一覧を主役にしない
* Free Mode
* Fixed
* Routine Flow
* Morning
* Running Session
* Wind Down
* Recovery

。

---

# 75. UI Smoke

既存UI smokeを更新。

Project画面やLegacy Routine CRUDを前提にするTestは削除またはLegacy testへ移動。

削除したfeatureを「壊れた」と判定しない。

---

# 76. Regression

以下は壊さない。

```text
Task CRUD
Plan CRUD
Actual CRUD
Inbox
Calendar Day / Week / Month
Now Engine
ExecutionSession
Morning Flow
Recurring Activity
Future Block
Direction
Money
Command Palette
Discord
Firebase Sync
Migration
Backup / Restore
Notifications
PWA基盤
```

。

---

# 77. Schema Migration

UI整理だけで済む場合、Schema Versionを上げない。

Legacy field削除のためだけのv7を作らない。

---

# 78. 完成後のNavigation

推奨：

Primary：

```text
今
カレンダー
タスク
未整理
```

Secondary：

```text
今日
ルーティン
お金
設定
```

。

Projectは削除。

---

# 79. Routine画面完成イメージ

```text
ルーティン

繰り返し予定
────────────────

毎週 月・木
10:45–12:25
線形代数

毎週 土
17:00–22:00
バイト


生活手順
────────────────

起床後
顔を洗う
→ 朝食
→ 着替える
→ メイク
→ 歯磨き

就寝前
...
```

。

旧Routine trackerは表示しない。

---

# 80. Task画面完成イメージ

```text
やること

[未完了] [予定なし] [完了]

地学レポート
明日まで
残り 75分
次の一手：写真を3枚選ぶ

[予定に入れる]

────────

研究室を調べる
期限なし
進路
```

。

Project treeを前提にしない。

---

# 81. Now画面 strong mode完成イメージ

```text
今、何する？

┌─────────────────┐
│ 次はこれ        │
│                 │
│ 地学レポート    │
│ 25分だけ        │
│                 │
│ 明日締切。      │
│ 今やるとまだ    │
│ 余裕がある。    │
│                 │
│   [ 開始 ]      │
│                 │
│ 今むり   違う   │
└─────────────────┘

次の予定 17:00
安全に使える時間 43分

今日の流れ
Direction
あとで整える
```

。

---

# 82. Cleanup後のCore概念

ユーザーが通常触る概念を、

```text
Direction

Task
  └ Next Action

Plan

Actual

Recurring Activity

Routine Flow

Record
  ├ Sleep
  └ Condition

Transaction
```

へ近づける。

---

# 83. Legacy concept一覧

Cleanup後、

```text
Project
Parent Project
Parent Task
Legacy Routine
RoutineOccurrence
Plan.actualId
```

は、

> **新規設計では使わないが、旧データ互換のため残っている**

状態にする。

---

# 84. 完成条件

以下を満たしたらPhase 2.4完了。

* Projectが通常Navigationから消えた
* Project新規作成導線がない
* Task/Plan/Actual入力にProject欄がない
* CalendarのProject Filterがない
* TasksのProject Filterがない
* MoneyのProject欄がない
* Legacy projectId dataは保持される
* Legacy Routine新規作成UIがない
* RoutineOccurrence trackerが通常UIから消えた
* Routine画面がRecurring Rule / Routine Flow中心になった
* Now画面からLegacy Routine一覧が消えた
* TaskのParent fieldが通常入力から消えた
* 既存hierarchy dataは壊れない
* strong Now UIがPrimary Action中心
* Direction / Free Modeを維持
* Legacy Entityは勝手に削除されない
* Core DomainはProjectなしで正常
* typecheck成功
* test成功
* lint成功
* UI smoke成功
* build成功

---

# 85. 完了報告

以下を報告する。

1. Projectを退役させたUI一覧
2. Project互換dataの扱い
3. Category inheritance変更
4. Legacy Routineの扱い
5. Routine画面再構成
6. RoutineOccurrenceの扱い
7. Parent Taskの扱い
8. Task画面変更
9. Now strong / balanced / light差分
10. Legacy dependency audit結果
11. `checkin`利用状況
12. Schema version変更有無
13. Migration変更有無
14. 追加・更新test
15. UI smoke結果
16. 既存データ互換確認
17. 既知の問題
18. Phase 2.5へ残したもの

---

# 最重要

Phase 2.4は、

> 古いコードを全部消すPhase

ではない。

目的は、

> **旧Liflowの概念を新しいユーザー体験から退役させ、vNextのCore設計とUI設計を一致させる**

こと。

CompatibilityのためにProject等が内部に残っていてもよい。

しかし新しいTaskを作るたびにProjectを聞いたり、

Recurring ActivityとRoutine Flowがあるのに旧Routineを作らせたり、

Directionを導入したのに旧Project hierarchyを人生設計として使わせ続けたりしない。

Phase 2.4完了後にCloudflare/PWAへdeployし、

**その状態を初めて日常利用するLiflowの基準版**

とする。
