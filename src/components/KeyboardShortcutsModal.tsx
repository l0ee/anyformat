import React from 'react';
import { AccessibleModal } from './common/AccessibleModal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const shortcuts = [
    { key: '1 / 2 / 3', description: 'Switch tab (SVG Vectorizer / Batch / Format Converter)' },
    { key: 'Cmd / Ctrl + K', description: 'Open Keyboard Shortcuts Helper' },
    { key: '?', description: 'Toggle Keyboard Shortcuts Modal' },
    { key: 'Shift + T', description: 'Toggle Dark / Light Theme' },
    { key: 'Escape', description: 'Close modals & popovers' },
  ];

  return (
    <AccessibleModal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="space-y-3 py-2 font-['Plus_Jakarta_Sans',sans-serif]">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Navigate and convert faster using built-in keyboard hotkeys:
        </p>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{s.description}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm text-slate-900 dark:text-slate-100">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </AccessibleModal>
  );
};
