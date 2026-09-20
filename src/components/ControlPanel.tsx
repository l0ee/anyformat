import React, { useId } from 'react';
import { MonochromeOptions, ColorTracerOptions } from '../engine/types';

interface ControlPanelProps {
  mode: 'monochrome' | 'color';
  setMode: (mode: 'monochrome' | 'color') => void;
  monoOpts: MonochromeOptions;
  setMonoOpts: React.Dispatch<React.SetStateAction<MonochromeOptions>>;
  colorOpts: ColorTracerOptions;
  setColorOpts: React.Dispatch<React.SetStateAction<ColorTracerOptions>>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  mode,
  setMode,
  monoOpts,
  setMonoOpts,
  colorOpts,
  setColorOpts,
}) => {
  const idPrefix = useId();
  const controlId = (name: string) => `${idPrefix}-${name}`;
  const focusClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';

  return (
    <div className="app-panel text-stone-900 dark:text-white rounded-2xl p-6 space-y-5 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-slate-800 pb-4">
        <span className="text-sm font-semibold uppercase tracking-wider text-stone-700 dark:text-slate-300">TRACING MODE</span>
        <div role="group" aria-label="Tracing mode" className="bg-[#eee4d7]/85 dark:bg-slate-950 p-1 rounded-lg flex space-x-1 border border-stone-300/70 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('monochrome')}
            aria-pressed={mode === 'monochrome'}
            className={`min-h-10 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md transition-all motion-reduce:transition-none ${focusClasses} ${
              mode === 'monochrome'
                ? 'bg-rose-500/20 border border-rose-500/60 text-rose-700 dark:text-pink-300 font-bold'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
            }`}
          >
            Black & White
          </button>
          <button
            type="button"
            onClick={() => setMode('color')}
            aria-pressed={mode === 'color'}
            className={`min-h-10 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-md transition-all motion-reduce:transition-none ${focusClasses} ${
              mode === 'color'
                ? 'bg-rose-500/20 border border-rose-500/60 text-rose-700 dark:text-pink-300 font-bold'
                : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
            }`}
          >
            Multi-Color
          </button>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500 dark:text-slate-400 pt-1">
        VECTOR PARAMETERS
      </div>

      {/* Mode Specific Controls */}
      {mode === 'monochrome' ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('mono-threshold')}>B&amp;W Threshold</label>
              <output id={controlId('mono-threshold-value')} htmlFor={controlId('mono-threshold')} className="font-mono text-pink-600 dark:text-pink-400">{monoOpts.threshold ?? 128}</output>
            </div>
            <input
              id={controlId('mono-threshold')}
              type="range"
              min="1"
              max="254"
              value={monoOpts.threshold ?? 128}
              onChange={(e) => setMonoOpts({ ...monoOpts, threshold: Number(e.target.value) })}
              aria-describedby={controlId('mono-threshold-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('mono-despeckle')}>Despeckle (Speckle Suppression)</label>
              <output id={controlId('mono-despeckle-value')} htmlFor={controlId('mono-despeckle')} className="font-mono text-pink-600 dark:text-pink-400">{monoOpts.turdSize ?? 2} px</output>
            </div>
            <input
              id={controlId('mono-despeckle')}
              type="range"
              min="0"
              max="100"
              value={monoOpts.turdSize ?? 2}
              onChange={(e) => setMonoOpts({ ...monoOpts, turdSize: Number(e.target.value) })}
              aria-describedby={controlId('mono-despeckle-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('mono-alpha')}>Corner Threshold (Alpha Max)</label>
              <output id={controlId('mono-alpha-value')} htmlFor={controlId('mono-alpha')} className="font-mono text-pink-600 dark:text-pink-400">{monoOpts.alphaMax ?? 1.0}</output>
            </div>
            <input
              id={controlId('mono-alpha')}
              type="range"
              min="0"
              max="1.3"
              step="0.05"
              value={monoOpts.alphaMax ?? 1.0}
              onChange={(e) => setMonoOpts({ ...monoOpts, alphaMax: Number(e.target.value) })}
              aria-describedby={controlId('mono-alpha-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('mono-tolerance')}>Curve Optimization Tolerance</label>
              <output id={controlId('mono-tolerance-value')} htmlFor={controlId('mono-tolerance')} className="font-mono text-pink-600 dark:text-pink-400">{monoOpts.optTolerance ?? 0.2}</output>
            </div>
            <input
              id={controlId('mono-tolerance')}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={monoOpts.optTolerance ?? 0.2}
              onChange={(e) => setMonoOpts({ ...monoOpts, optTolerance: Number(e.target.value) })}
              aria-describedby={controlId('mono-tolerance-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('mono-resolution')}>Max Trace Resolution</label>
              <output id={controlId('mono-resolution-value')} htmlFor={controlId('mono-resolution')} className="font-mono text-pink-600 dark:text-pink-400">{monoOpts.maxResolution ?? 1024} px</output>
            </div>
            <input
              id={controlId('mono-resolution')}
              type="range"
              min="256"
              max="2048"
              step="128"
              value={monoOpts.maxResolution ?? 1024}
              onChange={(e) => setMonoOpts({ ...monoOpts, maxResolution: Number(e.target.value) })}
              aria-describedby={controlId('mono-resolution-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div className="pt-2">
            <div className="flex flex-col justify-end space-y-2">
              <label className="flex min-h-10 items-center text-xs font-medium text-stone-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!monoOpts.invert}
                  onChange={(e) => setMonoOpts({ ...monoOpts, invert: e.target.checked })}
                  className={`w-5 h-5 rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-pink-500 mr-2 ${focusClasses}`}
                />
                Invert Colors
              </label>
              <label className="flex min-h-10 items-center text-xs font-medium text-stone-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!monoOpts.blackOnWhite}
                  onChange={(e) => setMonoOpts({ ...monoOpts, blackOnWhite: e.target.checked })}
                  className={`w-5 h-5 rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-pink-500 mr-2 ${focusClasses}`}
                />
                Black on White
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('color-count')}>Max Color Count</label>
              <output id={controlId('color-count-value')} htmlFor={controlId('color-count')} className="font-mono text-pink-600 dark:text-pink-400">{colorOpts.numberOfColors ?? 8}</output>
            </div>
            <input
              id={controlId('color-count')}
              type="range"
              min="2"
              max="32"
              value={colorOpts.numberOfColors ?? 8}
              onChange={(e) => setColorOpts({ ...colorOpts, numberOfColors: Number(e.target.value) })}
              aria-describedby={controlId('color-count-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('color-despeckle')}>Speckle Suppression (Turd Size)</label>
              <output id={controlId('color-despeckle-value')} htmlFor={controlId('color-despeckle')} className="font-mono text-pink-600 dark:text-pink-400">{colorOpts.turdSize ?? 2} px</output>
            </div>
            <input
              id={controlId('color-despeckle')}
              type="range"
              min="0"
              max="100"
              value={colorOpts.turdSize ?? 2}
              onChange={(e) => setColorOpts({ ...colorOpts, turdSize: Number(e.target.value) })}
              aria-describedby={controlId('color-despeckle-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('color-alpha')}>Corner Alpha Max</label>
              <output id={controlId('color-alpha-value')} htmlFor={controlId('color-alpha')} className="font-mono text-pink-600 dark:text-pink-400">{colorOpts.alphaMax ?? 1.0}</output>
            </div>
            <input
              id={controlId('color-alpha')}
              type="range"
              min="0"
              max="1.3"
              step="0.05"
              value={colorOpts.alphaMax ?? 1.0}
              onChange={(e) => setColorOpts({ ...colorOpts, alphaMax: Number(e.target.value) })}
              aria-describedby={controlId('color-alpha-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('color-tolerance')}>Curve Optimization Tolerance</label>
              <output id={controlId('color-tolerance-value')} htmlFor={controlId('color-tolerance')} className="font-mono text-pink-600 dark:text-pink-400">{colorOpts.optTolerance ?? 0.2}</output>
            </div>
            <input
              id={controlId('color-tolerance')}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={colorOpts.optTolerance ?? 0.2}
              onChange={(e) => setColorOpts({ ...colorOpts, optTolerance: Number(e.target.value) })}
              aria-describedby={controlId('color-tolerance-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-slate-300 mb-1">
              <label htmlFor={controlId('color-resolution')}>Max Trace Resolution</label>
              <output id={controlId('color-resolution-value')} htmlFor={controlId('color-resolution')} className="font-mono text-pink-600 dark:text-pink-400">{colorOpts.maxResolution ?? 1024} px</output>
            </div>
            <input
              id={controlId('color-resolution')}
              type="range"
              min="256"
              max="2048"
              step="128"
              value={colorOpts.maxResolution ?? 1024}
              onChange={(e) => setColorOpts({ ...colorOpts, maxResolution: Number(e.target.value) })}
              aria-describedby={controlId('color-resolution-value')}
              className={`w-full accent-pink-500 bg-[#e8dcce] dark:bg-slate-800 h-3 rounded-lg cursor-pointer ${focusClasses}`}
            />
          </div>

        </div>
      )}
    </div>
  );
};
