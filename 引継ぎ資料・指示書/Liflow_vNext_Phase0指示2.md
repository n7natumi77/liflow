# Liflow vNext Phase 1 実装指示書

## Now Engine / Daily Execution MVP

## 0. 実装対象

実装対象は、

`https://github.com/n7natumi77/liflow`

の `main` 最新状態です。

Phase 0で実装済みのSchema v4および既存基盤を前提とします。

現在の、

* Core Entity Registry
* Firebase Authentication
* Entity単位Firestore保存
* revision
* tombstone
* conflict
* migration
* Safety Backup / Restore
* Task / Plan / Actual分離
* 1 Plan : 複数Actual
* Direction
* Routine Flow / Run Schema
* Sleep / Condition Record
* Command Engine
* Discord
* Calendar

を壊さず利用してください。

`former_Liflow.html` は現行実装ではありません。

---

# 1. Phase 1の目的

Phase 1では、

> **Liflowが「今何をしたらいいか」を判断し、その行動を実際に開始・実行・記録し、状況が変われば次の行動を再計算する**

ところまでを一気に実装します。

Phase 1完了時には、少なくとも以下の一連の流れが実際に使える状態を目指します。

```text
起床
↓
起床時刻を記録
↓
朝のRoutine Flowを1Stepずつ指示
↓
次の固定予定・出発までの残り時間を見る
↓
余裕があればTaskを1つだけ推薦
↓
開始
↓
タイマー
↓
終了
↓
Actual保存
↓
Task残時間更新
↓
Now Engine再計算
↓
次の行動を1つ提示
↓
夜は就寝予定を保護
```

今回は「判断エンジンだけ」を作って終わらないでください。

**判断 → 実行 → Actual → 再判断**

まで一周させます。

---

# 2. Liflow vNextの基本原則

Now画面では原則として、

> 何をしますか？

とユーザーへ選択を投げ返さないでください。

Liflow側が、

> **次はこれ**

を1つ決めます。

ユーザーには、

* 開始
* 完了
* Skip
* 今むり
* 違う

程度の最小操作だけを求めます。

特に強介入モードでは候補一覧を最初から並べないでください。

---

# 3. 判断ロジックと表示ロジックを分離する

Now EngineをReact Component内に直接実装しないでください。

例えば、

```text
domain/now-engine.ts
```

を新設し、

必要なら、

```text
domain/scheduling.ts
domain/directions.ts
domain/execution.ts
```

等へ責務分離してください。

同じEntity集合・現在時刻・設定値を渡した場合、

**同じNowDecisionを返す決定論的Domain Logic**

を基本とします。

AI / LLMはPhase 1の判断には使用しません。

---

# 4. Now Mode

Phase 1では最低限、以下のModeを判定します。

```ts
type NowMode =
  | "morning"
  | "fixed"
  | "focus"
  | "recovery"
  | "windDown"
  | "free"
```

Transitは後Phaseで構いません。

---

# 5. Modeの大まかな優先順位

概念上、

```text
実行中Session
↓
Morning Routine
↓
現在Fixed Plan
↓
Wind Down
↓
Critical Deadline
↓
Tight Deadline
↓
Direction Need
↓
通常Task
↓
Free
```

を基本としてください。

ただしCritical DeadlineとWind Downが衝突する場合は後述します。

---

# 6. Anchor

Now Engineは常に、

**次に動かせない予定**

を確認します。

Anchor候補は基本的に、

* active Plan
* deletedでない
* resolution済みでない
* allDayでない
* validTimeRange
* `flexibility === "fixed"`
* `type !== "container"`

です。

---

# 7. Current Fixed Plan

現在、

```text
startAt <= now < endAt
```

となっているFixed Planがある場合、

```text
mode = fixed
```

とします。

例：

```text
12:00〜13:40 物理学
現在 12:28
```

なら、

> いま：物理学

を表示します。

この間に、

> レポートをやろう

など別Taskを推薦しないでください。

---

# 8. Next Anchor

現在Fixed Plan中でなければ、

