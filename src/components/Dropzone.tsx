import { useId, useState } from 'react';
import { getUniqueFormatLabels, getVectorStudioInputAccept, MAX_FILE_SIZE_LABEL, VECTOR_STUDIO_INPUT_FORMATS } from '../engine/universal/types';
import { FileUploadSurface } from './FileUploadSurface';

interface DropzoneProps {
  onFileSelect: (files: FileList | File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function Dropzone({ onFileSelect, multiple = false, disabled = false, compact = false }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();
  const headingId = useId();
  const descriptionId = useId();
  return (
    <div className="studio-upload" data-compact={compact}>
      <input id={inputId} type="file" accept={getVectorStudioInputAccept()} multiple={multiple} disabled={disabled} aria-label={multiple ? 'Browse raster images for the batch queue' : 'Browse a raster image for Vector Studio'} aria-describedby={descriptionId} className="peer sr-only" onChange={(event) => {
        if (!disabled && event.target.files?.length) onFileSelect(event.target.files);
        event.target.value = '';
      }} />
      <FileUploadSurface inputId={inputId} headingId={headingId} descriptionId={descriptionId} heading="Add images to create SVG" description={`${getUniqueFormatLabels(VECTOR_STUDIO_INPUT_FORMATS).join(', ')} · up to ${MAX_FILE_SIZE_LABEL} per file`} compact={compact} dragging={dragging} disabled={disabled} onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }} onDragLeave={() => setDragging(false)} onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled && event.dataTransfer.files.length) onFileSelect(event.dataTransfer.files);
      }} />
    </div>
  );
}

export default Dropzone;
