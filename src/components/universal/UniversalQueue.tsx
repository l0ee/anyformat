import React, { useId, useState, useEffect, useRef, useMemo } from 'react';
import { getCommonExportTargets, SUPPORTED_FORMATS, UniversalTaskItem } from '../../engine/universal/types';
import { DEFAULT_QUEUE_FILTERS, hasQueueFilters, filterUniversalTasks, UniversalFilterOptions } from '../../engine/universal/universalFilter';
import { calculateUniversalBatchMetrics, copyResultToClipboard } from '../../utils/universalResultUtils';
import { convertPdfToImage } from '../../engine/pdfConverter';
import { Download, ArrowRight, RefreshCw, Trash2, Layers, ShieldCheck, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { QueueFilters } from './QueueFilters';
import { WorkflowProgress } from '../WorkflowProgress';

const PdfSourcePagePreview: React.FC<{
  file: File;
  fileName: string;
  pageNumber: number;
}> = ({ file, fileName, pageNumber }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const currentPageRef = useRef(pageNumber);
  const activeUrlRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    currentPageRef.current = pageNumber;
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
      setPreviewUrl(null);
    }
  }, [pageNumber]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, []);

  const handlePreview = async () => {
    const requestedPage = pageNumber;
    setIsRendering(true);
    try {
      const blob = await convertPdfToImage(file, 'png', requestedPage);
      const url = URL.createObjectURL(blob);
      if (unmountedRef.current || currentPageRef.current !== requestedPage) {
        URL.revokeObjectURL(url);
      } else {
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
        }
        activeUrlRef.current = url;
        setPreviewUrl(url);
      }
    } catch {
      // ignore
    } finally {
      if (!unmountedRef.current) {
        setIsRendering(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview source page
        </button>
        {isRendering && (
          <span className="text-xs text-stone-500 dark:text-slate-400">
            {`Rendering PDF page ${pageNumber} preview\u2026`}
          </span>
        )}
      </div>
      {previewUrl && (
        <div className="mt-1">
          <img
            src={previewUrl}
            alt={`Source page preview for ${fileName}, page ${pageNumber}`}
            className="max-h-36 max-w-xs rounded-lg border border-stone-200 bg-white object-contain shadow-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      )}
    </div>
  );
};

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
  onPageNumberChange?: (id: string, pageNumber: number) => void;
  onClearCompleted?: () => void;
  onRetryFailed?: () => void;
  isProcessing: boolean;
  isStopping?: boolean;
  onStop?: () => void;
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
  onPageNumberChange,
  onClearCompleted,
  onRetryFailed,
  isProcessing,
  isStopping,
  onStop,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [filterOpts, setFilterOpts] = useState<UniversalFilterOptions>(DEFAULT_QUEUE_FILTERS);

  const headingId = useId();
  const statusId = useId();
  const globalTargetId = useId();
  const zipHelpId = useId();

  const isSingle = items.length === 1;
  const filteredItems = useMemo(
    () => filterUniversalTasks(items, filterOpts),
    [items, filterOpts]
  );
  const { counts, completedOutputFormats, commonTargets, batchMetrics } = useMemo(() => {
    const counts = { idle: 0, processing: 0, completed: 0, error: 0 };
    const outputFormats = new Set<string>();
    const sourceExtensions: string[] = [];
    for (const item of items) {
      counts[item.status]++;
      sourceExtensions.push(item.sourceExt);
      if (item.status === 'completed') outputFormats.add(item.targetExt.toUpperCase());
    }
    return {
      counts,
      completedOutputFormats: [...outputFormats],
      commonTargets: getCommonExportTargets(sourceExtensions),
      batchMetrics: calculateUniversalBatchMetrics(items),
    };
  }, [items]);
  const { completed: completedCount, error: errorCount, idle: idleCount, processing: processingCount } = counts;
  const hasIdle = idleCount > 0;
  const sharedTarget = items.every((item) => item.targetExt === items[0]?.targetExt) ? items[0]?.targetExt || '' : '';
  const globalTargetHelp = completedCount > 0
    ? 'Global changes are unavailable after a conversion completes. Choose formats per file before converting.'
    : commonTargets.length === 0
    ? 'No output format is supported by every queued source. Choose formats per file.'
    : '';

  const handleCopySvg = async (item: UniversalTaskItem) => {
    const success = await copyResultToClipboard(item);
    if (success) {
      setCopiedItemId(item.id);
      setTimeout(() => {
        setCopiedItemId((current) => (current === item.id ? null : current));
      }, 2000);
    }
  };

  return (
    <section aria-labelledby={headingId} className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 id={headingId} className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            {isSingle ? (
              <>
                Convert file
                <span className="sr-only"> — Format conversion queue ({items.length})</span>
              </>
            ) : (
              `Format conversion queue (${items.length})`
            )}
          </h2>
          <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-xs text-stone-600 dark:text-slate-400">
            {isSingle ? (
              items[0].status === 'completed' ? (
                <>
                  <span>Conversion complete · File ready for download{items[0].resultSize ? ` (${(items[0].resultSize / 1024).toFixed(1)} KB)` : ''}</span>
                  <span className="sr-only"> · 1 completed of 1</span>
                </>
              ) : items[0].status === 'error' ? (
                'Conversion failed'
              ) : items[0].status === 'processing' ? (
                'Converting…'
              ) : (
                'Ready to convert'
              )
            ) : (
              `${idleCount} ready · ${processingCount} processing · ${completedCount} completed · ${errorCount} failed`
            )}
            {batchMetrics.percentageReduction > 0 && (
              <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                · Saved {(Math.abs(batchMetrics.netByteDifference) / 1024).toFixed(1)} KB (-{batchMetrics.percentageReduction}%)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSingle && items.length > 0 && (
            <div>
              <label htmlFor={globalTargetId} className="mb-1 block text-xs font-semibold text-stone-600 dark:text-slate-300">Convert all to</label>
              <select
                id={globalTargetId}
                onChange={(event) => event.target.value && onApplyAllTargetFormat(event.target.value)}
                value={commonTargets.includes(sharedTarget) ? sharedTarget : ''}
                disabled={isProcessing || commonTargets.length === 0 || completedCount > 0}
                aria-describedby={globalTargetHelp ? `${globalTargetId}-help` : undefined}
                className="min-h-11 rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-2 text-sm font-bold text-pink-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-pink-300"
              >
                <option value="" disabled>Mixed formats</option>
                {commonTargets.map((ext) => <option key={ext} value={ext}>.{ext.toUpperCase()}</option>)}
              </select>
              {globalTargetHelp && <p id={`${globalTargetId}-help`} className="mt-1 max-w-56 text-xs text-amber-700 dark:text-amber-300">{globalTargetHelp}</p>}
            </div>
          )}
          {errorCount > 0 && onRetryFailed && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={onRetryFailed}
                disabled={isProcessing}
                aria-label="Retry failed conversions in the format conversion queue"
                className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-rose-300/80 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                Retry failed files
              </button>
              {idleCount > 0 && (
                <p className="text-xs text-stone-600 dark:text-slate-300">
                  Retry processes only failed files; {idleCount} idle file{idleCount === 1 ? '' : 's'} remain{idleCount === 1 ? 's' : ''} queued.
                </p>
              )}
            </div>
          )}
          {!isSingle && completedCount > 0 && onClearCompleted && (
            <button
              type="button"
              onClick={onClearCompleted}
              disabled={isProcessing}
              className="min-h-11 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear completed ({completedCount})
            </button>
          )}
          <button
            type="button"
            onClick={onClearQueue}
            disabled={isProcessing}
            aria-label="Clear all files from the format conversion queue"
            className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100/60 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            {isSingle ? 'Clear file' : 'Clear all'}
          </button>
        </div>
      </div>

      {isProcessing && <WorkflowProgress finished={completedCount + errorCount} completed={completedCount} total={items.length} stage={items.find((item) => item.status === 'processing')?.stage} stopping={isStopping} onStop={onStop} />}

      {(items.length > 2 || hasQueueFilters(filterOpts)) && (
        <QueueFilters value={filterOpts} onChange={setFilterOpts} visibleCount={filteredItems.length} totalCount={items.length} />
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs font-semibold text-stone-500 dark:border-slate-700 dark:text-slate-400">
          No files match. Reset filters or try another search.
          <button type="button" onClick={() => setFilterOpts(DEFAULT_QUEUE_FILTERS)} className="mx-auto mt-3 block min-h-11 rounded-xl px-4 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-slate-800">Show all files</button>
        </div>
      ) : (
        <ul aria-describedby={statusId} className="max-h-[450px] space-y-2 overflow-y-auto pr-1 sm:pr-2">
          {filteredItems.map((item) => {
            const spec = SUPPORTED_FORMATS[item.sourceExt];
            const targetId = `target-${item.id}`;
            const pageHelpId = `page-help-${item.id}`;
            const previewId = `universal-preview-${item.id}`;
            const expanded = expandedId === item.id;
            return (
              <li key={item.id} className="hover-surface rounded-2xl border border-stone-200/90 bg-[#fdfbf9]/90 p-3 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt="" width={44} height={44} loading="lazy" className="h-11 w-11 shrink-0 rounded-xl border border-stone-200 object-cover dark:border-slate-700" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-xs font-bold uppercase text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                        .{item.sourceExt}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 title={item.name} className="truncate text-sm font-bold text-stone-900 dark:text-white">{item.name}</h4>
                      <p className="break-words text-xs tabular-nums text-stone-600 dark:text-slate-400">
                        {(item.file.size / 1024).toFixed(1)} KB · {spec.label}
                        {item.resultSize !== undefined && (
                          <>
                            {' · Converted: '}
                            {(item.resultSize / 1024).toFixed(1)} KB
                            {item.file.size > 0 && (() => {
                              const delta = item.resultSize! - item.file.size;
                              const pct = Math.round((delta / item.file.size) * 100);
                              const isReduced = delta < 0;
                              return (
                                <span
                                  className={`ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                    isReduced
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-stone-200/70 text-stone-700 dark:bg-slate-700/60 dark:text-slate-300'
                                  }`}
                                  title={`${isReduced ? 'Size reduced by' : 'Size changed by'} ${Math.abs(pct)}%`}
                                >
                                  {delta < 0 ? `${pct}%` : delta > 0 ? `+${pct}%` : '0%'}
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {item.sourceExt === 'pdf' && (
                      <div className="flex w-full flex-col gap-2 rounded-xl bg-stone-100/70 p-2.5 sm:w-auto sm:flex-row sm:items-center dark:bg-slate-900/60">
                        <div className="flex items-center gap-1.5">
                          <label
                            htmlFor={`page-${item.id}`}
                            className="text-xs font-semibold text-stone-600 dark:text-slate-300"
                          >
                            PDF page
                          </label>
                          <input
                            id={`page-${item.id}`}
                            aria-label={`PDF page for ${item.name}`}
                            name={`page-${item.id}`}
                            autoComplete="off"
                            type="number"
                            min={1}
                            max={item.pageCount || 1}
                            value={item.pageNumber || 1}
                            disabled={isProcessing || item.status === 'completed' || item.pageCount === undefined}
                            aria-describedby={pageHelpId}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const max = item.pageCount || 1;
                              const clamped = Math.max(1, Math.min(max, val || 1));
                              onPageNumberChange?.(item.id, clamped);
                            }}
                            className="min-h-11 w-16 rounded-xl border border-stone-300/80 bg-white/90 px-2.5 py-2 text-center text-sm font-bold text-stone-800 transition focus:border-rose-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                          <span className="text-xs font-medium text-stone-500 dark:text-slate-400">
                            {item.pageCount === undefined ? 'Reading PDF pages…' : `of ${item.pageCount}`}
                          </span>
                        </div>
                        <p id={pageHelpId} className="sr-only">
                          {item.pageCount === undefined
                            ? 'The page selector will be available after the document is read.'
                            : 'Choose one page to convert. Use the Up and Down Arrow keys to change it.'}
                        </p>
                        <PdfSourcePagePreview
                          file={item.file}
                          fileName={item.name}
                          pageNumber={item.pageNumber || 1}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <label htmlFor={targetId} className="text-xs font-semibold text-stone-600 dark:text-slate-300">
                        Convert to <span className="sr-only">for {item.name}</span>
                      </label>
                      <select
                        id={targetId}
                        aria-label={`Output for ${item.name}`}
                        aria-describedby={item.sourceExt === 'pdf' && item.targetExt === 'svg' ? `${targetId}-note` : undefined}
                        value={item.targetExt}
                        onChange={(event) => onTargetFormatChange(item.id, event.target.value)}
                        disabled={isProcessing || item.status === 'completed'}
                        className="min-h-11 rounded-xl border border-stone-300/80 bg-white/90 px-3 py-2 text-sm font-bold text-rose-700 transition focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-rose-300"
                      >
                        {spec.canExportTo.map((target) => (
                          <option key={target} value={target}>.{target.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {item.sourceExt === 'pdf' && item.targetExt === 'svg' && (
                      <p id={`${targetId}-note`} className="basis-full text-xs text-stone-600 dark:text-slate-300">
                        PDF to SVG redraws the selected page as shapes. Text is not editable, and fine details may change.
                      </p>
                    )}

                    {onOpenInStudio && item.targetExt === 'svg' && ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(item.sourceExt) && (
                      <button
                        type="button"
                        onClick={() => onOpenInStudio(item)}
                        className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-rose-300/80 bg-rose-100/60 px-3 py-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Tune in Vector Studio
                      </button>
                    )}

                    {item.status === 'processing' && (
                      <div className="processing-stage">
                      <progress
                        aria-label={`Converting ${item.name}`}
                        aria-valuetext={item.stage || 'Processing…'}
                        max={100}
                        className="h-2 w-24 accent-rose-600"
                      >
                        {item.stage || 'Processing…'}
                      </progress>
                      <span>{item.stage || 'Processing…'}</span>
                      </div>
                    )}

                    {!isSingle && item.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        {(item.targetExt === 'svg' || item.resultBlob?.type === 'image/svg+xml') && (
                          <button
                            type="button"
                            onClick={() => handleCopySvg(item)}
                            aria-label={`Copy ${item.name} SVG code to clipboard`}
                            className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-stone-50/90 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {copiedItemId === item.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy SVG</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDownloadItem(item.id)}
                          aria-label={`Download ${item.resultFilename || `${item.name.replace(/\.[^/.]+$/, '')}.${item.targetExt}`}`}
                          className="min-h-11 inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <span role="alert" className="min-w-0 break-words self-center text-xs font-bold text-rose-700 dark:text-rose-300">
                        Failed: {item.error || 'Conversion failed'}
                      </span>
                    )}

                    {(item.previewUrl || item.resultUrl) && (
                      <button
                        type="button"
                        onClick={() => setExpandedId((value) => (value === item.id ? null : item.id))}
                        aria-expanded={expanded}
                        aria-controls={previewId}
                        className="min-h-11 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-slate-700"
                      >
                        {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {expanded ? 'Hide preview' : 'Preview'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={isProcessing}
                      aria-label={`Remove ${item.name} from conversion queue`}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl p-2 text-stone-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div id={previewId} className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-200/80 pt-3 sm:grid-cols-2 dark:border-slate-700">
                    {item.previewUrl && (
                      <figure>
                        <figcaption className="mb-1 text-xs font-semibold text-stone-600 dark:text-slate-300">Source</figcaption>
                        <img src={item.previewUrl} alt={`Source preview for ${item.name}`} className="max-h-40 rounded-lg border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950" />
                      </figure>
                    )}
                    {item.resultUrl && (
                      <figure>
                        <figcaption className="mb-1 text-xs font-semibold text-stone-600 dark:text-slate-300">Converted result</figcaption>
                        {item.targetExt === 'pdf' ? (
                          <div>
                            <iframe
                              src={item.resultUrl}
                              title={`PDF preview for ${item.name}`}
                              className="h-40 w-full rounded-lg border border-stone-200 bg-[#faf5ef] dark:border-slate-700 dark:bg-slate-950"
                            />
                            <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                              <a
                                href={item.resultUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`open ${item.name.replace(/\.[^/.]+$/, '')}.pdf in a new tab`}
                                className="text-rose-600 hover:underline dark:text-rose-400"
                              >
                                Open in new tab
                              </a>
                              <a
                                href={item.resultUrl}
                                download={`${item.name.replace(/\.[^/.]+$/, '')}.pdf`}
                                aria-label={`download ${item.name.replace(/\.[^/.]+$/, '')}.pdf`}
                                className="text-rose-600 hover:underline dark:text-rose-400"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.resultUrl}
                            alt={`Converted preview for ${item.name}`}
                            className="max-h-40 rounded-lg border border-stone-200 bg-[#faf5ef] object-contain dark:border-slate-700 dark:bg-slate-950"
                          />
                        )}
                      </figure>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-4 border-t border-stone-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Local browser conversion · Zero server uploads</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSingle ? (
            // SINGLE FILE CTA
            items[0].status === 'completed' ? (
              <>
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="min-h-12 rounded-full border border-stone-300 bg-white/80 px-5 py-2.5 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  Convert another file
                </button>
                {(items[0].targetExt === 'svg' || items[0].resultBlob?.type === 'image/svg+xml') && (
                  <button
                    type="button"
                    onClick={() => handleCopySvg(items[0])}
                    aria-label="Copy SVG code to clipboard"
                    className="min-h-12 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/90 px-6 py-2.5 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  >
                    {copiedItemId === items[0].id ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy SVG</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDownloadItem(items[0].id)}
                  aria-label={`Download ${items[0].resultFilename || `${items[0].name.replace(/\.[^/.]+$/, '')}.${items[0].targetExt}`}`}
                  className="min-h-12 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02]"
                >
                  <Download className="h-4 w-4" />
                  Download {items[0].targetExt.toUpperCase()}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartConversion}
                disabled={isProcessing}
                aria-label={isProcessing ? 'Converting files' : 'Convert all files'}
                className="min-h-12 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Converting…
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Convert to {items[0].targetExt.toUpperCase()}
                  </>
                )}
              </button>
            )
          ) : (
            // BATCH CTA (MULTIPLE FILES)
            <>
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={onExportZip}
                  aria-describedby={zipHelpId}
                  className="min-h-12 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-[#faf5ef] px-5 py-2.5 text-xs font-bold text-stone-800 transition-colors hover:bg-[#f3ebe1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <Download className="h-4 w-4" />
                  Export ZIP ({completedCount})
                </button>
              )}
              {completedCount === items.length && items.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="min-h-12 rounded-full border border-stone-300 bg-white/80 px-6 py-2.5 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  Convert more files
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (!hasIdle && errorCount && onRetryFailed ? onRetryFailed() : onStartConversion())}
                  disabled={isProcessing || !items.length}
                  aria-label={isProcessing ? 'Converting files' : (!hasIdle && errorCount) ? 'Retry failed files' : 'Convert all files'}
                  className="min-h-12 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Converting files…
                    </>
                  ) : !hasIdle && errorCount ? (
                    'Retry failed files'
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Convert all files ({items.length})
                    </>
                  )}
                </button>
              )}
            </>
          )}
          {!isSingle && completedCount > 0 && (
            <p id={zipHelpId} className="basis-full text-xs text-stone-600 dark:text-slate-400">
              ZIP includes {completedCount} completed file{completedCount === 1 ? '' : 's'} ({completedOutputFormats.join(', ')}) currently in this queue.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