未来Fixed Planの中から最も近いものをNext Anchorとします。

Now画面には、

```text
次の予定 15:00
あと1時間42分
```

等を補助表示できます。

---

# 9. usableWindow

Next Anchorまでの時間をそのまま自由時間として扱わないでください。

最低限、

* transition buffer
* 途中に存在する別Plan
* dayEnd
* Morning Flowの残り必要時間

を考慮してください。

例：

```text
現在       13:00
次の予定   15:00
buffer     10分

usableUntil   14:50
usableMinutes 110
```

---

# 10. Settingsへ時間安全設定を追加する

必要に応じてschemaをv5へ上げて構いません。

Settingsへ最低限、

```ts
guidanceIntensity:
  | "strong"
  | "balanced"
  | "light"

transitionBufferMinutes: number

departureSafetyBufferMinutes: number

targetSleepTime: string | null

windDownMinutes: number
```

を追加してください。

初期値例：

```text
guidanceIntensity = strong
transitionBufferMinutes = 10
departureSafetyBufferMinutes = 10
targetSleepTime = 23:30
windDownMinutes = 45
```

値は将来調整可能にします。

Domainコード中へマジックナンバーを散らさないでください。

---

# 11. 介入強度

一般利用時にNow Engineが鬱陶しくなりすぎないよう、最低限設定可能にします。

### strong

Liflowが次の行動を1つ決める。

候補一覧は出さない。

### balanced

1つを推薦するが、「別のもの」へ切り替えやすくする。

### light

Now Engineの提案は表示するが、強い誘導はしない。

Phase 1の主テスト対象は `strong` です。

---

# 12. Deadline Engine

Taskを単純な締切順で選ばないでください。

重要なのは、

> **締切まで存在する自由時間 − そのTask群に必要な時間**

です。

---

# 13. Task Remaining Estimate

利用優先順位：

```text
estimatedRemainingMinutes
↓
estimateMinutes
↓
unknown
```

unknownを勝手に30分などと断定しないでください。

ただしunknownを永久に候補から除外しないこと。

---

# 14. Safety Factor

Deadline計算ではTask見積をそのまま信用せず、

```text
requiredMinutes
=
remainingMinutes × safetyFactor
```

とします。

初期値は例えば、

```text
1.25
```

程度。

Policy / Settings等、一か所から変更可能にしてください。

---

# 15. Deadline Reservation

複数Taskが同じ未来の空き時間を重複利用しないよう、

**締切付きTask全体をまとめて未来のFree Windowへ仮予約**

してください。

例：

```text
Task A
明日締切
120分必要

Task B
明後日締切
90分必要
```

に対して、

同じ明日夜2時間を、

Aにも120分
Bにも90分

と二重計上しないでください。

---

# 16. Backward Reservation

可能であれば、期限以前のFree Windowへ後ろ側から確保します。

これにより、

「一週間後のTaskがあるから今日の自由時間を全部使え」

にならないようにします。

ただし容量不足なら現在時間へ食い込ませます。

---

# 17. Taskに既存Planがある場合

そのTaskに関連する将来Planは、

Deadline Reservation上、

**既に確保されている時間**

として扱ってください。

ただしPlanはActualではないので、

Taskの `estimatedRemainingMinutes` 自体は減らさないでください。

---

# 18. Deadline Pressure

最低限、

```ts
type DeadlinePressure =
  | "critical"
  | "tight"
  | "safe"
  | "unknown"
```

を判定します。

### critical

必要時間を締切まで確保できない、またはSlackがほぼない。

### tight

確保できるが余裕が少ない。

### safe

十分余裕がある。

### unknown

remaining estimate不足。

閾値はpolicyとして一か所にまとめてください。

---

# 19. Direction Actual Summary

Directionごとに、

**実際に使ったActual時間**

を集計します。

Task数やPlan数ではありません。

最低限、

```text
過去7日
過去14日
```

を取得可能にしてください。

---

# 20. Direction継承

ActualのDirection解決順：

