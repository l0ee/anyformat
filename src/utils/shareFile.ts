export type ShareOutcome =
  | { status: 'handed-off' }
  | { status: 'dismissed' }
  | { status: 'unsupported' }
  | { status: 'busy' }
  | { status: 'failed'; message: string };

let sharing = false;
const listeners = new Set<() => void>();

export function subscribeToSharing(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isSharing(): boolean {
  return sharing;
}

function setSharing(value: boolean): void {
  sharing = value;
  listeners.forEach((listener) => listener());
}

export function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined'
    || typeof navigator.share !== 'function'
    || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Call from the final user tap; there must be no async preparation before share(). */
export async function shareFile(file: File): Promise<ShareOutcome> {
  if (sharing) return { status: 'busy' };
  if (!canShareFile(file)) return { status: 'unsupported' };
  setSharing(true);
  try {
    // Invoke immediately, before the first await, while user activation is live.
    await navigator.share({ files: [file] });
    return { status: 'handed-off' };
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      return { status: 'dismissed' };
    }
    return { status: 'failed', message: 'Could not open file sharing. Try again, or download the file and attach it in your app.' };
  } finally {
    setSharing(false);
  }
}
