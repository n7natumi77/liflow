# Phase 2.4 追加指示

## Short Duration Calendar Rendering

Calendarの日・週時間軸で、短時間のPlan / Actualが読めない・操作できない問題を修正する。

### 1. 問題

現在は予定時間に比例した高さのBlockを描画しているため、

```text
5分
2分
1分
```

等の短いActivityでは、

* 時刻文字がBlockからはみ出す
* タイトルが読めない
* 1分程度ではクリック / タップが困難
* mobileでは実質操作不能

となる。

時間軸上の正確さを保つために、可読性・操作性を犠牲にしないこと。

---

### 2. 2種類の表示形式を用意する

Calendar itemを、

```text
block
compact
```

の2形式で描画する。

---

### 3. Block表示

十分な高さがあるPlan / Actualは従来どおりBlock表示。

例：

```text
┌──────────────┐
│ 13:00–14:00  │
│ 物理実験     │
└──────────────┘
```

。

---

### 4. Compact表示

Block内部に、

```text
時間
タイトル
```

を安全に表示できない高さの場合、無理に長方形を作らない。

代わりに、

```text
● 13:05–13:10 薬を飲む
```

のような1行表示にする。

構成：

```text
color marker
time
title
```

。

---

### 5. 色

左側の丸・dotには通常Blockと同じCalendar Category colorを使用。

Plan / Actualの区別も現在の視覚規則を維持する。

必要なら、

```text
Plan = filled dot
Actual = ring / alternate marker
```

等で区別可能。

既存Themeと調和させる。

---

### 6. Compact判定

単純に、

```text
duration <= 5min
```

だけで固定しない。

実際のCalendar scaleから算出した、

```text
renderedHeight
```

と、

```text
必要な文字・padding高さ
```

を比較する。

概念上：

```text
if renderedHeight < normalBlockMinimumContentHeight:
    compact
else:
    block
```

。

これにより、

* Day
* Week
* PC
* mobile

で適切に切り替わる。

---

### 7. Threshold

実装上必要なら定数化する。

例：

```text
NORMAL_BLOCK_MIN_HEIGHT_PX
COMPACT_ROW_HEIGHT_PX
MIN_HIT_TARGET_PX
```

。

magic numberを複数Componentへ散らさない。

---

### 8. 時間軸位置は正確にする

Compactになっても、

**予定開始位置そのものを別時刻へずらさない。**

色dot等のanchorはPlan / Actualの実際のstartAt位置に置く。

表示だけ読みやすくする。

---

### 9. 見た目の高さと操作領域を分離する

1分Planが時間軸上では数pxしかなくても、

click / tap targetまで数pxにしない。

視覚上のmarkerとは別に、安全なhit areaを持たせる。

最低でも既存UIのbutton操作と同等の操作性を確保する。

mobileでは特にタップしやすくする。

---

### 10. Hit Areaで時間表現を歪めない

Hit areaを大きくするために、

1分Planを視覚上30分Planのような巨大Blockにしてはいけない。

```text
visual position / duration
```

と、

```text
interactive hit target
```

を分離する。

---

### 11. Compact内容

基本：

```text
● HH:MM–HH:MM タイトル
```

。

非常に短時間なら、

```text
● HH:MM タイトル
```

でもよい。

ただし終了時刻を省略する基準は統一する。

---

### 12. 一行で入りきらない場合

タイトルは1行ellipsisでよい。

例：

```text
● 10:25–10:30 実験室に資料を持って…
```

。

詳細はclick / tap後のModalで確認できる。

---

### 13. Tooltip / accessible label

Desktopでは必要に応じてtitle / tooltip。

aria-labelには必ず、

```text
タイトル
開始時刻
終了時刻
Plan / Actual種別
```

が判別可能な情報を持たせる。

---

### 14. 複数の短時間予定

近接したCompact itemがある場合、

```text
10:00–10:02
10:03–10:05
10:05–10:06
```

などが文字ごと重ならないようにする。

必要なら短時間item同士を、

```text
compact lane
```

として縦方向へstackする。

時間軸のanchor位置は保持する。

---

### 15. Overlap

同時刻に複数Plan / Actualがある場合、

既存のoverlap layoutと統合する。

Compact表示になったからといって別itemを覆ってclick不能にしない。

---

### 16. Plan / Actual双方へ適用

PlanだけでなくActualにも同じ問題があるため、

```text
Day Calendar
Week Calendar
Plan
Actual
```

へ共通ルールを適用する。

---

### 17. Month表示

Monthは時間比例Blockではないため、今回の対象外でよい。

---

### 18. Today Flow

Now画面内の「今日の流れ」でも極端に短いActivityが操作不能になる場合、同じcompact principleを適用する。

ただしDay / Week Calendarと無理に同一Component化する必要はない。

表示規則は統一する。

---

### 19. Tests

最低限確認する。

```text
60分
30分
10分
5分
2分
1分
```

のPlan。

さらに、

* Plan / Actual
* 同時刻overlap
* 連続する1〜5分Activity
* PC week
* PC day
* 390px mobile
* 360px mobile

を確認。

---

### 20. 完成条件

1分Planでも、

* 存在が分かる
* 時刻が分かる
* タイトルが読める
* クリック / タップできる
* 正しい詳細Modalを開ける

こと。

### 最重要

Calendarは時間の長さを正確に表す必要があるが、

> **短いActivityほど存在しないように見える**

UIにしてはいけない。

時間軸上の位置と長さは保持しつつ、

表示する情報量に必要な高さが確保できない場合は、

**Block表現から「色dot + 時刻 + タイトル」のCompact表現へ切り替える。**
