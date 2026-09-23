# Liflow vNext Phase 2 実装指示書

## Automation / Notification / Recurrence / Future Protection

## 0. 実装対象

対象：

`https://github.com/n7natumi77/liflow`

`main` 最新状態。

Phase 1完了後のschema v5を前提とする。

現在すでに存在する、

* Now Engine
* Deadline Reservation
* Direction Need
* ExecutionSession
* Start Assist
* Routine Flow / Run
* Morning Flow
* Wake記録
* Wind Down
* Firebase安全同期
* Backup / Restore
* Command Engine
* Discord

を利用する。

Phase 2では、

> **Liflowを開いてから判断してくれる**

状態から、

> **Liflow側から必要なタイミングで呼びかけ、定期予定や長期方向も自動的に守る**

状態へ進める。

---

# 1. Phase 2の主目的

今回、一気に以下を実装する。

### A. Phase 1安全検証・補修

実Firebase上のv5検証。

起床時間ハードコード等のPhase 1仮実装を修正。

### B. Push Notification基盤

アプリを開いていなくても、

* 起床
* 支度開始
* 出発
* Task終了
* Fixed Plan接近
* Wind Down

等を通知できる基盤を作る。

### C. Recurring Activity Rule完成

授業・バイト等の繰り返し予定からPlanを安全かつ冪等に生成する。

### D. Future Block

専門・進路など、締切がないDirectionが生活から消えるのを防ぐ。

### E. Direction可視化

「自分は今何に向かって走っているか」をActualから確認できる最低限のUIを作る。

---

# 2. Phase 1安全検証を最初に行う

可能なら破棄可能なFirebaseテストアカウントを作り、

以下を実環境で確認する。

```text
v4 → v5 migration
Safety Backup
Restore
再ログイン
別ブラウザ
別端末相当
同時ExecutionSession開始
同時ExecutionSession終了
Actual二重生成防止
Direction初期化
Morning Flow初期化
revision conflict
```

本番データを破壊試験に使用しない。

検証環境を用意できない場合は、実装を停止する必要はない。

ただし報告書で未検証を明記する。

---

# 3. Runtime Lockを検証・整理する

Phase 1ではExecutionSessionの多重開始防止用runtime lockがEntity Backup外に存在する。

これは必ずしも問題ではないが、以下を検証する。

* Backup Restore後に古いLockが残った場合
* Session Entityだけ復元された場合
* Lockだけ残った場合
* 別端末でSession終了した場合
* tombstone化されたSessionをLockが参照した場合

LockはDerived / Runtime Stateであり、

**ユーザーデータ本体より強い権限を持たせないこと。**

整合しないLockはSession Entityを正として自己修復する。

---

# 4. Morning判定の固定時刻をやめる

現在のような、

```text
4:00〜12:00なら起床確認
```

という固定判定をCore Logicから外す。

起床時刻はユーザーによって変動する。

---

# 5. Wake Window

起床確認を出す条件は、以下の情報から求める。

優先：

```text
当日のplannedWakeAt
↓
Morning Flow / Sleep Plan
↓
ユーザー設定のfallback wake window
```

plannedWakeAtがあるならその周辺で起床確認する。

固定の「午前中」という意味には依存しない。

夜勤・昼起床等でも動作可能な構造にする。

---

# 6. plannedWakeAt入力

Phase 2では最低限、

* SleepRecord編集
* 前夜Wind Down
* 翌日の設定

のいずれかから翌日のplannedWakeAtを入力できるようにする。

毎日必須入力にはしない。

直近値を初期候補としてよい。

将来的にはCalendarから推定する。

---

# 7. PWA化

Push通知の前提として、Web AppをinstallableなPWAとして整える。

最低限、

* Web App Manifest
* app name
* short name
* icons
* theme
* standalone表示
* Service Worker
* update strategy

を用意する。

既存Magical Diaryテーマを壊さない。

---

# 8. Service Worker

Service Workerは、

