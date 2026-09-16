import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { HeroHeader } from './components/HeroHeader';
import { Dropzone } from './components/Dropzone';
import { PresetSelector } from './components/PresetSelector';
import { ControlPanel } from './components/ControlPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { PaletteEditor } from './components/PaletteEditor';
import { CodeInspector } from './components/CodeInspector';
import { BatchQueue } from './components/BatchQueue';
import { Footer } from './components/Footer';
import { UniversalDropzone } from './components/universal/UniversalDropzone';
import { UniversalQueue } from './components/universal/UniversalQueue';

import { convertUniversalFile } from './engine/universal/converterEngine';
import { getFileExtension, isSupportedSourceExtension, SUPPORTED_FORMATS, UniversalTaskItem } from './engine/universal/types';

import { traceWorkerClient } from './workers/traceWorkerClient';
import { extractPalette } from './engine/paletteExtractor';
import { optimizeSvg } from './engine/svgOptimizer';
import { rasterizeSvgToBlob } from './engine/svgRasterizer';
import { exportBatchZip, downloadBlob } from './engine/zipExporter';

import {
  MonochromeOptions,
  ColorTracerOptions,
  OptimizeOptions,
  PaletteColor,
  PresetType,
  BatchItem,
} from './engine/types';

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

const SUPPORTED_RASTER_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']);
const SUPPORTED_RASTER_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/bmp',
  'image/gif',
]);

