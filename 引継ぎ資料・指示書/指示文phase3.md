# Liflow GUI Phase 3 実装指示

## Visual Polish / Interaction / Asset Pass

Phase 2 までで、Magical Diary Theme を

* 今
* Day
* Week
* Month
* Task
* 未整理
* Project
* Routine
* Money

へ一通り展開できました。

ここからは新しい大規模機能を増やす段階ではありません。

今回の目的は、

> **現在の全画面を実際に見比べ、「機能はあるがデザインがまだ仮実装に見える部分」「普通のWebアプリに戻っている部分」「触っていて反応が弱い部分」を潰し、Magical Diaryを完成形に近づけること**

です。

---

# 1. まず保存済みスクリーンショットを全部レビューする

`artifacts/diary/` にある以下の画像を、実装前に必ず確認してください。

* desktop-now
* mobile-now
* desktop-day
* mobile-day
* desktop-week
* mobile-week
* desktop-month
* mobile-month
* desktop-tasks
* mobile-tasks
* desktop-inbox
* mobile-inbox
* desktop-projects
* mobile-projects
* desktop-routines
* mobile-routines
* desktop-money
* mobile-money
* desktop-command
* desktop-modal
* Simple Theme の画面

今回の作業では、コードだけ見てデザイン判断しないでください。

**実際にレンダリングされた画面を見て判断してください。**

---

# 2. 最初にVisual Auditを行う

全画面を並べて、以下を確認してください。

## A. Liflow固有の見た目になっているか

普通の、

* SaaS
* admin dashboard
* generic React app
* Material UI
* Bootstrap
* Tailwind component demo

のように見える部分が残っていないか。

---

## B. Magical Diaryの素材感が存在するか

画面全体で、

* 乳白色プラスチック
* 透明ピンク
* ライラック
* パール
* オーロラ
* 宝石
* レース
* リボン
* シール
* 電子玩具

の質感が十分に出ているか。

単に、

`background: pink`

になっているだけでは不十分です。

---

## C. 画面ごとの差があるか

以下がすべて「タイトル＋角丸カード一覧」になっていないか確認してください。

Week
→ 一週間の手帳

Month
→ 一か月の手帳

Task
→ checklist / index

未整理
→ 整理待ちtray / loose memo

Project
→ binder / folder

Routine
→ daily stamp sheet

Money
→ ledger / household book

それぞれの画面で役割が見た目に現れている必要があります。

---

## D. 共通世界観があるか

画面ごとの差を作りながら、

「別々の7アプリ」

にはしないでください。

すべて、

**同じLiflowという魔法の電子手帳の内部**

に見えるようにしてください。

---

# 3. Visual Auditの結果を実際の修正につなげる

Auditだけを書いて終了しないでください。

発見した問題をそのまま修正してください。

特に優先するのは、

1. genericな部分
2. 情報hierarchyが弱い部分
3. decorationが足りない部分
4. decorationだけ多く情報が読みにくい部分
5. 画面ごとの個性が弱い部分
6. 操作feedbackが弱い部分
7. mobileで窮屈な部分

です。

---

# 4. 「角丸カードを置けば完成」をやめる

現在の画面を確認し、

意味なく大量の白い角丸Cardに分割されている場合は見直してください。

すべての情報をCardへ入れる必要はありません。

利用可能な表現：

* divider
* lace divider
* sticker label
* tab
* index
* ruled paper
* notebook line
* translucent panel
* tray
* folder
* ribbon header
* floating memo
* timeline
* ledger row

など。

Cardは必要な場所だけ使ってください。

---

# 5. Asset Passを行う

Phase 2では既存素材のみを再利用しました。

Phase 3では、

**CSSだけでは表現が弱くなっている装飾について、Magical Diary用assetを追加して構いません。**

候補：

* lace horizontal divider
* lace corner
* jewel corner ornament
* ribbon divider
* small bow
* aurora sheet texture
* pearl surface texture
* subtle glitter overlay
* decorative index tab
* sticker edge
* routine stamp
* unresolved memo decoration
* project folder ornament
* money ledger ornament
* calendar current-time jewel marker
* small star / sparkle variations
* Liflow emblem

すべてを追加する必要はありません。

画面を確認して、**本当に必要なものだけ作る / 使用する**こと。

---

# 6. CSSだけで複雑な装飾を作ろうとしない

特に、

* lace
* jewel
* ribbon
* ornament
* illustration
* fairy
* complex texture