* Push受信
* Notification表示
* Notification click
* Appへのdeep link

を担当する。

App Core Entityの複雑な判断ロジックをService Workerへ複製しない。

通知内容は原則server側で決定する。

---

# 9. Push Notificationはページタイマーで代替しない

以下は禁止。

```text
setTimeoutで朝まで待つ
ブラウザtabが開いている時だけ通知
```

これではMorning Entryの目的を満たさない。

ブラウザを閉じていても通知可能なPush方式を採用する。

---

# 10. Device Subscription

Push subscription / tokenはユーザーデータEntityとは分離してよい。

例えば、

```text
users/{uid}/devices/{deviceId}
```

等。

保存するもの：

```text
deviceId
pushSubscription / token
platform
createdAt
updatedAt
enabled
lastSeenAt
```

Push tokenはRoutineやTask等のバックアップ対象にしなくてよい。

古いsubscriptionは無効化可能にする。

---

# 11. Notification Permission

初回ログイン直後にいきなりPermissionを要求しない。

設定画面またはMorning機能設定で、

> Liflowから朝や予定前に知らせる

という説明を見せてからユーザー操作で要求する。

拒否されてもアプリは正常動作する。

---

# 12. Notification Scheduler

ブラウザが閉じていても動作するserver-side schedulerを作る。

現行Deployment構成に合う方式を選択する。

Cloudflare WorkerのScheduled Trigger等が自然なら使用してよい。

特定providerへDomain Logicを密結合しない。

概念上、

```text
findDueNotifications(now)
↓
deduplicate
↓
sendPush
```

とする。

---

# 13. Notification Job

通知を完全なその場生成にせず、

必要なら、

```text
notificationJob
```

またはserver-side queue相当を導入してよい。

ただし通知履歴をCore Entityとして大量同期する必要はない。

重要なのは、

* いつ
* 誰へ
* 何の理由で
* 一度送ったか

を冪等に判断できること。

---

# 14. 通知の冪等性

同じ起床通知が、

cron実行ごとに5回届く

ことを防ぐ。

例えば、

```text
wake:uid:2026-09-24
anchor:planId:10min
winddown:2026-09-23
```

等のdedupe keyを使う。

---

# 15. Phase 2で送る通知

最低限：

### Wake

```text
おはよう。起きた？
```

### Morning / preparation

```text
そろそろ支度を始めよう。
```

### Departure

```text
あと10分で出発。
```

または、

```text
出発の時間。
```

### Fixed Plan

必要に応じて、

```text
次の予定まで15分。
```

### Execution

```text
ここで切り上げよう。
次の予定の準備時間。
```

### Wind Down

```text
そろそろ今日を終える時間。
```

---

# 16. NotificationからNowへ入れる

通知Click後は原則、

```text
/ → Now
```

へ遷移。

必要ならquery / action ID等で、

* wake
* routine
* session
* anchor

を識別する。

通知ごとに別の複雑な画面を作らない。

---

# 17. Notification Action

Platformが対応している場合のみ、

```text
起きた
開始
完了
Skip
```

等をNotification Actionとして提供してよい。

ただしAction非対応環境でも必ず使えること。

Fallback：

通知Tap
↓
Now画面
↓
ワンタップ操作

---

# 18. Wake Notification

plannedWakeAtが存在する場合、

その時刻付近でWake通知。

「起きた」が押された場合、

Phase 1のWake transactionを再利用する。

別の起床処理を作らない。

---

# 19. 出発通知

Travel Planがある場合のみ利用。

Phase 1と同じ、

```text
Travel start
-
departureSafetyBuffer
```

を基準にする。

位置情報やGoogle Mapsをまだ推測に利用しない。

通知例：

```text
推奨出発まで10分
推奨出発時刻
出発時刻
```

---

# 20. Execution cutoff通知

ExecutionSession実行中に、

next Anchorやdeparture safety boundaryが近づいた場合、

通知する。

例：

```text
あと5分で終わろう。
```

Sessionを自動終了はしない。

---

