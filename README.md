# Liflow v0.1 ローカル版

Liflowを自分のPCで起動してテストできる配布版です。ChatGPT Workや公開Siteを開いておく必要はありません。ログインと端末間同期には旧Liflowと同じFirebaseプロジェクトを使用します。

「カレンダー」ではPlanの形の中へ紐づくActualを重ね、日・週・月を切り替えて確認できます。不正な時間範囲や親タスクの循環は保存前に検出します。端末間でrevisionが競合した更新は古い内容で上書きせず、設定画面で「この端末」と「クラウド」のどちらを残すか選べます。

「今日を整える」では、予定通りのActual作成、実際の時間の入力、やらなかった、不要になった、明日への延期を選べます。予定通りのActual作成と延期はFirestoreトランザクションで処理し、途中までしか保存されない状態を防ぎます。元のPlanは上書きせず履歴として残ります。

設定画面で一日の開始・終了、案内強度、予定切替・出発バッファ、就寝・起床候補、Wind Down時間を変更できます。「今」は固定予定、締切予約、疲労、就寝時間から次の行動を1件だけ導出します。ActualからPlanへの関連付けと、旧`Plan.actualId`が残るデータの互換リンク解除もFirestoreトランザクションで処理します。`Actual.planId`が正規参照で、1件のPlanへ複数のActualを記録できます。

Phase 2ではPWA、通知境界、繰り返し予定、Future Block、Direction実績表示を追加しました。起床確認は固定の午前判定ではなく、当日の`plannedWakeAt`、Sleep Plan、設定した通常の起床候補の順で決まります。繰り返し予定は未来45日だけを安定IDで生成し、手動編集した予定をRuleで上書きしません。Future Blockは専門・進路の不足とOpen Taskが揃い、criticalな締切がない安全な空き時間にだけ1日最大1件作ります。

Phase 2.4ではProjectと旧Routineを通常UIから退役させ、既存データだけを互換保持します。「この作業は終わった」「Taskも完了」「いったん止める」を区別し、Pause後の再開では同じPlanへ複数のActualを残せます。Early Startは安全な未来Planだけを実時刻から開始し、元のPlan時刻を変更しません。

Phase 2.45ではPrimary Navigationを「今・カレンダー・タスク・お金」に整理し、Routine Flowを通常UIから退役させました。Task Action、必須のCalendar Category、Plan/Actual統合Activity、Start Assistの一時除外、Money Category・支払方法・振替・週/月予算を追加しています。旧Entityは削除せず互換保持します。

## 必要なもの

- Node.js 22以上（LTS版推奨）
- Windows 10/11、macOS、またはLinux

## 起動方法

1. ZIPを展開します。
2. Windowsは `START_LIFLOW.bat`、macOSは `Liflowを起動.command` を開きます。
3. 初回のみ必要なファイルの準備に数分かかります。
4. ブラウザで <http://127.0.0.1:8787> を開きます。

ZIPの中から直接起動しないでください。WindowsではZIPを右クリックして「すべて展開」してから、展開先の `START_LIFLOW.bat` を開きます。起動に失敗しても画面は閉じず、エラー内容が画面に残ります。

Node.jsをインストールした直後に「見つかりません」と表示された場合は、Windowsを一度再起動してください。ランチャーは通常のインストール先も自動で確認します。

Node.js 26を含む新しいWindows版でも、npmだけをWindowsシェル経由で起動し、空白を含むNode.jsのパスは直接処理します。

ターミナルから起動する場合は、このフォルダで `npm run local` を実行してください。

## アカウントと同期

メールアドレスとパスワードで登録・ログインします。データは`users/{uid}/entities/{entityId}`へ項目単位で保存され、同じアカウントの端末間で同期されます。

各項目には`revision / createdAt / updatedAt / updatedBy / deletedAt`があり、削除も即時消去ではなくtombstoneとして同期します。Firestoreのブラウザキャッシュも有効なので、接続が一時的に切れても表示済みデータは保持されます。

Firebase ConsoleではAuthenticationの「メール/パスワード」を有効にし、`firebase/firestore.rules`のルールをFirestoreへ設定してください。旧LiflowのFirebase設定値はそのまま同梱されています。

この版ではバックアップ保存先を追加しているため、同梱の`firebase/firestore.rules`をFirebase ConsoleのFirestore Database → ルールへ反映してから、初回ログインしてください。旧ルールのままバックアップを作れない場合、Liflowは移行を開始せずエラーを表示します。

## Schemaとバックアップ

永続Entityは共通registryで管理され、すべて`schemaVersion`を持ちます。旧データは`v1 → v2 → v3 → v4 → v5 → v6 → v7`の順で段階的に移行します。移行前には`users/{uid}/backups/{backupId}`へ件数・時刻・schemaVersionを記録し、その下へEntity単位のsnapshotを保存します。snapshotの保存完了後にだけmigrationを開始します。設定画面から過去のsnapshotを選んで復元でき、復元直前の状態も自動で別snapshotへ保存します。

