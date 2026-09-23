# Liflow vNext Phase 2 完了報告

更新日: 2026-09-23
対象: `Liflow_vNext_Phase2.md`
基準ブランチ: `main`

## 1. Phase 1実Firebase検証結果

**実Firebase検証未実施。** 本番データを破壊試験に使わず、安全に破棄できるテスト用アカウント・複製データ・通知用VAPID鍵・Scheduler用サービスアカウントが提供されていないため、v5実データmigration、Safety Backup / Restore、再ログイン、別ブラウザ相当、多端末transaction、実Push送信は成功扱いにしていない。

ローカルではschema v1→v6 migration、Backupを必須にするmigration plan、ExecutionSession / Actualの冪等処理、UI fixtureによる再読込相当、Firestore transaction実装、Firestore Rules差分まで確認した。

## 2. runtime lock検証結果

`deriveExecutionRuntimeState()`を追加し、runtime lockをExecutionSession Entityから再構築するDerived Stateとした。ログイン準備後とBackup Restore後にlockを自己修復する。

- lockだけ残り参照Sessionがない: completed状態へ修復する。
- Sessionだけ復元されrunning: そのSession IDでlockを再構築する。
- tombstone / completed Sessionを参照: runningとして扱わない。
- 複数running Sessionがある既存異常状態: `startedAt`が最新のSessionをlock対象にする。
- 別端末終了: Session Entityとlockを同一transactionで完了させる。
- 同時開始: user別runtime documentのtransactionで直列化する。

Firestore Rulesへ`users/{uid}/runtime/{runtimeId}`の本人限定read / create / updateを追加した。

## 3. Wake判定変更

Core Logicの固定`4:00〜12:00`判定を削除した。`getWakeWindow()`は次の順で起床候補を決める。

1. 当日のSleepRecord `plannedWakeAt`
2. 当日終了するSleep Planの`endAt`
3. Settingsの`fallbackWakeTime`

候補の60分前から`wakeWindowMinutes`後までだけ起床確認を表示する。午後起床・夜勤型の時刻でも同じロジックで動く。Settingsから次回の`plannedWakeAt`を入力でき、決定的なSleepRecord IDをtransactionでupsertする。

## 4. PWA構成

- `public/manifest.webmanifest`
- standalone表示、name / short name、theme / background color
- 通常用・maskable用SVG icon
- `app/layout.tsx`のmanifest / application metadata
- `public/sw.js`

Service Workerは通常更新時に即座に既存画面を奪わず、`SKIP_WAITING` messageを受けた場合だけ待機解除できる。navigation失敗時はcache済みshellへfallbackする。

## 5. Service Worker構成

Service Workerの責務はinstall / activate、最小shell cache、Push受信、Notification表示、notification click、Nowへのdeep linkに限定した。Now EngineやDeadline / Direction判断は複製していない。

通知clickは既存Liflow windowがあれば`navigate()`してfocusし、なければ新しいwindowを開く。`/?notification=<type>&source=<id>`からNowへ入り、Entityの現在状態で再計算する。

## 6. Push技術方式

Firebase Cloud Messaging Web Pushを採用した。ユーザー操作でNotification permissionを要求し、公開VAPID鍵と明示的に登録したService WorkerからFCM tokenを取得する。Permission拒否、非対応、公開鍵未設定でもCore機能は継続する。

サーバー送信はFCM HTTP v1を使用する。Scheduler側でサービスアカウントJWTをWeb Cryptoで署名し、短期OAuth tokenを取得する。秘密鍵やtokenはクライアントbundle・Core Entity・Gitへ入れない。

## 7. Scheduler方式

`workers/notification-scheduler.ts`をCloudflare Scheduled Workerとして分離し、`wrangler.notifications.jsonc`で5分cronを定義した。

処理は次の順で行う。

```text
due notificationJobs取得
→ Firestore updateTime precondition付きclaim
→ enabled deviceへFCM送信
→ sentAt記録
```

送信失敗時はJobをpendingへ戻すだけで、Task / Plan / Actualを変更しない。Cloudflare dry-run bundleは成功したが、credentialなしのため実deployと実cron発火は未実施。

## 8. Device subscription保存方式

`users/{uid}/devices/{deviceId}`へ次を保存する。