# 21. Wind Down通知

targetSleepTimeから逆算。

同日のWind Down通知は原則1回。

Critical Deadlineがある場合、

単純な、

> 寝よう

ではなく、

> 明日締切の作業が残っている

ことが分かる文面にする。

---

# 22. Notification設定

Settingsに最低限、

```text
notificationsEnabled
wakeNotifications
anchorNotifications
departureNotifications
executionNotifications
windDownNotifications
```

を追加してよい。

通知全体OFFも可能。

---

# 23. Recurring Activity Ruleを完成させる

Phase 0でSchemaだけ存在する、

```text
recurringActivityRule
```

からPlanを実際に生成する。

用途：

* 授業
* 定期バイト
* 定期通院
* 毎週の固定イベント

Routine Flowとは完全に別。

---

# 24. Recurring Rule UI

最低限、

```text
タイトル
曜日
開始時刻
所要時間
Category
Direction
Plan Type
Flexibility
有効 / 無効
```

を編集できる。

---

# 25. 生成期間

未来すべてを無限生成しない。

例：

```text
過去7日
〜
未来45日
```

等のGeneration Horizonを持つ。

未来側だけでもよい。

値は一か所で変更可能にする。

---

# 26. Recurring Instance ID

同じRule・同じ発生日からPlanを複数生成しない。

安定したOccurrence Keyを用いる。

例：

```text
ruleId + localDate
```

。

Planには必要に応じて、

```text
recurringRuleId
recurrenceKey
```

等を追加する。

schema更新が必要ならSafety Migrationを行う。

---

# 27. Recurring生成の冪等性

別端末で同時Generationしても、

同じPlanが2件できないこと。

Firestore transactionまたは安定document IDを利用する。

---

# 28. 生成済みPlanを勝手に上書きしない

非常に重要。

Recurring Ruleから生成されたPlanをユーザーが手動で変更した場合、

Rule再生成時に元の時刻へ戻さない。

Occurrenceごとに、

* generated
* overridden
* cancelled

等を区別可能にする。

---

# 29. Rule変更

例えば、

```text
毎週火曜10:00
↓
毎週火曜11:00
```

へRule変更した場合、

未来の**未編集generated instanceのみ**更新対象にできる。

手動変更済みOccurrenceは維持する。

過去Planも書き換えない。

---

# 30. Rule無効化

RuleをOFFにしただけで過去実績を削除しない。

未来の未編集generated Planを、

* cancellation
* tombstone

のどちらで扱うかは既存Calendar semanticsと整合する方式を選ぶ。

物理削除しない。

---

# 31. Future Blockを実装する

Direction Needが高いのに、

締切TaskやFixed Planだけで日々が埋まる問題を防ぐ。

主対象：

```text
専門
進路
```

。

---

# 32. Future Block Policy

初期値：

```text
1日最大1件
15〜45分
専門 / 進路優先
Critical Deadline時は生成しない
```

程度。

PolicyはDomainにまとめる。

---

# 33. Future Block候補

Direction Needが高いDirectionに属するOpen Taskから候補を探す。

例えば、

```text
Direction = 進路
Task = 研究室を調べる
```

なら、

Future Block候補。

---

# 34. TaskがないDirection

Needが高くても該当Taskが存在しない場合、

Phase 2では勝手にTaskを文章生成しない。

AI生成は後Phase。

代わりに、

```text
進路方向のTaskが最近ない
```

という状態を表示可能にする。

---

# 35. Future Block生成

強介入設定では、

安全なFree Windowが見つかれば、

柔軟Planとして自動生成してよい。

例：

```text
20:10〜20:35
研究室を調べる
```

。

---

# 36. Future BlockはSoft Constraint

Fixed Planではない。

Critical Deadline等が発生すれば移動可能。

Planに必要なら、

```text
source = futureBlock
protection = soft
```

等を持たせる。

---

# 37. Future Blockの重複防止

同じ日・同じDirectionについて、

Now再計算のたびにBlockが増えないこと。

