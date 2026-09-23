# Phase 2.4 追加指示

## Start Assist — 「やりたくない」と「今できない」を区別する

現在の「今むり」は、

* 何すればいいかわからない
* 大きすぎる
* 疲れた
* つまらない

のみで、提示されたActivity自体は実行可能であることを暗黙に前提としている。

しかし実際には、

> 別の必須Activityを実行中
> 必要な場所・道具がない
> 外部条件待ち
> 利用可能時間が足りない

など、心理的抵抗ではなく**現実的に実行不能**な場合がある。

Liflowはこれを「ユーザーがやりたくない」と解釈しない。

---

## 1. Start Assistを2系統に分ける

UI概念：

```text
今むり

今はできない
├ 別のことをしている
├ 場所・道具がない
├ 誰か／何かを待っている
└ 今は時間が足りない

取りかかりにくい
├ 何すればいいかわからない
├ 大きすぎる
├ 疲れた
└ つまらない
```

UIは必ずしも二段階Modalでなくてよいが、内部意味を区別する。

---

## 2. 現在のStartAssistReasonを拡張する

現在の、

```ts
unknown
heavy
tired
boring
```

に加え、少なくとも意味として、

```ts
occupied
contextUnavailable
blocked
insufficientWindow
```

を扱えるようにする。

名称は実装に合わせて変更可。

---

## 3. `occupied` — 別のことをしている

ユーザーが現在別Activityを実行している場合。

これは推薦Taskの拒否ではない。

Liflowの観測状態が現実とずれていることを意味する。

---

## 4. 既存Running Sessionがある場合

既にExecutionSessionがrunningなら、Now Engineは原則としてそのSessionを最優先する。

その状態で別TaskがPrimary Actionになる場合はbugとして修正する。

---

## 5. Current Fixed Planがある場合

現在時刻内のFixed Planが存在し、それが未完了Activityなら、通常はDeadline Task等より優先する。

これも既存Now Engineの優先順位を維持する。

---

## 6. Liflowに未記録のActivityを実行中の場合

「別のことをしている」を選んだら、

ユーザーが現在実行しているものを素早く指定できる導線を用意する。

候補：

```text
現在時刻に近いPlan
今日のPlan
Open Task
その他
```

。

---

## 7. 別の既存Plan / Taskを選んだ場合

対象をExecutionSessionとして開始し、

実際の開始時刻を現在時刻として記録する。

元のNow候補は一時拒否扱いにせず、Entity状態更新後にNow Engineを再計算する。

---

## 8. 未登録の行動

既存Task / Planでは表せないActivityを実行中の場合にも、将来的に現実を記録できる構造を考慮する。

Phase 2.4で実装する場合は、

* ad-hoc ExecutionSession
* ongoing Actual相当

など、Planを偽造せず実行中の現実を表現できる方法を選ぶ。

単に「今やっているから」という理由で過去時刻からPlanを自動作成しない。

実装負荷が大きい場合、この部分だけ後Phaseへ残してよい。

---

## 9. `contextUnavailable`

例：

```text
大学PCが必要
実験室でしかできない
資料を家に置いてきた
電話できない場所にいる
```

。

この場合、

* Task urgency自体は下げない
* Taskを完了扱いしない
* 単に現在の候補から外す

。

---

## 10. Next Action Contextとの接続

既存 `NextActionData.contexts` を利用できる。

将来的には、

```text
home
campus
lab
PC
phone
outside
quiet
```

等のContextと組み合わせ、

実行不可能なNext Actionを最初から候補から除外できるようにする。

Phase 2.4では基盤だけでもよい。

---

## 11. Context unavailableは永続的拒否ではない

「今は道具がない」を選んだからといって、そのTaskを以後推薦しない状態にはしない。

Contextが変われば再度候補になり得る。

---

## 12. `blocked`

外部条件待ち。

例：

```text
先生から返事待ち
荷物到着待ち
友人からファイルを送ってもらうまで不可
```

。

Task自体は未完了。

Deadline urgencyも消さない。

ただし現在実行候補からは除外する。

---

## 13. Block状態の寿命

可能なら、

```text
until manual clear
until date/time
```

程度を将来扱える構造にする。

Phase 2.4で複雑なDependency Systemは作らなくてよい。

---

## 14. `insufficientWindow`

ユーザーが、

> 10分しかないからこれは無理

と判断した場合。

Taskの `minimumUsefulMinutes` とNow EngineのusableWindowを見直す。

単純に5分Taskへ縮めてよいとは限らない。

---

## 15. `insufficientWindow`から学習可能にする

例えば、

```text
minimumUsefulMinutes = 20
```

なのに10分Windowで提案されていたなら、NextAction情報の不足またはEngine bug。

ユーザーの回答を、少なくとも診断可能な情報として保持できる設計にする。

---

## 16. 心理的frictionの既存挙動

以下は現在の方向を維持。

### 何すればいいかわからない

Next Actionを出す。
なければ5分だけ触る。

### 大きすぎる

5分開始等へ縮小。

### 疲れた

CriticalでなければRecoveryを検討。

### つまらない

短いSprintへする。

---

## 17. Urgencyを偽って下げない

どの「今むり」理由でも、

Task DeadlineやCritical判定そのものを書き換えない。

例：

```text
Critical Task
+
場所がなく実行不能
```

なら、

> urgencyは高いが今は実行不能

という事実を保つ。

---

## 18. 「違う」と区別する

既存の「違う」は、

> Liflowが選んだ候補自体が今の選択として適切ではない

という軽い再選択。

「今むり」は、

> 候補は理解できるが、現在状態との不整合がある

という情報。

同じ除外処理へまとめない。

---

## 19. Now再計算

「今むり」の理由入力後は、

```text
現実状態更新
↓
候補filter更新
↓
Now Engine再計算
↓
次のPrimary Actionを1つ
```

とする。

同じActivityを無条件に即再提示しない。

---

## 20. 「別のことをしている」の理想フロー

例：

```text
Liflow:
「レポートを25分やろう」

ユーザー:
[今むり]

理由:
[別のことをしている]

Liflow:
「今やっているのは？」

[18:30 バイト]
[移動]
[別のTask]
[その他]

ユーザー:
バイト

↓
Current Activityを更新
↓
Now再計算

Liflow:
「バイトを続けよう」
```

。

---

## 21. 「今むり」を失敗扱いしない

「今むり」の回数、

拒否回数、

Task回避回数

等を生産性scoreとして表示しない。

これはLiflowが現実状態を修正するための観測入力。

---

## 22. Tests

最低限：

* Running Session中に別Taskを提案しない
* Current Fixed Plan中に不要なDeadline Taskを優先しない
* occupiedを選択
* 別PlanをCurrent Activityとして開始
* 別Taskを開始
* context unavailableで現在候補から除外
* blockedで現在候補から除外
* insufficientWindow
* urgencyが消えない
* context変化後に再候補化可能
* 「違う」と「今むり」が別挙動
* reload後も永続化すべき状態は再構築可能

---

## 最重要

「今むり」は、

> **やる気がないボタン**

ではない。

Liflowから見えている世界と、現実世界がずれていることをユーザーが教える入口でもある。

したがって、

```text
やりたくない
```

と、

```text
現実的に今はできない
```

を区別し、

後者ではユーザーを説得するのではなく、

**現実状態を修正してNowを再計算する。**