- deviceId
- FCM token
- platform
- createdAt / updatedAt / lastSeenAt
- enabled

同一端末の再登録ではcreatedAtを維持してtokenとlastSeenAtを更新する。通知全体OFF時はtoken削除を試み、device documentをdisabledにする。Core Backup / Restoreの対象外とした。

## 9. Notification種類

- Wake: `おはよう。起きた？`
- Morning: departureとMorning Flow残時間から支度開始を案内
- Anchor: Fixed Planの15分前
- Departure: 推奨出発の10分前
- Execution cutoff: 次Anchorのtransition boundary 5分前
- Wind Down: targetSleepTimeから逆算。critical deadlineがある場合は残作業を明記

Wake / Wind Downは最大45日分、既存Fixed / Travel Planも45日horizonでJob化する。同種の細かなRoutine step通知は作らない。Quiet Hours中はWake / Wind Down以外をJob化しない。

## 10. Notification dedupe方式

用途・対象・日付またはoffsetからdedupe keyを作る。

- `wake:uid:localDate`
- `anchor:planId:15min`
- `departure:planId:10min`
- `execution:sessionId:anchorId`
- `winddown:uid:localDate`

dedupe keyをhashした安定document IDで`notificationJobs/{id}`へ保存する。クライアント同期時の重複を防ぎ、Scheduler側でもFirestore document version付きclaimによりcron重複実行を抑止する。送信済みJobは再度pendingへ戻さない。

## 11. Recurring Rule生成アルゴリズム

`domain/recurrence.ts`で、active Ruleごとに今日から未来45日を走査し、`daily / weekdays / weekends / weekly`を判定する。発生日のlocal timeとdurationからPlanを作る。Rule無効化・曜日変更・Rule削除時は未来の未編集generated Planだけをcancelし、過去Planは維持する。

Rule UIではタイトル、曜日、開始時刻、所要時間、Category、Direction、Plan Type、Flexibility、有効 / 無効を編集・tombstone削除できる。

## 12. Occurrence ID方式

Occurrence keyは`ruleId:localDate`、Plan IDは`recurring_<safeRuleId>_<YYYY-MM-DD>`とした。別端末が同時生成しても同じFirestore documentへ到達する。transactionで既存documentを先に読み、存在すれば新規作成しない。

## 13. 手動編集Occurrence保護方法

生成Planは`source=recurring`、`generationState=generated`を持つ。通常のPlan編集経路を通った時点で`overridden`に変更する。ユーザーcancelは`cancelled`にする。

再生成・Rule変更・Rule無効化は`generated`だけを更新対象にし、`overridden`、`cancelled`、tombstone、過去Planを上書き・復活させない。

## 14. Future Block生成条件

- Direction Needがある。
- 初期対象は専門・進路を優先する。
- そのDirectionにOpen Taskがある。
- critical deadlineがない。
- 当日の安全なFree Windowが15分以上ある。
- 1日最大1件。
- 15〜45分、初期推奨25分。

TaskがないDirectionは文章を自動生成せず、「この方向のOpen Taskが最近ありません」とDirection UIへ事実表示する。生成Planは`source=futureBlock`、`protection=soft`、`flexibility=flexible`を持つ。

## 15. Future Block再配置方法

生成済みBlockを容量計算から一時的に外し、現在のFixed / flexible Planに重なるか再評価する。重なった未編集generated Blockだけを次の安全なFree Windowへ移動する。実行中Block、競合のないBlock、`overridden` Blockは移動しない。critical deadline発生時は開始前のgenerated Blockをcancelする。

安定IDは`future_block_<localDate>_<directionId>`で、Now再計算や複数端末から同日同DirectionのBlockが増殖しない。

## 16. Direction Policy

初期値は次のとおり。

- 学業: 弱く守る
- 専門: 強く守る
- 進路: 強く守る
- 生活: 保護しない（生活ロジック側を優先）
- 世界: 生産性保護なし

SettingsにはDirection別の`off / weak / strong`と内部のmaxGapDays / targetMinutesを保存できる。Now EngineとFuture Blockは同じPolicy変換を使う。

## 17. Direction可視化

Now補助エリアに全Directionの直近7日・14日のActual実時間、最後の実行からの日数、Need理由、Open Task不在を表示する。割合だけ、善悪評価、ブラックボックスscoreは表示しない。各カードで保護強度を変更できる。

