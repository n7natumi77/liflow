"use client";
import { useDiaryTheme, type FairyExpression } from "./diary-theme";
const labels: Record<FairyExpression, string> = { normal: "いつもの表情", happy: "にっこり", excited: "わくわく", thinking: "考え中", surprised: "びっくり", concerned: "気にかけている", sleepy: "ねむい", proud: "得意げ" };
export function FairyCharacter({ expression = "normal", size = 220, decorative = false, className = "" }: {
  expression?: FairyExpression; size?: number; decorative?: boolean; className?: string;
}) {
  const { theme } = useDiaryTheme(), { character } = theme;
  const index = character.expressions.indexOf(expression);
  return <span className={"fairy-character " + className} role={decorative ? undefined : "img"}
    aria-hidden={decorative || undefined} aria-label={decorative ? undefined : character.name + "：" + labels[expression]}
    style={{ width: size, aspectRatio: "1", backgroundImage: "url(" + character.atlas + ")",
      backgroundSize: character.columns * 100 + "% " + character.rows * 100 + "%",
      backgroundPosition: (index % character.columns) / (character.columns - 1) * 100 + "% " + Math.floor(index / character.columns) / (character.rows - 1) * 100 + "%" }} />;
}
