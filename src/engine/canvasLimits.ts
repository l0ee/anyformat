export const MAX_CANVAS_EDGE = 8_192;
export const MAX_CANVAS_PIXELS = 16_777_216;

export function assertCanvasDimensionsWithinBudget(
  width: number,
  height: number,
  description = 'Image',
): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`${description} has invalid dimensions.`);
  }

  if (
    width > MAX_CANVAS_EDGE ||
    height > MAX_CANVAS_EDGE ||
    width * height > MAX_CANVAS_PIXELS
  ) {
    throw new Error(
      `${description} exceeds the browser canvas limits (${MAX_CANVAS_EDGE}px per edge and ${MAX_CANVAS_PIXELS.toLocaleString()} pixels).`,
    );
  }
}