schema v4ではTask / Plan / Actualへ任意の`directionId`を追加し、固定IDの初期Direction（学業・専門・進路・生活・世界）を重複なく初期化します。Taskは`nextAction`と`estimatedRemainingMinutes`を保持できます。schema v5では永続化される`executionSession`、時間安全設定、編集可能な初期Morning Flowを追加しました。schema v6ではPlanへRecurring / Future Blockの生成元と編集保護状態、SettingsへWake・通知・Direction Policyを追加しました。Phase 2.4もschema v6のままで、Session終了時の`activityCompleted` / `paused`を互換的な任意フィールドとして保存します。schema v7ではTask Action、Money Category、Money Method、Transfer、Budgetを追加し、Calendar CategoryのないPlanへfallbackを設定します。旧`Task.nextAction`と文字列Money Categoryは、元データを残したまま決定的IDで一度だけ移行します。終了処理は決定的なActual IDを用いるFirestore transactionでActual作成と残時間更新をまとめ、二重終了によるActual重複を防ぎます。既存Project・旧Routine・RoutineOccurrence・Routine Flow・Parent Task関連は推測変換せず、そのまま保持します。

Now Engineは`domain/now-engine.ts`、時間・締切予約は`domain/scheduling.ts`、Direction集計は`domain/directions.ts`、実行・Routine Run遷移は`domain/execution.ts`に分離されています。Phase 2のWake Window、通知、繰り返し生成、Future Blockもそれぞれ`domain/wake.ts`、`domain/notifications.ts`、`domain/recurrence.ts`、`domain/future-blocks.ts`へ分離しました。NowDecision自体は保存せず、Entity集合・現在時刻・設定値から決定論的に再計算します。

移行中にEntityの消失、revision競合、未知の新しいschema、種類別件数の減少を検出した場合は自動更新を停止します。旧データを初期化して捨てる処理はありません。バックアップ内のEntityはクライアントから更新・削除できないFirestoreルールです。

## PWAとPush通知の配備

`public/manifest.webmanifest`と`public/sw.js`によりインストール可能なPWAとして動作します。通知許可はログイン直後には求めず、設定画面の説明付きボタンからだけ要求します。拒否時もNowやCalendarは通常どおり使えます。

Web PushはFirebase Cloud Messagingを利用します。`.env.notifications.example`を参考に公開VAPID鍵を`NEXT_PUBLIC_FIREBASE_VAPID_KEY`へ設定し、Firebase ConsoleでWeb Push certificateとFCM HTTP v1 APIを有効にします。端末tokenはCore EntityやBackupではなく`users/{uid}/devices/{deviceId}`へ保存します。