を大量の、

* box-shadow
* pseudo-element
* gradient
* clip-path

だけで無理に再現しないでください。

装飾用画像の方が適切ならassetとして実装してください。

一方で、

* content
* text
* button state
* calendar geometry
* selected state

を画像へ焼き込まないでください。

---

# 7. リフちゃんは現在のassetをそのまま利用してよい

現在の白背景の処理について、実際の画面上で自然に背景が除去・合成できているなら、今回そこを作り直す必要はありません。

問題が見える場合だけ修正してください。

優先すべきなのは、

**リフちゃんがUIの中で「キャラクターとして存在している」こと**

です。

---

# 8. リフちゃんの使い方を見直す

全画面のスクリーンショットを見て、

* 小さすぎる
* 唐突
* UI iconのようになっている
* 同じ表情ばかり
* 吹き出しとの位置関係がおかしい
* 情報を邪魔している

部分があれば修正してください。

基本：

## 今

最も存在感を出してよい。

## 未整理

整理・解消時に比較的出番が多い。

## Routine

実施時の短いreaction。

## Task

完了やPlan化など意味のある時だけ。

## Calendar

常駐不要。

## Project / Money

基本的に控えめ。

---

# 9. Navigationを仕上げる

Navigationが単なる、

「ピンク色にした普通のタブ」

に見える場合は改善してください。

Magical Diaryでは、

**電子手帳の物理index / control panel**

を感じる造形がほしいです。

確認ポイント：

* selected state
* hover
* press
* page transition
* secondary menu
* notification / unresolved count
* mobile bottom nav

選択中のtabが「手前へ出る」感覚を強めて構いません。

---

# 10. Button / Input / Toggleを仕上げる

共通componentについて画面横断で確認してください。

Primary Button：

* 触れそう
* 押せそう
* 電子玩具 / jewel感

Secondary：

* 明確だがPrimaryと競合しない

Input：

* decorativeすぎず入力しやすい
* focus stateが明確

Toggle：

* stateが瞬時に分かる

Checkbox：

* generic browser checkboxのままにしない
* ただし意味が分からなくなるほど装飾しない

---

# 11. Motion Pass

Phase 1 / 2で入れたMotionを、実際に全画面で触って見直してください。

Motionの目的は、

> **何を操作し、その結果何が起きたかを感じられること**

です。

Motionがあるだけでは不十分です。

---

# 12. 優先して確認するMotion

### Navigation

selected tabの移動。

### Plan

grab → drag → snap。

### Task

complete / restore。

### 未整理

resolve。

### Project

fold / unfold。

### Routine

record / skip / undo。

### Money

settled / edit / delete。

### Modal

open / close。

### Command

execute。

---

# 13. Motionの性質

通常操作：

**物理的**

* 沈む
* 浮く
* 滑る
* 開く
* 閉じる
* 吸着する
* 整列する

意味のある節目：

**魔法的**

* small sparkle
* jewel glow
* aurora shimmer
* tiny star
* fairy reaction

としてください。

すべてのclickでparticleを出さないでください。

---

# 14. 「未整理」は特に磨く

未整理はLiflowの設計思想を最も表す画面の一つです。

単なる警告リストに見える場合は修正してください。

方向：

> **まだ置き場所が決まっていない生活の断片を整理するtray**

です。

解消したとき、

「エラーを消した」

ではなく、

**現実とLiflowが一致した**

感じを出してください。

ここは小さなMagic Motionを比較的積極的に使用できます。

---

# 15. Routineは「Stamp Sheet」感を確認する

普通のTask listとの差が十分か確認してください。

Routine実施時には、

「checkboxをONにした」

より、

**今日の欄へstampを押した**

感覚を試してください。

ただしRoutineOccurrence等のdata modelは変更しない。

---

# 16. Projectは「Binder / Folder」感を確認する

nested cardsだけになっている場合は再検討してください。

Project hierarchyについて、

* parent
* child
* current selection
* folded state

を理解しやすくする。

folder tab / index / connector等を利用して構いません。

---

# 17. Moneyは可愛さより読みやすさも確認する

Moneyだけは、

* 金額
* income / expense
* settled / expected
* date

の認識を特に優先してください。

ただし普通のaccounting tableへ戻さない。

**Liflowの電子家計簿**

として仕上げてください。

---

# 18. Calendarの3ビューを並べて調整する

Day / Week / Monthを別々に見るだけでなく、