```text
Actual.directionId
↓
Plan.directionId
↓
Task.directionId
↓
unclassified
```

Projectは参照しません。

---

# 21. 同DirectionのActual重複

同一Direction内でActual時間帯が重複している場合、

Intervalをmergeし、

同じ10分を20分として集計しないでください。

異なるDirection同士の重複はPhase 1では複雑な按分不要です。

---

# 22. 初期Direction Policy

現在の5 Direction：

```text
学業
専門
進路
生活
世界
```

を同じように扱わないでください。

---

## 学業

主に締切・Fixed Planで守ります。

Direction Needから無理に学業Taskを増やさない。

---

## 専門

Future-oriented Direction。

最近Actualが少ない場合、優先度を上げます。

---

## 進路

Future-oriented Direction。

特に放置を検出して推薦してください。

---

## 生活

Phase 1では主に、

* Morning Flow
* Sleep
* Condition

側で扱います。

「生活Directionが少ないから家事しろ」のような単純推薦は禁止。

---

## 世界

生産性を増やすDirectionではありません。

他に必要なことがなければ、

**Free Modeを許す方向**

で利用します。

---

# 23. Direction Need

Future BlockをCalendarへ自動作成するところまではまだ不要です。

ただしNow Engineの候補選択でDirection Needを使います。

最低限、

* 最後にそのDirectionのActualがあった日時
* 直近N日のActual分数

を考慮します。

Policy例：

```ts
type DirectionPolicy = {
  directionId: string
  windowDays: number
  maxGapDays?: number
  targetMinutes?: number
  protection:
    | "none"
    | "soft"
    | "strong"
}
```

数値はあとで調整可能にしてください。

---

# 24. NowDecision

Viewへ文章だけ返さず、構造化Resultを返してください。

例：

```ts
type NowDecision = {
  mode: NowMode

  primaryAction:
    | {
        kind: "plan"
        planId: string
        title: string
      }
    | {
        kind: "task"
        taskId: string
        sourcePlanId?: string | null
        title: string
        suggestedMinutes: number
      }
    | {
        kind: "routine"
        routineRunId: string
        stepId: string
        title: string
      }
    | {
        kind: "rest"
        title: string
        suggestedMinutes: number
      }
    | null

  nextAnchorAt?: string | null
  usableUntil?: string | null
  usableMinutes?: number | null

  reason:
    | "running_session"
    | "morning_routine"
    | "current_fixed_plan"
    | "critical_deadline"
    | "tight_deadline"
    | "direction_need"
    | "continuation"
    | "recovery"
    | "wind_down"
    | "free"

  reasonDetails?: Record<string, unknown>
}
```

細部変更可。

---

# 25. Task選定

Task候補から最終的に**1件**を選びます。

優先順位の基本：

```text
Critical Deadline
↓
Tight Deadline
↓
Direction Need
↓
継続中・最近触ったTask
↓
Window Fitの良いTask
↓
Free
```

候補5件をNow画面へ並べないでください。

---

# 26. Window Fit

Task remainingが90分でも、

usableWindowが18分なら、

Task自体を除外しないでください。

分割可能なTaskなら、

```text
18分だけやる
```

とできます。

`nextAction.minimumUsefulMinutes` がある場合は利用してください。

---

# 27. Free Mode

これは必須です。

急ぎTaskなし。

Direction Needも強くない。

Fixed PlanもMorning Flowもない。

なら、

```text
mode = free
primaryAction = null
```

としてください。

表示例：

> 急ぎのものはないよ。
> 次の予定まで自由時間。

何もないときまで生産性Taskを発掘しないでください。

---

# 28. Direction編集UI

Phase 0ではSchemaだけなので、

Task / Plan / Actual編集画面へ最低限Direction指定を追加してください。

```text
方向
未指定
学業
専門
進路
生活
世界
```

入力必須ではありません。

---

# 29. Direction継承表示

TaskからPlanへDirectionが継承されている場合、

必要なら、

```text
進路（Taskから）
```

等と表示してください。

