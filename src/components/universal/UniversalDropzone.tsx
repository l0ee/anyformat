import { useId, useState } from 'react';
import { FileUploadSurface } from '../FileUploadSurface';
import { getFileExtension, getUniversalInputAccept, getUniversalInputFormatLabels, isSupportedSourceExtension, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL, SUPPORTED_FORMATS } from '../../engine/universal/types';

interface UniversalDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function UniversalDropzone({ onFilesAdded, disabled = false, compact = false }: UniversalDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const headingId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const submit = (files: File[]) => {
    if (disabled) return;
    const valid: File[] = [];
    const unsupported: string[] = [];
    const oversized: string[] = [];
    for (const file of files) {
      if (!isSupportedSourceExtension(getFileExtension(file.name))) unsupported.push(file.name);
      else if (file.size > MAX_FILE_SIZE_BYTES) oversized.push(file.name);
      else valid.push(file);
    }
    const errors: string[] = [];
    if (unsupported.length) errors.push(`${unsupported.length} unsupported file${unsupported.length === 1 ? '' : 's'} rejected: ${unsupported.join(', ')}`);
    if (oversized.length) errors.push(`${oversized.length} file${oversized.length === 1 ? '' : 's'} exceeded the ${MAX_FILE_SIZE_LABEL} limit: ${oversized.join(', ')}`);
    setError(errors.join(' '));
    if (valid.length) onFilesAdded(valid);
  };
  const formats = Object.values(SUPPORTED_FORMATS).filter((format, index, all) => all.findIndex((candidate) => candidate.label === format.label) === index);
  return (
    <div className="studio-upload" data-compact={compact}>
      <input id={inputId} type="file" multiple disabled={disabled} accept={getUniversalInputAccept()} aria-label="Browse files for the format conversion queue" aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`} className="peer sr-only" onChange={(event) => {
        if (event.target.files?.length) submit(Array.from(event.target.files));
        event.target.value = '';
      }} />
      <FileUploadSurface inputId={inputId} headingId={headingId} descriptionId={descriptionId} heading={compact ? 'Add more files' : 'Choose the files you want to convert'} description={`PNG, JPEG, WebP, BMP, SVG, PDF · up to ${MAX_FILE_SIZE_LABEL} per file`} compact={compact} dragging={dragging} disabled={disabled} onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }} onDragLeave={() => setDragging(false)} onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        submit(Array.from(event.dataTransfer.files));
      }} />
      <details className="supported-formats">
        <summary>Supported inputs and outputs</summary>
        <p className="sr-only">{getUniversalInputFormatLabels().join(', ')}</p>
        <ul aria-label="Supported conversion paths">{formats.map((format) => <li key={format.ext}><strong>{format.label}</strong><span>→ {format.canExportTo.map((target) => target.toUpperCase()).join(', ')}</span></li>)}</ul>
      </details>
      {error && <p id={errorId} role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    </div>
  );
}
