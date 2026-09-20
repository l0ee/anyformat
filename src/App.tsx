import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { HeroHeader } from './components/HeroHeader';
import { HoverBackground } from './components/HoverBackground';
import { Dropzone } from './components/Dropzone';
import { PresetSelector } from './components/PresetSelector';
import { ControlPanel } from './components/ControlPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { PaletteEditor } from './components/PaletteEditor';
import { CodeInspector } from './components/CodeInspector';
import { BatchQueue } from './components/BatchQueue';
import { Footer } from './components/Footer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { UniversalDropzone } from './components/universal/UniversalDropzone';
import { UniversalQueue } from './components/universal/UniversalQueue';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { getClipboardImages } from './components/clipboardPaste';
import { ShieldCheck, Cpu, Layers } from 'lucide-react';

const VECTOR_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
};

const UNIVERSAL_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

import { convertUniversalFile } from './engine/universal/converterEngine';
import { getFileExtension, isSupportedSourceExtension, SUPPORTED_FORMATS, UniversalTaskItem } from './engine/universal/types';
import { getPdfPageCount } from './engine/pdfConverter';

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

const MAX_QUEUE_CAPACITY = 100;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const isSupportedRasterFile = (file: File): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_RASTER_EXTENSIONS.has(extension) || SUPPORTED_RASTER_MIME_TYPES.has(file.type);
};

const getStoredTheme = (): boolean => {
  try {
    return localStorage.getItem('theme') !== 'light';
  } catch {
    return true;
  }
};

