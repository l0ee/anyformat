import type { TraceResult } from '../engine/types';

function setRootSvgAttribute(openTag: string, name: 'width' | 'height', value: number): string {
  const attribute = new RegExp(
    `(^|\\s)${name}(?=\\s*=)\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`,
    'i'
  );

  if (attribute.test(openTag)) {
    return openTag.replace(attribute, (_match, prefix: string) => `${prefix}${name}="${value}"`);
  }

  return openTag.replace(/\/?>$/, closing => ` ${name}="${value}"${closing}`);
}

/**
 * Restore the intrinsic output dimensions without changing the traced coordinate
 * system. The SVG viewBox is the coordinate space of the paths; its viewport
 * width and height scale that geometry to the original source dimensions.
 */
export function restoreTraceDimensions(
  result: TraceResult,
  origWidth: number,
  origHeight: number
): TraceResult {
  if (origWidth === result.width && origHeight === result.height) return result;

  const svg = result.svg.replace(/<svg\b[^>]*>/i, openTag =>
    setRootSvgAttribute(setRootSvgAttribute(openTag, 'width', origWidth), 'height', origHeight)
  );

  return {
    ...result,
    width: origWidth,
    height: origHeight,
    svg
  };
}