継承値を必ず複製保存する必要はありません。

明示指定があるときだけoverride可能で構いません。

---

# 30. Execution Sessionを導入する

Taskを「開始」した瞬間を安全に保持する必要があります。

Local Component stateだけでタイマーを管理しないでください。

ページReload等で開始時刻が消えてはいけません。

新Entity：

```text
executionSession
```

を追加することを推奨します。

このため必要であれば、

```text
CURRENT_SCHEMA_VERSION = 5
```

へ上げてください。

---

# 31. ExecutionSession Schema例

```ts
type ExecutionSessionData = {
  targetKind:
    | "task"
    | "plan"

  taskId?: string | null
  planId?: string | null

  title: string

  startedAt: string
  endedAt?: string | null

  status:
    | "running"
    | "completed"
    | "cancelled"

  suggestedMinutes?: number | null

  directionId?: string | null
}
```

実装に合わせて変更可。

既存 `checkin` Entityを意味なく流用しないでください。

---

# 32. Task開始

NowDecisionがTaskの場合、

大きな、

> 開始

ボタンを表示。

押したらExecutionSessionを作成します。

画面はExecution Modeへ切り替わります。

---

# 33. Execution Mode

例：

```text
地学レポート

14:20まで
残り 27分

──────────
      27:14
──────────

[ 終わる ]

いったん止める
```

秒表示にするか分表示にするかはUIに合わせて調整可。

重要なのは、

* 何をしているか
* いつまでやるか
* 次のAnchorまでどれだけか

が一目で分かること。

---

# 34. Session終了時にActualを作る

ExecutionSessionを終了したら、

```text
startedAt
↓
現在時刻
```

でActualを作ります。

Task由来なら、

```text
Actual.taskId = Task.id
```

。

Plan由来の場合は、

```text
Actual.planId = Plan.id
```

も保存。

Directionも正しく継承してください。

---

# 35. ExecutionSession終了後

Session自体は、

```text
status = completed
endedAt = ...
```

として保持して構いません。

Actualが正式な実績履歴です。

二重Actual生成が起きないよう冪等性を考慮してください。

---

# 36. estimatedRemainingMinutes更新

Taskに `estimatedRemainingMinutes` が存在する場合のみ、

Actual時間分を差し引いてください。

例：

```text
残り90分
↓
30分Actual
↓
残り60分
```

0未満にしないこと。

元々nullなら勝手な数値を作らないでください。

---

# 37. Activity終了 ≠ Task完了

Session終了時にTaskを自動完了しないでください。

必要なら、

> このTask自体も終わった？

をワンタップで確認できます。

```text
完了
まだ
```

。

ただし毎回大きなModalを開く必要はありません。

---

# 38. Running Session復帰

アプリReloadや別画面移動後に、

`status === running`

のExecutionSessionがある場合、

Now Engineは最優先でそれを検出してください。

表示：

> 地学レポートを実行中
> 13:42から

など。

二重Sessionを開始させないでください。

---

# 39. 「いったん止める」

「いったん止める」は、

現在Sessionを終了させActualとして記録し、

Task自体はopenのままにします。

後で同じTaskを再度開始したら、

新しいActualになります。

これにより1 Taskに複数Actualが自然に積み上がります。

---

# 40. Start Assist

Now画面のPrimary Actionへ、

小さく、

> 今むり

を追加してください。

これは「サボった」と評価するボタンではありません。

Now Engineへの入力です。

---

# 41. 今むり理由

最低限、

```text
何すればいいかわからない
大きすぎる
疲れた
つまらない
```

の4つ。

一度の選択で済むUIにします。

---

# 42. 「何すればいいかわからない」

Task.nextActionが存在する場合、

それをPrimary Actionとして使用。

なければPhase 1ではAI生成しないため、

```text
まず5分だけ触る
```

程度の短いActionへ縮小してください。

Task詳細からNext Actionを手動設定できても構いません。

---

# 43. 「大きすぎる」

Taskを、

```text
5分だけ
```

