import React, { useId, useState } from 'react';
import { getCommonExportTargets, SUPPORTED_FORMATS, UniversalTaskItem } from '../../engine/universal/types';
import { filterUniversalTasks, UniversalFilterOptions } from '../../engine/universal/universalFilter';

interface UniversalQueueProps {
  items: UniversalTaskItem[];
  onTargetFormatChange: (id: string, targetExt: string) => void;
  onApplyAllTargetFormat: (targetExt: string) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
  onStartConversion: () => void;
  onDownloadItem: (id: string) => void;
  onExportZip: () => void;
  onOpenInStudio?: (item: UniversalTaskItem) => void;
  isProcessing: boolean;
}

export const UniversalQueue: React.FC<UniversalQueueProps> = ({
  items,
  onTargetFormatChange,
  onApplyAllTargetFormat,
  onRemoveItem,
  onClearQueue,
  onStartConversion,
  onDownloadItem,
  onExportZip,
  onOpenInStudio,
  isProcessing,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterOpts, setFilterOpts] = useState<UniversalFilterOptions>({
    statusFilter: 'all',
    categoryFilter: 'all',
    searchQuery: '',
  });

  const headingId = useId();
  const statusId = useId();
  const globalTargetId = useId();
  const searchInputId = useId();
  const statusFilterId = useId();
  const categoryFilterId = useId();

  const filteredItems = filterUniversalTasks(items, filterOpts);
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const errorCount = items.filter((item) => item.status === 'error').length;
  const commonTargets = getCommonExportTargets(items.map((item) => item.sourceExt));
  const globalTargetHelp = completedCount > 0
    ? 'Global changes are unavailable after a conversion completes. Choose formats per file before converting.'
    : commonTargets.length === 0
    ? 'No output format is supported by every queued source. Choose formats per file.'
    : '';

  return (
    <section aria-labelledby={headingId} className="app-panel mx-auto max-w-5xl space-y-6 rounded-3xl p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-stone-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h3 id={headingId} className="text-xl font-bold text-stone-900 dark:text-white">Format conversion queue ({items.length})</h3>
          <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-xs text-stone-600 dark:text-slate-400">{completedCount} completed{errorCount ? `, ${errorCount} failed` : ''} of {items.length}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={globalTargetId} className="mb-1 block text-xs font-semibold text-stone-600 dark:text-slate-300">Convert all to</label>
            <select id={globalTargetId} onChange={(event) => event.target.value && onApplyAllTargetFormat(event.target.value)} defaultValue="" disabled={isProcessing || commonTargets.length === 0 || completedCount > 0} aria-describedby={globalTargetHelp ? `${globalTargetId}-help` : undefined} className="min-h-11 rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-2 text-sm font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-pink-300">
              <option value="" disabled>Select format</option>
              {commonTargets.map((ext) => <option key={ext} value={ext}>.{ext.toUpperCase()}</option>)}
            </select>
            {globalTargetHelp && <p id={`${globalTargetId}-help`} className="mt-1 max-w-56 text-xs text-amber-700 dark:text-amber-300">{globalTargetHelp}</p>}
          </div>
          <button type="button" onClick={onClearQueue} disabled={isProcessing} className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-rose-700 transition-colors motion-reduce:transition-none hover:bg-rose-100/60 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Clear all</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200/90 bg-stone-100/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex-1 min-w-[180px]">
            <label htmlFor={searchInputId} className="sr-only">Search queue</label>
            <input
              id={searchInputId}
              type="text"
              placeholder="Search queued files..."
              value={filterOpts.searchQuery}
              onChange={(e) => setFilterOpts((prev) => ({ ...prev, searchQuery: e.target.value }))}
              className="w-full rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-1.5 text-xs font-medium text-stone-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={statusFilterId} className="sr-only">Filter by status</label>
            <select
              id={statusFilterId}
              value={filterOpts.statusFilter}
              onChange={(e) => setFilterOpts((prev) => ({ ...prev, statusFilter: e.target.value as UniversalFilterOptions['statusFilter'] }))}
              className="rounded-xl border border-stone-300/80 bg-stone-50/90 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">All status</option>
              <option value="idle">Idle</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="error">Failed</option>
            </select>
            <label htmlFor={categoryFilterId} className="sr-only">Filter by category</label>
            <select
              id={categoryFilterId}
              value={filterOpts.categoryFilter}
              onChange={(e) => setFilterOpts((prev) => ({ ...prev, categoryFilter: e.target.value as UniversalFilterOptions['categoryFilter'] }))}
              className="rounded-xl border border-stone-300/80 bg-stone-50/90 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">All categories</option>
              <option value="image">Images</option>
              <option value="vector">Vectors</option>
              <option value="document">Documents</option>
            </select>
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs font-semibold text-stone-500 dark:border-slate-700 dark:text-slate-400">
          No queued files match your search and filter criteria.
        </div>
      ) : (
        <ul aria-describedby={statusId} className="max-h-[450px] space-y-3 overflow-y-auto pr-1 sm:pr-2">
          {filteredItems.map((item) => {
          const spec = SUPPORTED_FORMATS[item.sourceExt];
          const targetId = `target-${item.id}`;
          const previewId = `universal-preview-${item.id}`;
          const expanded = expandedId === item.id;
          return (
            <li key={item.id} className="rounded-2xl border border-stone-200/90 bg-[#fdfbf9]/90 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-stone-200 object-cover dark:border-slate-700" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-xs font-bold uppercase text-pink-600">.{item.sourceExt}</div>}
                  <div className="min-w-0"><h4 className="truncate text-sm font-bold text-stone-900 dark:text-white">{item.name}</h4><p className="text-xs text-stone-600 dark:text-slate-400">{(item.file.size / 1024).toFixed(1)} KB · {spec.label}</p></div>
                </div>
                <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                  <div><label htmlFor={targetId} className="mb-1 block text-xs font-medium text-stone-600 dark:text-slate-300">Convert to <span className="sr-only">for {item.name}</span></label><select id={targetId} aria-label={`Output for ${item.name}`} value={item.targetExt} onChange={(event) => onTargetFormatChange(item.id, event.target.value)} disabled={isProcessing || item.status === 'completed'} className="min-h-11 rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-2 text-sm font-bold text-pink-700 dark:border-slate-700 dark:bg-slate-900 dark:text-pink-300">{spec.canExportTo.map((target) => <option key={target} value={target}>.{target.toUpperCase()}</option>)}</select></div>
                  {onOpenInStudio && item.targetExt === 'svg' && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(item.sourceExt) && (
                    <button
                      type="button"
                      onClick={() => onOpenInStudio(item)}
                      className="min-h-11 rounded-xl border border-rose-300/80 bg-rose-100/60 px-3 py-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      Tune in Vector Studio
                    </button>
                  )}
                  {item.status === 'processing' && <progress aria-label={`Converting ${item.name}`} max={100} value={item.progress} className="mb-4 h-2 w-24 accent-pink-600">{item.progress}%</progress>}
                  {item.status === 'completed' && <button type="button" onClick={() => onDownloadItem(item.id)} className="min-h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors motion-reduce:transition-none hover:bg-emerald-500/20 dark:text-emerald-300">Download {item.name.replace(/\.[^/.]+$/, '')}.{item.targetExt}</button>}
                  {item.status === 'error' && <span role="alert" className="self-center text-xs font-bold text-rose-700 dark:text-rose-300">Failed: {item.error || 'Conversion failed'}</span>}
                  {(item.previewUrl || item.resultUrl) && <button type="button" onClick={() => setExpandedId((value) => value === item.id ? null : item.id)} aria-expanded={expanded} aria-controls={previewId} className="min-h-11 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-700">{expanded ? 'Hide preview' : 'Preview'}</button>}
                  <button type="button" onClick={() => onRemoveItem(item.id)} disabled={isProcessing} aria-label={`Remove ${item.name} from conversion queue`} className="min-h-11 min-w-11 rounded-xl p-2 text-stone-500 transition-colors motion-reduce:transition-none hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"><svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
              {expanded && <div id={previewId} className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-200/80 pt-3 sm:grid-cols-2 dark:border-slate-700">
                {item.previewUrl && <figure><figcaption className="mb-1 text-xs font-semibold text-stone-600 dark:text-slate-300">Source</figcaption><img src={item.previewUrl} alt={`Source preview for ${item.name}`} className="max-h-40 rounded-lg border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950" /></figure>}
                {item.resultUrl && (
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold text-stone-600 dark:text-slate-300">Converted result</figcaption>
                    {item.targetExt === 'pdf' ? (
                      <iframe
                        src={item.resultUrl}
                        title={`Converted PDF preview for ${item.name}`}
                        className="h-40 w-full rounded-lg border border-stone-200 bg-[#faf5ef] dark:border-slate-700 dark:bg-slate-950"
                      />
                    ) : (
                      <img
                        src={item.resultUrl}
                        alt={`Converted preview for ${item.name}`}
                        className="max-h-40 rounded-lg border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950"
                      />
                    )}
                  </figure>
                )}
              </div>}
            </li>
          );
        })}
      </ul>
      )}

      <div className="flex flex-col gap-4 border-t border-stone-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <p className="text-xs text-stone-600 dark:text-slate-400">
          All conversions execute in-memory with zero server uploads. Completed files can be saved individually or in a ZIP archive.
        </p>
        <div className="flex flex-wrap gap-3">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={onExportZip}
              className="min-h-11 rounded-full border border-stone-300 bg-[#faf5ef] px-5 py-2.5 text-xs font-bold text-stone-800 transition-colors hover:bg-[#f3ebe1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              Export ZIP ({completedCount})
            </button>
          )}
          <button
            type="button"
            onClick={onStartConversion}
            disabled={isProcessing || !items.length}
            aria-label={isProcessing ? 'Converting files' : errorCount ? 'Retry failed files' : 'Convert all files'}
            className="min-h-12 rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-transform motion-reduce:transition-none hover:scale-[1.02] disabled:opacity-50"
          >
            {isProcessing ? 'Converting files...' : errorCount ? 'Retry failed files' : `Convert ${items.length} file${items.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </section>
  );
};
