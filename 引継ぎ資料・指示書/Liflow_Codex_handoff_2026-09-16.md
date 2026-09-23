# Liflow Codex 引き継ぎ資料
更新日: 2026-09-16

## 0. 目的

Liflow の開発を Codex に引き継ぐための資料。

今回の最重要課題は、**既存機能・データ安全性を壊さず、Liflow 本体 GUI を「開きたくなる・触りたくなる魔法少女の電子手帳」に作り直すこと**。

Liflow は単なる Todo / Calendar ではない。

> 生きることの管理を、できるだけこれ一つでできるようにする。

という長期目標を持つ生活 OS である。

---

## 1. 作業対象

ユーザーが最新系列として扱っているのは `Liflow-v0.1-local-firebase-v16` 以降の React / TypeScript 系 Liflow。

ただし、実際に Codex に渡された最新 repo を source of truth とすること。

- `former_Liflow.html` は旧 Liflow の参考資料であり、現在の実装基盤ではない。
- 旧巨大 HTML に戻さない。
- 現行 React / TypeScript / Firebase 系を維持する。
- repo / package / data model / migration / tests を確認してから変更する。
- この資料だけを見てコードを再構築しない。

---

## 2. プロダクト思想

Liflow は、

> 現実の生活を観測し、自分が把握している生活状態と同期させ、次に何をするか決めるための生活 OS。

基本サイクル:

**Capture → Understand → Decide → Act → Observe → Reconcile**

非交渉原則:

- Task ≠ Plan
- Plan ≠ Actual
- 未達成 ≠ 失敗
- 現実を優先する
- 後から修正できる
- 履歴を失わない
- AI / Game / Integration は optional
- Core はそれらがなくても動く
- PC と Mobile を単純縮小で同一 UI にしない
- Liflow のための管理作業を増やすのではなく、Liflow が生活把握を助ける

---

## 3. Domain の意味

### Task
「何をする / 達成するか」。deadline / project / hierarchy / estimate 等を持てるが、実行時刻そのものではない。

### Plan / PlanBlock
「いつやるか」。date + start/end を持つ。1 Task に複数 PlanBlock があってよい。

### Actual / ActualBlock
「実際に何をしたか」。Plan とは別 entity。Actual で Plan を上書きしない。

### Routine
繰り返し生活行動。Task list を recurring instance で埋めない。

### Project
まとまりのある活動・目的の束。親子関係を持てる。

### Calendar Category
大学 / 勉強 / 遊び / バイト / 生活等、時間を横断して見るための大分類・表示レイヤー。Project とは別概念。

### Transaction
収入・支出。Plan / Actual / Project 等とリンク可能。

### 未整理 / Unresolved
失敗一覧ではなく、**現実と Liflow 内の状態がまだ一致していない箇所**。

---

## 4. Calendar Category と Project

統合しない。

Category inheritance の基本:

- Plan explicit → Task → Project → 未分類
- Actual explicit → source Plan → Task → Project → 未分類

履歴の表示が後から変わりすぎないよう、Plan / Actual 作成時点の categoryId は entity に保存する。

Calendar filter は display-only。非表示 category も capacity / Now 判定から消してはいけない。

---

## 5. Calendar 原則

### Day
主要実用画面。
- vertical time axis
- Plan
- Actual
- current-time line
- all-day/container strip
- free gaps
- overlap
- direct manipulation

### Week
PC は 7 日 vertical time grid。
Task を時間へ drag → linked PlanBlock を作る。Task 自体は残る。
Mobile で 7 列を無理に縮小しない。

### Month
大局把握。major Plan / deadline / all-day / period。1 日の表示数は制限し、+N 等を使う。

### All-day / Container
旅行等を 24 時間 capacity 消費として扱わない。

---

## 6. 現在までに実装済みとして確認すべき領域

「未実装」と決めつけず現行コードを確認すること。

