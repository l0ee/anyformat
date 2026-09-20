import { PaletteColor } from './types';

export function exportPaletteAsCss(colors: PaletteColor[]): string {
  const lines = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

export function exportPaletteAsJson(colors: PaletteColor[]): string {
  return JSON.stringify(colors, null, 2);
}

export function parsePaletteFromJson(jsonString: string): PaletteColor[] | null {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) return null;
    const valid: PaletteColor[] = [];
    for (const item of data) {
      if (typeof item === 'object' && item && typeof item.hex === 'string') {
        valid.push({
          r: typeof item.r === 'number' ? item.r : 0,
          g: typeof item.g === 'number' ? item.g : 0,
          b: typeof item.b === 'number' ? item.b : 0,
          a: typeof item.a === 'number' ? item.a : 1,
          hex: item.hex,
          percentage: typeof item.percentage === 'number' ? item.percentage : 0,
        });
      }
    }
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}
