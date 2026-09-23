# Liflow vNext Phase 2.45 実装指示書

## Core UX Reconstruction / Phase 2.5前の本体再構成

更新日: 2026-09-24

対象: 現在の最新Liflow vNext。Phase 2.4完了状態を基準とする。

---

# 0. 今回の位置づけ

Phase 2.5のCloudflare/PWA/実機検証へ進む前に、Liflow本体の日常利用UXと一部Domain Modelを再構成する。

今回の目的は、新機能を大量に追加することではない。

既存のLiflowが持つ、

* Task
* Plan
* Actual
* Execution Session
* Calendar
* Direction
* Recurring Activity
* Money
* Start Assist
* Now Engine
* Command Engine
* Discord関連
* Firebase同期・migration

を生かしながら、

> 大量の情報を並べるアプリ
> ↓
> 必要な情報を裏で保持し、その瞬間に必要なものだけを強く見せる生活OS

へUIと操作体系を再構成する。

特にユーザーの実行機能・時間感覚・再開負荷を補助することを重視する。

---

# 1. 最重要設計原則

Liflow全体で以下を守ること。

## 1.1 ユーザーに記憶させない

* 今何をしていたか
* 次に何があるか
* いつ出るべきか
* どのTaskから触るべきか
* 予定がどうずれたか

を可能な限りLiflow側で保持・可視化する。

## 1.2 選択肢を大量に並べない

通常状態では、

* Nowは原則1つのCurrent Action
* Taskトップは重要な数件のみ
* 未整理は件数中心
* 詳細一覧は明示的に開いた場合のみ

とする。

## 1.3 時間は数字だけでなく形で見せる

「あと43分」の文字だけではなく、

* 空き時間の長さ
* PlanとActualのズレ
* 現在位置
* 次のAnchor

を時間軸上の面積・位置で理解できるようにする。

## 1.4 状態を文字だけに依存しない

色、濃淡、枠、面積、位置、形状を使う。

Magical Diaryの装飾は単なる飾りではなく、情報階層を示すために使う。

例:

* 大きい宝石: Primary Action
* リボン帯: Next
* ミルキーな半透明枠: Plan
* 濃い帯: Actual
* 薄い紙面: Detail

## 1.5 計画より現実を優先する

PlanはActualによって上書きしない。

Plan / Actual / Differenceを保持する。

現実が計画から外れても責めず、現在の現実をもとに再計算する。

---

# 2. Primary Navigation再構成

通常ナビのPrimaryは以下4画面とする。

1. 今
2. カレンダー
3. タスク
4. お金

Secondary:

* 未整理
* 繰り返し予定
* 方向
* 設定

Projectは通常UIへ戻さない。

Routine Flow / 生活手順も通常ナビへ戻さない。

「今日」という独立画面がCalendarの日表示と重複している場合は統合する。

---

# 3. 今画面 — Cockpit化

NowはDashboardではなく、

> 今何をするか
> 次に何があるか
> それまでどれくらいあるか

を答える画面とする。

情報階層は必ず、

NOW
↓
NEXT
↓
TODAY
↓
OTHER

とする。

---

## 3.1 Primary Action

画面内で最も視覚的に強い領域。

表示内容:

* TaskまたはActivity名
* Current Task Action / Next Action
* 目安時間
* 選ばれた理由1つ
* 開始ボタン

理由表示例:

* 明日締切
* さっきの続き
* 最近「進路」が空いている

理由を複数同時に並べない。

---

## 3.2 実行中表示

Execution Session開始後は同じPrimary領域をそのまま変形する。

表示:

* 実行中の対象
* 経過時間
* 必要なら進行中Actual
* この作業は終わった
* Taskも完了
* いったん止める

アプリを閉じて再度開いても同じ実行状態へ戻れること。

Phase 2.4で実装済みのActivity完了 / Pause / Task完了の意味を壊さないこと。

---

## 3.3 NEXT

次の固定Plan / Anchorを表示。

必要なら:

* 開始時刻
* 出発目安
* あと何分
* 現在からそこまでのusable window

を表示する。

---

## 3.4 TODAY

単なる小さな予定列ではなく「今日の時間の地図」とする。