- entity CRUD 改善
- Plan 編集 / 削除
- entity-level sync
- migration / data safety
- Calendar Category 編集
- Project hierarchy
- Task hierarchy
- Routine
- Money / Transaction
- 未整理
- Day / Week / Month Calendar
- practical timeline UX
- Command Engine
- Command Palette
- Discord からの一部コマンド操作
- Core data を使った fairy advice

既実装でも bug / incomplete はあり得る。

---

## 7. 現在の優先順位

### 最優先
**GUI / visual / interaction redesign**。

現状は機能に対して無機質すぎる。

本体を開く理由として、
- かわいい
- 見て楽しい
- 触って気持ちいい
- 状態が視覚的に分かる
- 妖精に会いたくなる

を作る。

### 今は優先しない
- Notification 本格実装
- HP / MP
- Battle
- enemy
- level / exp
- 新しい大規模 domain

---

## 8. GUI と CUI / Discord の役割

Discord / Command:
- 高速入力
- 一括操作
- 本体を開かない quick operation

GUI:
- 生活全体を見る
- 今日の流れを見る
- 時間を直接触る
- 状態を理解する
- モチベ維持
- 世界観を楽しむ
- 妖精と接する

よって GUI を過度に「静か」「無装飾」にする必要はない。

---

## 9. Default Theme: Magical Diary

中心コンセプト:

> **2006 年に発売された魔法少女の電子手帳玩具が、20 年後に本気の生活 OS として進化したもの。**

別表現:

> 2000 年代魔法少女の電子手帳玩具 × 平成女児手帳 × 2020 年代の生活 OS

Liflow 自体を、**魔法少女が生活を把握・整理するために使う電子手帳型の魔法道具**として見せる。

以前の「かわいくしすぎず静かに」は過度に適用しない。現状は抑えすぎている。

---

## 10. Magical Diary の素材感

積極的に使ってよい:

- 乳白色プラスチック
- translucent pink / lavender
- pearl
- aurora / iridescent film
- glitter
- jewel / crystal
- chrome / metallic trim
- lace
- ribbon
- star
- heart
- wing
- charm
- sticker / index tab

レースは薄ければ比較的多く使用可。情報本文の上へ高コントラストで被せない。

---

## 11. UI の三層

### Layer 1: 世界 / 筐体
background / frame / nav / emblem / lace / jewel / fairy / decoration

### Layer 2: 操作部
button / tab / toggle / input / modal / calendar control / command palette

### Layer 3: 情報
task / plan / actual / time / date / money / project / long text

要約:

> **外側は魔法少女、操作部は電子玩具、中の情報は実用品。**

---

## 12. 機能名は普通の日本語のまま

非常に重要。

使用:
- 今
- カレンダー
- タスク
- 未整理
- プロジェクト
- ルーティン
- お金
- 予定
- 実績
- 設定
- 保存
- 編集
- 削除

禁止例:
- Task → 使命
- Calendar → 魔導暦
- Project → 冒険
- Money → 魔力通貨
- Home → 拠点

世界観は visual / character / motion で出す。

---

## 13. Theme System

Magical Diary を hard-code しない。

Theme が最低限制御できる余地:
- palette
- typography
- surfaces
- frame
- shape
- icon styling
- decoration
- motion
- character assets
- 将来 sound

将来 Simple / Dark / Cyber / 別 Magical theme / user theme を追加可能にする。

ただし抽象化しすぎて開発を止めない。

---

## 14. Typography

### Display
Liflow / 今、何する？ / 今日 / 9月 等。手書き・丸文字可。

### UI
Task / Plan / Button / Form / Project。読みやすい Gothic / rounded Gothic。

### Data
time / date / money / duration。瞬間認識しやすい sans-serif。

ギャル文字等を生活情報に使わない。

---

## 15. Navigation

Primary:
- 今
- カレンダー
- タスク
- 未整理

Project / Routine / Money / Settings は secondary menu でよい。

