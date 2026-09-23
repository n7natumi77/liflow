# Liflow v0.1 ローカル版

Liflowを自分のPCで起動してテストできる配布版です。ChatGPT Workや公開Siteを開いておく必要はありません。ログインと端末間同期には旧Liflowと同じFirebaseプロジェクトを使用します。

「今日」では当日の予定と実績を別々に確認でき、「計画」では日・週・月を切り替えて編集できます。不正な時間範囲や親タスクの循環は保存前に検出します。端末間でrevisionが競合した更新は古い内容で上書きせず、設定画面で「この端末」と「クラウド」のどちらを残すか選べます。

「今日を整える」では、予定通りのActual作成、実際の時間の入力、やらなかった、不要になった、明日への延期を選べます。予定通りのActual作成と延期はFirestoreトランザクションで処理し、途中までしか保存されない状態を防ぎます。元のPlanは上書きせず履歴として残ります。

設定画面で一日の開始・終了、案内強度、予定切替・出発バッファ、就寝目標、Wind Down時間を変更できます。「今」は固定予定、締切予約、Direction実績、疲労、Morning Flow、就寝時間から次の行動を1件だけ導出します。ActualからPlanへの関連付けと、旧`Plan.actualId`が残るデータの互換リンク解除もFirestoreトランザクションで処理します。`Actual.planId`が正規参照で、1件のPlanへ複数のActualを記録できます。

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

永続Entityは共通registryで管理され、すべて`schemaVersion`を持ちます。旧データは`v1 → v2 → v3 → v4 → v5`の順で段階的に移行します。移行前には`users/{uid}/backups/{backupId}`へ件数・時刻・schemaVersionを記録し、その下へEntity単位のsnapshotを保存します。snapshotの保存完了後にだけmigrationを開始します。設定画面から過去のsnapshotを選んで復元でき、復元直前の状態も自動で別snapshotへ保存します。

schema v4ではTask / Plan / Actualへ任意の`directionId`を追加し、固定IDの初期Direction（学業・専門・進路・生活・世界）を重複なく初期化します。Taskは`nextAction`と`estimatedRemainingMinutes`を保持できます。schema v5では永続化される`executionSession`、時間安全設定、編集可能な初期Morning Flowを追加しました。Session終了は決定的なActual IDを用いるFirestore transactionでActual作成と残時間更新をまとめ、二重終了によるActual重複を防ぎます。既存ProjectとRoutineは推測変換せず、そのまま保持します。

Now Engineは`domain/now-engine.ts`、時間・締切予約は`domain/scheduling.ts`、Direction集計は`domain/directions.ts`、実行・Routine Run遷移は`domain/execution.ts`に分離されています。NowDecision自体は保存せず、Entity集合・現在時刻・設定値から決定論的に再計算します。

移行中にEntityの消失、revision競合、未知の新しいschema、種類別件数の減少を検出した場合は自動更新を停止します。旧データを初期化して捨てる処理はありません。バックアップ内のEntityはクライアントから更新・削除できないFirestoreルールです。

## 今回の不具合修正

- Routine保存時にFirestoreで拒否される`undefined`を送信しない
- Transactionを一覧から編集・tombstone削除できる
- Inbox Itemを編集・整理・削除できる
- Routine Occurrenceを「記録を戻す」で削除でき、Routine本体も削除できる
- Week ViewではPlanとActualを左右に分離し、時間が重なる同種の項目も横方向へ分割する
- Day Viewの同時間帯項目も横方向へ分割する
- 時刻を指定したRoutineを「今」「今日」と日・週カレンダーへ表示する
- Plan / Routine / Actualを日表示で別レーンにし、週表示ではPlanとActualを左右に分ける
- 競合したローカル版とクラウド版を両方保存し、設定画面で選択して解決する
- バックアップ一覧と、確認付きの安全な復元を設定画面へ追加する

## Command Palette

`Ctrl+K`（macOSは`Command+K`）で開きます。候補から通常の入力画面を開くほか、次の確実な形式は共通Command Engineで検証してから保存します。

- `t 物理レポート`：Task
- `p 2026-09-16 18:00 19:00 過去問`：Plan
- `a 2026-09-16 16:00 17:00 図書館で勉強`：Actual
- `m 420 電車`：今日の支出
- `mi 5000 アルバイト`：今日の収入
- `m 2026-05-01 420 交通費`：日付・カテゴリ付き支出
- `mi 2026-05-01 20000 親からもらった現金`：日付・カテゴリ付き収入
- `n`：今

自然文を直接Firestoreへ書き込む処理はありません。Webと外部UIで共通の構造化Command、validation、実行処理を使います。

## Discord

設定画面にDiscord Webhook URLを入力すると、「今」「次」「確認したいもの」の状況をテスト送信できます。送信APIはFirebaseのログイン状態を検証し、Discord公式Webhook以外のURLを拒否します。Webhook URLはFirestoreへ同期せず、その端末のブラウザ内だけに保存します。

Discordからの書き込みには、ローカルで動くBotを使います。Webと同じCommand Engineでvalidationしてから、Firebase上の同じEntity collectionへ保存します。

### Discord Botの準備

1. `.env.discord.example`をコピーして`.env.discord`へ名前を変えます。
2. Discord Developer PortalでBotを作り、`DISCORD_BOT_TOKEN`を設定します。
3. DiscordのDeveloper Modeで自分のUser IDをコピーし、`DISCORD_ALLOWED_USER_IDS`へ設定します。ここにない利用者からの操作は拒否されます。
4. Firebase ConsoleのサービスアカウントJSONをPCへ保存し、その絶対パスを`FIREBASE_SERVICE_ACCOUNT_FILE`へ設定します。
5. Firebase Authenticationで自分のLiflow UIDを確認し、`LIFLOW_FIREBASE_UID`へ設定します。
6. Botを追加したテスト用サーバーのIDを`DISCORD_GUILD_ID`へ設定します。
7. `START_DISCORD_BOT.bat`を開き、その黒い画面をBot利用中は閉じずに残します。

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

## 終了方法

起動時に開いた黒い画面で `Ctrl+C` を押してください。

同じフォルダから二重起動しないでください。`dist`のPermission deniedが表示された場合は、前に起動した画面で`Ctrl+C`を押すか、Windowsを再起動してからもう一度開きます。2回目以降は既存のbuildを再利用します。

## 開発用の確認

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`

Task、Plan、Actualは別々のエンティティとして保存されます。PlanなしActualとTaskなしPlanも保存でき、Planに紐づくActualは`Actual.planId`で複数取得します。削除はデータを即時消去せず、tombstoneとして記録します。