stable key / generated markerを使用する。

---

# 38. Future Blockの自動リスケ

予定変更でFuture Blockが成立しなくなった場合、

次の安全なFree Windowへ移動できる。

ただし、

ユーザーが手動変更したFuture Blockは勝手に動かさない。

---

# 39. Future Blockを守りすぎない

以下は禁止。

```text
専門0分だから毎日2時間入れる
進路を毎日必須にする
休息時間をFuture Blockで全て埋める
```

目的は、

**未来方向が何週間も完全に消えることを防ぐ**

こと。

---

# 40. Free Modeを壊さない

Future Block導入後も、

何も不足していない場合はFree Modeを返す。

Now Engineが常に仕事を生成するようになってはいけない。

---

# 41. Direction可視化

「自分は今何に向かって走っているのか」を見られるUIを追加する。

トップナビ全面刷新はまだ不要。

「今日」またはNowの補助エリア、あるいは簡易Reflection sectionで構わない。

---

# 42. Direction表示内容

最低限、

```text
直近7日
直近14日
```

のActual時間。

例：

```text
学業        18h 30m
専門         2h 10m
進路           25m
生活         5h 40m
世界         4h 20m
```

。

---

# 43. 割合だけにしない

割合だけだと、

実時間2分でも100%

になりうる。

必ずActual時間も確認可能にする。

---

# 44. 評価表現を避ける

以下のようにしない。

```text
進路がダメ
専門不足！
学業やりすぎ！
```

代わりに、

```text
最近14日、進路方向は25分
最後に進路方向へ動いたのは8日前
```

のように事実を表示。

---

# 45. Needの説明

Direction Needが高い場合、

ユーザーが理由を確認できる。

例：

```text
進路
最後の実行：8日前
直近7日：0分
```

。

ブラックボックスScoreだけ表示しない。

---

# 46. Direction Policy UI

Phase 1ではDomain固定だったPolicyを最低限調整可能にする。

各Directionについて、

```text
保護しない
弱く守る
強く守る
```

程度でよい。

ユーザーに複雑な数値設定を要求しない。

詳細設定として、

* 最大空白日数
* 期間目安分数

を開けてもよい。

---

# 47. 初期Policy

引き続き、

```text
学業：弱
専門：強
進路：強
生活：別ロジック中心
世界：生産性保護なし
```

を初期値とする。

---

# 48. NotificationとFuture Blockの連携

自動生成されたFuture Blockが近づいた場合も通知可能。

ただし通知過多を避ける。

Fixed Planほど強い通知にしない。

例：

```text
今なら20分、研究室探しに使えるよ。
```

程度。

---

# 49. Notification Fatigue対策

通知を増やしすぎない。

同じ理由の通知はまとめる。

例：

```text
支度開始
↓5分
メイク開始
↓3分
歯磨き
↓2分
出発
```

と大量通知しない。

Routine Flow実行中はアプリ内誘導を優先。

Pushは主に、

**アプリを開かせる必要がある境界**

に使う。

---

# 50. Push Quiet Hours

睡眠時間中などに不要通知を出さない。

Criticalなもの以外は抑制。

Quiet Hourの初期値はtargetSleepTime等から導出してよい。

---

# 51. Offline / Push Failure

Pushが送れなかったからといってCore Plan等を変更しない。

通知は補助経路。

アプリを開いた時点でNow Engineが現実から再計算する。

---

# 52. Phase 2ではまだ行わないもの

以下は別Phase：

```text
Gmail自動解析
大学メール解析
クレジットカード通知解析
銀行連携
Account / Transfer / Safe-to-Spend
Google Maps route API
GPS常時監視
自動Transit検出
SNSブロック
他アプリ自動起動
Screen Time解析
Health連携
AIによるNext Action生成
AIによるDirection分類
魔法少女戦闘
MP再設計
Projectデータ物理削除
```

---

# 53. schema更新

新field / Entityが必要なら、

```text
schema v6
```

へ更新してよい。

