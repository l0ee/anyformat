import React from 'react';
import { Zap, Image, Grid, LucideIcon } from 'lucide-react';
import { PresetType } from '../engine/types';

interface PresetSelectorProps {
  selectedPreset: PresetType;
  onSelectPreset: (preset: PresetType) => void;
}

const PRESETS: { id: PresetType; label: string; desc: string; icon: LucideIcon }[] = [
  {
    id: 'logo',
    label: 'LOGO / GRAPHIC',
    desc: 'High precision, crisp edges & monochrome/low color count',
    icon: Zap,
  },
  {
    id: 'photo',
    label: 'FULL COLOR PHOTO',
    desc: 'Detailed color quantization and high layer count',
    icon: Image,
  },
  {
    id: 'clipart',
    label: 'ICON / CLIPART',
    desc: 'Simplified shapes with despeckling filter',
    icon: Grid,
  },
];

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPreset,
  onSelectPreset,
}) => {
  return (
    <fieldset className="space-y-3 font-['Plus_Jakarta_Sans',sans-serif]">
      <legend className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
        Preset Workflows
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const active = selectedPreset === p.id;
          const IconComponent = p.icon;
          return (
            <label key={p.id} className="relative block cursor-pointer">
              <input
                type="radio"
                name="vector-preset"
                value={p.id}
                checked={active}
                onChange={() => onSelectPreset(p.id)}
                className="peer sr-only"
              />
              <span
                className={`block min-h-28 p-3 text-left transition-all motion-reduce:transition-none bg-[#faf5ef]/80 dark:bg-slate-900/70 border backdrop-blur-md rounded-2xl text-stone-900 dark:text-white peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-pink-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-950 ${
                  active
                    ? 'border-pink-500 bg-pink-100/60 dark:bg-slate-800/90 dark:border-pink-500 ring-2 ring-pink-500/20 shadow-md'
                    : 'border-stone-300/70 dark:border-slate-800 hover:bg-[#fdfaf6] dark:hover:bg-slate-800 shadow-sm'
                }`}
              >
              <span className="mb-2 block text-pink-500" aria-hidden="true">
                <IconComponent className="w-5 h-5" />
              </span>
              <span className="block text-xs font-bold tracking-wider uppercase text-stone-900 dark:text-white">{p.label}</span>
              <span className="block text-[10px] text-stone-600 dark:text-slate-400 leading-tight mt-1 line-clamp-2">
                {p.desc}
              </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
