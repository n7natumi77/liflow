# Liflow vNext Phase 2.5 実装指示書

## Cloudflare Deployment / PWA / Real-device / Firebase / Discord Validation

更新日: 2026-09-25

対象: **Phase 2.45完了後のLiflow vNext / schema v7**

---

# 0. Phase 2.5の位置づけ

Phase 2.45でLiflow本体のCore UX Reconstructionは完了している。

Phase 2.5では、原則として新しいDomain機能や大規模UI再設計を行わない。

今回の目的は、

> **ローカルで完成しているLiflowを、clean clone可能・Cloudflare上で稼働可能・PWAとして実機利用可能・Firebase/Discordを実環境で利用可能な状態へ持っていくこと**

である。

特に以下を重視する。

1. GitHubからclean cloneしてもbuild/deployできる
2. Cloudflare上で本番相当環境が動作する
3. PWAとしてスマホ/PCへInstallできる
4. Firebase同期が実環境・複数端末で壊れない
5. 通知が実機で動作する
6. Phase 2.45で実装済みのDiscord Interaction endpointを実Discordへ接続する
7. Phase 2.45の機能をDeployment作業でRegressionさせない

---

# 1. Phase 2.45を前提とする

以下はすでに実装済みとして扱い、Phase 2.5で一から再実装しない。

* Primary Navigation: 今 / カレンダー / タスク / お金
* Now Cockpit
* Strong / Balanced / Light
* Start Assist改善
* Plan / Actual統合Calendar
* 日 / 週 / 月Calendar
* Task Action
* Plan Calendar Category必須化
* raw Plan Type通常UI削除
* Plan reschedule履歴
* Routine Flow通常UI退役
* Money Category
* Money Method
* Transfer
* Transfer fee
* Category Budget / Budget pace
* Money振り返り
* Application Action境界
* Command Palette
* Command Engine
* Discord Interaction endpoint
* Discord署名検証
* trusted channel
* mutation user allowlist
* Discord通常Channel response
* long message split
* schema v7 migration

Phase 2.5中に実環境でBugが見つかった場合は修正してよい。

ただしDeploymentと無関係な機能追加・UI再設計へ作業範囲を広げないこと。

---

# 2. 最重要ガードレール

Phase 2.5中は以下を守る。

## 2.1 Domain再設計をしない

Deploymentに必要な変更または実機検証で発覚したBug fix以外では、

* Entity構造
* Now Engine
* Task Action semantics
* Plan / Actual semantics
* Money semantics
* Calendar rendering semantics
* Application Actions

を再設計しない。

---

## 2.2 Phase 2.45機能をRegressionさせない

特に以下は必ず維持する。

* Plan / Actual別列へ戻さない
* Task Actionを単一nextActionへ戻さない
* Routine Flowを通常UIへ戻さない
* raw Plan Typeを通常UIへ戻さない
* Money Categoryを自由記述へ戻さない
* TransferをExpenseとして二重計上しない
* GUI / Command / DiscordでDomain処理を重複実装しない

---

# 3. Clean Clone Portability

最初に、ローカル開発環境固有の隠しファイル依存をなくす。

新しい空ディレクトリで、

