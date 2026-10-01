interface ResultSizeSummaryProps {
  sourceBytes: number;
  resultBytes: number;
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function ResultSizeSummary({ sourceBytes, resultBytes }: ResultSizeSummaryProps) {
  const delta = sourceBytes > 0 ? Math.round(((resultBytes - sourceBytes) / sourceBytes) * 100) : null;
  return (
    <p className="result-size-summary">
      <span>Original: {sizeLabel(sourceBytes)} → Output: {sizeLabel(resultBytes)}</span>
      {delta !== null && <strong className={delta < 0 ? 'size-smaller' : ''}>{delta < 0 ? `${Math.abs(delta)}% smaller` : delta > 0 ? `${delta}% larger` : 'Same size'}</strong>}
    </p>
  );
}