**3画面を並べて同じCalendar familyに見えるか**

確認してください。

共通すべきもの：

* category visual
* date styling
* Plan styling
* current day
* selected state
* all-day treatment

異なってよいもの：

* density
* decoration
* amount of text
* interaction method

---

# 19. Monthは少し装飾を強めてもよい

Monthは精密操作より俯瞰が中心なので、

Day / Weekより世界観を少し強く出せます。

例えば：

* month title ornament
* faint lace
* seasonal charm area
* small star marker

など。

ただし項目本文が読めなくならない。

---

# 20. Mobileを実際のUIとして再確認する

360px / 390pxでpassしただけでなく、スクリーンショットを人間の目で確認してください。

見ること：

* tap target
* text wrapping
* hidden content
* bottom nav collision
* modal height
* sticky controls
* calendar readability
* unnecessary horizontal compression

desktopを縮めただけに見えるところは修正してください。

---

# 21. Empty Stateを確認する

以下でデータが0件の場合も確認してください。

* Task
* 未整理
* Project
* Routine
* Money

`データがありません`

だけで終わらせない。

軽いMagical Diary visualを使用してよい。

ただし大きなillustrationで操作領域を圧迫しない。

---

# 22. Simple Themeも維持する

Magical Diaryでassetを追加してもSimple Themeを壊さない。

Magical-specific componentをfeature側へ直接埋め込まず、

Theme layerから供給できる構造を維持してください。

Simpleでは、

* ornamentなし
* plain surface
* minimal motion

へ自然にfallbackする。

---

# 23. 今回はDomainを変更しない

Phase 3はvisual / interaction polish。

原則変更しない：

* domain/core.ts
* domain/schema.ts
* domain/commands.ts
* Firebase persistence
* Firestore rules
* Discord Bot
* entity schema

見た目の都合でschemaを変更しない。

---

# 24. 実ユーザー同期テストは別Phase

Phase 2時点で、

* real Firebase login
* multi-device sync
* Discord送信

は未確認です。

これは重要ですが、今回のVisual Polishと混ぜないでください。

Phase 3終了後に、

**Data / Integration Verification Phase**

として別に行います。

---

# 25. Phase 3の成果物

修正前後を比較できるようにしてください。

最低限：

`artifacts/diary/phase3/`

などに、

* desktop-now
* desktop-day
* desktop-week
* desktop-month
* desktop-tasks
* desktop-inbox
* desktop-projects
* desktop-routines
* desktop-money
* mobile-now
* mobile-week
* mobile-month
* mobile-tasks
* mobile-inbox
* mobile-projects
* mobile-routines
* mobile-money
* command
* modal

を保存。

できれば主要Motionについて短いcaptureも残してください。

---

# 26. Phase 3終了時の報告

単に変更ファイル一覧を書くのではなく、

## Visual Auditで見つけた問題

## 実際にどう修正したか

## 新しく追加したasset

## Interaction / Motionで変更した点

## Mobile固有の修正

## Simple Themeへの影響

## 残っている視覚上の課題

を報告してください。

---

# 27. テスト

Phase 1 / 2のテストをすべて維持。

* typecheck
* lint
* domain tests
* UI tests
* build
* smoke

に加え、

全主要screenが実際にrenderされることを確認。

今回assetを増やす場合は、

* missing asset
* broken URL
* layout shift

も確認してください。

---

# 28. 今回の完成条件

Phase 3終了時には、

**どの主要画面を開いても「普通のWebアプリにテーマを当てただけ」には見えない**

状態を目指してください。

同時に、

* CalendarはCalendarとして読みやすい
* TaskはTaskとして操作しやすい
* Project hierarchyが分かる
* Routineが使いやすい
* Moneyの金額が読みやすい
* 未整理の意味が分かる

こと。

最終的に、

> **かわいいから開きたくなる**
>
> **触ったときの反応が気持ちいいからGUIを使いたくなる**
>
> **見れば生活の状態が分かる**

の3つを同時に成立させてください。

---

# 29. 特に重要

今回、安全側に倒して、

「既存の見た目をほぼ変えず、装飾を数個追加しただけ」

で終了しないでください。

Phase 1 / 2で機能的な土台はできました。

Phase 3では、

**デザインの完成度を本気で上げること**

が仕事です。

ただし、情報の可読性や操作性を壊すほど装飾する必要はありません。

実際のスクリーンショットを見ながら、必要なら大胆に直してください。