```text
git clone
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

が成功すること。

---

## 3.1 禁止するProduction依存

以下のような、Repositoryに存在しないローカル専用ファイルへProduction buildが依存しないこと。

例:

* `.openai/hosting.json`
* `.sites-runtime`
* local-only generated config
* 開発マシンだけに存在する絶対Path
* gitignored fileがないと起動できない構造

必要な設定は、

* Git管理される設定
* Environment Variable
* Cloudflare Secret
* Firebase公開設定

等へ整理する。

---

## 3.2 vite.config等の確認

特に`vite.config.ts`およびbuild/deploy scriptを確認し、

「現在の開発環境ではたまたま存在するファイル」

に依存していないことを保証する。

---

# 4. Cloudflare Deployment

GitHub RepositoryをCloudflareへDeployment可能にする。

既存構成に最も自然な、

* Cloudflare Workers
* Pages相当構成
* Wrangler

等を選択してよい。

ただしRepository内の設定だけで再現できること。

---

## 4.1 Wrangler

必要であれば、

* `wrangler.toml`
* `wrangler.jsonc`

等を追加する。

環境依存値は直接commitしない。

---

## 4.2 Runtime Routes

最低限以下がCloudflare本番環境で動作すること。

* Liflow frontend
* Firebaseを利用するclient
* `/api/discord/interactions`
* その他現在存在するAPI route

SPA fallbackとAPI routeが競合しないこと。

---

## 4.3 Production URL

Deployment後、

```text
https://<liflow-domain>/
```

でLiflowが開けること。

以下を直接開いて404にならないことも確認する。

* root
* app route
* API route
* PWA manifest
* service worker関連resource

---

# 5. Environment Variables / Secrets

Cloudflare本番環境で必要な環境変数を整理する。

最低限、実装上必要なものについて、

* Variable名
* public / secret区分
* 必須 / optional
* 設定先

をREADMEまたはDeployment documentへまとめる。

---

## 5.1 SecretをRepositoryへcommitしない

以下をRepositoryへ直接書かない。

* Discord Bot Token
* Discord private credentials
* Firebase Admin秘密鍵
* private webhook secrets
* その他server secret

Cloudflare Secretとして管理する。

---

# 6. Firebase Production Validation

Phase 2.45ではschema v7までローカル検証済みだが、Phase 2.5では**実Firebase credentialを使ってE2E確認**する。

---

## 6.1 基本同期

最低2つの独立Clientで確認する。

例:

* Desktop browser
* smartphone PWA

または

* Browser A
* Browser B / private profile

確認:

1. Client AでEntity作成
2. Client Bへ反映
3. Client Bで編集
4. Client Aへ反映
5. 削除
6. tombstone反映

---

## 6.2 schema v7 Entity

最低限以下を実Firebaseで確認する。

* Task
* Task Action
* Plan
* Actual
* Calendar Category
* Recurring Plan
* Money Transaction
* Money Category
* Money Method
* Transfer
* Budget
* Condition Record
* Settings

---

## 6.3 Migration

旧schema相当データからv7へmigrationするケースを、可能な範囲で実Firebase上でも確認する。

最低確認:

* Task.nextAction → Task Action
* string Money Category → MoneyCategory
* categoryId backfill
* Calendar Category fallback
* defaultCalendarCategoryId
* initial Money Method生成

migrationを再実行しても重複しないこと。

---

## 6.4 Conflict

最低限、

同一Entityを2 Clientで近い時刻に変更した場合について、

* revision
* tombstone
* newer update
* data loss protection

が期待通り動くことを確認する。

完全なCRDT化は今回の対象ではない。

既存同期契約を壊していないことを確認する。

---

# 7. PWA

LiflowをInstallable PWAにする。

すでにPWA基盤がある場合は修正・完成させる。

---

## 7.1 Manifest

最低限:

* name
* short_name
* start_url
* display
* theme_color
* background_color
* icon

を正しく設定する。

---

## 7.2 Icons

PWA iconは必要なsizeを用意する。

Magical Diaryテーマと整合したLiflow iconを使用してよい。

OS上で極端に切れたり、小さすぎたりしないこと。

---

## 7.3 Service Worker

Service WorkerをProductionで正常にregisterする。

最低限:

* app shell
* static assets

について適切なcache戦略を設定する。

---

## 7.4 Update

新version Deploy後、

古いService Workerに永久に固定されないこと。

必要なら、

* update available
* reload

等の軽い導線を用意する。

---

# 8. Offline / Reconnect

完全なOffline-firstアプリ化は必須ではない。

ただし一時的なNetwork断でアプリ全体が破壊されないようにする。

確認:

1. Onlineで起動
2. Offline
3. 既存画面を閲覧
4. 可能な範囲でlocal操作
5. Online復帰
6. Firebase再同期

同期失敗をSilent data lossにしない。

---

# 9. Real-device UI Validation

Browser emulationだけでPhase 2.5を完了しない。

最低1台の実スマートフォンでPWAを確認する。

---

## 9.1 必須画面

実機で最低限確認:

* Now Strong
* Now Balanced
* Now Light
* Calendar Day
* Calendar Week
* Calendar Month
* Task top
* Task detail
* Task Action
* Money
* Money Budget
* Money Category
* Money Transfer
* Direction
* Recurring
* Inbox
* Quick Capture
* Settings

---

## 9.2 実機UX

確認:

* 横overflowなし
* 小さすぎるtap targetなし
* viewport safe area
* keyboard表示でformが隠れない
* modalが画面外へ出ない
* sticky/fixed UIがOS UIと重ならない
* scroll lock不具合なし
* PWA standaloneでもNavigation可能

---

# 10. Execution Session実機確認

実スマホ上で、

1. Activity開始
2. アプリを閉じる
3. 数分後に再度開く
4. 実行中Sessionへ戻る
5. pause
6. resume
7. finish

を確認する。

PlanをActualで上書きしないこと。

複数Actual segmentが維持されること。

---

# 11. Notification Infrastructure

Phase 2.5で実通知を検証する。

Firebase Cloud Messaging等、現在の設計に沿った方法を使用する。

---

## 11.1 Permission

通知Permissionを、

アプリ初回起動直後に無条件要求しない。

ユーザーが通知機能を有効にする文脈で要求する。

---

## 11.2 Token

確認:

* token取得
* 保存
* refresh
* logout / user switch
* invalid token処理

---

## 11.3 Notification Test

最低限:

* foreground
* background
* PWA standalone
* app closed状態で可能な範囲

を確認する。

---

## 11.4 Notification click

通知をtapしたとき、

関連するLiflow画面または対象へ遷移できるようにする。

例:

Plan通知
→ Plan / Calendar

Task deadline
→ Task detail

必要以上に複雑なDeep Link systemを新規構築する必要はない。

---

# 12. Discord — 新規実装ではなくProduction接続

Phase 2.45で以下は実装済み。

* `/api/discord/interactions`
* Ed25519署名検証
* trusted channel
* mutation user allowlist
* query
* mutation
* persistent response
* long output split
* common Command Engine

Phase 2.5ではこれを作り直さない。

目的は、

> **実際のDiscord Developer ApplicationとCloudflare本番endpointを接続してE2E確認すること**

である。

---

# 13. Discord Cloudflare Route

Deployment後、

```text
https://<production-domain>/api/discord/interactions
```

がDiscordから到達可能であること。

確認:

* POST受付
* raw request body保持
* signature verification前にbodyを書き換えない
* Discord timeout内でresponse
* 不正signature拒否

Cloudflare Runtime特有の差で署名検証が壊れないこと。

---

# 14. Discord Developer Portal

これはユーザー側のManual作業が必要になる可能性がある。

Codexは必要な値・手順を具体的に示すこと。

最低限:

* Interaction Endpoint URL
* Public Key
* Application ID
* Bot Tokenが必要な場合の設定箇所
* Command registration方法
* trusted channel ID
* mutation allowed user ID

を明示する。

CodexがPortalへ自動ログインする前提にしない。

---

# 15. Real Discord E2E

実Discord Serverから最低限以下を確認する。

## Query

* 今
* 予定 今日
* 予定 6時間
* 予定 3日
* タスク
* お金 今週
* お金 今月

## Mutation

* Task作成
* Plan作成
* Money expense
* Money income

## Bulk

複数行Command。

---

## 15.1 Persistent history

Responseが通常Channelへ残ること。

Ephemeral-onlyにならないこと。

---

## 15.2 Long output

長い予定一覧等でDiscord API制限を超える場合、

切り捨てず複数Messageへ分割する。

---

## 15.3 Security

実環境で確認:

* trusted channel → query成功
* untrusted channel →拒否
* allowlisted user → mutation成功
* non-allowlisted user → mutation拒否
* invalid signature →拒否

---

# 16. Command / GUI parity

Deployment後も、

GUI / Command Palette / Discord

が共有Application Actionsを使用していること。

Cloudflare対応のためにDiscord側だけ別Domain処理を複製しない。

---

# 17. Quick Capture

PWA standalone実機で、

* Task
* Plan
* Actual
* Money
* Memo

のQuick Captureを確認する。

スマホKeyboard表示時にも操作できること。

---

# 18. Calendar Real-device Validation

特にPhase 2.45で変更が大きかったため重点確認する。

---

## 18.1 Plan / Actual overlay

実データで、

* Planのみ
* Plan + Actual
* early start
* late start
* early finish
* overrun
* Pause / Resume
* running Actual
* PlanなしActual

を確認する。

Plan / Actualが再び別欄表示にならないこと。

---

## 18.2 Compact events

実スマホで、

* 1分
* 2分
* 5分
* 10分
* 30分

のActivityを操作できること。

表示が小さくてもtap targetが十分あること。

---

# 19. Money Real-device Validation

Phase 2.45のMoney modelを本番Firebase/PWAで確認する。

最低限:

* Category selection
* Category追加
* Category改名
* Category統合
* Money Method
* Expense
* Income
* Transfer
* Transfer fee
* weekly Budget
* monthly Budget
* expected expense込みBudget pace
* 振り返り

Transfer本体がIncome/Expense総額へ混入しないこと。

---

# 20. Diagnostics

Production環境で問題調査できる最低限のDiagnostic情報を用意する。

Settings等にDeveloper / Diagnostic領域を置いてもよい。

候補:

* app version
* schema version
* build identifier
* service worker version
* Firebase connection状態
* last sync timestamp
* notification permission
* FCM token存在有無
* Discord config存在有無
* current environment

Secret値そのものは表示しない。

---

# 21. Error UX

Productionで、

* Firebase offline
* auth error
* migration error
* sync conflict
* notification registration failure
* Discord error

が起きてもBlank screenにしない。

ユーザー向けには、

* 何が失敗したか
* データは保存されているか
* 再試行できるか

が分かるようにする。

---

# 22. Bundle warning

Phase 2.45時点でclient chunk 500kB超過warningがある。

これはPhase 2.5のDeployment blockerとはしない。

機能・初回表示性能に重大な問題がない場合、

warningだけを理由にDeploymentを止めない。

ただし簡単かつ安全に改善できる場合は、

* route-based lazy loading
* heavy module dynamic import
* code splitting

等を行ってよい。

この最適化のために大規模なArchitecture変更はしない。

---

# 23. Performance

実機で最低限確認:

* 初回表示が実用範囲
* Navigationで長時間freezeしない
* Calendar scrollが極端に重くない
* Money chartが大量Transactionで破綻しない
* Task一覧が大量Entityで破綻しない

Micro optimizationは不要。

明確なボトルネックだけ修正する。

---

# 24. Security Review

Production前に最低限確認する。

* Secret commitなし
* Discord signature verification
* mutation allowlist
* Firebase Security Rules
* user isolation
* API endpoint authentication
* XSS-safe rendering
* Command text sanitization
* error logにsecretを出さない

---

# 25. Firebase Security Rules

実Firebaseで、

別Userが他UserのLiflow dataへアクセスできないことを確認する。

必要ならRulesをRepositoryで管理する。

Rule変更が必要な場合は、

* 変更内容
* deploy手順
* rollback方法

を記載する。

---

# 26. Production Data Safety

本番データへmigrationをかける前に、

既存のbackup mechanismが働くことを確認する。

Production migration中に異常が起きた場合、

データを空状態で上書きしない。

既存の、

* backup
* data decrease detection
* revision
* tombstone

を維持する。

---

# 27. Codexが実施する範囲

Codex側で可能な限り以下を実施する。

1. Clean clone相当確認
2. Production dependency修正
3. Cloudflare config
4. build/deploy config
5. PWA manifest/service worker
6. Notification code
7. Cloudflare API route compatibility
8. Discord Production endpoint対応
9. Diagnostics
10. Automated tests
11. Browser smoke
12. Deployment documentation

---

# 28. ユーザーのManual作業を分離する

ユーザーが外部Dashboard等で操作する必要があるものは、実装指示の最後に明確にまとめる。

Codex作業と混ぜない。

想定:

## Cloudflare

* account login
* Repository connection
* environment variables
* secrets
* domain設定

## Firebase

* authorized domain
* FCM / messaging設定
* Security Rules deploy
* 必要なcredential確認

## Discord Developer Portal

* Interaction Endpoint URL登録
* Public Key等確認
* Bot/Command設定
* production channel/user ID確認

## Mobile

* PWA Install
* notification permission
* 実機テスト

---

# 29. Manual手順の品質

単に、

「Cloudflareを設定してください」

と書かない。

ユーザーが初見でもできるレベルで、

1. どのDashboardを開くか
2. どこを押すか
3. 何というFieldへ
4. 何の値を入れるか
5. 保存後に何を確認するか

まで書く。

ただしPassword/SecretそのものをReportへ貼らせない。

---

# 30. Automated Test

Phase 2.45の108 testをRegression baselineとして扱う。

既存testを削って通したことにしない。

Phase 2.5用に最低限追加:

* clean build
* production env missing handling
* Discord Cloudflare signature path
* PWA manifest
* service worker registration
* notification registration logic
* production route smoke
* env validation

---

# 31. Browser Smoke

Phase 2.45 smokeに加え、

Production-like serverで以下を確認する。

* PWA manifest
* Service Worker
* frontend routes
* Discord interaction route
* offline fallback
* reconnect
* diagnostics

---

# 32. Deployment Smoke

Cloudflare deployment後に実URLへ対して確認する。

最低限:

* HTTP 200
* Liflow HTML
* JS/CSS load
* manifest
* service worker
* Firebase login
* Firebase read/write
* API route
* Discord endpoint
* no fatal console error

---

# 33. Production E2E Checklist

最終的に最低限この流れを通す。

1. smartphoneでLiflowを開く
2. login
3. PWA install
4. Task作成
5. Task Action追加
6. Plan作成
7. Nowから開始
8. appを閉じる
9. 再度開いてSession復帰
10. pause / resume
11. finish
12. CalendarでPlan / Actual overlay確認
13. Money expense追加
14. Money transfer追加
15. Desktop側へ同期
16. Discordから今日の予定照会
17. Discordからmutation
18. Notification受信
19. offline → reconnect
20. data lossがないことを確認

---

# 34. 今回やらないもの

以下はPhase 2.5の完了条件に含めない。

* Money Safe-to-Spend完成版
* Account残高Accounting
* credit card billing cycle
* long-term financial Forecast
* native mobile app
* native Health連携
* Location trigger
* Screen Time連携
* Routine Flow復活
* HP/MP本実装
* combat/game system
* 大規模な新UI再設計
* 新しいDomain概念の追加

---

# 35. 完了条件

Phase 2.5は以下をすべて満たした時点で完了。

1. clean cloneからbuild成功
2. hidden local fileへのProduction依存なし
3. Cloudflare Production deploy成功
4. Production URLでLiflow起動
5. schema v7 dataが実Firebaseで同期
6. 2 Client間同期確認
7. migrationでdata lossなし
8. PWA Install可能
9. standalone mode利用可能
10. 実スマホで主要画面利用可能
11. Execution Session復帰可能
12. Plan / Actual overlay正常
13. notification実機動作
14. Discord Interaction EndpointがProductionで利用可能
15. 実Discord query成功
16. 実Discord mutation成功
17. trusted channel制限成功
18. mutation user allowlist成功
19. long response分割成功
20. Money v7機能が実Firebaseで動作
21. offline / reconnectで致命的data lossなし
22. Production上でfatal console errorなし
23. Phase 2.45 regressionなし
24. Automated tests成功
25. build成功
26. Manual設定手順が明文化されている
27. 残課題がCompletion Reportに明記されている

---

# 36. Completion Report

完了時、以下をまとめる。

## A. Deployment

* Production URL
* Cloudflare構成
* build/deploy command
* environment構成

## B. PWA

* manifest
* Service Worker
* install test
* tested devices/browser

## C. Firebase

* tested sync scenarios
* migration status
* conflict test
* remaining risks

## D. Notification

* tested platform
* foreground/background result
* unresolved platform limitations

## E. Discord

* Production endpoint
* tested commands
* trusted channel
* allowlist
* long-message behavior
* remaining manual setup

## F. Tests

* typecheck
* unit
* lint
* UI smoke
* build
* production smoke

## G. Manual user steps

未実施のDashboard操作を具体的に一覧化する。

## H. Remaining issues

Phase 2.6以降へ残すものを明記する。

---

# 37. 最終原則

Phase 2.5は、

> 「新しいLiflowを作るPhase」

ではない。

> **Phase 2.45で完成したLiflowを、実際の日常生活で使える場所へ安全に持っていくPhase**

である。

実環境で発見されたBugは直す。

しかし、Deployment中に思いついた新しい機能を追加してScopeを広げない。

まず、

**Cloudflare上で動く
Firebaseで安全に同期する
スマホにInstallできる
通知が来る
Discordから操作できる**

という状態を完成させることを最優先とする。