程度のSprintへ変更。

Priority自体を下げないでください。

---

# 44. 「疲れた」

ConditionRecordを作成できるようにしてください。

最低限、

```text
fatigue = high相当
source = manual
```

と記録可能にします。

その後Now Engineを再計算。

Critical Taskがなければ、

```text
15分休憩
```

等のRecovery Actionを提示してよいです。

Critical Taskがある場合でも、

「疲れたからTaskを消す」

ことはしないでください。

短いSprint等へ変換します。

---

# 45. 「つまらない」

10分程度のSprintへ変更してください。

短時間終了後に再判断します。

---

# 46. 「違う」

Primary Actionの横に小さく、

> 違う

を置いて構いません。

押した場合、

次点候補を1件だけ出します。

全候補一覧へはしないでください。

---

# 47. Routine Flow Runner

Phase 0で存在する `routineFlow / routineRun` を実際に使えるようにしてください。

最低限、

* Flow開始
* Step表示
* 完了
* Skip
* 次Step
* Flow終了
* routineRun保存

まで実装。

---

# 48. Routine Step executionMode

以下を実装します。

```text
automatic
checkOnly
softTimer
pacedTimer
checklist
```

---

## automatic

ユーザー操作なしで完了できるStep。

起床記録等。

---

## checkOnly

大きな、

> 完了

ボタン。

個別カウントダウンを強制しない。

ただし内部で開始・終了時刻は記録してよい。

---

## softTimer

経過時間または目安時間を視覚表示。

超過しても強く警告しない。

---

## pacedTimer

残り時間を明確に表示。

終了が近づいたら視覚的に強くする。

目安超過時は、

> そろそろ切り上げよう

等を表示。

---

## checklist

複数確認項目を持てるようにしてください。

現在RoutineFlowStepにchecklist itemがない場合、

必要に応じて以下を追加。

```ts
checklistItems?: {
  id: string
  title: string
}[]
```

---

# 49. Morning Flow MVP

Morning FlowをPhase 1で実装します。

ただしPush通知はまだ不要です。

アプリを開いたところからテスト可能にします。

---

# 50. 起床

Now画面が朝で、

今日のSleepRecordに `actualWakeAt` がない場合、

大きく、

> 起きた？

を表示。

押した時刻を、

```text
actualWakeAt = 現在時刻
```

として保存。

入力フォームを開かない。

間違っている場合のみ後から編集可能にします。

---

# 51. SleepRecord

既存SleepRecordがあれば更新。

なければ今日分を作成。

`estimatedSleepAt` はPhase 1では自動推定しなくて構いません。

Screen Time連携は後Phase。

---

# 52. 起床後Routine Flow

`trigger.type === "afterWake"`

のActive Routine Flowがあれば開始。

Morning Modeへ入ります。

---

# 53. 初期Morning Flow

Routine Flowがまだ1件もないユーザー向けに、

初期Presetを安全に作成できるようにしてください。

例：

```text
顔を洗う        checkOnly      3分
朝食            softTimer     15分
着替える        checkOnly      5分
メイク          pacedTimer    12分
歯磨き          checkOnly      3分
持ち物確認      checklist      2分
```

このPresetは編集可能にします。

既存ユーザーへ重複作成しないでください。

---

# 54. 朝風呂

将来的には、

「前夜に入浴Stepを実行していなければ朝風呂」

の条件分岐を想定します。

Phase 1で条件判定まで安全に実装できる場合は、

前日のRoutineRun Step Resultを参照してください。

難しければ、

Morning FlowのOptional Stepとして残して構いません。

タイトル文字列推測等で勝手に判定しないでください。

---

# 55. Morning UI

Morning Flow中はTask一覧を見せるより、

現在Stepを大きく表示。

例：

```text
出発まで 42分

いま
顔を洗ってきて

[ 完了 ]

スキップ

次：朝ごはん
```

---

# 56. 朝の予定情報

朝食などsoftTimer Stepでは、

同画面に、

