P# Liflow vNext Phase 0 実装指示書

## Core Semantics / Schema v4 / Migration Foundation

### 0. 実装対象の明示

今回の実装対象は以下です。

`https://github.com/n7natumi77/liflow`

対象ブランチは原則 `main` の最新状態とします。

`former_Liflow.html` は旧版資料です。

旧UI・旧機能の考え方を確認する参考資料として読むことは構いませんが、

* 現在のコード構成
* 現在のEntity Schema
* 現在の同期方式
* migration方式
* Firebase保存構造
* 現在実装済みの機能

の根拠として使用しないでください。

必ず現在のGitHub Repositoryのコードを確認してから変更してください。

---

# 1. 現在の基盤は作り直さない

現在のLiflowにはすでに以下があります。

* TypeScriptベースのアプリ構成
* `app / domain / firebase / tests` 等の分離
* Core Entity Registry
* Task / Plan / Actual の独立Entity
* Firestore上のEntity単位保存
* `schemaVersion`
* `revision`
* `createdAt`
* `updatedAt`
* `updatedBy`
* `deletedAt`
* tombstone削除
* revision競合検出
* conflict Entity
* migration
* migration前Safety Backup
* Backup Restore
* Firebase Authentication
* Command Engine
* Discord経由の同一Core Entity操作
* Plan / ActualのCalendar表示
* unresolved判定
* Plan延期・Actual記録等のtransaction処理

これらはvNextの土台として再利用します。

今回、

「新しいアーキテクチャを作るために既存基盤を捨てる」

ことは禁止します。

特に、

* Entity単位Firestore保存
* revision競合処理
* tombstone
* backup / restore
* migration framework

は維持してください。

---

# 2. 今回の目的

今回のPhase 0では、現在のSchema v3を壊さずに、

**vNextの設計思想へ対応できるSchema v4へ拡張する**

ことが目的です。

Liflow vNextの中心思想は以下です。

> Liflowは、自分の予定・義務・実際の行動・生活状態・お金・将来の方向を観測し、その時点で「次に何をするか」をできるだけ代わりに判断して、実行まで助ける生活OSとする。
>
> 計画どおりに行動できたかを評価すること自体を目的としない。
>
> 現実が計画から外れた場合は、現実を正として計画を再構成する。
>
> 最終的には「自分は今、何に向かって走っているのか」を、登録した目標ではなく実際の行動から確認できるようにする。

このPhaseでは、

* Now Engine完成
* UI全面刷新
* Morning Flow完成
* Money全面刷新
* AI自動解析
* 魔法少女戦闘

などはまだ実装しません。

まず意味論とSchemaを整理します。

---

# 3. Task / Plan / Actualは現在の独立Entity方式を維持する

新しい `activity` Entityを追加しないでください。

vNextにおける概念上のActivityは、

**ある時間上の行動に関するPlan / Actualのまとまり**

として扱います。

保存上は現在の、

* Task
* Plan
* Actual

をそのまま利用します。

---

# 4. Taskの意味を明確にする

Taskは、

**終わらせる必要がある、または終わらせたいもの**

です。

Task自体は具体的な開始時刻・終了時刻を持ちません。

例：

* 9月25日までに地学レポートを提出する
* 洗剤を買う
* 研究室を調べる
* 友人に写真を送る

Taskには期限があってもなくても構いません。

現在のTask Schemaのうち、

* `projectId`
* `parentTaskId`

は今後のvNext Coreでは中心概念にしません。

ただしmigration時にデータを消さないでください。

---

# 5. Planの意味

Planは、

**ある具体的な時間帯に何をする予定か**

を表します。

例：

* 13:00〜14:00 地学レポートを書く
* 12:00〜13:40 授業
* 17:00〜21:00 バイト
* 23:30〜翌7:00 睡眠予定

Taskに紐づいても、Taskなしでも成立します。

TaskなしPlanを正式に許容します。

---

# 6. Actualの意味

Actualは、

**実際にその時間に起きた行動**

です。

Plan由来でも、Planなしでも構いません。

例：

* 13:18〜14:07 地学レポートを書いた
* 予定なしで20分写真整理をした
* 実際の移動が予定より15分長かった

PlanなしActualを正式に許容します。

---

# 7. PlanとActualは1:1前提から外せるようにする

現在はPlan側に `actualId` があり、1 Plan : 1 Actualを前提とした構造になっています。

