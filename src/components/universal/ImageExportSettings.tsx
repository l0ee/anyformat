import { useId } from 'react';
import { ImageExportOptions } from '../../engine/universal/types';
import { getImageExportErrors } from '../../engine/universal/imageTransform';

interface Props {
  value: ImageExportOptions;
  targetExt: string;
  disabled: boolean;
  onChange: (value: ImageExportOptions) => void;
  onApplyAll: () => void;
}

export function ImageExportSettings({ value, targetExt, disabled, onChange, onApplyAll }: Props) {
  const lossy = ['jpg', 'jpeg', 'webp'].includes(targetExt);
  const id = useId();
  const errors = getImageExportErrors(value);
  const invalid = Object.keys(errors).length > 0;
  return (
    <details className="image-export-settings basis-full rounded-xl border border-stone-300 px-3 dark:border-slate-700">
      <summary className="min-h-11 content-center cursor-pointer text-sm font-semibold">Image settings{invalid && <span className="ml-2 text-rose-700 dark:text-rose-300">— Check settings</span>}</summary>
      <fieldset disabled={disabled} className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <legend className="sr-only">Image export settings</legend>
        {(['width', 'height'] as const).map((dimension) => (
          <label key={dimension} className="grid gap-1">
            {dimension === 'width' ? 'Width (px)' : 'Height (px)'}
            <input type="number" min="1" step="1" placeholder="Original"
              value={value[dimension] === undefined || !Number.isFinite(value[dimension]) ? '' : value[dimension]}
              aria-invalid={!!errors[dimension]} aria-describedby={errors[dimension] ? `${id}-${dimension}-error` : undefined}
              className="min-h-11 rounded-lg border border-stone-300 bg-transparent px-3"
              onChange={(event) => onChange({ ...value, [dimension]: event.target.validity.badInput ? NaN : event.target.value === '' ? undefined : event.target.valueAsNumber })} />
            {errors[dimension] && <span id={`${id}-${dimension}-error`} className="text-xs text-rose-700 dark:text-rose-300">{errors[dimension]}</span>}
          </label>
        ))}
        <label><input type="checkbox" checked={value.keepAspectRatio !== false} onChange={(event) => onChange({ ...value, keepAspectRatio: event.target.checked })} /> Keep aspect ratio (fit within dimensions)</label>
        <label><input type="checkbox" checked={value.allowUpscaling ?? false} onChange={(event) => onChange({ ...value, allowUpscaling: event.target.checked })} /> Allow upscaling</label>
        {lossy && <label className="grid gap-1">Quality: {Math.round((value.quality ?? 0.92) * 100)}%
          <input type="range" min="1" max="100" value={Math.round((value.quality ?? 0.92) * 100)} onChange={(event) => onChange({ ...value, quality: Number(event.target.value) / 100 })} />
        </label>}
        {['jpg', 'jpeg'].includes(targetExt) && <label className="flex items-center gap-2">JPEG background
          <input type="color" value={value.background ?? '#ffffff'} onChange={(event) => onChange({ ...value, background: event.target.value })} />
        </label>}
        {(errors.quality || errors.background) && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300 sm:col-span-2">{errors.quality || errors.background}</p>}
        <p className="text-xs sm:col-span-2">Leave both dimensions blank to keep the original size. With aspect ratio locked, one dimension scales the other automatically. Browser limits may reduce large outputs to 8,192 pixels per edge and 16 megapixels.</p>
        <button type="button" disabled={invalid} className="min-h-11 rounded-lg border px-3 disabled:opacity-50" onClick={onApplyAll}>Apply to compatible files</button>
        <button type="button" className="min-h-11 rounded-lg border px-3" onClick={() => onChange({})}>Reset image settings</button>
      </fieldset>
    </details>
  );
}