```text
今日
10:00 授業
15:00 研究室
18:00 バイト

明日まで
地学レポート
```

程度の情報を補助表示して構いません。

「予定確認」という別Routine Stepを作らないでください。

---

# 57. Departure Anchor

Phase 1ではGoogle Maps等を使用しません。

出発時刻は、

**未来のTravel Plan**

が存在する場合、その開始時刻を基準にします。

例えば：

```text
09:10〜09:45 移動
10:00 授業
```

なら、

Travel Plan開始9:10を通常の出発予定とみなします。

---

# 58. 推奨出発時刻

ユーザー設定の、

```text
departureSafetyBufferMinutes = 10
```

なら、

```text
Travel Plan start = 9:10
Liflow推奨 = 9:00
```

として表示できます。

詳細では元Plan時刻も確認可能にしてください。

---

# 59. Travel Planがない場合

外出が必要か推測しないでください。

単に、

```text
次の予定 10:00
```

のみ表示。

「9:20に家を出ろ」等を勝手に生成しないこと。

これは後の移動・位置連携Phaseで改善します。

---

# 60. Morning Flow全体カウントダウン

推奨出発時刻が分かる場合、

すべてのStepで、

```text
出発まで ○分
```

を大きく表示してください。

個別Stepタイマーより上位の制約です。

---

# 61. 支度時間が危険になった場合

残りRoutine StepのexpectedMinutes合計が、

推奨出発までの残り時間を超えそうなら、

Now EngineはMorning FlowをUrgent状態にします。

表示例：

> あと18分。支度を優先しよう。

pacedTimer Stepではさらに明確に警告可能です。

---

# 62. Morning Flowが早く終わった場合

Routine完了後、

推奨出発まで安全に使える時間が残っていれば、

通常Now Engineへ戻します。

例えば、

```text
出発まで 27分
最終確認 buffer 7分
usableWindow 20分
```

なら、

> 地学レポートを20分だけやろう

のようにTaskを1つ提示。

---

# 63. 出発時刻になったらTaskを終了方向へ誘導

Task実行中に推奨出発時刻が近づいたら、

> ここで終わろう。出発の時間。

と表示してください。

Taskを続けることよりAnchorを優先します。

---

# 64. Wind Down

Settingsの、

```text
targetSleepTime
windDownMinutes
```

を使用。

例えば、

```text
就寝目標 23:30
Wind Down 45分
```

なら22:45以降をwindDown候補にします。

---

# 65. Wind Down中のTask選定

Critical Deadlineがなければ、

長時間・高負荷Taskを新規推薦しないでください。

可能なら、

* 就寝Routine
* 短い整理
* 明日の準備

へ移行。

何もなければ、

> 今日はここまで

で構いません。

---

# 66. Critical Taskと睡眠の衝突

Critical Taskが残っている場合、

単純に「寝ろ」で消さないでください。

例：

> 明日締切のTaskがあと40分必要。
> 今からやると就寝は0:05頃になる見込み。

のように現実を表示。

Phase 1では複雑な健康最適化は不要です。

---

# 67. Now画面の再構成

既存Now Viewの全機能を削除する必要はありません。

ただし画面最上部の主役を、

**NowDecision**

にしてください。

最初に見えるものは基本1つ。

---

# 68. Focus表示例

```text
次はこれ

地学レポート
14:20まで 35分

明日締切で、
これ以上後ろに回すと余裕が少ない。

[ 開始 ]

今むり        違う
```

---

# 69. Direction表示例

```text
次はこれ

研究室を1件見る
20分

最近「進路」の時間が空いてる。

[ 開始 ]

今むり        違う
```

---

# 70. Free表示例

```text
急ぎのものはないよ。

次の予定まで自由時間。
```

Free Modeには開始ボタン不要。

---

# 71. Fixed表示例

```text
いま

物理学
12:00–13:40

次の予定
15:00 ○○
```

別Task推薦不要。

---

# 72. Fairy

妖精をNow Engineの説明役として使用してください。

妖精は、

* 評価する
* 怒る
* 罪悪感を与える

