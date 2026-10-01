interface WorkflowProgressProps {
  finished: number;
  completed: number;
  total: number;
  stage?: string;
  stopping?: boolean;
  onStop?: () => void;
}

/** Counts completed work; the active operation has no invented percentage. */
export function WorkflowProgress({ finished, completed, total, stage, stopping = false, onStop }: WorkflowProgressProps) {
  return (
    <div className="workflow-progress" aria-label="Processing controls">
      <div className="workflow-progress-copy">
        <p aria-live="polite" aria-atomic="true">
          <strong>{stopping ? 'Stopping safely…' : stage || 'Processing files…'}</strong>
          <span>{finished} of {total} files finished · {completed} ready to download</span>
        </p>
        <progress aria-label="Files finished" aria-valuetext={`${finished} of ${total} files finished`} max={Math.max(1, total)} value={finished} />
        <small>{stopping ? 'Waiting for the current browser operation to finish. No further files will start.' : 'Progress counts files, not time. Completed results stay available if you stop.'}</small>
      </div>
      {onStop && <button type="button" onClick={onStop} disabled={stopping} className="workflow-stop-button">{stopping ? 'Stopping…' : 'Stop processing'}</button>}
    </div>
  );
}
