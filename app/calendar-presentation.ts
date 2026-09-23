export const NORMAL_BLOCK_MIN_HEIGHT_PX = 38;
export const COMPACT_ROW_HEIGHT_PX = 32;
export const MIN_HIT_TARGET_PX = 44;
export const COMPACT_GAP_PX = 2;

export function calendarItemPresentation(durationMinutes: number, pixelsPerMinute: number) {
  const renderedHeight = Math.max(1, durationMinutes * pixelsPerMinute);
  return {
    renderedHeight,
    compact: renderedHeight < NORMAL_BLOCK_MIN_HEIGHT_PX,
    hitHeight: Math.max(COMPACT_ROW_HEIGHT_PX, MIN_HIT_TARGET_PX),
  };
}

export type CalendarPlacementInput<T> = {
  id: string;
  item: T;
  startMinute: number;
  endMinute: number;
  column: number;
  columns: number;
};

export function placeCalendarItems<T>(items: CalendarPlacementInput<T>[], pixelsPerMinute: number) {
  const bottomByLane = new Map<string, number>();
  return [...items]
    .sort((a, b) => a.startMinute - b.startMinute || a.column - b.column || a.id.localeCompare(b.id))
    .map(input => {
      const anchorTop = input.startMinute * pixelsPerMinute;
      const presentation = calendarItemPresentation(input.endMinute - input.startMinute, pixelsPerMinute);
      if (!presentation.compact) return { ...input, ...presentation, anchorTop, displayTop: anchorTop, anchorOffset: 0 };
      const lane = `${input.column}:${input.columns}`;
      const displayTop = Math.max(anchorTop, bottomByLane.get(lane) || anchorTop);
      bottomByLane.set(lane, displayTop + presentation.hitHeight + COMPACT_GAP_PX);
      return { ...input, ...presentation, anchorTop, displayTop, anchorOffset: anchorTop - displayTop };
    });
}