const isSupportedRasterFile = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_RASTER_EXTENSIONS.has(extension) || SUPPORTED_RASTER_MIME_TYPES.has(file.type);
};

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem('theme') !== 'light'
  );
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'universal'>('single');
  const [toast, setToast] = useState<Toast | null>(null);

  // Universal File Converter state
  const [universalItems, setUniversalItems] = useState<UniversalTaskItem[]>([]);
  const [isUniversalProcessing, setIsUniversalProcessing] = useState<boolean>(false);

  // Single file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [tracingMode, setTracingMode] = useState<'monochrome' | 'color'>('color');
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('photo');

  const [monoOpts, setMonoOpts] = useState<MonochromeOptions>({
    threshold: 128,
    invert: false,
    turdSize: 2,
    alphaMax: 1.0,
    optTolerance: 0.2,
    turnPolicy: 'minority',
    blackOnWhite: true,
    maxResolution: 1024,
  });

  const [colorOpts, setColorOpts] = useState<ColorTracerOptions>({
    numberOfColors: 8,
    quantization: 'median-cut',
    turdSize: 2,
    alphaMax: 1.0,
    blurRadius: 0,
    maxResolution: 1024,
  });

  const [optOpts, setOptOpts] = useState<OptimizeOptions>({
    precision: 2,
    removeComments: true,
    removeMetadata: true,
    minify: false,
  });

  const [rawSvg, setRawSvg] = useState<string>('');
  const [optimizedSvg, setOptimizedSvg] = useState<string>('');
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Batch mode state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const singleProcessIdRef = useRef(0);
  const originalUrlRef = useRef('');
  const batchItemsRef = useRef<BatchItem[]>([]);
  const universalItemsRef = useRef<UniversalTaskItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3000);
  }, []);

  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => { originalUrlRef.current = originalUrl; }, [originalUrl]);
  useEffect(() => { batchItemsRef.current = batchItems; }, [batchItems]);
  useEffect(() => { universalItemsRef.current = universalItems; }, [universalItems]);
  useEffect(() => () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    batchItemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    universalItemsRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
  }, []);

  // Handle preset application
  const handlePresetSelect = (preset: PresetType) => {
    setSelectedPreset(preset);
    switch (preset) {
      case 'logo':
        setTracingMode('monochrome');
        setMonoOpts((prev) => ({ ...prev, threshold: 140, turdSize: 5, optTolerance: 0.1 }));
        break;
      case 'photo':
        setTracingMode('color');
        setColorOpts((prev) => ({ ...prev, numberOfColors: 16, turdSize: 1, blurRadius: 1 }));
        break;
      case 'clipart':
        setTracingMode('color');
        setColorOpts((prev) => ({ ...prev, numberOfColors: 5, turdSize: 10, blurRadius: 0 }));
        break;
    }
    showToast(`Preset "${preset}" applied`, 'info');
  };

  // Run conversion pipeline with non-blocking async delay & debounce
  const processSingleFile = useCallback(async () => {
    if (!selectedFile) return;
    const processId = ++singleProcessIdRef.current;
    setIsProcessing(true);

    // Give browser UI time to render loading spinner before heavy CPU work
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      let rawResultSvg = '';
      let w = 0;
      let h = 0;

      if (tracingMode === 'monochrome') {
        const result = await traceWorkerClient.traceMonochrome(selectedFile, monoOpts);
        rawResultSvg = result.svg;
        w = result.width;
        h = result.height;
        if (processId === singleProcessIdRef.current) setPalette([]);
      } else {
        const result = await traceWorkerClient.traceColor(selectedFile, colorOpts);
        rawResultSvg = result.svg;
        w = result.width;
        h = result.height;
        if (result.colors) {
          if (processId === singleProcessIdRef.current) setPalette(result.colors);
        } else {
          const extPalette = await extractPalette(selectedFile, colorOpts.numberOfColors || 8);
          if (processId === singleProcessIdRef.current) setPalette(extPalette);
        }
      }

      if (processId !== singleProcessIdRef.current) return;
      setRawSvg(rawResultSvg);
      setDimensions({ width: w, height: h });

      // Apply optimization
      const optResult = optimizeSvg(rawResultSvg, optOpts);
      setOptimizedSvg(optResult.svg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tracing error occurred';
      console.error('Tracing error:', err);
      if (processId === singleProcessIdRef.current) showToast(msg, 'error');
    } finally {
      if (processId === singleProcessIdRef.current) setIsProcessing(false);
    }
  }, [selectedFile, tracingMode, monoOpts, colorOpts, optOpts, showToast]);

  // Re-run single processing on file or trace config change with 350ms debounce
  useEffect(() => {
    if (!selectedFile) return;

    const timer = setTimeout(() => {
      processSingleFile();
    }, 350);

    return () => clearTimeout(timer);
  // Optimization settings are intentionally excluded; the next effect updates only the SVG output.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, tracingMode, monoOpts, colorOpts]);

  // Re-run optimization when cleanup settings change
  useEffect(() => {
    if (rawSvg) {
      const optResult = optimizeSvg(rawSvg, optOpts);
      setOptimizedSvg(optResult.svg);
    }
  }, [rawSvg, optOpts]);

  // Reset single file state and revoke Object URL
  const resetSingleFileState = () => {
    singleProcessIdRef.current += 1;
    if (originalUrl) {
      URL.revokeObjectURL(originalUrl);
    }
    setSelectedFile(null);
    setOriginalUrl('');
    setRawSvg('');
    setOptimizedSvg('');
    setPalette([]);
    setDimensions({ width: 0, height: 0 });
  };

  // Handle single file drop
  const handleSingleFileSelect = (files: FileList | File[]) => {
    const file = files[0];
    if (file && isSupportedRasterFile(file)) {
      resetSingleFileState();
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setOriginalUrl(url);
      showToast(`Loaded ${file.name}`, 'info');
    } else if (file) {
      showToast('Unsupported file. Choose a PNG, JPG, WebP, BMP, or GIF image.', 'error');
    }
  };

  // Handle batch file drop
  const handleBatchFileSelect = (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter(isSupportedRasterFile);
    const rejectedCount = selectedFiles.length - validFiles.length;

    if (validFiles.length === 0) {
      showToast('No supported images found. Choose PNG, JPG, WebP, BMP, or GIF files.', 'error');
      return;
    }

    const newItems: BatchItem[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      status: 'idle',
      progress: 0,
      previewUrl: URL.createObjectURL(file),
    }));
    setBatchItems((prev) => [...prev, ...newItems]);
    showToast(
      rejectedCount > 0
        ? `Added ${newItems.length} image${newItems.length === 1 ? '' : 's'}; skipped ${rejectedCount} unsupported file${rejectedCount === 1 ? '' : 's'}.`
        : `Added ${newItems.length} file(s) to queue`,
      rejectedCount > 0 ? 'error' : 'info'
    );
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearBatchQueue = () => {
    batchItems.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setBatchItems([]);
    showToast('Batch queue cleared', 'info');
  };

  // Run Batch Processing
  const startBatchProcess = async () => {
    setIsBatchProcessing(true);
    const updated = batchItems.map((item) => ({ ...item }));
    const commitBatchUpdates = () => {
      setBatchItems((current) => {
        const updatesById = new Map(updated.map((item) => [item.id, item]));
        return current.map((item) => updatesById.get(item.id) || item);
      });
    };

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'completed') continue;

      updated[i].status = 'processing';
      updated[i].progress = 20;
      updated[i].error = undefined;
      commitBatchUpdates();

      // Yield thread to UI between batch files
      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        let svgRes = '';
        if (tracingMode === 'monochrome') {
          const res = await traceWorkerClient.traceMonochrome(updated[i].file, monoOpts);
          svgRes = res.svg;
          updated[i].width = res.width;
          updated[i].height = res.height;
        } else {
          const res = await traceWorkerClient.traceColor(updated[i].file, colorOpts);
          svgRes = res.svg;
          updated[i].width = res.width;
          updated[i].height = res.height;
        }

        const optRes = optimizeSvg(svgRes, optOpts);
        updated[i].svgResult = optRes.svg;
        updated[i].status = 'completed';
        updated[i].progress = 100;
      } catch (err: unknown) {
        updated[i].status = 'error';
        updated[i].error = err instanceof Error ? err.message : 'Tracing failed';
      }

      commitBatchUpdates();
    }

    setIsBatchProcessing(false);
    const failureCount = updated.filter((item) => item.status === 'error').length;
    showToast(
      failureCount > 0
        ? `Batch finished with ${failureCount} failed file${failureCount === 1 ? '' : 's'}.`
        : 'Batch conversion complete!',
      failureCount > 0 ? 'error' : 'success'
    );
  };

  // Color swap in palette editor
  const handlePaletteColorChange = (oldHex: string, newHex: string) => {
    if (!rawSvg) return;
    const oldRaw = oldHex.replace('#', '');
    const newRaw = newHex.replace('#', '');

    const regexHash = new RegExp(`#${oldRaw}`, 'gi');
    const regexLayer = new RegExp(`layer-${oldRaw}`, 'gi');

    const updatedSvg = rawSvg
      .replace(regexHash, newHex.startsWith('#') ? newHex : `#${newHex}`)
      .replace(regexLayer, `layer-${newRaw}`);

    setRawSvg(updatedSvg);
    setPalette((prev) =>
      prev.map((c) => (c.hex.toLowerCase() === oldHex.toLowerCase() ? { ...c, hex: newHex } : c))
    );
    showToast(`Color updated: ${oldHex} -> ${newHex}`, 'success');
  };

  // Downloads
  const downloadSvgFile = () => {
    if (!optimizedSvg) return;
    const blob = new Blob([optimizedSvg], { type: 'image/svg+xml' });
    const fileName = `${selectedFile?.name.replace(/\.[^/.]+$/, '') || 'vector'}.svg`;
    downloadBlob(blob, fileName);
    showToast('SVG file downloaded!', 'success');
  };

  const downloadPngFile = async (scale: number) => {
    if (!optimizedSvg || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await rasterizeSvgToBlob(optimizedSvg, {
        width: dimensions.width,
        height: dimensions.height,
        scale,
        format: 'png',
      });
      const fileName = `${selectedFile?.name.replace(/\.[^/.]+$/, '') || 'vector'}@${scale}x.png`;
      downloadBlob(blob, fileName);
      showToast(`PNG (${scale}x) downloaded!`, 'success');
    } catch (err) {
      console.error('Rasterize error:', err);
      showToast('PNG rasterization failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadWebpFile = async (scale: number) => {
    if (!optimizedSvg || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await rasterizeSvgToBlob(optimizedSvg, {
        width: dimensions.width,
        height: dimensions.height,
        scale,
        format: 'webp',
        quality: 0.92,
      });
      const fileName = `${selectedFile?.name.replace(/\.[^/.]+$/, '') || 'vector'}@${scale}x.webp`;
      downloadBlob(blob, fileName);
      showToast(`WebP (${scale}x) downloaded!`, 'success');
    } catch (err) {
      console.error('Rasterize error:', err);
      showToast('WebP rasterization failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Universal File Handlers
  const handleUniversalFilesAdded = (files: File[]) => {
    const supportedFiles = files.filter((file) => {
      return isSupportedSourceExtension(getFileExtension(file.name));
    });
    const newTasks: UniversalTaskItem[] = supportedFiles.map((file) => {
      const ext = getFileExtension(file.name);
      const targetExt = SUPPORTED_FORMATS[ext].canExportTo[0];
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        sourceExt: ext,
        targetExt,
        status: 'idle',
        progress: 0,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      };
    });
    setUniversalItems((prev) => [...prev, ...newTasks]);
    showToast(`Added ${newTasks.length} file(s) to Universal Converter`, 'info');
  };

  const handleUniversalTargetChange = (id: string, targetExt: string) => {
    setUniversalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, targetExt } : item))
    );
  };

  const handleUniversalApplyAllTarget = (targetExt: string) => {
    const supportsEveryItem = universalItems.every((item) =>
      SUPPORTED_FORMATS[item.sourceExt]?.canExportTo.includes(targetExt)
    );
    if (!supportsEveryItem) {
      showToast(`.${targetExt.toUpperCase()} is not available for every queued source file.`, 'error');
      return;
    }
    setUniversalItems((prev) => prev.map((item) => ({ ...item, targetExt })));
    showToast(`Set all target formats to .${targetExt.toUpperCase()}`, 'info');
  };

  const handleRemoveUniversalItem = (id: string) => {
    setUniversalItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearUniversalQueue = () => {
    universalItems.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setUniversalItems([]);
    showToast('Universal queue cleared', 'info');
  };

  const startUniversalConversion = async () => {
    setIsUniversalProcessing(true);
    const updated = universalItems.map((item) => ({ ...item }));
    const commitUniversalUpdates = () => {
      setUniversalItems((current) => {
        const updatesById = new Map(updated.map((item) => [item.id, item]));
        return current.map((item) => updatesById.get(item.id) || item);
      });
    };

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'completed') continue;

      updated[i].status = 'processing';
      updated[i].progress = 10;
      commitUniversalUpdates();

      await new Promise((resolve) => setTimeout(resolve, 30));

      try {
        const result = await convertUniversalFile(
          updated[i].file,
          updated[i].targetExt,
          (percent) => {
          updated[i].progress = percent;
            commitUniversalUpdates();
          }
        );

        updated[i].resultBlob = result.blob;
        updated[i].resultUrl = URL.createObjectURL(result.blob);
        updated[i].resultSize = result.blob.size;
        updated[i].status = 'completed';
        updated[i].progress = 100;
      } catch (err: unknown) {
        updated[i].status = 'error';
        updated[i].error = err instanceof Error ? err.message : 'Conversion failed';
      }

      commitUniversalUpdates();
    }

    setIsUniversalProcessing(false);
    const failureCount = updated.filter((item) => item.status === 'error').length;
    showToast(
      failureCount > 0
        ? `Conversion finished with ${failureCount} failed file${failureCount === 1 ? '' : 's'}.`
        : 'Universal conversion complete!',
      failureCount > 0 ? 'error' : 'success'
    );
  };

  const downloadUniversalItem = (id: string) => {
    const item = universalItems.find((i) => i.id === id);
    if (item?.resultBlob) {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      downloadBlob(item.resultBlob, `${baseName}.${item.targetExt}`);
      showToast(`Downloaded ${baseName}.${item.targetExt}`, 'success');
    }
  };

  const exportBatchZipFiles = async () => {
    const exportItems = batchItems
      .filter((item) => item.status === 'completed' && item.svgResult)
      .map((item) => ({
        filename: `${item.name.replace(/\.[^/.]+$/, '')}.svg`,
        content: item.svgResult!,
      }));

    if (exportItems.length === 0) return;
    try {
      const zipBlob = await exportBatchZip(exportItems);
      downloadBlob(zipBlob, 'vectorized_batch.zip');
      showToast('Batch ZIP exported!', 'success');
    } catch (err) {
      console.error('ZIP export error:', err);
      showToast('Failed to export ZIP file', 'error');
    }
  };

  const exportUniversalZip = async () => {
    const exportItems = universalItems
      .filter((i) => i.status === 'completed' && i.resultBlob)
      .map((i) => ({
        filename: `${i.name.replace(/\.[^/.]+$/, '')}.${i.targetExt}`,
        content: i.resultBlob!,
      }));

    if (exportItems.length === 0) return;
    try {
      const zipBlob = await exportBatchZip(exportItems);
      downloadBlob(zipBlob, 'converted_files.zip');
      showToast('Universal ZIP exported!', 'success');
    } catch (err) {
      console.error('ZIP export error:', err);
      showToast('Failed to export ZIP file', 'error');
    }
  };

  return (
    <div className="app-shell relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
      <a href="#main-content" className="skip-link">
        Skip to converter
      </a>

      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div
          className="app-toast fixed inset-x-3 bottom-3 z-[60] flex justify-center sm:inset-x-auto sm:bottom-5 sm:right-5"
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <div
            className={`max-w-md rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl ${
              toast.type === 'success'
                ? 'bg-emerald-700/95'
                : toast.type === 'error'
                ? 'bg-rose-700/95'
                : 'bg-indigo-700/95'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="app-main relative mx-auto max-w-7xl space-y-6 px-3 pb-8 pt-6 sm:space-y-8 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8"
      >
        <HeroHeader activeTab={activeTab} />

        {activeTab === 'single' ? (
          <div className="space-y-8">
            {!selectedFile ? (
              <Dropzone onFileSelect={handleSingleFileSelect} />
            ) : (
              <div className="space-y-6">
                <div className="app-panel flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={originalUrl}
                      alt={`Preview of ${selectedFile.name}`}
                      className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                    />
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {selectedFile.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {dimensions.width} x {dimensions.height} px
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetSingleFileState}
                    className="min-h-11 shrink-0 self-start rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 sm:self-auto dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                  >
                    Change File
                  </button>
                </div>

                <PresetSelector
                  selectedPreset={selectedPreset}
                  onSelectPreset={handlePresetSelect}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <ControlPanel
                      mode={tracingMode}
                      setMode={setTracingMode}
                      monoOpts={monoOpts}
                      setMonoOpts={setMonoOpts}
                      colorOpts={colorOpts}
                      setColorOpts={setColorOpts}
                    />
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    {isProcessing ? (
                      <div
                        className="app-panel flex min-h-72 flex-col items-center justify-center rounded-2xl sm:min-h-[400px]"
                        role="status"
                        aria-live="polite"
                      >
                        <svg className="animate-spin w-10 h-10 text-indigo-600 mb-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          Tracing curves & quantizing colors...
                        </span>
                      </div>
                    ) : (
                      <ComparisonSlider
                        originalUrl={originalUrl}
                        svgContent={optimizedSvg || rawSvg}
                      />
                    )}

                    {tracingMode === 'color' && (
                      <PaletteEditor colors={palette} onColorChange={handlePaletteColorChange} />
                    )}

                    <CodeInspector
                      svgContent={optimizedSvg || rawSvg}
                      optOptions={optOpts}
                      setOptOptions={setOptOpts}
                      onDownloadSvg={downloadSvgFile}
                      onDownloadPng={downloadPngFile}
                      onDownloadWebp={downloadWebpFile}
                      isExporting={isExporting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'batch' ? (
          <div className="space-y-6">
            <Dropzone onFileSelect={handleBatchFileSelect} multiple={true} />

            {batchItems.length > 0 && (
              <>
                <section aria-labelledby="batch-settings-heading" className="space-y-5 rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-slate-900 shadow-xl backdrop-blur-md sm:p-5 dark:border-slate-800 dark:bg-slate-900/80 dark:text-white">
                  <div>
                    <h2 id="batch-settings-heading" className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Batch settings</h2>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Choose a preset or tune the shared tracing controls before processing the queue.</p>
                  </div>
                  <PresetSelector selectedPreset={selectedPreset} onSelectPreset={handlePresetSelect} />
                  <ControlPanel
                    mode={tracingMode}
                    setMode={setTracingMode}
                    monoOpts={monoOpts}
                    setMonoOpts={setMonoOpts}
                    colorOpts={colorOpts}
                    setColorOpts={setColorOpts}
                  />
                </section>
                <BatchQueue
                  items={batchItems}
                  onRemoveItem={handleRemoveBatchItem}
                  onClearQueue={handleClearBatchQueue}
                  onStartBatch={startBatchProcess}
                  onExportZip={exportBatchZipFiles}
                  isProcessing={isBatchProcessing}
                />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <UniversalDropzone onFilesAdded={handleUniversalFilesAdded} />

            {universalItems.length > 0 && (
              <UniversalQueue
                items={universalItems}
                onTargetFormatChange={handleUniversalTargetChange}
                onApplyAllTargetFormat={handleUniversalApplyAllTarget}
                onRemoveItem={handleRemoveUniversalItem}
                onClearQueue={handleClearUniversalQueue}
                onStartConversion={startUniversalConversion}
                onDownloadItem={downloadUniversalItem}
                onExportZip={exportUniversalZip}
                isProcessing={isUniversalProcessing}
              />
            )}
          </div>
        )}
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
};

export default App;
