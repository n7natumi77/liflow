# Magical Diary assets

## Files

- fairy-expressions.png — 1774 × 887 px, 4列 × 2行の表情アトラス。
- emblem.svg — 手書きのSVGコードで作成した羽付き宝石。文字を含まない。
- lace.svg — 手書きのSVGコードで作成した繰り返しレース。
- pearl-paper.svg — Phase 3で追加した乳白色・オーロラ調の紙面テクスチャ。文字や状態を含まない。
- ribbon-divider.svg — Phase 3で追加したリボンと宝石の区切り線。
- memo-corner.svg — Phase 3で追加した未整理メモ用の折り角。
- ledger-flourish.svg — Phase 3で追加した家計簿用の罫飾り。

妖精は組み込みの image_gen ツールで作成し、このフォルダへコピーした。元画像は Codex の generated_images に残している。API / CLI フォールバックは使用していない。

Phase 3 の4点は既存のMagical Diaryパレットに合わせて手書きしたコードネイティブSVG。Simple Themeでは表示しない。

最終アトラスの表情順:

| 行 | 1列 | 2列 | 3列 | 4列 |
|---|---|---|---|---|
| 上 | normal | happy | excited | thinking |
| 下 | surprised | concerned | sleepy | proud |

最初の生成では透過を指定したがチェック柄が焼き込まれたため、その版は採用していない。最終画像は白背景。明るいUIでは CSS の multiply 合成で背景になじませる。

## Reference

引継ぎ資料・指示書/リフちゃんキャラデザ.png をキャラクターのデザイン参照に使用した。図中の文字はUIへ転記していない。

## Generation prompt

Use case: identity-preserve. Asset type: production UI character sprite atlas for Liflow. Input image is the character design reference; preserve the exact white/cream cat fairy identity, fluffy lavender-tipped tail, small blue/lavender wings, pink neck bow with gold diamond jewel and forehead jewel. Create ONE transparent PNG sprite atlas, 2048 by 1024, a strict four-column two-row grid of eight equally sized 512x512 cells. Each cell contains the same full-body sitting fairy, centered at the same scale, complete ears, wings, paws, and fluffy tail inside the cell with safe padding. Background genuinely transparent with alpha, no white background, no checkerboard baked in, no shadows outside the character. Expression order left to right: top row normal (calm relaxed eyes), happy (closed smiling eyes), excited (bright joyful eyes), thinking (thoughtful eyes looking slightly aside); bottom row surprised (wide eyes), concerned (soft drooping brows), sleepy (closed sleepy eyes), proud (gentle confident closed-eye smile). 2000s magical girl anime companion, delicate clean soft-pink line art, 2D cel shading with soft pastel highlights; readable silhouette at 140px. Not glossy 3D toy, not realistic animal. No text, labels, lettering, boxes, decorative surrounding sparkles, props or speech bubbles. Reference is subject design only; remove all character-sheet labels and layout.

## Final edit prompt

Precise image edit. Preserve exactly the eight fairy characters, their expressions, design, colors, positions, scale, the 4-column by 2-row sprite atlas grid, and 2:1 aspect ratio. Change ONLY the background: completely remove the gray checkerboard, replacing it with perfectly solid pure white #FFFFFF everywhere outside the characters, including enclosed spaces between wings and tails and ribbon loops. No transparency checkerboard or pattern anywhere. This output intentionally uses a white background to blend with a light UI. Do not add text, shadow, border or ornaments. Keep the character linework untouched.