必須:

* 現在時刻
* 固定Plan
* Actual
* 現在から次Anchorまでの空き
* 出発目安

空き時間は「何も描画されない空白」にしない。

---

## 3.5 Fairy

通常時はPrimary Actionより弱く表示する。

以下のような意味のあるTransition時のみ存在感を強めてよい。

* Task/Activity完了
* 朝
* 一日の終わり
* 長時間離脱後の復帰
* 大きなリスケ後

通常操作中に常に大きな吹き出しを占有しない。

---

## 3.6 Strong / Balanced / Light

### Strong

表示:

* NOW
* NEXT
* TODAY

のみを基本とする。

Task一覧、Direction一覧、未整理内容、Money詳細を出さない。

### Balanced

Strongに加えて:

* 未整理件数
* 今日の補助情報

を小さく出してよい。

### Light

さらに:

* Task補助
* Direction補助
* Quick Capture
* その他詳細

を出してよい。

モード差は視覚的に明確であること。

---

# 4. Start Assist修正

現在の「今はできない」「取りかかりにくい」の分離は維持する。

---

## 4.1 今はできない

対象例:

* occupied
* contextUnavailable
* blocked
* insufficientWindow

選択された対象はNowから即座に除外し、再計算する。

同じ項目が直後に再表示されないこと。

PlanにもTaskにも適用する。

---

## 4.2 unavailable有効期限

初期仕様:

* insufficientWindow
  → 現在のusable windowが変わるまで

* occupied
  → 対応する固定予定/状態の終了まで

* contextUnavailable
  → 原則その日の終わりまで

* blocked
  → 原則その日の終わりまで

手動で「戻す」操作を可能にする。

ConditionRecord等を利用する場合はexpiry/resolvedAt相当を明確に持つ。

---

## 4.3 「疲れた」の修正

Start Assistから「疲れた」を選んでも、長時間Persistentなfatigue Conditionを作らない。

これは一時的なRecovery Requestとして扱う。

Recovery表示には最低限、

* 休憩する
* もう大丈夫

を用意する。

短時間の自動expiryを持たせる。

1回「疲れた」を押しただけで半日Recovery Modeが続かないこと。

明示的に入力された健康/Condition記録とは別概念にする。

---

# 5. Calendar全面再構成

Calendarは、

> 時間の地図

として扱う。

日・週・月表示はすべて残す。

---

# 6. Plan / Actualを別欄に分けない

現行のPlan列 / Actual列の分割を廃止する。

同じActivityに属するPlanとActualを1レーン上に重ねる。

基本表現:

* Plan = 薄い半透明背景または外枠
* Actual = 濃い実線/帯

例:

予定14:00–16:00、実績14:00–14:45なら、

14:00–14:45部分にはActual帯、
14:45–16:00にはPlanのみ残る。

これにより、予定より早く終了したことを形で理解できるようにする。

---

## 6.1 Activity grouping

曖昧な推測でPlanとActualを結合しない。

基本:

* `Actual.planId === Plan.id` の場合、同じActivityVisualへまとめる
* 同じPlanに複数Actualがある場合は同一Activity内の複数segmentとする
* Pause / Resumeによる複数Actualも同一Activity内
* 同じTaskであっても別Planなら別Activity
* PlanなしActualは単独Activity
* 明確なExecution Session等の共通IDがある場合のみ、必要に応じてPlanなしActualを同一Activityとして扱ってよい

名前一致だけで結合しない。

---

## 6.2 本当に別Activityが重なる場合

PlanとActualの違いでは横レーンを増やさない。

別Activity同士が時間的に重複する場合のみ横分割する。

---

## 6.3 Running Actual

Execution Session実行中なら、

Actualを現在時刻まで伸びている帯として表示する。

Calendarを開くだけで、

「今これをやっている途中」

と分かること。

---

## 6.4 unresolved Plan

PlanにActualがない状態で、

* skipped
* postponed
* unneeded

などのresolutionがある場合、薄い枠や状態記号で表す。

---

# 7. Calendar 日表示

最も詳細な時間軸。

必須:

* 現在時刻ライン
* Plan
* Actual
* FREE時間
* Next Anchor
* 出発目安
* Running Activity