ただし、

```text
v1
↓
v2
↓
v3
↓
v4
↓
v5
↓
v6
```

のmigrationを維持。

Safety Backup必須。

---

# 54. Notification技術データはCore Entityと分けてよい

Push tokenやruntime scheduler stateなど、

ユーザーの生活履歴ではないものを無理にCore Entity Registryへ入れない。

Core Backupを復元したことで、

昔の失効Push tokenまで復元される設計にしない。

---

# 55. Tests — Notification

最低限：

* permission disabled
* subscription登録
* subscription更新
* subscription無効
* dedupe
* Wake通知
* Anchor通知
* Departure通知
* Execution cutoff
* Wind Down
* Quiet Hours
* notification click deep link
* Push失敗時Core状態不変

---

# 56. Tests — Recurring

最低限：

* weekly rule
* weekdays
* daily
* horizon生成
* 同Rule同日非重複
* 別端末相当同時生成
* edited occurrenceを上書きしない
* cancelled occurrence復活防止
* rule変更
* rule無効
* 過去Plan維持

---

# 57. Tests — Future Block

最低限：

* Direction Needなし → 生成しない
* Needあり → 候補
* critical deadline → 生成抑制
* 1日最大数
* Free Window選択
* 重複生成しない
* conflict発生時移動
* 手動編集済みBlockを移動しない
* Free Mode維持

---

# 58. UI Smoke

追加：

* PWA installable
* Notification設定
* Push permission拒否でも正常
* Recurring Rule CRUD
* generated Plan
* edited occurrence
* Direction summary
* Direction policy
* Future Block表示
* Future Blockの手動編集
* Notification deep link

既存41項目も回帰確認。

---

# 59. 完成条件

Phase 2は最低限以下で完了。

* 実Firebase v5安全検証を可能な範囲で行った
* Morning判定から4〜12時固定を除去
* plannedWakeAtベースで起床導線を作れる
* PWA install可能
* Service Workerが存在
* Push subscriptionを安全に保存できる
* Appを閉じても通知可能なserver-side仕組みがある
* Wake通知
* Departure通知
* Anchor通知
* Execution cutoff通知
* Wind Down通知
* notification dedupe
* Recurring Activity Rule CRUD
* Recurring Plan生成
* 生成が冪等
* 手動編集Occurrence保護
* Future Block生成
* Future Block重複防止
* Future Block自動リスケ
* Free Modeを維持
* Direction Actual可視化
* Direction Need理由を確認できる
* Direction保護強度を調整できる
* 既存Now Engineを壊さない
* existing Calendar / Command / Discord / Moneyを壊さない
* typecheck成功
* test成功
* lint成功
* UI smoke成功
* build成功

---

# 60. 完了報告

以下を報告すること。

1. Phase 1実Firebase検証結果
2. runtime lock検証結果
3. Wake判定変更
4. PWA構成
5. Service Worker構成
6. Push技術方式
7. Scheduler方式
8. Device subscription保存方式
9. Notification種類
10. Notification dedupe方式
11. Recurring Rule生成アルゴリズム
12. Occurrence ID方式
13. 手動編集Occurrence保護方法
14. Future Block生成条件
15. Future Block再配置方法
16. Direction Policy
17. Direction可視化
18. schema migration内容
19. 追加テスト
20. 実機 / Browser検証
21. 既知の問題
22. 次Phaseに残したもの

---

# 最重要

Phase 2の本質は通知を増やすことではありません。

目標は、

> **ユーザーがLiflowを思い出さなくても、Liflowのほうが必要な瞬間に生活へ戻ってこられる入口を作ること**

です。

同時に、

> **締切がないという理由だけで専門・進路などの未来方向が生活から消えない**

ようにします。

ただしLiflowが自由時間をすべて予定で埋めることも禁止します。

Liflowはユーザーを常時働かせるシステムではなく、

**必要なものを守ったうえで、迷わず行動したり安心して休んだりできる生活OS**

として実装してください。
