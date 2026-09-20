import React, { useId, useState } from 'react';
import { Image } from 'lucide-react';
import { BatchItem } from '../engine/types';

interface BatchQueueProps {
  items: BatchItem[];
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onStartBatch: (targetIds?: string[]) => void;
  onExportZip: () => void;
  isProcessing: boolean;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({ items, onRemoveItem, onClearQueue, onStartBatch, onExportZip, isProcessing }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const headingId = useId();
  const statusId = useId();
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  const hasIdle = items.some((item) => item.status === 'idle');
  const isFinished = items.length > 0 && completedCount + errorCount === items.length;

  return (
    <section aria-labelledby={headingId} className="app-panel space-y-4 rounded-2xl p-4 text-stone-900 shadow-xl sm:p-5 dark:text-white">
      <div className="flex flex-col gap-3 border-b border-stone-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h3 id={headingId} className="text-sm font-serif uppercase tracking-wider">Batch queue ({items.length} files)</h3>
          <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="text-xs text-stone-600 dark:text-slate-400">
            {completedCount} completed{errorCount ? `, ${errorCount} failed` : ''} of {items.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onClearQueue} disabled={isProcessing} className="min-h-11 rounded-xl border border-stone-300 bg-[#faf5ef] px-4 py-2 text-xs font-semibold uppercase text-stone-700 transition-colors motion-reduce:transition-none hover:bg-[#f3ebe1] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Clear all</button>
          {isFinished && completedCount > 0 && (
            <button type="button" onClick={onExportZip} className="min-h-11 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors motion-reduce:transition-none hover:from-rose-700 hover:to-pink-700">Export {completedCount} as ZIP</button>
          )}
          {(!isFinished || errorCount > 0) && (
            <button
              type="button"
              onClick={() => {
                if (!hasIdle && errorCount > 0) {
                  const failedIds = items.filter((item) => item.status === 'error').map((item) => item.id);
                  onStartBatch(failedIds);
                } else {
                  onStartBatch();
                }
              }}
              disabled={isProcessing || !items.length}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors motion-reduce:transition-none hover:from-rose-700 hover:to-pink-700 disabled:opacity-50"
            >
              {isProcessing && <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {isProcessing ? 'Processing…' : (!hasIdle && errorCount > 0) ? 'Retry failed files' : 'Process batch'}
            </button>
          )}
        </div>
      </div>

      <ul aria-describedby={statusId} className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const previewId = `batch-preview-${item.id}`;
          const expanded = expandedId === item.id;
          return (
            <li key={item.id} className="rounded-xl border border-stone-200/90 bg-[#faf5ef] p-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 object-cover dark:border-slate-800" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-500 dark:border-slate-800"><Image className="h-5 w-5" aria-hidden="true" /></div>}
                  <div className="min-w-0">
                    <h4 className="truncate text-xs font-medium text-stone-900 dark:text-white">{item.name}</h4>
                    <p className="text-[11px] text-stone-600 dark:text-slate-400">{(item.file.size / 1024).toFixed(1)} KB · {item.status === 'completed' ? 'Completed' : item.status === 'error' ? `Failed: ${item.error || 'Tracing failed'}` : item.status === 'processing' ? 'Processing' : 'Ready'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {item.status === 'processing' && <progress aria-label={`Processing ${item.name}`} max={100} value={item.progress} className="h-2 w-28 accent-pink-600">{item.progress}%</progress>}
                  {(item.svgResult || item.previewUrl) && <button type="button" onClick={() => setExpandedId((value) => value === item.id ? null : item.id)} aria-expanded={expanded} aria-controls={previewId} className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 transition-colors motion-reduce:transition-none hover:bg-rose-100/60 dark:text-sky-300 dark:hover:bg-slate-800">{expanded ? 'Hide preview' : 'Preview'}</button>}
                  <button type="button" onClick={() => onRemoveItem(item.id)} disabled={isProcessing} aria-label={`Remove ${item.name} from batch queue`} className="min-h-11 min-w-11 rounded-lg p-2 text-stone-500 transition-colors motion-reduce:transition-none hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              {expanded && <div id={previewId} className="mt-3 grid grid-cols-1 gap-3 rounded-lg border-t border-stone-200 bg-[#f4ece3] p-3 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
                <figure><figcaption className="mb-1 text-[10px] uppercase tracking-widest text-stone-600 dark:text-slate-400">Original image</figcaption><img src={item.previewUrl} alt={`Original ${item.name}`} className="max-h-36 rounded border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950" /></figure>
                <figure><figcaption className="mb-1 text-[10px] uppercase tracking-widest text-stone-600 dark:text-slate-400">SVG result</figcaption>{item.svgResult ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svgResult)}`} alt={`Converted SVG preview for ${item.name}`} className="max-h-36 rounded border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950" /> : <span className="text-xs italic text-stone-500">Not converted yet</span>}</figure>
              </div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