FREE時間も情報として表現する。

---

## 7.1 短時間イベント

Phase 2.4で導入済みのCompact表示を維持する。

短時間イベントは文字が入らなくなっても消さない。

例:

* 通常ブロック
* dot + one-line time/title
* 1分イベントでも視認可能

クリック/タップ領域は視覚サイズと分離し、最低44px程度の操作領域を維持する。

既存の1/2/5/10/30/60分テストを壊さない。

---

# 8. Calendar 週表示

7日×時間を単純に細く詰め込むだけの表示にしない。

主目的:

> どの曜日がどれくらい埋まっているかを見る

PCでは各日の時間密度が視覚的に分かる構造にする。

選択した日は詳細な時間軸を同画面または近接領域に展開してよい。

スマホでは週の日付Selector + 選択日の詳細でもよい。

---

# 9. Calendar 月表示

目的:

* 忙しい日
* 空いている日
* 大きなイベント

を俯瞰すること。

細かい予定タイトルを大量に詰め込まない。

日セルでは、

* Calendar Categoryの色
* 密度
* 大きな予定
* 件数

等で表現してよい。

選択すると日表示/日詳細へ移動する。

---

# 10. Calendar Category

意味を以下に固定する。

> Calendar Category = どの生活領域・予定表に属するか。Calendar上の色分け・表示切替単位。

Directionとは別概念。

既存Category名は勝手に整理・改名しない。

現在のユーザーデータを維持する。

---

## 10.1 PlanではCalendar Category必須

Plan作成時に「なし」をなくす。

Settingsに、

`defaultCalendarCategoryId`

を追加する。

新規PlanはDefault Calendar Categoryを初期値にする。

既存CategoryなしPlanは安全なfallback Categoryへmigrationする。

fallbackとして「その他」等を自動生成してよい。

Default Categoryを削除/Archiveする場合は新しいDefaultを選ばせる。

---

## 10.2 Taskでは任意

Task自体は時間軸ではないのでCalendar Categoryは必須にしない。

TaskからPlanを作る場合:

1. Task側Category
2. Default Calendar Category

の順で利用する。

---

## 10.3 Recurring Plan

Recurring Activity Ruleから生成されるPlanにもCalendar Categoryを必須とする。

---

# 11. Direction

意味:

> その行動が何に向かっているか。

初期Direction:

* 学業
* 専門
* 進路
* 生活
* 世界

Calendar Categoryと1:1対応させない。

例:

大学Calendarでも、

* 授業 → 学業
* 研究室見学 → 専門
* 就職イベント → 進路
* サークル → 世界

となり得る。

---

## 11.1 DirectionはNowの表面から退く

Now画面にDirection Cardを5枚並べない。

Now Engineでは引き続きDirection Actual Summary / protection等を利用してよい。

Direction画面で、

* 最近7/14日Actual
* 各Directionに使った時間
* 最近空いているDirection
* protection状態

などを視覚的に確認できるようにする。

---

# 12. Task画面全面再構成

Task画面の役割:

> 未完了Taskを大量に表示する場所ではなく、やることを実行可能な形に整える場所。

---

# 13. Taskトップ

通常状態で全Taskを表示しない。

主なSection:

1. いま整える
2. 整理が必要
3. あとで
4. 予定済み
5. 完了済み

トップに表示する高優先項目は最大数件程度とする。

総件数が多くても、

「未完了37件」

を巨大表示しない。

---

## 13.1 いま整える判定例

* 締切が近いのにPlanなし
* Current Actionなし
* 残り時間不明でDeadline Reservationできない
* 長期間放置
* blocked解除済み
* Direction protection上必要

ユーザーには内部判定をそのまま出さず、

「明日締切なのに、まだ時間を決めていない」

等の理解しやすい理由を1つ表示する。

---

# 14. Task Action導入

現在の単一`nextAction`を、軽量な複数Task Actionへ拡張する。

Task Actionは子Taskではない。

原則持たないもの:

* 独立締切
* 独立Direction
* 子Action階層
* 独立Calendar Category
* 独立Priority

目的はTaskを進めるための軽量Step。

---