vNextでは、

* 一時停止
* 再開
* 中断
* 複数回に分けて実行

を扱いたいため、

**1 Planに複数Actualが関連できる**

構造へ拡張できるようにしてください。

推奨方針：

Plan側の単一 `actualId` を正規参照とするのをやめ、

Actual側の

```text
planId
```

を正規の関連とします。

Planに紐づくActualは、

```text
actual.payload.planId === plan.id
```

で取得してください。

既存 `actualId` はschema v4 migration後も互換目的で一時的に保持して構いません。

ただし新規ロジックでは単一Actual前提にしないでください。

---

# 8. Actual Segmentを新Entityにしない

中断・再開を扱うために、

Actualを巨大な1件にして `segments[]` を持たせる方法と、

複数Actual Entityとして保存する方法があります。

現行Repositoryの構造を活かすため、

**まずは複数Actual方式を優先してください。**

例：

```text
Plan
13:00〜14:30 レポート
```

実際：

```text
Actual A
13:12〜13:40

Actual B
13:55〜14:21
```

両方とも同じ `planId` を持つ。

この方式なら、

* 既存Actual Entity
* 既存Firestore構造
* 既存Calendar描画
* Entity revision
* tombstone

をそのまま活用できます。

どうしても既存コード上不合理になる場合のみsegments方式を検討してください。

その場合は変更理由を完了報告に書いてください。

---

# 9. Plan変更履歴は既存Entity方式を活かす

vNextでは予定変更前の情報を失わない必要があります。

ただし新たに `planHistory[]` を必須導入する必要はありません。

現在すでに存在する、

* 元Planに `resolution: postponed`
* 新しいPlanを生成

というEntity方式を基本として活かします。

必要であれば以下のような参照を追加してください。

```text
rescheduledFromPlanId
rescheduledToPlanId
```

または同等の関係。

目的は、

```text
13:00〜14:00
↓
17:00〜18:00
```

へ変更された履歴が追えることです。

旧Planは通常Calendarでは現在予定として表示しません。

過去の変更履歴として参照できればよいです。

リスケ済み旧Planを「未達成予定」として扱わないでください。

---

# 10. Plan Resolutionを整理する

現状の

```text
cancelled
postponed
unneeded
```

等は基本的に維持可能です。

vNextでは少なくとも以下を意味として区別してください。

* 未処理
* 実行済み
* cancelled
* postponed
* unneeded / skipped

「Actualがない = 失敗」ではありません。

予定を実行しなかった場合でも、

* 中止
* 延期
* 不要
* スキップ

として処理されていればresolvedです。

---

# 11. unresolved判定をvNext向けに整理する

現在の `unresolved()` は有用なので削除しないでください。

ただし今後の意味に合わせて拡張しやすい構造にしてください。

未処理候補は例えば、

* 過去PlanなのにActualもresolutionもない
* Inbox未整理
* 期限が近いTaskなのにPlanがない
* 未解決Conflict
* expected Transactionが期限を過ぎている

など。

将来Game Layerはこれを「濁り」として表示します。

`muddyPoints` のような独立数値をCoreへ保存しないでください。

---

# 12. ProjectをCore中心概念から外す

Project Entityは現時点で存在しています。

削除はしないでください。

ただしvNextでは、

* 新規Task作成
* 新規Plan作成
* 新規Actual作成
* Direction計算
* Now Engine

にProjectを必須にしません。

今後の新規CoreロジックはProject非依存にしてください。

既存Entityの `projectId` はlegacy compatibilityとして保持して構いません。

Project画面については今後廃止・非表示予定ですが、このPhaseでデータを削除しないでください。

---

# 13. Goal階層を新たに強化しない

Goal → Project → Task

のような階層構造をvNext Coreには採用しません。

現在存在する関連機能がある場合は互換維持のみとし、新機能をそこへ追加しないでください。

---

# 14. Direction Entityを新設する

新Entity typeとして `direction` を追加してください。

初期Directionは以下の5つです。

```text
学業
専門
進路
生活
世界
```

Directionには達成率や期限を持たせません。

目的は、

**実際のTask / Plan / Actualがどちらへ向いているか**

を見ることです。

例Schema：

```ts
type DirectionData = {
  name: string
  description?: string
  icon?: string
  colorToken?: string
  active: boolean
  sortOrder: number
}
```

