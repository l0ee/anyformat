import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { rasterizeSvgToBlob } from '../engine/svgRasterizer';
import { downloadBlob } from '../engine/zipExporter';
import { FileResultActions } from './common/FileResultActions';

interface PreparedRasterExportProps {
  svgContent: string;
  baseName: string;
  width: number;
  height: number;
  disabled: boolean;
}

export function PreparedRasterExport({ svgContent, baseName, width, height, disabled }: PreparedRasterExportProps) {
  const [format, setFormat] = useState<'png' | 'webp'>('png');
  const [scale, setScale] = useState(2);
  const formatId = useId();
  const scaleId = useId();
  const spec = useMemo(() => ({ svgContent, baseName, width, height, format, scale, disabled }),
    [svgContent, baseName, width, height, format, scale, disabled]);
  const [attempt, setAttempt] = useState<{ spec: typeof spec; blob?: Blob; error?: string; pending: boolean } | null>(null);
  const requests = useRef({ id: 0 });

  useEffect(() => {
    const control = requests.current;
    setAttempt(null);
    return () => { control.id++; };
  }, [spec]);

  const current = attempt?.spec === spec ? attempt : null;
  const prepare = async () => {
    if (disabled || current?.pending) return;
    const id = ++requests.current.id;
    setAttempt({ spec, pending: true });
    try {
      const blob = await rasterizeSvgToBlob(svgContent, { width, height, scale, format, quality: 0.92 });
      if (requests.current.id === id) setAttempt({ spec, blob, pending: false });
    } catch {
      if (requests.current.id === id) setAttempt({ spec, error: 'Could not prepare this image. Try again or choose a smaller scale.', pending: false });
    }
  };
  const filename = `${baseName}@${scale}x.${format}`;

  return <section aria-label="Prepare image for saving or sharing" className="space-y-3 rounded-xl border border-stone-300 p-3 dark:border-slate-700">
    <h4 className="text-sm font-semibold">Save or share an image</h4>
    <p className="text-xs text-stone-600 dark:text-slate-400">Prepare your image first, then tap Save or Share. Choose Telegram or another compatible app in the native share menu.</p>
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1 text-xs"><label htmlFor={formatId}>Image format</label>
        <select id={formatId} value={format} disabled={disabled} onChange={(event) => setFormat(event.target.value as 'png' | 'webp')} className="min-h-11 rounded-lg border border-stone-300 bg-transparent px-3 dark:border-slate-700">
          <option value="png">PNG</option><option value="webp">WebP</option>
        </select>
      </div>
      <div className="grid gap-1 text-xs"><label htmlFor={scaleId}>Image scale</label>
        <select id={scaleId} value={scale} disabled={disabled} onChange={(event) => setScale(Number(event.target.value))} className="min-h-11 rounded-lg border border-stone-300 bg-transparent px-3 dark:border-slate-700">
          {[1, 2, 4].map((value) => <option key={value} value={value}>{value}×</option>)}
        </select>
      </div>
      <button type="button" disabled={disabled || current?.pending} onClick={prepare} className="min-h-11 rounded-lg border border-stone-300 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-700">
        {current?.pending ? 'Preparing image…' : 'Prepare image'}
      </button>
    </div>
    <p role="status" className="text-xs">{current?.pending ? 'Preparing the selected image…' : current?.blob ? `${filename} is ready to save or share.` : ''}</p>
    {current?.error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{current.error}</p>}
    {current?.blob && !disabled && <FileResultActions blob={current.blob} filename={filename} onDownload={() => downloadBlob(current.blob!, filename)} />}
  </section>;
}