## 14.1 Task Actionモデル

概念例:

```ts
TaskAction {
  id: string
  taskId: string
  title: string
  status: "todo" | "done" | "skipped"
  sortOrder: number

  estimatedMinutes?: number
  minimumUsefulMinutes?: number

  contexts?: ...
  energyRequirement?: ...
}
```

既存Domainに合うよう調整してよい。

---

## 14.2 Current Action

`current`という独立statusを保存しない。

原則:

> sortOrder順で最初のtodo Action = Current Action

とする。

Current Action完了時は自動的に次のtodo Actionへ移る。

---

## 14.3 最後のAction完了

最後のActionを完了してもTaskを自動完了させない。

UIで、

「すべての手順が終わりました。Taskも完了しますか？」

等の確認を出す。

---

## 14.4 Task Actionは全部作らなくてよい

Task作成時に全工程入力を要求しない。

Task:

「地学レポート」

Action:

「写真を選ぶ」

だけでも成立する。

後からAction追加可能。

---

# 15. Task ActionとPlan / Actual

Planに、

`taskActionId?: string`

を追加できる構造にする。

Planは、

* Task全体
* 特定Task Action

どちらにも紐付け可能。

Actualにも可能なら、

`taskActionId?: string`

を持たせる。

Planから生成されるActualは自動継承する。

入力時に毎回Action指定を強制しない。

---

# 16. 既存nextAction migration

既存TaskのnextActionが存在する場合、

最初のTaskActionとしてmigrationする。

既存データを失わない。

migrationはidempotentにする。

backup / rollback可能な形を維持する。

---

# 17. Task Card

Task名よりCurrent Actionを視覚的に強くする。

例:

Task:
地学レポート

Current Action:
→ 写真を3枚選ぶ

補助:

* 約15分
* 明日締切
* このあと4件
* 予定あり/なし

---

# 18. Task詳細

最初から編集Formを表示しない。

まず状態表示。

表示候補:

* Task名
* Current Action
* 後続Actions
* 締切
* 残り見積もり
* 予定
* Actual実績
* Direction
* Calendar Category
* blocked等の状態

編集は別操作。

締切と予定は明確に別Sectionにする。

---

# 19. TaskからPlan作成

「予定に入れる」を押した場合、巨大Formを最初から出さない。

候補:

* 今日の空き時間
* 明日の空き時間
* 日時を選ぶ

Liflowがusable windowを持つ場合は、

「16:10–16:40 30分空いている」

等を提示できる。

---

# 20. Plan Type整理

通常UIからraw Plan Type selectorを削除する。

現在表示されている、

* タスク
* 予定
* 移動
* 休憩
* 睡眠
* 個人
* 期間

という選択肢を通常ユーザーに選ばせない。

理由:

* taskはtaskIdから分かる
* 予定は全Planが予定
* 個人はCalendar Categoryと重複
* 期間は日時表現
* restはRecovery等と重複

---

## 20.1 内部互換

既存type値は破壊的migrationしない。

旧:

* appointment
* rest
* personal
* task
* travel
* sleep
* container

等は読み込み可能にする。

新UIでは通常Planとして扱い、必要な特殊挙動のみ別flag/derived semanticsで扱う。

移動・睡眠等に本当に特殊処理が必要なら、raw enumではなく理解しやすいUIを用意する。

Recurring Plan UIにもraw Plan Typeを出さない。

---

# 21. Plan reconciliation改善

終了済みPlanでActualがない場合の、

「やらなかった」

を単なるcancelled処理にしない。

選択後:

* 別の時間にやる
* 今回はやらない
* 不要になった

を出す。

---

## 21.1 リスケ

任意の日付/時間を選べる。

旧Plan:

* resolution = postponed
* rescheduledToPlanId = newPlan.id

新Plan:

* rescheduledFromPlanId = oldPlan.id

とする。

旧Planは履歴として残す。

Task-linked PlanをskipしてもTaskを完了しない。

Recurring generated occurrenceをリスケする場合、必要なら独立したmanual successorとして扱い、元Ruleから重複生成しない。

---

# 22. Routine Flow / 生活手順の退役

Routine Flowは通常UIから外す。

対象:

* afterWake
* beforeDeparture
* afterReturnHome
* beforeSleep
* manual

等のFlow UI。

現在ユーザー作成データがない前提でも、Entity/schema自体は破壊的削除しない。

既存データ互換を維持する。

自動起動も通常動作から外す。

将来、Health / Location / native signal等を利用できる段階で再設計する。

---

# 23. Recurring Activity

残すのは「繰り返し予定」。

通常ユーザー向け名称も「繰り返し予定」を優先する。

Recurring Activity RuleからPlan生成を継続する。

Calendar Category必須。

raw Plan Type selectorは削除。

---

# 24. Money — 今回の対象範囲

Moneyは将来的に、

* Account残高
* Safe-to-Spend
* 約1か月の予測生活費
* 購入可能日
* 資産/負債
* 本格的な未来予測

へ拡張予定。

ただし今回はそこまで作らない。

今回の目的:

> 現在のMoneyを日常利用できる状態にし、将来拡張可能な土台を作る。

---

# 25. Money CategoryをEntity化

自由記述カテゴリを廃止する。

例:

```ts
MoneyCategory {
  id
  name
  appliesTo
  sortOrder
  archived
}
```

`appliesTo`は必要なら、

* expense
* income
* both

等。

---

## 25.1 Money Category操作

必須:

* 作成
* 名前変更
* 並び替え
* Archive
* 統合
* 削除

使用中Categoryをそのまま削除してTransactionを壊さない。

削除時:

* 他Categoryへ統合
* 別Categoryへ再割当

を要求する。

---

## 25.2 Legacy migration

既存Transactionのstring categoryを取得し、同名Categoryを作成する。

同名は統合。

Transactionへ`categoryId`をbackfillする。

旧string fieldは互換用に残してもよいが、canonicalは`categoryId`とする。

---

# 26. 決済手段

自由記述ではなく選択式マスタを導入する。

名称例:

`MoneyMethod`

初期例:

* 現金
* 三井住友銀行
* Suica
* PayPay
* ポイント
* クレジットカード

ユーザーが追加・編集・Archive可能。

今回、厳密なAccount残高管理までは実装しなくてよい。

---

## 26.1 Expense / Income

Expense:

* 金額
* Category
* 支払元MoneyMethod
* 日付
* memo
* status
* Plan/Actual linkage等

Income:

* 金額
* Category
* 入金先MoneyMethod
* 日付
* memo
* status

---

# 27. Transfer

支出・収入以外に、

`transfer`

を導入する。

用途:

* 銀行→現金
* 銀行→Suica
* 現金→電子マネー
* その他チャージ/資金移動

Transfer本体は収入/支出集計に含めない。

---

## 27.1 Transfer Data

最低限:

* amount
* sourceMethodId
* destinationMethodId
* date
* memo
* feeAmount

`feeAmount`はデフォルト0。

sourceとdestinationは同一不可。

---

## 27.2 Transfer fee

手数料はExpenseとして集計する。

例:

銀行→現金 10,000円
手数料220円

なら、

Transfer:
10,000円

Expense:
220円

と解釈する。

「手数料」Categoryをsystem/defaultとして利用してよい。

Transfer本体とfee Expenseはリンク可能にする。

二重入力しない。

---

# 28. クレジットカード

今回、実際のカード請求・引落日モデルは作らない。

簡略仕様:

> カード利用は利用時点で支出として確定したものとみなす。

将来的なAccount残高モデル導入時に変更可能な構造を保つ。

---

# 29. Budget

今回は手動Budgetを残し、使いやすくする。

BudgetはCategory単位で、

* 週
* 月

のどちらかを設定可能。

初期仕様では、

> 1 Categoryにつき同時に有効なBudget周期は1つ

とする。

週Budgetと月Budgetの二重適用を避ける。

---

## 29.1 Budget pace

各Categoryについて、

`予算 - 期間内settled支出 - 期間終了までの予定支出`

を求め、

`今日を含む残り日数`

で割る。

これを、

> あと ○円 / 日

として表示する。

---

## 29.2 expected expense

未来のexpected expenseもBudgetから先に差し引く。

例:

今週食費予算 7,000
settled 2,100
expected 900
残り4日

なら:

4,000 / 4
= 1,000円/日

---

## 29.3 Budget超過

マイナス日額を表示しない。

例:

0円 / 日
1,240円オーバー

とする。

---

# 30. Money画面

今回のPrimaryはBudget Pace。

構造:

1. 予算ペース
2. これからの予定入出金
3. 振り返り
4. 最近の記録
5. Category / MoneyMethod管理

Safe-to-Spend完成版は作らない。

---

## 30.1 振り返り

期間:

* 今週
* 今月
* 3か月
* 任意期間

等。

カテゴリ別支出/収入を視覚的に表示する。

横棒等で、

* 金額
* Category間の比率

が一目で分かるようにする。

単なる数値表のみにはしない。

---

# 31. MoneyをNowへ常設しない

今回のNowにはMoney Dashboardを追加しない。

通常のBudget pace一覧もNowに入れない。

明確なBudget超過等をbalanced/lightで補助表示する程度は可。

NOW → NEXT → TODAYの階層を壊さない。

---

# 32. Command / Discordを正式アーキテクチャへ

今後の永続的な原則:

> GUIで可能な操作はCommand経由でも可能にする。

Command/Discordは後付け機能ではない。

Canonical architecture:

Domain
↓
Application Actions
↓
GUI / Command Palette / Discord

とする。

---

# 33. Application Actions

各Domain操作を共有Application Actionへ寄せる。

GUIだけが直接Storeを操作し、Discord側に同じ処理を再実装する構造を避ける。

最低対象:

## Task

* create
* edit
* delete
* complete
* cancel
* list
* detail
* deadline
* Task Action CRUD
* Task Action complete
* Plan化

## Plan

* create
* edit
* delete
* list
* range query
* start
* pause
* finish
* skip
* reschedule
* unneeded
* Actual生成

## Actual

* create
* edit
* delete
* list
* link

## Money

* expense
* income
* transfer
* edit
* delete
* range
* category CRUD
* category merge
* MoneyMethod CRUD
* Budget CRUD

## Calendar

* today
* tomorrow
* N hours
* N days
* range
* Calendar Category CRUD

## Direction

* list
* summaries
* assignment
* protection policy

## Now

* show current
* start
* unavailable
* hard-to-start
* pause
* finish

---

# 34. Command Palette

Command EngineもApplication Actionsを使用する。

GUIとは別のDomain処理を持たない。

---

# 35. Discord

現状のRepoには、

* command parser
* Liflow→Discord webhook送信

は存在するが、Discord→Liflowの正式なInteraction処理が不足している。

今回、Discordを正式な第2Clientとして接続する。

---

## 35.1 Discord inbound

実装対象:

* Interaction endpoint
* Discord署名検証
* Slash Commandまたは同等のCommand入力
* text parser
* multi-line bulk command
* Action実行
* 結果返信

---

## 35.2 Persistent response

結果は原則通常Channel Messageとして残す。

Ephemeral-onlyを標準にしない。

用途:

* mobile console
* schedule共有
* query history
* bulk input result

---

## 35.3 Query例

* 今
* 予定 今日
* 予定 6時間
* 予定 3日
* 予定 9/25
* 予定 9/25 9/30
* タスク
* お金 今週
* お金 今月

等。

---

## 35.4 Bulk input

既存の、

`t`
`p`
`a`
`m`
`mi`

等のCommand思想を維持・拡張する。

複数行を一度に処理可能にする。

件数を任意に切り捨てない。

Discord API message lengthを超える場合は複数Messageへ分割する。

---

## 35.5 Mutation security

閲覧:

設定されたtrusted channelで可能。

変更:

初期仕様ではallowlistされたDiscord Userのみ。

trusted serverにいる全員がLiflowデータを書き換えられる状態にはしない。

---

# 36. Quick Capture

全画面共通で低摩擦なCaptureを提供する。

候補:

* やること
* 予定
* 実績
* お金
* メモ

巨大Formを最初に見せない。

必要項目だけ最初に入力し、詳細は後から補完可能にする。

---

# 37. 未整理

Inboxの意味を、

> Liflowが現実を理解するために、あと一つ判断が必要なもの

