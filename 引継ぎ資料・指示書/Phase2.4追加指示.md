# Phase 2.4 追加指示

## Activity Lifecycle / Early Start / Early Finish

Phase 2.4へ以下を追加する。

### 1. 基本原則

Activityは永続Entityとして新設しない。

Activityの現在状態は、

```text
Plan
linked Actual(s)
ExecutionSession
Execution outcome
```

からderiveする。

Planは「予定」、Actualは「現実」であり、実行結果に合わせてPlanの時刻を書き換えない。

---

### 2. 予定より早くActivityを開始できるようにする

現在、Fixed Planは開始時刻にならないとNowのPrimary Actionにならない。

次のPlanについて、安全に今から開始可能な場合はNow画面に、

```text
次の予定
19:00 レポート

[今から始める]
```

を表示する。

開始すると、

```text
ExecutionSession.startedAt = 実際に押した時刻
ExecutionSession.planId = 対象Plan
```

とする。

Plan.startAtは変更しない。

---

### 3. Early Start候補

少なくとも、

* future Plan
* unresolved
* executableなPlan type
* 現在Running Sessionなし
* 今から開始して別のcurrent fixed activityを壊さない
* 明確な直前Anchor / Travel等と衝突しない

場合に候補化する。

どの程度前からボタンを表示するかはPolicy化してよい。

初期値は30〜60分程度でもよいが、時間だけで機械的に決めずusable windowを考慮する。

---

### 4. Fixed appointment等への扱い

すべてのFixed PlanにEarly Startを出さない。

例えば外部時刻に拘束される、

```text
授業
診察
他者との約束
交通
```

等は「早く開始する」という意味が不自然な場合がある。

少なくともTask-linked Planや自分で開始可能な作業を優先する。

将来的にPlanへstartability policyを追加できる構造にする。

---

### 5. Execution終了理由を区別する

現在の、

```text
終わる
いったん止める
```

が同じ処理を呼ぶ状態を解消する。

ExecutionSessionに永続的に終了理由を記録する。

少なくとも、

```text
activityCompleted
paused
```

を区別する。

Task全体の完了はTask.statusで別管理する。

---

### 6. UI操作

Running Sessionには、

```text
[この作業は終わった]
[Taskも完了]
[いったん止める]
```

を用意する。

PlanのみでTaskがない場合はTask完了ボタンを表示しない。

---

### 7. Activity Completed

「この作業は終わった」を押した場合、

* ExecutionSession終了
* 実時刻でActual作成
* SessionにactivityCompletedを記録
* Plan時刻は変更しない
* Nowを即時再計算

する。

予定終了時刻まで待たない。

---

### 8. Task Completed

「Taskも完了」は、

* Activity Completed
* Task.status = completed
* completedAt記録

を同一transactionで行う。

---

### 9. Pause

「いったん止める」は、

* ExecutionSession終了
* そこまでのActual作成
* Session outcome = paused
* Taskは未完了
* Plan Activityもcompleted扱いしない

とする。

---

### 10. Completed PlanのDerived State

Planに紐づくExecutionSessionのうち、

```text
outcome = activityCompleted
```

または同等の完了情報がある場合、

そのPlanのActivityはplanned endAt前でもcompletedとderiveする。

---

### 11. `getCurrentFixedPlan()`修正

現在時刻だけで、

```text
startAt <= now < endAt
```

を判定してはいけない。

Activity completedとderiveされたPlanはcurrent fixed候補から除外する。

---

### 12. Now Engine再計算

予定より早くActivityが終了した場合、

```text
Actual終了
↓
Activity completed
↓
元Planは保持
↓
Now Engine即再計算
```

とする。

結果は通常どおり、

```text
next Anchor
Deadline
Direction Need
Recovery
Wind Down
Free
```

から決定する。

---

### 13. Plan / Actual Differenceを保持

例：

```text
Plan
19:00–20:00

Actual
18:35–19:10
```

をそのまま保持する。

Planを、

```text
18:35–19:10
```

へ書き換えない。

---

### 14. multiple Actuals

Pause → Resumeした場合、

```text
Plan
19:00–20:00

Actual 1
18:50–19:10

Actual 2
19:30–19:45
```

を許す。

既存の1 Plan → multiple Actual設計を利用する。

---

### 15. Completionは最後のActualの存在だけでは判断しない

PlanにActualが存在するだけでActivity Completedとは限らない。

PauseでもActualが作られるため、

```text
Actualあり
=
完了
```

とはしない。

Execution outcome等の明示状態で区別する。

既存`planState()`がActual存在だけで`executed`と判定している場合、Activity lifecycle用途にはそのまま流用しない。

---

### 16. Early Finish後の空き時間

Activity Completedによって予定終了前に時間が空いた場合、その時間は新しいusable windowとして扱う。

例：

```text
19:00–20:00 Plan
19:00–19:25 Actual / completed
21:00 next Anchor
```

なら19:25以降を再計算対象とする。

---

### 17. Calendar表示

CalendarではPlanを元の予定位置に残す。

Actualを実時刻位置に表示。

これにより、

```text
予定より早く始めた
予定より早く終わった
長引いた
中断して再開した
```

が視覚的に比較できる。

---

### 18. Tests

最低限以下を追加。

* 30分前にPlanをEarly Start
* Early StartしてActual.startAtが実時刻になる
* Plan.startAtが変更されない
* 予定途中でActivity Completed
* planned endAt前でもNowが同じPlanを再提示しない
* Activity Completed後にFreeを返す
* Activity Completed後に別Deadline Taskを返す
* PauseではPlanがcompleted扱いされない
* Pause → Resume → multiple Actual
* Task Completed
* TaskなしPlan completion
* Early Start + Early Finish
* Early Start +予定超過
* current Fixed appointmentがある時に別PlanをEarly Startしない
* Running Session中は別Activity開始不可
* reload / multi-device後もcompletion stateを再構築可能

---

### 19. 最重要

Liflowでは、

> **予定が現実を拘束するのではなく、現実が変わったら予定との差分を残したまま次の判断を再計算する。**

したがって、

```text
予定より早く始めた
予定より早く終わった
途中で止めた
後から再開した
```

をすべて正常なActivity lifecycleとして扱うこと。

PlanをActualへ上書きして帳尻を合わせない。