存在ではありません。

例えば、

> 今はこれをやろう
> あと8分で切り上げよう
> 最近進路のことできてないから今日は1件だけ見よう
> 疲れてるなら15分休もう

等。

Core判断結果を人間向けに短く伝える存在です。

---

# 73. 「できなかった」への扱い

Taskを延期した、Routine StepをSkipした、予定が崩れた、

という事実そのものにペナルティを与えないでください。

ユーザー操作後、

**現在の現実を新しい入力としてNow Engineを再計算**

してください。

---

# 74. 再計算タイミング

最低限、

* 時刻更新
* Session開始
* Session終了
* Routine Step完了
* Routine Step Skip
* Task完了
* Plan変更
* Actual追加
* Condition追加
* SleepRecord更新

の後にNowDecisionを再計算してください。

不要なFirestore writeはしないでください。

NowDecision自体は導出値です。

---

# 75. NowDecisionを保存しない

NowDecisionはCore EntityとしてFirestoreへ保存しません。

Entity群と現在時刻から導出します。

「Liflowが13:20にこのTaskを推薦した」という履歴が必要になった場合は後Phaseで別途考えます。

---

# 76. Push通知はPhase 1では作らない

重要：

Morning Flowが完成しても、

ブラウザを閉じているスマホへ確実に通知する仕組みは別問題です。

Phase 1では、

* Push notification
* Service Worker scheduling
* Firebase Cloud Messaging
* server-side scheduler

を中途半端に追加しないでください。

アプリを開けばMorning Flowが動くところまで。

通知基盤は次Phase。

---

# 77. Transit Modeもまだ作らない

電車内の、

* 英単語アプリ自動起動
* 休息判定
* SNS制限
* 到着前通知

は次Phase。

ただしNow EngineのContext設計を後から追加できるようにしてください。

---

# 78. Recurring Activity Rule生成も今回は後回し

Phase 0でSchemaはありますが、

Recurring Activity Rule → Plan生成

はPhase 1の主目的ではありません。

Morning Flow / Now Engine / Executionを優先。

既存Routine機能は壊さないでください。

---

# 79. Moneyは触りすぎない

Money全面再設計は後Phase。

Phase 1では既存Money機能を維持。

Account / Transfer / Safe-to-Spendはまだ実装しません。

---

# 80. 実Firebase v4/v5検証

Phase 0で未実施だったため、可能なら検証用Firebase Accountまたは安全な複製データで、

* v3→v4
* v4→v5を追加した場合はv4→v5
* Safety Backup
* Restore
* Direction固定ID
* ExecutionSession
* revision conflict
* 再ログイン
* migration再実行なし

を確認してください。

本番ユーザーデータを破壊テストに使わないこと。

利用可能な検証環境がなければ、

> 実Firebase検証未実施

と報告し、成功扱いしないでください。

---

# 81. テスト

既存テストに加えて最低限以下を追加してください。

## Now Engine

* current Fixed Plan優先
* next Anchor
* resolved Plan除外
* flexible PlanをFixed Anchorにしない
* allDay除外
* usableWindow
* transition buffer
* Free Mode
* Projectなしで正常動作

## Deadline

* 1 Task
* 複数Task
* Backward Reservation
* 同じFree Windowの二重利用防止
* 既存Task Plan coverage
* critical
* tight
* safe
* unknown
* safety factor

## Direction

* Actual明示Direction
* Plan継承
* Task継承
* unclassified
* 7日
* 14日
* 同Direction時間重複merge

## Execution

* Session開始
* Reload相当状態からRunning Session取得
* Session終了→Actual
* Task linked Actual
* Plan linked Actual
* estimatedRemainingMinutes減少
* null estimateはnullのまま
* Session終了でTaskを自動完了しない
* 二重終了でActual二重生成しない

## Start Assist

* heavy → 5分
* tired → Condition Record
* tired + noncritical → recovery
* tired + critical → Taskを消さない
* boring → short sprint
* unknown → nextAction優先

## Routine