## 18. schema migration内容

`CURRENT_SCHEMA_VERSION`を6へ更新し、v1→v2→v3→v4→v5→v6を維持した。

Plan追加field:

- source
- generationState
- recurringRuleId
- recurrenceKey
- futureBlockDirectionId
- protection

Settings追加field:

- fallbackWakeTime / wakeWindowMinutes
- 通知全体と種類別ON / OFF
- directionPolicies

既存payload、revision、tombstone、全Entity IDと種類別件数を維持し、migration前Safety Backupを必須とする。

## 19. 追加テスト

- plannedWakeAt / Sleep Plan / fallback / 午後起床
- runtime lockの欠損・stale・tombstone・Session正規化
- subscription登録・更新・無効化
- 通知全OFF、全通知種類、45日事前Job、dedupe、Quiet Hours、deep link、Push失敗時Core不変
- recurring daily / weekdays / weekends / weekly、horizon、安定ID、同時生成相当
- edited / cancelled保護、Rule変更、無効化、削除、過去維持
- Future BlockのNeed、critical抑制、Free Window、1日最大数、重複防止、競合移動、開始中維持、手動編集保護、Free Mode
- schema v5→v6 defaultと連続migration

Domain / unit回帰は合計93件成功した。

## 20. 実機 / Browser検証

- Edge headless UI smoke: 51項目成功
- 未捕捉browser error: 0
- 360px / 390px horizontal overflow: なし
- PWA Manifest / icons / Service Worker: browser fetchとproduction HTTPで確認
- Permission拒否後の継続動作: 確認
- Recurring CRUD → Plan生成 → manual override: 確認
- Direction summary / Policy: 確認
- Future Block表示 / manual override: 確認
- Notification deep link → Now再計算: 確認
- Cloudflare Scheduler: wrangler dry-run bundle成功
- `npm.cmd run typecheck`: 成功
- `npm.cmd run lint`: 成功
- `npm.cmd test`: 93件成功
- `npm.cmd run test:ui`: 51項目成功
- `npm.cmd run build`: 成功
- production root / manifest / sw: HTTP 200

物理スマートフォンへのPWA install、OS通知表示、background Push、FCM HTTP v1実送信はcredential未設定のため未検証。

## 21. 既知の問題

- 実Firebase v5→v6 migration、Backup / Restore、多端末競合、Firestore Rules反映後の実動作は未検証。
- VAPID鍵、FCM API、サービスアカウント、Cloudflare secret、公開APP_ORIGINの設定とScheduler deployが必要。
- iOS / Android / desktop各OSの通知UI・省電力制限・permission再許可導線は未検証。
- Jobは最大45日先まで事前生成する。45日を超えて一度もLiflowを開かない場合の継続Job補充は未実装。
- 送信済みtechnical Jobの長期cleanup / TTL運用設定は未実装。
- Direction Policyの詳細数値はschemaで保持できるが、UIは意図的に3段階だけ表示する。
- Future Blockは外部カレンダー、交通API、位置情報を使用しない。
- buildには`module.register()`非推奨警告と500kB超chunk警告が残る。

## 22. 次Phaseに残したもの

1. 破棄可能なFirebase環境でv5→v6 migration、Rules、Backup / Restore、同時Session、同時Occurrence生成を検証する。
2. Firebase VAPID / service accountとCloudflare secretsを設定し、Schedulerをdeployして実端末Pushを確認する。
3. notificationJobsへFirestore TTLを設定し、送信済みtechnical stateを自動cleanupする。
4. iOS Safari、Android Chrome、desktop Edge / Chromeでinstall・background delivery・click・token refreshを確認する。
5. Scheduler自体が45日horizonを補充できる構成、または安全なserver-side recurrence materializationを検討する。
6. Gmail、大学メール、金融、Maps / GPS、Health、AI分類・AI Next Actionは引き続き別Phaseとする。

Phase 2のローカル実装範囲では、アプリを閉じていても使える通知入口、冪等な定期予定、締切のない未来方向を弱く守るPlan、事実ベースのDirection可視化を追加し、Free Modeと既存Now / Calendar / Command / Discord / Moneyの回帰を維持した。