初期Directionはmigrationまたは初期化処理で安全に生成してください。

重複生成しないこと。

---

# 15. Task / Plan / ActualへdirectionIdを追加する

schema v4で以下へ任意の `directionId` を追加してください。

* Task
* Plan
* Actual

ただし入力必須にはしません。

TaskにdirectionIdがある場合、Plan作成時に候補として継承可能です。

PlanにdirectionIdがあり、そこからActualを記録する場合も継承可能です。

ただし明示的指定があればそれを優先します。

今後AI推定で自動設定できる余地を残してください。

---

# 16. Calendar CategoryとDirectionは統合しない

両者は別物です。

Calendar Category：

```text
大学
バイト
個人
友人
```

など。

Direction：

```text
学業
専門
進路
生活
世界
```

など。

例：

```text
研究室訪問
calendarCategory = 大学
direction = 進路
```

```text
趣味でC++を書く
calendarCategory = 個人
direction = 専門
```

両方持てるようにしてください。

---

# 17. 現在のRoutineをそのまま拡張しない

現行には、

* `routine`
* `routineOccurrence`

があります。

vNextでは「繰り返し」と「生活の手順」を分離します。

現行Routineを削除せず、schema v4で新しい意味を追加できるようにしてください。

---

# 18. Recurring Activity Ruleを導入する

以下のようなもの：

```text
毎週火曜12:00〜13:40 授業
毎週金曜17:00〜21:00 バイト
```

は、

**Routine Flowではなく繰り返しPlan生成ルール**

として扱います。

Entity新設例：

```text
recurringActivityRule
```

または既存Routineをこの用途へ整理しても構いません。

ただし後述のRoutine Flowとは明確に分離してください。

---

# 19. Routine Flowを新設する

Routine Flowは、

**特定の状況になったときに順番に生活を進める手順**

です。

例：

* 起床後
* 外出前
* 帰宅後
* 就寝前

新Entity typeとして、

```text
routineFlow
```

を追加してください。

例：

```ts
type RoutineFlowData = {
  name: string
  trigger: {
    type:
      | 'afterWake'
      | 'beforeDeparture'
      | 'afterReturnHome'
      | 'beforeSleep'
      | 'manual'
  }
  active: boolean
  steps: RoutineFlowStep[]
}
```

Step例：

```ts
type RoutineFlowStep = {
  id: string
  title: string

  executionMode:
    | 'automatic'
    | 'checkOnly'
    | 'softTimer'
    | 'pacedTimer'
    | 'checklist'

  estimatedMinutes?: number | null

  condition?: Record<string, unknown> | null
}
```

---

# 20. Routine Runも保存可能にする

Routine Stepを通常PlanやActualとして大量生成しないでください。

例：

顔を洗う
朝食
歯磨き
メイク

をCalendarへ4件表示する必要はありません。

代わりにRoutine実行記録として、

```text
routineRun
```

または同等のEntityを持てるようにしてください。

例：

```ts
type RoutineRunData = {
  routineFlowId: string
  startedAt: string
  endedAt?: string | null

  stepResults: {
    stepId: string
    startedAt?: string | null
    endedAt?: string | null
    status:
      | 'completed'
      | 'skipped'
      | 'pending'
  }[]
}
```

これにより将来、

「メイクは予定12分なのに平均18分」

のような学習が可能になります。

このPhaseでは完成UI不要です。

---

# 21. Record系Entityを追加する

Activityとは別に保存したほうが自然な生活観測データ用の受け皿を作ってください。

最低限、

```text
sleepRecord
conditionRecord
```

を想定します。

fatigueはConditionへ含めても別Entityでも構いません。

過剰にEntityを増やさない判断は可です。

SleepRecord例：

```ts
type SleepRecordData = {
  date: string

  plannedSleepAt?: string | null
  plannedWakeAt?: string | null

  estimatedSleepAt?: string | null
  actualWakeAt?: string | null

  source:
    | 'manual'
    | 'notification'
    | 'screenTime'
    | 'health'

  confidence?: number | null
}
```

このPhaseではOS連携不要です。

保存Schemaだけ作ります。

---

# 22. Next Action用の拡張をTaskへ追加する

Now EngineではTaskそのものではなく、

**次に実際にできる小さい行動**

を扱います。

Taskへ任意のnextAction情報を追加してください。

例：