* Flow開始
* Step完了
* Skip
* 順番
* RoutineRun記録
* softTimer
* pacedTimer
* Flow終了
* reload後Run復帰

## Morning

* Wake記録
* 同日SleepRecord重複防止
* afterWake Flow開始
* Travel Planからdeparture算出
* safety buffer
* Travel Planなしで出発時刻を推測しない
* 余り時間でTask推薦
* 支度不足でUrgent

## Wind Down

* target sleep前
* windDown期間
* noncritical Task抑制
* critical Task保持

---

# 82. UI Smoke

最低限、

* 今
* 今日
* Calendar
* Task
* Routine
* Money
* Inbox
* Settings
* Command Palette
* Discord関連既存画面

の回帰を確認。

Now画面について追加で、

* Free
* Fixed
* Task recommendation
* Running Session
* Morning
* Routine Step
* Wind Down

を確認してください。

---

# 83. Phase 1でやらないもの

今回の対象外：

```text
Push通知
朝のバックグラウンド通知
Google Maps
位置情報
Transit Mode完成
SNS制限
他アプリ自動起動
Screen Time連携
Healthアプリ連携
メール自動解析
クレカ通知解析
Money Account
Transfer
Safe-to-Spend
Future BlockのCalendar自動生成
AI Next Action生成
AIメール解析
HP再設計
MP再設計
戦闘
トップナビ全面刷新
旧Projectデータ削除
旧Routine自動migration
```

---

# 84. 完成条件

Phase 1は以下をすべて満たしたら完了です。

* Now EngineがDomain層に存在する
* Current Fixed Planを正しく優先する
* Next Anchorを取得できる
* usableWindowを計算できる
* Deadline Reservationが複数Taskで成立する
* critical / tight / safe / unknownを判定できる
* Direction Actual Summaryがある
* Direction Needがある
* NowDecisionが構造化されている
* Primary Actionが原則1件
* Free Modeがある
* Task / Plan / ActualのDirection編集ができる
* TaskをNow画面から開始できる
* Running Sessionが永続化される
* 終了時Actualが作られる
* remaining estimateが安全に更新される
* Task完了とActual終了が分離されている
* Start Assistが使える
* Routine Flow Runnerが動く
* Wake記録ができる
* Morning Flowが実際に進められる
* 出発Anchorが分かる場合Countdownできる
* 早く終わったらTask推薦へ移る
* Wind Downが最低限動く
* 状況変化後NowDecisionを再計算する
* existing Calendar / Command / Discord / Syncを壊さない
* Safety Backup / Migrationを壊さない
* typecheck成功
* test成功
* lint成功
* UI smoke成功
* build成功

---

# 85. 完了報告

以下を必ず報告してください。

1. Now Engineのファイル構成
2. NowMode一覧
3. Anchor判定
4. usableWindow計算
5. Deadline Reservationアルゴリズム
6. critical / tight / safe判定
7. Direction Need Policy
8. NowDecision型
9. ExecutionSessionのSchemaとmigration
10. Task開始からActual保存までの流れ
11. estimatedRemainingMinutesの更新方法
12. Start Assistの実装
13. Routine Flow Runnerの実装
14. Morning Flowの挙動
15. Departure判定
16. Wind Down判定
17. Settings追加項目
18. 実Firebase検証結果
19. 追加テスト
20. UI回帰結果
21. 既知の問題
22. 次Phaseに残したもの

---

# 最重要注意

Phase 1の目的は、

**「今画面におすすめTaskを出すこと」ではありません。**

目標は、

> Liflowが現在の現実を見て、
> 次の行動を1つ決め、
> 実際に開始させ、
> Actualとして記録し、
> その結果を受けて次の行動を再決定する

という循環を完成させることです。

また、

> Liflowが提案した通りに動けなかった

ことを失敗として扱わないでください。

現実が変わったら、

**現実を入力として再計算する**

だけです。

そして、何も必要なことがない場合には、

> 今は自由時間

と判断できることも、Liflowの重要な機能です。
