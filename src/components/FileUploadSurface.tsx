import { Plus } from 'lucide-react';
import type { DragEventHandler } from 'react';
import { ConversionMotionGraphic } from './ConversionMotionGraphic';

interface FileUploadSurfaceProps {
  inputId: string;
  headingId: string;
  descriptionId: string;
  description: string;
  heading: string;
  compact?: boolean;
  dragging: boolean;
  disabled: boolean;
  onDragOver: DragEventHandler;
  onDragLeave: DragEventHandler;
  onDrop: DragEventHandler;
}

export function FileUploadSurface({ inputId, headingId, descriptionId, description, heading, compact = false, dragging, disabled, ...events }: FileUploadSurfaceProps) {
  return (
    <div role="group" aria-labelledby={headingId} aria-disabled={disabled} className="file-upload-surface" data-dragging={dragging} data-compact={compact} {...events}>
      <div className="file-upload-copy">
        {compact ? <span className="file-upload-icon" aria-hidden="true"><Plus size={20} /></span> : <ConversionMotionGraphic />}
        <div>
          <h2 id={headingId}>{heading}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
      </div>
      <label htmlFor={inputId} className={`file-upload-button ${disabled ? 'pointer-events-none' : ''}`}>
        {compact ? 'Add files' : 'Choose files'} <Plus size={16} aria-hidden="true" />
      </label>
      {!compact && <p className="file-upload-paste">or drop files here · paste an image with Ctrl+V / ⌘V</p>}
    </div>
  );
}