通知Schedulerは`workers/notification-scheduler.ts`をCloudflare Scheduled Workerとして分離し、`wrangler.notifications.jsonc`で5分ごとに実行します。次の値をCloudflare側へ登録してから配備します。サービスアカウント秘密鍵をGitへ追加しないでください。

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
APP_ORIGIN
```

配備例：

```text
npx wrangler secret put FIREBASE_PROJECT_ID --config wrangler.notifications.jsonc
npx wrangler secret put FIREBASE_CLIENT_EMAIL --config wrangler.notifications.jsonc
npx wrangler secret put FIREBASE_PRIVATE_KEY --config wrangler.notifications.jsonc
npx wrangler secret put APP_ORIGIN --config wrangler.notifications.jsonc
npx wrangler deploy --config wrangler.notifications.jsonc
```

通知Jobは`notificationJobs/{dedupeId}`へCore Entityとは分離して保存します。SchedulerはFirestore document versionを条件にJobをclaimし、重複cronの二重送信を抑止します。Push失敗時はJobを再試行可能に戻し、Task / Plan / Actualを変更しません。

## 主な実装内容

- Projectのナビ・一覧・新規作成・各入力欄・フィルターを通常UIから削除し、旧関連IDは編集時も保持する
- 旧RoutineとRoutineOccurrenceの新規生成を停止し、Routine画面をRecurring Activity RuleとRoutine Flowへ整理する
- Task入力は名前と締切を中心にし、Next Action・残り見積・カレンダー・Directionを詳細欄へまとめる
- Nowの案内強度をstrong / balanced / lightで分け、Free Modeを維持する
- Activity終了結果、Early Start、Pause/Resume、Task完了の原子的更新を実装する
- Start Assistで心理的な取りかかりにくさと、場所・待ち・時間不足などの一時的な実行不可を分ける
- Day / Weekの短時間Plan・Actualを、正確な時間位置と44px操作領域を両立するコンパクト表示にする
- Transactionを一覧から編集・tombstone削除でき、旧Project関連は編集しても保持する
- 競合したローカル版とクラウド版を両方保存し、設定画面で選択して解決する
- バックアップ一覧と、確認付きの安全な復元を設定画面へ追加する

## Command Palette

`Ctrl+K`（macOSは`Command+K`）で開きます。候補から通常の入力画面を開くほか、次の確実な形式は共通Command Engineで検証してから保存します。

- `t 物理レポート`：Task
- `p 2026-09-16 18:00 19:00 過去問`：Plan
- `a 2026-09-16 16:00 17:00 図書館で勉強`：Actual
- `m 420 電車`：今日の支出
- `mi 5000 アルバイト`：今日の収入
- `m 2026-09-20 220 越中宮崎→泊 --category 交通費`：日付・明細・カテゴリ付き支出
- `m 2026-09-18 159 Suica物販 --category その他`：その他カテゴリの支出
- `mi 2026-05-01 20000 親からもらった現金 --category その他`：日付・明細・カテゴリ付き収入
- `n`：今

自然文を直接Firestoreへ書き込む処理はありません。Webと外部UIで共通の構造化Command、validation、実行処理を使います。

## Discord

設定画面にDiscord Webhook URLを入力すると、「今」「次」「確認したいもの」の状況をテスト送信できます。送信APIはFirebaseのログイン状態を検証し、Discord公式Webhook以外のURLを拒否します。Webhook URLはFirestoreへ同期せず、その端末のブラウザ内だけに保存します。

Discordからの書き込みには、ローカルで動くBot、または配備後の`/api/discord/interactions`を使います。どちらもWebと同じCommand EngineとApplication Action境界でvalidationしてから、Firebase上の同じEntity collectionへ保存します。読み取りは`DISCORD_TRUSTED_CHANNEL_IDS`、変更はそれに加えて`DISCORD_ALLOWED_USER_IDS`で制限します。

### Discord Botの準備

1. `.env.discord.example`をコピーして`.env.discord`へ名前を変えます。
2. Discord Developer PortalでBotを作り、`DISCORD_BOT_TOKEN`を設定します。
3. DiscordのDeveloper Modeで自分のUser IDをコピーし、`DISCORD_ALLOWED_USER_IDS`へ設定します。ここにない利用者からの操作は拒否されます。
4. 利用するChannel IDを`DISCORD_TRUSTED_CHANNEL_IDS`へ設定します。
5. Firebase ConsoleのサービスアカウントJSONをPCへ保存し、その絶対パスを`FIREBASE_SERVICE_ACCOUNT_FILE`へ設定します。
6. Firebase Authenticationで自分のLiflow UIDを確認し、`LIFLOW_FIREBASE_UID`へ設定します。
7. Botを追加したテスト用サーバーのIDを`DISCORD_GUILD_ID`へ設定します。
8. `START_DISCORD_BOT.bat`を開き、その黒い画面をBot利用中は閉じずに残します。

サービスアカウントJSON、Bot Token、`.env.discord`は他人へ送ったりGitへ追加したりしないでください。

利用できるSlash Command：

- `/n`：今と次の予定
- `/t name:`：Task追加
- `/p name: start: end: date:`：Plan追加。date省略時は今日
- `/a name: start: end: date:`：Actual追加。date省略時は今日
- `/m amount: name: kind: date: category: note:`：収支追加。メモは省略可
- `/x commands:`：複数コマンドを改行または`;`で区切って一括追加

`/x`の入力例：

```text
t 物理レポート
p 2026-09-16 18:00 19:00 過去問
m 420 電車
m 2026-05-01 16000 歯医者 --note 抜歯代、矯正の診察代
```

WebのCommand Paletteでも同様に、改行または`;`で複数件を並べられます。Liflow独自の件数制限はありません。全行を保存前に検証し、1行でも解釈できない場合は何も保存しません。Firestore側の上限を超える件数は、内部で400件ずつに分割して保存します。Discordから入力する場合はDiscord自体の入力文字数上限を受けます。

Discordが貼り付け時の改行を空白へ変えた場合も、`/m`や`/mi`など次のSlash Commandを境界として分割します。

Botは許可済みDiscord User IDだけを受け付けます。Firestoreへは`revision / createdAt / updatedAt / updatedBy / deletedAt`を含む通常のCore Entityとして保存するため、Web側へそのまま同期されます。

Interaction endpointを利用する場合は、Discord Developer PortalのInteractions Endpoint URLへ公開URLの`/api/discord/interactions`を設定し、配備先Secretへ`DISCORD_PUBLIC_KEY`、`DISCORD_TRUSTED_CHANNEL_IDS`、`DISCORD_ALLOWED_USER_IDS`、`LIFLOW_FIREBASE_UID`、`FIREBASE_SERVICE_ACCOUNT_JSON`を登録します。署名が不正なリクエストは保存処理より前に拒否されます。Phase 2.45ではendpoint実装までが対象で、Cloudflareへの実配備はPhase 2.5で行います。

## 終了方法

起動時に開いた黒い画面で `Ctrl+C` を押してください。

同じフォルダから二重起動しないでください。`dist`のPermission deniedが表示された場合は、前に起動した画面で`Ctrl+C`を押すか、Windowsを再起動してからもう一度開きます。2回目以降は既存のbuildを再利用します。

## 開発用の確認

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run test:ui`

Task、Plan、Actualは別々のエンティティとして保存されます。PlanなしActualとTaskなしPlanも保存でき、Planに紐づくActualは`Actual.planId`で複数取得します。削除はデータを即時消去せず、tombstoneとして記録します。