へ整理する。

対象例:

* 終了PlanのActual確認
* Taskに次の一手がない
* category不足
* expected transactionの確定
* sync conflict
* Captureしたメモの分類

Nowでは件数中心。

内容一覧をPrimaryにはしない。

---

# 38. Magical Diary UI

テーマは維持する。

コンセプト:

> 2006年の魔法少女電子手帳が20年後に生活OSへ

ただしDecorationが情報階層を破壊しないこと。

---

## 38.1 共通Visual hierarchy

Primary:
大きく、宝石/強い形状

Context:
リボン・中程度のカード

Detail:
薄い紙面・弱いカード

すべてのCardを同じ装飾・同じ強さにしない。

---

# 39. Desktop / Mobile

DesktopとMobileで同じ情報量を無理に表示しない。

Mobileでは:

* Current Action
* Next
* current day
* selected Calendar day
* Task数件

を優先。

管理一覧や詳細はDrill-downする。

Desktopでは空間を利用してContextを横に展開してよい。

---

# 40. Migration

今回Domain変更が多いため、schema versionを更新する。

現行v6なら次versionへ進める。

Migration対象:

* Task.nextAction → TaskAction
* Money string category → MoneyCategory
* Transaction categoryId
* MoneyMethod初期化
* Plan CalendarCategory fallback
* Budget形式調整
* 必要なPlan/Actual action linkage field追加

---

## 40.1 Migration条件

* idempotent
* 既存データを削除しない
* rollback/backup可能
* migration途中で再起動しても壊れない
* 旧クライアントのデータを可能な限り読める
* sync conflictを増やさない

---

# 41. Firebase / sync

既存の安全同期設計を壊さない。

新Entity:

* TaskAction
* MoneyCategory
* MoneyMethod
* Transfer等

を同期対象へ追加する場合も既存migration/sync contractに従う。

端末間競合でCategoryやTask Actionが消えないようテストする。

---

# 42. 既存Phase 2.4の挙動を壊さない

以下はRegression禁止。

* Activity lifecycle
* Execution Session
* Early Start
* Early Finish
* pauseによる複数Actual
* Activity completeとTask completeの分離
* PlanをActualで上書きしない
* Calendar短時間イベント表示
* 44px相当hit target
* Now Engine基本ロジック
* Deadline reservation
* Direction protection

---

# 43. Test

Unit / integration / browser smokeを更新する。

最低限以下を追加する。

---

## 43.1 Task Action

* legacy nextAction migration
* first todo = Current Action
* completeで次へ昇格
* skipped処理
* last Action終了時Taskは自動完了しない
* Plan linkage
* Actual linkage

---

## 43.2 Calendar

* Plan + 1 Actual
* Plan + multiple Actual
* Pause / Resume
* early start
* early finish
* late start
* overrun
* PlanなしActual
* 同じTaskだが別Plan
* unrelated overlapping Activity
* 1/2/5/10/30/60分event
* running Actual

---

## 43.3 Start Assist

* unavailable PlanがNowから外れる
* unavailable TaskがNowから外れる
* expiry後に戻る
* 手動解除
* tired 1回で長時間Recoveryにならない
* Recovery Request解除

---

## 43.4 Calendar Category

* Plan Category必須
* Default Category
* legacy null backfill
* default削除保護
* Recurring Plan Category

---

## 43.5 Plan reconciliation

* skipped
* unneeded
* arbitrary reschedule
* old/new linkage
* Task completion非連動
* recurring occurrence duplicate防止

---

## 43.6 Money

* category migration
* category rename
* merge
* used category delete protection
* MoneyMethod
* expense
* income
* transfer
* transfer fee
* transferが収支本体に混入しない
* Budget weekly
* Budget monthly
* expected expense reservation
* per-day remaining calculation
* budget overrun
* period boundary

---

## 43.7 Command / Discord

各Application Actionについて、

GUIとCommandで結果が一致すること。

* multi-line parsing
* long output split
* read query
* mutation allowlist
* invalid signature
* invalid command
* partial failure in batch

をテスト。

---

# 44. Browser Smoke

最低限:

