import React, { useId, useState } from 'react';
import { OptimizeOptions } from '../engine/types';

interface CodeInspectorProps {
  svgContent: string;
  optOptions: OptimizeOptions;
  setOptOptions: React.Dispatch<React.SetStateAction<OptimizeOptions>>;
  onDownloadSvg: () => void;
  onDownloadPng: (scale: number) => void;
  onDownloadWebp: (scale: number) => void;
  isExporting?: boolean;
  isProcessing?: boolean;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({
  svgContent,
  optOptions,
  setOptOptions,
  onDownloadSvg,
  onDownloadPng,
  onDownloadWebp,
  isExporting = false,
  isProcessing = false,
}) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'webp'>('svg');
  const [rasterScale, setRasterScale] = useState(2);
  const headingId = useId();
  const precisionId = useId();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(svgContent);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const formattedSize = (new Blob([svgContent]).size / 1024).toFixed(2);

  return (
    <section aria-labelledby={headingId} className="app-panel rounded-2xl text-stone-900 dark:text-white p-5 space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 dark:border-slate-800 pb-4">
        <div>
          <h3 id={headingId} className="text-sm font-serif uppercase tracking-wider text-stone-900 dark:text-slate-200">SVG OUTPUT &amp; OPTIMIZATION</h3>
          <p className="text-xs font-mono text-stone-500 dark:text-slate-400">File Size: {formattedSize} KB</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!svgContent || isProcessing}
            className="min-h-11 px-4 py-1.5 text-xs font-serif uppercase tracking-wider rounded-full border border-stone-300 dark:border-slate-700 bg-[#faf5ef] dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-[#f3ebe1] dark:hover:bg-slate-700 transition-colors motion-reduce:transition-none flex items-center space-x-1 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            {copyStatus === 'success' ? (
              <>
                <svg className="w-4 h-4 text-sky-500 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : copyStatus === 'error' ? (
              <span>Copy failed</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>COPY SVG</span>
              </>
            )}
          </button>
          <span className="sr-only" role={copyStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
            {copyStatus === 'success' ? 'SVG code copied to clipboard.' : copyStatus === 'error' ? 'Unable to copy SVG code.' : ''}
          </span>

          <div role="group" aria-label="Download format" className="flex flex-wrap items-center gap-1 bg-[#eee4d7]/85 dark:bg-slate-800 rounded-2xl sm:rounded-full p-1 border border-stone-300/70 dark:border-slate-700">
            <button
              type="button"
              aria-pressed={exportFormat === 'svg'}
              onClick={() => {
                setExportFormat('svg');
                onDownloadSvg();
              }}
              disabled={isExporting || isProcessing || !svgContent}
              className={`min-h-10 px-3 py-1 text-xs font-serif uppercase tracking-wider rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                exportFormat === 'svg'
                  ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/60 font-semibold'
                  : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
              }`}
            >
              DOWNLOAD OPTIMIZED SVG
            </button>
            <button
              type="button"
              aria-pressed={exportFormat === 'png'}
              onClick={() => {
                setExportFormat('png');
                onDownloadPng(rasterScale);
              }}
              disabled={isExporting || isProcessing || !svgContent}
              className={`min-h-10 px-3 py-1 text-xs font-serif uppercase tracking-wider rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                exportFormat === 'png'
                  ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/60 font-semibold'
                  : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
              }`}
            >
              DOWNLOAD PNG
            </button>
            <button
              type="button"
              aria-pressed={exportFormat === 'webp'}
              onClick={() => {
                setExportFormat('webp');
                onDownloadWebp(rasterScale);
              }}
              disabled={isExporting || isProcessing || !svgContent}
              className={`min-h-10 px-3 py-1 text-xs font-serif uppercase tracking-wider rounded-full transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                exportFormat === 'webp'
                  ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/60 font-semibold'
                  : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
              }`}
            >
              WEBP
            </button>

            {exportFormat !== 'svg' && (
              <div role="group" aria-label={`${exportFormat.toUpperCase()} export scale`} className="flex items-center ml-1 border-l border-stone-300 dark:border-slate-700 pl-1 space-x-1">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRasterScale(s)}
                    disabled={isExporting || isProcessing}
                    aria-pressed={rasterScale === s}
                    className={`min-w-10 min-h-10 px-2 py-0.5 text-[10px] font-mono rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                      rasterScale === s ? 'bg-sky-500 text-white font-bold' : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {s}X
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG cleanup toggles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#faf5ef] dark:bg-slate-950 p-3 rounded-xl border border-stone-200/90 dark:border-slate-800">
        <label className="flex min-h-10 items-center text-xs text-stone-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!optOptions.removeComments}
            onChange={(e) => setOptOptions({ ...optOptions, removeComments: e.target.checked })}
            className="w-5 h-5 rounded border-stone-300 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 text-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 mr-2"
          />
          Clean Comments
        </label>
        <label className="flex min-h-10 items-center text-xs text-stone-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!optOptions.removeMetadata}
            onChange={(e) => setOptOptions({ ...optOptions, removeMetadata: e.target.checked })}
            className="w-5 h-5 rounded border-stone-300 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 text-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 mr-2"
          />
          Remove Metadata
        </label>
        <label className="flex min-h-10 items-center text-xs text-stone-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!optOptions.minify}
            onChange={(e) => setOptOptions({ ...optOptions, minify: e.target.checked })}
            className="w-5 h-5 rounded border-stone-300 dark:border-slate-700 bg-stone-100 dark:bg-slate-800 text-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 mr-2"
          />
          Minify Markup
        </label>
        <div className="flex items-center space-x-2">
          <label htmlFor={precisionId} className="text-xs text-stone-500 dark:text-slate-400">Decimal places:</label>
          <select
            id={precisionId}
            value={optOptions.precision ?? 2}
            onChange={(e) => setOptOptions({ ...optOptions, precision: Number(e.target.value) })}
            className="min-h-10 text-xs rounded border border-stone-300/80 dark:border-slate-800 bg-[#fdfaf6] dark:bg-slate-900 px-2 py-0.5 text-stone-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
      </div>

      {/* Raw SVG Output Box */}
      <div className="relative rounded-xl overflow-hidden border border-stone-200/90 dark:border-slate-800 bg-[#faf5ef] dark:bg-slate-950 text-stone-800 dark:text-slate-300">
        <pre tabIndex={0} aria-label="Optimized SVG source code" className="p-4 text-xs font-mono max-h-60 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
          {svgContent}
        </pre>
      </div>
    </section>
  );
};