PC は generic SaaS sidebar 一辺倒にせず、「電子手帳の index tab」感を検討。
Mobile は bottom nav 可だが Magical Diary の toy button 感を持たせる。

---

## 16. 「今」画面

Liflow のホーム。最も世界観を強く出してよい。

中心:

> **今、何する？**

最低限:
- 日付
- current / next action
- free time
- next event
- today flow
- today Routine
- 少数の unresolved
- fairy advice
- quick capture / command 入口

generic KPI dashboard にしない。

今日の流れは timeline として、「どこが埋まっていて、どこが空いているか」を見せる。

---

## 17. Day Calendar

GUI を使う大きな理由にする。

- vertical time axis
- Plan height = duration
- Actual distinct
- current-time marker
- free gaps
- overlap
- direct manipulation

Plan visual は **「平成女児手帳の予定シール × 電子 UI」**。

Category color は side accent / small tab / translucent background / indicator 等へ使う。

可能な範囲で:
- drag Plan
- move time
- resize duration
- drag empty range → create Plan
- click/tap free space

空き時間 drag 中は「薄いオーロラフィルムを時間軸へ貼る」ような preview を試してよい。

---

## 18. Motion

Motion は GUI の価値の一部。

最初から全 app に数値固定して展開せず、Now / Day で prototype → 触って調整。

通常 motion:
- press → sink
- hover → slightly lift
- grab → lift
- drag → follow
- drop → snap
- open → expand
- close → fold
- delete → reflow

魔法 motion:
- unresolved resolved
- routine completed
- command success
- reconciliation

small sparkle / jewel glow / aurora / tiny stars / fairy reaction 等。

常時すべて動かさない。`prefers-reduced-motion` 対応。

---

## 19. Command Palette

Generic Spotlight にしない。

Magical Diary では「魔法の電子端末の command console」として見せてよい。

Command の処理構造は:

Command → parse → validate → Application / Domain Service → Core write

AI / parser が直接 Firestore を触らない。
Web Command Palette と Discord は同じ Command Engine を共有する方向。

---

## 20. 妖精 / リフちゃん

現在の特殊記号・文字・簡易図形による妖精は完成版として使用しない。

正式な character asset に置き換える。

### デザイン
- 猫型妖精
- white / cream base
- pink / lavender accents
- 額の jewel
- neck ribbon / jewel
- small wings
- fluffy tail
- 2000s 魔法少女アニメの相棒感
- realistic animal ではない
- Jewelpet 的な光沢玩具質感より、**アニメの 2D セル / soft illustration 寄り**
- Precure / まどマギ系マスコットに近い質感方向
- 全表情で目を最大まで開かない

### 表情差分
- normal
- smile / happy
- excited
- thinking
- surprised
- concerned / sad
- sleepy
- proud

通常は落ち着いた目。笑顔は閉じ目も使う。驚き以外で常時ガン開きにしない。

### Pose
将来的に:
- sitting
- walking / following
- flying
- looking up
- curled / sleeping
- turning around
- found something

### UI behavior
「今」では常駐可。
Calendar / Task / Project 等では必要な時だけ edge pop-in / bubble / reaction。

---

## 21. 妖精素材

同時に渡す character sheet:

`a_pastel_anime_character_design_sheet_illustration.png`

主要デザインリファレンスとして使用。

注意:
- AI 生成文字は UI 文言として転記しない。
- character design / silhouette / palette / expression direction を参照。
- `FairyCharacter` 等の component を作り、後から expression asset を差し替えられる構造にする。
- 特殊記号で代替しない。

---

## 22. Magical Diary UI リファレンス

同時に渡す design board:

`a_pastel_kawaii_ui_design_concept_board_style_g.png`

参照:
- shell / frame
- translucent material
- jewel / lace
- Now layout
- Day Calendar
- button / input / modal
- palette
- decorative density
- fairy placement
- component styling

