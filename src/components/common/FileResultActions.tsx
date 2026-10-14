import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Download, ImageDown, Share2 } from 'lucide-react';
import { getMobilePlatform, isPhotoImage } from '../../utils/mobilePlatform';
import { canShareFile, isSharing, shareFile, ShareOutcome, subscribeToSharing } from '../../utils/shareFile';
import { SaveImageDialog } from './SaveImageDialog';

interface FileResultActionsProps {
  blob?: Blob;
  filename: string;
  disabled?: boolean;
  onDownload: () => void;
}

const buttonClass = 'min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

export function FileResultActions({ blob, filename, disabled = false, onDownload }: FileResultActionsProps) {
  const file = useMemo(() => blob ? new File([blob], filename, { type: blob.type }) : null, [blob, filename]);
  const platform = getMobilePlatform();
  const photo = !!file && isPhotoImage(file.type);
  const shareable = !!file && canShareFile(file);
  const sharing = useSyncExternalStore(subscribeToSharing, isSharing, () => false);
  const [openFor, setOpenFor] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ file: File; outcome: ShareOutcome } | null>(null);
  const feedbackEpoch = useRef({ id: 0 });
  useEffect(() => {
    const epoch = feedbackEpoch.current;
    setOpenFor(null);
    setFeedback(null);
    return () => { epoch.id++; };
  }, [file, disabled]);
  const closePreview = useCallback(() => setOpenFor(null), []);
  const helpId = useId();
  const outcome = feedback?.file === file ? feedback?.outcome : undefined;
  const downloadLabel = photo && platform === 'android' ? 'Save image'
    : photo && platform === 'ios' ? 'Download file'
    : `Download ${filename.split('.').pop()?.toUpperCase() || 'file'}`;

  const handleShare = async () => {
    if (!file || disabled) return;
    const epoch = feedbackEpoch.current.id;
    setFeedback(null);
    const result = await shareFile(file);
    if (feedbackEpoch.current.id === epoch) setFeedback({ file, outcome: result });
  };
  const saveAndShare = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onDownload} disabled={disabled}
        aria-label={photo && platform === 'android' ? `Save image ${filename}` : `Download ${filename}`}
        className={`${buttonClass} file-result-download`}>
        <Download aria-hidden="true" className="h-4 w-4" />{downloadLabel}
      </button>
      {shareable && <button type="button" onClick={handleShare} disabled={disabled || sharing}
        aria-label={`Share ${filename}`} aria-describedby={helpId} className={buttonClass}>
        <Share2 aria-hidden="true" className="h-4 w-4" />{sharing ? 'Sharing…' : 'Share…'}
      </button>}
    </div>
  );
  const status = outcome?.status === 'failed' ? outcome.message
    : outcome?.status === 'unsupported' ? 'File sharing is unavailable. Download the file and attach it in your app.'
    : outcome?.status === 'busy' ? 'Another share menu is already open.' : '';
  const previewOpen = !disabled && !!file && openFor === file;
  const statusMessage = status ? <p role={outcome?.status === 'failed' ? 'alert' : 'status'} className="max-w-sm text-xs text-rose-700 dark:text-rose-300">{status}</p> : null;
  const guidance = photo && platform === 'android'
    ? 'Images download to your browser’s default location. Check Downloads or Files; appearance in Gallery depends on your device.'
    : file?.type === 'application/pdf' && platform === 'ios'
    ? 'Find downloads in the Files app. You can also choose Save to Files in the share menu, if available.' : '';

  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap gap-2">
      {photo && platform === 'ios' && <button type="button" onClick={() => setOpenFor(file)} disabled={disabled}
        aria-label={`Save ${filename} to Photos…`} className={buttonClass}>
        <ImageDown aria-hidden="true" className="h-4 w-4" />Save to Photos…
      </button>}
      {saveAndShare}
    </div>
    <span id={helpId} className="sr-only">Choose Telegram or another compatible app in your device’s share menu.</span>
    {guidance && <p className="max-w-sm text-xs text-stone-600 dark:text-slate-400">{guidance}</p>}
    {file && !shareable && <details className="max-w-sm text-xs text-stone-600 dark:text-slate-400">
      <summary className="cursor-pointer">Sharing help</summary>
      <p>File sharing isn’t available in this browser for this file. Download it, then attach it in Telegram or another app.</p>
    </details>}
    {!previewOpen && statusMessage}
    {previewOpen && file && <SaveImageDialog file={file} onClose={closePreview} actions={<>{saveAndShare}{statusMessage}</>} />}
  </div>;
}
