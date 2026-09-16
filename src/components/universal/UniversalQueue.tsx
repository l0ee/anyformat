import React, { useId, useState } from 'react';
import { getCommonExportTargets, SUPPORTED_FORMATS, UniversalTaskItem } from '../../engine/universal/types';

interface UniversalQueueProps {
  items: UniversalTaskItem[];
  onTargetFormatChange: (id: string, targetExt: string) => void;
  onApplyAllTargetFormat: (targetExt: string) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onStartConversion: () => void;
  onDownloadItem: (id: string) => void;
  onExportZip: () => void;
  isProcessing: boolean;
}

export const UniversalQueue: React.FC<UniversalQueueProps> = ({ items, onTargetFormatChange, onApplyAllTargetFormat, onRemoveItem, onClearQueue, onStartConversion, onDownloadItem, onExportZip, isProcessing }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const headingId = useId();
  const statusId = useId();
  const globalTargetId = useId();
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  const commonTargets = getCommonExportTargets(items.map((item) => item.sourceExt));
  const globalTargetHelp = completedCount > 0
    ? 'Global changes are unavailable after a conversion completes. Choose formats per file before converting.'
    : commonTargets.length === 0
    ? 'No output format is supported by every queued source. Choose formats per file.'
    : '';

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-5xl space-y-6 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-xl backdrop-blur-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h3 id={headingId} className="text-xl font-bold text-slate-900 dark:text-white">Format conversion queue ({items.length})</h3>
          <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-xs text-slate-600 dark:text-slate-400">{completedCount} completed{errorCount ? `, ${errorCount} failed` : ''} of {items.length}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={globalTargetId} className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Convert all to</label>
            <select id={globalTargetId} onChange={(event) => event.target.value && onApplyAllTargetFormat(event.target.value)} defaultValue="" disabled={isProcessing || commonTargets.length === 0 || completedCount > 0} aria-describedby={globalTargetHelp ? `${globalTargetId}-help` : undefined} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-pink-300">
              <option value="" disabled>Select format</option>
              {commonTargets.map((ext) => <option key={ext} value={ext}>.{ext.toUpperCase()}</option>)}
            </select>
            {globalTargetHelp && <p id={`${globalTargetId}-help`} className="mt-1 max-w-56 text-xs text-amber-700 dark:text-amber-300">{globalTargetHelp}</p>}
          </div>
          <button type="button" onClick={onClearQueue} disabled={isProcessing} className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-rose-700 transition-colors motion-reduce:transition-none hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Clear all</button>
        </div>
      </div>

      <ul aria-describedby={statusId} className="max-h-[450px] space-y-3 overflow-y-auto pr-1 sm:pr-2">
        {items.map((item) => {
          const spec = SUPPORTED_FORMATS[item.sourceExt];
          const targetId = `target-${item.id}`;
          const previewId = `universal-preview-${item.id}`;
          const expanded = expandedId === item.id;
          return (
            <li key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-800/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-xs font-bold uppercase text-pink-600">.{item.sourceExt}</div>}
                  <div className="min-w-0"><h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.name}</h4><p className="text-xs text-slate-600 dark:text-slate-400">{(item.file.size / 1024).toFixed(1)} KB · {spec.label}</p></div>
                </div>
                <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                  <div><label htmlFor={targetId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Output for {item.name}</label><select id={targetId} value={item.targetExt} onChange={(event) => onTargetFormatChange(item.id, event.target.value)} disabled={isProcessing || item.status === 'completed'} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-pink-700 dark:border-slate-700 dark:bg-slate-900 dark:text-pink-300">{spec.canExportTo.map((target) => <option key={target} value={target}>.{target.toUpperCase()}</option>)}</select></div>
                  {item.status === 'processing' && <progress aria-label={`Converting ${item.name}`} max={100} value={item.progress} className="mb-4 h-2 w-24 accent-sky-600">{item.progress}%</progress>}
                  {item.status === 'completed' && <button type="button" onClick={() => onDownloadItem(item.id)} className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors motion-reduce:transition-none hover:bg-emerald-500/20 dark:text-emerald-300">Download {item.name.replace(/\.[^/.]+$/, '')}.{item.targetExt}</button>}
                  {item.status === 'error' && <span role="alert" className="self-center text-xs font-bold text-rose-700 dark:text-rose-300">Failed: {item.error || 'Conversion failed'}</span>}
                  {(item.previewUrl || item.resultUrl) && <button type="button" onClick={() => setExpandedId((value) => value === item.id ? null : item.id)} aria-expanded={expanded} aria-controls={previewId} className="min-h-11 rounded-xl px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-700">{expanded ? 'Hide preview' : 'Preview'}</button>}
                  <button type="button" onClick={() => onRemoveItem(item.id)} disabled={isProcessing} aria-label={`Remove ${item.name} from conversion queue`} className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 transition-colors motion-reduce:transition-none hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              {expanded && <div id={previewId} className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 dark:border-slate-700">
                {item.previewUrl && <figure><figcaption className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Source</figcaption><img src={item.previewUrl} alt={`Source preview for ${item.name}`} className="max-h-40 rounded-lg border bg-white object-contain dark:bg-slate-950" /></figure>}
                {item.resultUrl && <figure><figcaption className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Converted result</figcaption><img src={item.resultUrl} alt={`Converted preview for ${item.name}`} className="max-h-40 rounded-lg border bg-white object-contain dark:bg-slate-950" /></figure>}
              </div>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <p className="text-xs text-slate-600 dark:text-slate-400">Only completed files are included in ZIP exports.</p>
        <div className="flex flex-wrap gap-3">
          {completedCount > 0 && <button type="button" onClick={onExportZip} className="min-h-11 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition-opacity motion-reduce:transition-none hover:opacity-90 dark:bg-slate-100 dark:text-slate-900">Export ZIP ({completedCount})</button>}
          <button type="button" onClick={onStartConversion} disabled={isProcessing || !items.length} className="min-h-11 rounded-full bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-700 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform motion-reduce:transition-none motion-reduce:transform-none hover:scale-[1.02] disabled:opacity-50">{isProcessing ? 'Converting files…' : errorCount ? 'Retry failed files' : 'Convert all files'}</button>
        </div>
      </div>
    </section>
  );
};