画像内の AI 生成文字は source of truth ではない。現行 Liflow の正しい label / data を使用。

---

## 23. CSS だけで装飾を完結させない

CSS は layout / responsive / theme / state / motion の中心。

ただし以下をすべて gradient / box-shadow 等だけで似せない:
- fairy
- jewel
- lace
- complex ornament
- emblem
- texture
- illustration

必要な visual asset は asset として管理する。

今後 asset 化候補:
- Liflow emblem / logo
- corner jewel
- lace strip
- ribbon divider
- aurora film texture
- subtle glitter texture
- tab decoration
- modal frame corner
- empty-state illustration
- small magical marker
- icon set

一方で UI logic / 文字 / state を画像へ焼き込まない。

---

## 24. 実装順序

全画面を一度に redesign しない。

### Phase 1
1. current repo / architecture 調査
2. Theme infrastructure
3. shared shell / background / navigation
4. FairyCharacter + asset
5. Now
6. Day Calendar
7. shared Button / Input / Modal / Tab
8. Command Palette
9. motion prototype
10. browser 上で実際に触れる状態にする

### Phase 2
方向確認後:
- Week
- Month
- Task
- 未整理
- Project
- Routine
- Money

---

## 25. 既存機能を壊さない

Visual redesign 中も維持:
- CRUD
- entity IDs
- relations
- Task / Plan / Actual separation
- sync
- migrations
- history
- deletedAt / tombstone 等の safety
- Command Engine
- Discord
- Calendar logic
- category logic
- project hierarchy
- routine state
- money linkage

UI のために schema を無断変更しない。必要なら migration を明示する。

---

## 26. Sync / Data Safety

過去に multi-device sync で、一方の欠損状態が deletion として同期され、他端末のデータまで消える重大問題があった。

再発禁止。

基本:
- entity-level docs
- revision
- updatedAt
- updatedBy
- deletedAt / tombstone
- conflict awareness
- schema version
- migration
- backup / snapshot
- destructive change detection

UI redesign で storage 初期化 / 全置換 / 全 delete 等を行わない。

---

## 27. Testing

変更後:
- typecheck
- lint
- build
- existing domain tests
- smoke test

特に Now / Day / Week / Month / Task / Project / Routine / Money / 未整理 / Command Palette の render を確認。

過去に syntax error で複数 view が blank になったことがあるため、build 成功だけでなく画面表示も確認する。

---

## 28. 完成条件

### First impression
普通の SaaS / Todo app ではなく「Liflow という魔法少女の電子手帳」と分かる。

### Interaction
Button / Tab / Plan / Modal が操作へ反応し、GUI を触ることに気持ちよさがある。

### Calendar
かわいくても、何時 / 空き時間 / 現在時刻 / duration / overlap が分かる。

### Fairy
記号ではなく正式な相棒キャラクター。

### Terminology
普通の日本語。世界観用語を覚えなくても操作できる。

### Safety
visual change で data / sync / history を壊さない。

---

## 29. Codex が最初に確認するもの

1. repo structure
2. package.json
3. routes
4. domain types
5. Firestore / local persistence
6. migrations
7. Theme / CSS structure
8. Now
9. Day Calendar
10. Fairy implementation
11. Command Engine
12. Discord integration boundary
13. tests

良い既存 component / logic は再利用する。

---

## 30. 最終方針

Liflow は「機能を増やす」だけの段階ではない。

今回の仕事は、

> **Core の安全性と実用性を維持したまま、Liflow 本体を本当に触りたくなる魔法少女の生活 OS にすること。**

以前の「静かに、控えめに」を最優先しない。
情報の可読性を守りながら Default Theme では世界観をかなり強く出してよい。

一方で、世界観のために domain semantics / 機能名 / sync safety / history を犠牲にしない。

まず **Now + Day + Fairy + shared components** で「見ただけで Liflow」「触って Liflow」と言える状態を作る。