```ts
type NextActionData = {
  title: string

  estimatedMinutes?: number | null
  minimumUsefulMinutes?: number | null

  contexts?: string[]

  energyLevel?:
    | 'low'
    | 'medium'
    | 'high'
    | null

  interruptible?: boolean

  setupCost?: number | null

  generatedBy?:
    | 'manual'
    | 'ai'
}
```

Task作成UIでこれらを必須入力にはしません。

Schema上保持できればよいです。

---

# 23. Task estimateを将来拡張可能にする

現在の `estimateMinutes` は残して構いません。

ただしvNextでは将来、

```text
estimatedRemainingMinutes
```

が重要になります。

Task全体の総時間より、

**今あと何分必要そうか**

をNow Engineで使います。

今回、

* `estimateMinutes`
* `estimatedRemainingMinutes`

を併存させるか、
意味を整理して置換するかは実装を確認して判断してください。

既存値を失わないこと。

---

# 24. Schema v4へ上げる

現在 `CURRENT_SCHEMA_VERSION = 3` なので、

今回の変更は原則、

```text
CURRENT_SCHEMA_VERSION = 4
```

としてください。

既存の、

```text
v1 → v2
v2 → v3
```

migrationを壊さず、

```text
v3 → v4
```

を追加します。

古いユーザーは、

```text
v1
↓
v2
↓
v3
↓
v4
```

と安全に移行できる必要があります。

---

# 25. Migrationは現在のSafety Backup機構を必ず使う

新しいmigrationシステムを別に作らないでください。

現行の、

* migration前backup
* Entity snapshot
* entity loss検出
* revision conflict検出
* schema version検出

をそのまま活用してください。

v3→v4 migration開始前にもSafety Backupを作成してください。

---

# 26. v3 → v4 Migration

既存Entityは原則そのまま保持します。

Task：

```text
directionId = null
nextAction = null
estimatedRemainingMinutes = existing estimate等から安全に設定可能なら設定
```

無理に推測しない。

Plan：

```text
directionId = null
```

Actual：

```text
directionId = null
```

Project：

そのまま保持。

Routine：

そのまま保持。

新Routine Flowへ自動変換しない。

既存Routineの意味を誤判定して変換しないこと。

---

# 27. Direction初期Entity生成

schema v4 migration後、以下の5 Directionがなければ作成します。

```text
学業
専門
進路
生活
世界
```

ただし、

* migration再実行
* 別端末
* 再ログイン

で重複生成しないこと。

固定IDを使用するか、stable keyを持たせる方法を推奨します。

例えば：

```text
direction_academic
direction_specialty
direction_career
direction_life
direction_world
```

など。

---

# 28. Project関連既存ロジックを新機能へ伝播させない

現在 `inheritedCategory()` 等にProject由来categoryの継承があります。

既存互換は維持して構いません。

ただし新しいDirectionやNow Engineで、

Projectがないと動作しない設計にしないでください。

Projectはlegacy featureとして徐々に切り離します。

---

# 29. Routine migrationは保守的にする

現在のRoutine Entityを、

「これは授業だからRecurring Activity Rule」

「これは歯磨きだからRoutine Flow」

とAIやタイトル文字列だけで自動変換しないでください。

誤変換のリスクが高いためです。

schema v4では、

既存Routineをそのまま維持し、

新規Routine Flow / Recurring Ruleを並行導入して構いません。

旧Routineのmigration整理は後Phaseで行います。

---

# 30. 現行Calendarを壊さない

このPhaseではCalendar UIの全面刷新はしません。

Day / Week / Monthの既存Plan / Actual表示を維持してください。

1 Planに複数Actualが紐づくよう変更した場合のみ、

Calendar上で表示が破綻しないよう調整してください。

---

# 31. Command Engineを壊さない

現在の、

```text
t
p
a
m
mi
n
```

等のCommandは維持してください。

新Schemaへ対応する必要がある部分だけ修正します。

特に既存CommandによるPlan / Actual作成を破壊しないでください。

Direction等のCommand追加は今回必須ではありません。

---

# 32. Discordを壊さない

Discord BotはWebと同じCore Entityを利用しています。

schema v4対応により、

既存Discord Commandが保存不能にならないようにしてください。

新機能対応は後で構いません。

---

# 33. Firebase Storeのtransaction処理を維持する

以下のような既存transaction処理は安全性が高いので活かしてください。

* Plan延期
* Plan → Actual記録
* Actual削除時のPlan unlink
* conflict resolution

