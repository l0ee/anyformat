import React, { useId } from 'react';
import { PaletteColor } from '../engine/types';

interface PaletteEditorProps {
  colors: PaletteColor[];
  onColorChange: (oldHex: string, newHex: string) => void;
}

export const PaletteEditor: React.FC<PaletteEditorProps> = ({ colors, onColorChange }) => {
  const headingId = useId();

  if (!colors || colors.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl text-slate-900 dark:text-white p-5 space-y-3 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="flex items-center justify-between">
        <h4 id={headingId} className="text-xs font-serif uppercase tracking-widest text-slate-500 dark:text-slate-400">
          EXTRACTED COLOR PALETTE ({colors.length})
        </h4>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Choose a swatch to change its color</span>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {colors.map((col, idx) => (
          <li
            key={`${col.hex}-${idx}`}
            className="flex flex-col items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <label className="relative block group w-11 h-11 rounded-lg shadow-inner mb-2 cursor-pointer">
              <span className="sr-only">
                Change color {col.hex.toUpperCase()}, {col.percentage.toFixed(1)}% of the image
              </span>
              <input
                type="color"
                value={col.hex}
                onChange={(e) => onColorChange(col.hex, e.target.value)}
                className="peer absolute inset-0 w-11 h-11 cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="block w-11 h-11 rounded-lg border border-slate-300 dark:border-slate-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-950"
                style={{ backgroundColor: col.hex }}
              />
            </label>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {col.hex.toUpperCase()}
            </span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
              {col.percentage.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