const setStoredTheme = (darkMode: boolean): void => {
  try {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  } catch {
    // Ignore storage errors in blocked/private browsing contexts
  }
};

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(getStoredTheme);
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
    quantization: 'kmeans',
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
  const isBatchProcessingRef = useRef(false);
  const isUniversalProcessingRef = useRef(false);
  const singleProcessIdRef = useRef(0);
  const singleAbortControllerRef = useRef<AbortController | null>(null);
  const originalUrlRef = useRef('');
  const batchItemsRef = useRef<BatchItem[]>([]);
  const universalItemsRef = useRef<UniversalTaskItem[]>([]);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    setStoredTheme(darkMode);
  }, [darkMode]);

  useEffect(() => { originalUrlRef.current = originalUrl; }, [originalUrl]);
  useEffect(() => { batchItemsRef.current = batchItems; }, [batchItems]);
  useEffect(() => { universalItemsRef.current = universalItems; }, [universalItems]);
  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    singleAbortControllerRef.current?.abort();
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

  const optOptsRef = useRef(optOpts);
  useEffect(() => { optOptsRef.current = optOpts; }, [optOpts]);

  // Run conversion pipeline with non-blocking async delay & debounce
  const processSingleFile = useCallback(async (processId: number) => {
    if (!selectedFile) return;
    if (processId !== singleProcessIdRef.current) return;

    singleAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    singleAbortControllerRef.current = abortController;

    setIsProcessing(true);

    // Give browser UI time to render loading spinner before heavy CPU work
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      let rawResultSvg = '';
      let w = 0;
      let h = 0;

      if (tracingMode === 'monochrome') {
        const result = await traceWorkerClient.traceMonochrome(selectedFile, monoOpts, abortController.signal);
        if (processId !== singleProcessIdRef.current) return;
        rawResultSvg = result.svg;
        w = result.width;
        h = result.height;
        setPalette([]);
      } else {
        const result = await traceWorkerClient.traceColor(selectedFile, colorOpts, abortController.signal);
        if (processId !== singleProcessIdRef.current) return;
        rawResultSvg = result.svg;
        w = result.width;
        h = result.height;
        if (result.colors) {
          setPalette(result.colors);
        } else {
          const extPalette = await extractPalette(selectedFile, colorOpts.numberOfColors || 8);
          if (processId !== singleProcessIdRef.current) return;
          setPalette(extPalette);
        }
      }

      if (processId !== singleProcessIdRef.current) return;
      setRawSvg(rawResultSvg);
      setDimensions({ width: w, height: h });

      // Apply optimization
      const optResult = optimizeSvg(rawResultSvg, optOptsRef.current);
      setOptimizedSvg(optResult.svg);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Tracing error occurred';
      console.error('Tracing error:', err);
      if (processId === singleProcessIdRef.current) showToast(msg, 'error');
    } finally {
      if (processId === singleProcessIdRef.current) setIsProcessing(false);
    }
  }, [selectedFile, tracingMode, monoOpts, colorOpts, showToast]);

  // Re-run single processing on file or trace config change with 350ms debounce
  useEffect(() => {
    if (!selectedFile) return;

    const processId = ++singleProcessIdRef.current;
    setIsProcessing(true);

    const timer = setTimeout(() => {
      processSingleFile(processId);
    }, 350);

    return () => {
      clearTimeout(timer);
      singleAbortControllerRef.current?.abort();
    };
  // Optimization settings are intentionally excluded; the next effect updates only the SVG output.
  }, [selectedFile, tracingMode, monoOpts, colorOpts, processSingleFile]);

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
    singleAbortControllerRef.current?.abort();
    singleAbortControllerRef.current = null;
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
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`${file.name} exceeded the 100 MB limit.`, 'error');
        return;
      }
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
    const supportedFiles = selectedFiles.filter(isSupportedRasterFile);
    const rejectedFormatCount = selectedFiles.length - supportedFiles.length;

    const validFiles = supportedFiles.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    const oversizedCount = supportedFiles.length - validFiles.length;

    if (oversizedCount > 0) {
      showToast(
        `${oversizedCount} file${oversizedCount === 1 ? '' : 's'} exceeded the 100 MB limit and ${oversizedCount === 1 ? 'was' : 'were'} skipped.`,
        'error'
      );
    }

    if (validFiles.length === 0) {
      if (rejectedFormatCount > 0 && oversizedCount === 0) {
        showToast('No supported images found. Choose PNG, JPG, WebP, BMP, or GIF files.', 'error');
      }
      return;
    }

    const availableCapacity = Math.max(0, MAX_QUEUE_CAPACITY - batchItems.length);
    const acceptedFiles = validFiles.slice(0, availableCapacity);
    const overCapCount = validFiles.length - acceptedFiles.length;

    const newItems: BatchItem[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      status: 'idle',
      progress: 0,
      previewUrl: URL.createObjectURL(file),
    }));

    if (newItems.length > 0) {
      setBatchItems((prev) => [...prev, ...newItems]);
    }

    if (overCapCount > 0) {
      showToast(
        `Accepted ${acceptedFiles.length} image${acceptedFiles.length === 1 ? '' : 's'}; skipped ${overCapCount} file${overCapCount === 1 ? '' : 's'} (${overCapCount} over the 100-file queue limit).`,
        'error'
      );
    } else if (rejectedFormatCount > 0) {
      showToast(
        `Added ${newItems.length} image${newItems.length === 1 ? '' : 's'}; skipped ${rejectedFormatCount} unsupported file${rejectedFormatCount === 1 ? '' : 's'}.`,
        'error'
      );
    } else {
      showToast(`Added ${newItems.length} file(s) to queue`, 'info');
    }
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
  const startBatchProcess = async (targetIds?: string[] | unknown) => {
    if (isBatchProcessingRef.current) return;
    isBatchProcessingRef.current = true;
    setIsBatchProcessing(true);
    const processedIds = new Set<string>();
    const ids = Array.isArray(targetIds) ? targetIds : undefined;

    const finalStatuses = new Map<string, 'idle' | 'processing' | 'completed' | 'error'>();
    batchItemsRef.current.forEach((item) => finalStatuses.set(item.id, item.status));

    try {
      while (true) {
        const nextItem = batchItemsRef.current.find(
          (item) => item.status !== 'completed' && item.status !== 'processing' && !processedIds.has(item.id) && (ids ? ids.includes(item.id) : true)
        );
        if (!nextItem) break;

        processedIds.add(nextItem.id);
        const currentId = nextItem.id;
        const currentFile = nextItem.file;

        setBatchItems((current) => {
          const updated = current.map((item) =>
            item.id === currentId
              ? { ...item, status: 'processing' as const, progress: 20, error: undefined }
              : item
          );
          batchItemsRef.current = updated;
          return updated;
        });

        // Yield thread to UI between batch files
        await new Promise((resolve) => setTimeout(resolve, 50));

        try {
          let svgRes = '';
          let width = 0;
          let height = 0;
          if (tracingMode === 'monochrome') {
            const res = await traceWorkerClient.traceMonochrome(currentFile, monoOpts);
            svgRes = res.svg;
            width = res.width;
            height = res.height;
          } else {
            const res = await traceWorkerClient.traceColor(currentFile, colorOpts);
            svgRes = res.svg;
            width = res.width;
            height = res.height;
          }

          const optRes = optimizeSvg(svgRes, optOptsRef.current);
          finalStatuses.set(currentId, 'completed');

          setBatchItems((current) => {
            const updated = current.map((item) =>
              item.id === currentId
                ? {
                    ...item,
                    svgResult: optRes.svg,
                    status: 'completed' as const,
                    progress: 100,
                    width,
                    height,
                  }
                : item
            );
            batchItemsRef.current = updated;
            return updated;
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Tracing failed';
          finalStatuses.set(currentId, 'error');

          setBatchItems((current) => {
            const updated = current.map((item) =>
              item.id === currentId
                ? { ...item, status: 'error' as const, error: errMsg }
                : item
            );
            batchItemsRef.current = updated;
            return updated;
          });
        }
      }
    } finally {
      isBatchProcessingRef.current = false;
      setIsBatchProcessing(false);
    }

    const failureCount = Array.from(finalStatuses.values()).filter((s) => s === 'error').length;
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
    const valid: File[] = [];
    const oversized: File[] = [];
    const unsupported: File[] = [];

    files.forEach((file) => {
      const ext = getFileExtension(file.name);
      if (!isSupportedSourceExtension(ext)) {
        unsupported.push(file);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        oversized.push(file);
      } else {
        valid.push(file);
      }
    });

    if (oversized.length > 0) {
      showToast(
        `${oversized.length} file${oversized.length === 1 ? '' : 's'} exceeded the 100 MB limit and ${oversized.length === 1 ? 'was' : 'were'} skipped.`,
        'error'
      );
    }
    if (unsupported.length > 0) {
      showToast(
        `${unsupported.length} unsupported file${unsupported.length === 1 ? '' : 's'} skipped.`,
        'error'
      );
    }

    const availableCapacity = Math.max(0, MAX_QUEUE_CAPACITY - universalItems.length);
    const acceptedFiles = valid.slice(0, availableCapacity);
    const overCapCount = valid.length - acceptedFiles.length;

    const newTasks: UniversalTaskItem[] = acceptedFiles.map((file) => {
      const ext = getFileExtension(file.name);
      const spec = Object.prototype.hasOwnProperty.call(SUPPORTED_FORMATS, ext)
        ? SUPPORTED_FORMATS[ext]
        : undefined;
      const targetExt = spec?.canExportTo[0] || 'svg';
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        sourceExt: ext,
        targetExt,
        status: 'idle',
        progress: 0,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        pageNumber: ext === 'pdf' ? 1 : undefined,
      };
    });

    if (newTasks.length > 0) {
      setUniversalItems((prev) => [...prev, ...newTasks]);

      // Read PDF page counts asynchronously with controlled concurrency (max 2 parallel tasks)
      const pdfTasks = newTasks.filter((task) => task.sourceExt === 'pdf');
      if (pdfTasks.length > 0) {
        (async () => {
          const queue = [...pdfTasks];
          const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
            while (queue.length > 0) {
              const task = queue.shift();
              if (!task) break;
              try {
                const numPages = await getPdfPageCount(task.file);
                setUniversalItems((current) =>
                  current.map((item) =>
                    item.id === task.id ? { ...item, pageCount: numPages } : item
                  )
                );
              } catch (err) {
                console.warn(`Failed to read PDF page count for ${task.name}:`, err);
                const message = err instanceof Error ? err.message : 'Invalid PDF document';
                setUniversalItems((current) =>
                  current.map((item) =>
                    item.id === task.id
                      ? { ...item, status: 'error', error: message }
                      : item
                  )
                );
              }
            }
          });
          await Promise.all(workers);
        })();
      }
    }

    if (overCapCount > 0) {
      showToast(
        `Accepted ${acceptedFiles.length} file${acceptedFiles.length === 1 ? '' : 's'}; skipped ${overCapCount} file${overCapCount === 1 ? '' : 's'} (${overCapCount} over the 100-file queue limit).`,
        'error'
      );
    } else {
      showToast(`Added ${newTasks.length} file(s) to AnyFormat`, 'info');
    }
  };

  const handleUniversalPageChange = (id: string, pageNumber: number) => {
    setUniversalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pageNumber } : item))
    );
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

  const handleClearCompletedUniversal = () => {
    setUniversalItems((prev) => {
      prev.forEach((item) => {
        if (item.status === 'completed') {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        }
      });
      return prev.filter((item) => item.status !== 'completed');
    });
  };

  const handleRetryFailedUniversal = () => {
    if (isUniversalProcessingRef.current) return;

    const failedIds = universalItemsRef.current
      .filter((item) => item.status === 'error')
      .map((item) => item.id);
    if (failedIds.length === 0) return;

    isUniversalProcessingRef.current = true;
    setIsUniversalProcessing(true);

    const updated = universalItemsRef.current.map((item) =>
      failedIds.includes(item.id)
        ? { ...item, status: 'idle' as const, error: undefined, progress: 0 }
        : item
    );
    universalItemsRef.current = updated;
    setUniversalItems(updated);

    startUniversalConversion(failedIds, true);
  };

  const handleClearUniversalQueue = () => {
    universalItems.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setUniversalItems([]);
    showToast('AnyFormat queue cleared', 'info');
  };

  const startUniversalConversion = async (targetIds?: string[] | unknown, isDirectRetry = false) => {
    if (isUniversalProcessingRef.current && !isDirectRetry) return;
    isUniversalProcessingRef.current = true;
    setIsUniversalProcessing(true);

    const ids = Array.isArray(targetIds) ? targetIds : undefined;

    let processedCount = 0;
    let failedCount = 0;
    let singleResult: { blob: Blob; ext: string; baseName: string } | null = null;

    try {
      while (true) {
        let nextTask: UniversalTaskItem | null = null;
        for (const item of universalItemsRef.current) {
          const isTargeted = ids ? ids.includes(item.id) : true;
          if (item.status === 'idle' && isTargeted) {
            nextTask = { ...item };
            break;
          }
        }

        if (!nextTask) break;

        const currentId = nextTask.id;
        const currentFile = nextTask.file;
        const currentTargetExt = nextTask.targetExt;
        const currentPageNumber = nextTask.pageNumber;
        const currentName = nextTask.name;

        setUniversalItems((current) =>
          current.map((i) =>
            i.id === currentId ? { ...i, status: 'processing', progress: 10 } : i
          )
        );

        await new Promise((resolve) => setTimeout(resolve, 30));

        try {
          const result = await convertUniversalFile(
            currentFile,
            currentTargetExt,
            (percent) => {
              setUniversalItems((current) =>
                current.map((i) => (i.id === currentId ? { ...i, progress: percent } : i))
              );
            },
            { pageNumber: currentPageNumber }
          );

          const resultUrl = URL.createObjectURL(result.blob);
          setUniversalItems((current) =>
            current.map((i) =>
              i.id === currentId
                ? {
                    ...i,
                    status: 'completed',
                    progress: 100,
                    resultBlob: result.blob,
                    resultUrl,
                    resultSize: result.blob.size,
                  }
                : i
            )
          );

          processedCount++;
          const baseName = currentName.replace(/\.[^/.]+$/, '');
          singleResult = { blob: result.blob, ext: currentTargetExt, baseName };
        } catch (err: unknown) {
          failedCount++;
          const errorMsg = err instanceof Error ? err.message : 'Conversion failed';
          setUniversalItems((current) =>
            current.map((i) =>
              i.id === currentId ? { ...i, status: 'error', error: errorMsg } : i
            )
          );
        }
      }
    } finally {
      isUniversalProcessingRef.current = false;
      setIsUniversalProcessing(false);
    }

    if (failedCount > 0) {
      showToast(
        `Conversion finished with ${failedCount} failed file${failedCount === 1 ? '' : 's'}.`,
        'error'
      );
    } else if (processedCount === 1 && singleResult) {
      downloadBlob(singleResult.blob, `${singleResult.baseName}.${singleResult.ext}`);
      showToast(`Conversion complete! ${singleResult.baseName}.${singleResult.ext} downloaded.`, 'success');
    } else if (processedCount > 0) {
      showToast('AnyFormat conversion complete!', 'success');
    }
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
      showToast('AnyFormat ZIP exported!', 'success');
    } catch (err) {
      console.error('ZIP export error:', err);
      showToast('Failed to export ZIP file', 'error');
    }
  };

  useKeyboardShortcuts({
    onHelp: () => setIsShortcutsOpen((prev) => !prev),
    onCommandK: () => setIsShortcutsOpen((prev) => !prev),
    onEscape: () => setIsShortcutsOpen(false),
    onNextTab: () => {
      setActiveTab((prev) => (prev === 'universal' ? 'single' : prev === 'single' ? 'batch' : 'universal'));
    },
    onPrevTab: () => {
      setActiveTab((prev) => (prev === 'universal' ? 'batch' : prev === 'batch' ? 'single' : 'universal'));
    },
    onTabSelect: (tabIndex) => {
      if (tabIndex === 1) setActiveTab('single');
      else if (tabIndex === 2) setActiveTab('batch');
      else if (tabIndex === 3) setActiveTab('universal');
    },
    onToggleTheme: () => setDarkMode((prev) => !prev),
    onConvert: () => {
      if (activeTab === 'universal') {
        if (!isUniversalProcessing && universalItems.length > 0) {
          startUniversalConversion();
        }
      } else if (activeTab === 'batch') {
        if (!isBatchProcessing && batchItems.length > 0) {
          startBatchProcess();
        }
      }
    },
  });

  const handleSingleFileSelectRef = useRef(handleSingleFileSelect);
  const handleBatchFileSelectRef = useRef(handleBatchFileSelect);
  const handleUniversalFilesAddedRef = useRef(handleUniversalFilesAdded);

  useEffect(() => {
    handleSingleFileSelectRef.current = handleSingleFileSelect;
    handleBatchFileSelectRef.current = handleBatchFileSelect;
    handleUniversalFilesAddedRef.current = handleUniversalFilesAdded;
  });

  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const mimeMap = activeTab === 'universal' ? UNIVERSAL_MIME_TYPES : VECTOR_MIME_TYPES;
      const files = getClipboardImages(e, mimeMap);
      if (files.length === 0) return;

      e.preventDefault();
      if (activeTab === 'single') {
        handleSingleFileSelectRef.current([files[0]]);
      } else if (activeTab === 'batch') {
        if (!isBatchProcessing) {
          handleBatchFileSelectRef.current(files);
        }
      } else if (activeTab === 'universal') {
        if (!isUniversalProcessing) {
          handleUniversalFilesAddedRef.current(files);
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [activeTab, isBatchProcessing, isUniversalProcessing]);

  return (
    <div className="app-shell relative isolate min-h-screen overflow-x-clip text-stone-900 transition-colors dark:text-white">
      <HoverBackground />
      <a href="#main-content" className="skip-link">
        Skip to converter
      </a>

      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
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
                      className="h-12 w-12 shrink-0 rounded-xl border border-stone-300/80 object-cover dark:border-slate-700"
                    />
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-stone-900 dark:text-slate-100">
                        {selectedFile.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-stone-600 dark:text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {dimensions.width} x {dimensions.height} px
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetSingleFileState}
                    className="min-h-11 shrink-0 self-start rounded-xl border border-rose-300/80 bg-rose-100/60 px-4 py-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 sm:self-auto dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
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
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'batch' ? (
          <div className="space-y-6">
            <Dropzone onFileSelect={handleBatchFileSelect} multiple={true} disabled={isBatchProcessing} />

            {batchItems.length > 0 && (
              <>
                <section aria-labelledby="batch-settings-heading" className="app-panel space-y-5 rounded-2xl p-4 text-stone-900 sm:p-5 dark:text-white">
                  <div>
                    <h2 id="batch-settings-heading" className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white">Batch settings</h2>
                    <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">Choose a preset or tune the shared tracing controls before processing the queue.</p>
                  </div>
                  <PresetSelector
                    selectedPreset={selectedPreset}
                    onSelectPreset={handlePresetSelect}
                    disabled={isBatchProcessing}
                  />
                  <ControlPanel
                    mode={tracingMode}
                    setMode={setTracingMode}
                    monoOpts={monoOpts}
                    setMonoOpts={setMonoOpts}
                    colorOpts={colorOpts}
                    setColorOpts={setColorOpts}
                    disabled={isBatchProcessing}
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
          <div className="space-y-8">
            <UniversalDropzone onFilesAdded={handleUniversalFilesAdded} disabled={isUniversalProcessing} />

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
                onOpenInStudio={(task) => {
                  handleSingleFileSelect([task.file]);
                  setActiveTab('single');
                }}
                onPageNumberChange={handleUniversalPageChange}
                onClearCompleted={handleClearCompletedUniversal}
                onRetryFailed={handleRetryFailedUniversal}
                isProcessing={isUniversalProcessing}
              />
            )}

            <section aria-label="Converter Features" className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-3">
              <div className="app-panel rounded-2xl p-6 transition-all">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-slate-100">
                  Client-Side Privacy
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-400">
                  All conversions run locally in your browser sandbox using WebAssembly and HTML5 Canvas. Your documents and images are never uploaded to any remote server.
                </p>
              </div>

              <div className="app-panel rounded-2xl p-6 transition-all">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-slate-100">
                  Multi-Threaded Performance
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-400">
                  Dedicated Web Workers handle intensive image quantization, rasterization, and document processing off the main thread to keep UI interaction smooth.
                </p>
              </div>

              <div className="app-panel rounded-2xl p-6 transition-all">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-slate-100">
                  Vector Studio Integration
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-400">
                  Seamlessly jump from batch conversion into the integrated Vector Studio to fine-tune bezier curves, adjust color palettes, and inspect clean SVG markup.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
      <div className="relative z-10">
        <Footer />
      </div>

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default App;
