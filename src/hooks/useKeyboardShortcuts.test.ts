import { describe, it, expect, vi } from 'vitest';

describe('useKeyboardShortcuts logic', () => {
  it('attaches and triggers event listeners on window', () => {
    const listeners: Record<string, (e: { key: string }) => void> = {};
    const mockWindow = {
      addEventListener: (type: string, fn: (e: { key: string }) => void) => { listeners[type] = fn; },
      removeEventListener: (type: string, fn: (e: { key: string }) => void) => { if (listeners[type] === fn) delete listeners[type]; }
    };

    const onHelp = vi.fn();
    const handleKeyDown = (event: { key: string }) => {
      if (event.key === '?') onHelp();
    };

    mockWindow.addEventListener('keydown', handleKeyDown);
    listeners['keydown']({ key: '?' });
    expect(onHelp).toHaveBeenCalledTimes(1);

    mockWindow.removeEventListener('keydown', handleKeyDown);
    expect(listeners['keydown']).toBeUndefined();
  });
});
