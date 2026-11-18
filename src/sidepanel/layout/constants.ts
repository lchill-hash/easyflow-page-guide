export const INPUT_MIN_ROWS = 2;
export const INPUT_MAX_ROWS = 6;
export const INPUT_MAX_VIEWPORT_RATIO = 0.2;
export const COMPOSER_MAX_VIEWPORT_RATIO = 0.32;
export const COMPOSER_CHROME_PX = 72;

export function inputMaxHeightPx(viewportHeight: number, lineHeight: number, padding: number): number {
  const byRows = lineHeight * INPUT_MAX_ROWS + padding;
  const byViewport = viewportHeight * INPUT_MAX_VIEWPORT_RATIO;
  const byComposer = viewportHeight * COMPOSER_MAX_VIEWPORT_RATIO - COMPOSER_CHROME_PX;
  return Math.max(lineHeight * INPUT_MIN_ROWS + padding, Math.min(byRows, byViewport, byComposer));
}