1 Plan : 複数Actual対応のために必要な修正だけ行います。

---

# 34. Domainロジックを追加する場所

Now Engineそのものは今回作りません。

ただし今後追加できるよう、

`domain/`

に新しいDomain Functionを置ける設計を維持してください。

今後想定：

```text
getCurrentMode
getNextAnchor
getUsableWindow
getOpenTasks
getTaskRemainingEstimate
getDirectionActualSummary
getDirectionNeed
```

今回必要のないものは空実装しないでください。

---

# 35. 今回のテスト追加

既存の、

```text
domain/core.test.ts
domain/schema.test.ts
domain/commands.test.ts
tests/
```

を活用してください。

最低限以下のテストを追加します。

### Schema migration

* v3 Task → v4 Task
* v3 Plan → v4 Plan
* v3 Actual → v4 Actual
* v3 Projectが消えない
* v3 Routineが消えない
* migration後Entity数が減らない
* v4 migration再実行で重複しない

### Direction

* 初期5Direction生成
* 再実行で二重生成されない

### Plan / Actual

* TaskなしPlan
* PlanなしActual
* 1 Planに複数Actual
* postponed Planの履歴保持
* resolution済みPlanがunresolved扱いにならない

### Sync Safety

* revision維持
* tombstone維持
* backup作成
* migration conflictで中断
* newer schemaを勝手に読み替えない

---

# 36. Phase 0でやらないこと

以下はまだ実装しないでください。

* Now Engine完成版
* Task Score
* Direction Debt
* Future Block自動生成
* Morning Flow完成UI
* Transit Mode
* Focus Mode
* OSアプリ自動起動
* Screen Time連携
* Health連携
* メール自動解析
* クレカ通知解析
* Safe-to-Spend
* Account / Transfer全面Money刷新
* Start Assist完成
* HP再計算
* MP再設計
* 戦闘
* トップナビ全面変更
* Magical Diary全面再デザイン

---

# 37. Phase 0完成条件

以下を満たしたらPhase 0完了とします。

* 現行Repository `main` を基準に実装している
* schemaVersionがv4へ上がっている
* v1→v2→v3→v4 migrationが成立する
* 既存データが消えない
* migration前Backupが動く
* Task / Plan / Actualの独立構造を維持している
* TaskなしPlanが成立する
* PlanなしActualが成立する
* 1 Planに複数Actualを関連できる
* 単一 `actualId` 依存をCoreから外している
* Projectを新Core機能の必須概念にしていない
* Direction Entityが存在する
* 初期5Directionが安全に生成される
* Task / Plan / ActualがdirectionIdを保持できる
* Routine Flow用Schemaがある
* Routine Run用Schemaがある
* Recurring Activity RuleをRoutine Flowと区別できる
* Sleep等Recordを保存できるSchemaがある
* Next Actionを保存できる
* unresolved判定が既存機能を壊していない
* CalendarがPlan / Actualを正常表示する
* Command Engineが動く
* Discord操作が壊れていない
* Firebase revision / conflict / tombstoneが維持される
* TypeScript errorなし
* `npm run typecheck` 成功
* `npm run test` 成功
* `npm run lint` 成功
* `npm run build` 成功

---

# 38. 完了時の報告

完了時には以下を必ず報告してください。

1. 変更したEntity type
2. 新しく追加したEntity type
3. schema v3→v4 migration内容
4. 1 Plan : 複数Actualをどう実装したか
5. 旧 `actualId` をどう扱ったか
6. Project依存をどこまで外したか
7. Routineを今回どこまで変更したか
8. Direction初期化方式
9. 追加したテスト
10. 既存機能で互換Adapterを使っている箇所
11. 今後削除可能なlegacy field / code
12. 既知の問題
13. Phase 1で最初に実装すべき項目

---

# 39. 最重要注意

今回の目的は、

**Liflowを作り直すことではなく、今の安全な基盤をvNextへ進化させること**

です。

以下は禁止します。

* 既存データ初期化
* Firestore全消去
* Projectデータの物理削除
* Routineの推測自動変換
* backupなしmigration
* 単純な全件上書き
* revision無視
* conflict無視
* 旧Command Engineの破壊
* UI都合によるCore Schemaの場当たり的変更

Phase 0では見た目よりも、

**Schema / migration / sync safety / semantic consistency**

を優先してください。
