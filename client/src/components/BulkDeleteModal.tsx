import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface BulkDeleteModalProps {
  count: number;
  itemLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function BulkDeleteModal({ count, itemLabel, onConfirm, onClose }: BulkDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const plural = count === 1 ? itemLabel : itemLabel + 's';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-error-subtle shrink-0">
            <AlertTriangle className="w-5 h-5 text-error" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Delete {count} {plural}?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              This action cannot be undone. {count === 1 ? 'This item' : `All ${count} selected items`} will be permanently removed.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-error-subtle border border-error/20 rounded-lg text-error text-xs">{error}</div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-error hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete {count} {plural}
          </button>
        </div>
      </div>
    </div>
  );
}
