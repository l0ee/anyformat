import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccessibleModal } from './AccessibleModal';

interface SaveImageDialogProps {
  file: File;
  onClose: () => void;
  actions: React.ReactNode;
}

export function SaveImageDialog({ file, onClose, actions }: SaveImageDialogProps) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return createPortal(
    <AccessibleModal isOpen onClose={onClose} title="Save image to Photos">
      <p className="mb-3 text-sm">Touch and hold the image, then choose Save Image or Add to Photos, if available. If the option is missing, download the file and use your device’s image-saving options.</p>
      {preview?.file === file && <img src={preview.url} alt={`Image to save: ${file.name}`} onError={() => setFailed(true)} className="mx-auto mb-4 max-h-[50vh] max-w-full rounded-lg object-contain" />}
      {failed && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-300">The image preview could not be opened. You can still download or share the file below.</p>}
      {actions}
    </AccessibleModal>,
    document.body,
  );
}