* Now Strong
* Now Balanced
* Now Light
* Calendar Day
* Calendar Week
* Calendar Month
* Task top
* Task detail
* Task Action
* Money top
* Money Budget
* Money Category management
* Money Transfer
* Direction
* Recurring Plan
* Inbox
* Quick Capture

Desktop / mobile双方。

---

# 45. 今回やらないもの

明確に対象外。

## Money将来版

今回は以下を完成させない。

* Account残高の厳密管理
* 資産/負債Accounting
* 実カード請求サイクル
* 自動Safe-to-Spend
* 30日予測生活費
* 自動収支Forecast
* 「いつなら買える？」
* 欲しい物の購入可能日判定
* 本格的なliquidity
* 本格的なポイント価値換算

今回のMoney modelは将来これらを追加しやすい構造にする。

---

## Native signals

* Health連携
* Screen Time
* Location trigger
* native background activity detection

等は今回対象外。

---

## Deployment

Cloudflare / PWA / 実機通知等のPhase 2.5作業は今回行わない。

本改修完了後にPhase 2.5へ進む。

---

# 46. 実装順序

依存関係を踏まえ、以下を推奨する。

### Step 1

Domain / schema / migration

* Task Action
* Calendar Category default
* Money Category
* Money Method
* Transfer
* Budget
* Plan/Actual linkage

### Step 2

Shared Application Actions

GUI以外からも利用可能なDomain操作へ整理。

### Step 3

Task UI

Taskトップ / Action / detail / scheduling。

### Step 4

Calendar

Plan/Actual unified Activity rendering。

### Step 5

Now

Cockpit化 + Start Assist修正。

### Step 6

Money

Budget pace / Category / Method / Transfer / visual review。

### Step 7

Secondary UI

Direction / Inbox / Recurring Activity / Settings。

### Step 8

Command Palette

Application Actionsへ接続。

### Step 9

Discord inbound

Interaction endpoint / security / persistent output / bulk input。

### Step 10

Regression / smoke / screenshots / completion report。

---

# 47. 完了条件

今回のPhaseは、単に画面が表示された時点では完了としない。

以下を満たすこと。

1. Nowを開いた時、何をすればいいかが1つ明確
2. CalendarでPlan/Actualが別列になっていない
3. PlanとActualのズレが形で分かる
4. Task一覧が大量の未完了項目をPrimaryに表示しない
5. Task ActionがCurrent Actionとして機能する
6. PlanのCalendar Categoryが必須
7. raw Plan Typeが通常UIから消えている
8. Routine Flowが通常UIから退役している
9. Start Assist unavailableがNowから対象を除外する
10. tiredが長時間Recoveryを起こさない
11. Plan skipped時にリスケ可能
12. Money Categoryが選択式
13. Money Categoryの編集・削除・統合が可能
14. 決済手段を記録可能
15. Transfer / チャージを記録可能
16. Transfer手数料がExpenseとして集計される
17. 週/月Category Budgetが設定可能
18. expected支出込みの日割りBudget paceが見える
19. Money振り返りが視覚化されている
20. GUI/Command/Discordが共有Application Actionsを利用する
21. Discordから主要操作・照会が可能
22. migrationで既存データが失われない
23. Phase 2.4 regressionがない
24. build / tests / browser smoke成功
25. 完了報告に変更点・migration・残課題を明記

---

# 48. 実装時の判断原則

細部で迷った場合は、以下を優先する。

1. 現実のデータを失わない
2. ユーザーに考えさせる回数を減らす
3. 一画面に複数のPrimaryを作らない
4. 「今必要なもの」を強く、「あとでよいもの」を弱くする
5. PlanとActualを混同しない
6. TaskとPlanを混同しない
7. Calendar CategoryとDirectionを混同しない
8. TransferとExpenseを混同しない
9. GUI専用ロジックを作らずApplication Actionへ置く
10. 将来拡張のために、今回不要な複雑さを先回りして実装しない

今回の改修後、Liflowは「大量の管理項目を見るアプリ」ではなく、

**今何をするか、時間がどうなっているか、何を整える必要があるかを、視覚的に理解しやすく外部化する生活OS**

として一貫したUI/Domain構造になっていること。
