import { X } from 'lucide-react';

interface CountdownPanelProps {
    /** What is about to happen, e.g. "Deleting Maria Santos". The seconds are appended. */
    label: string;
    remaining: number;
    total: number;
    onCancel: () => void;
}

/**
 * CountdownPanel - the "last chance" state shown inside a destructive confirmation modal: a live countdown, a
 * progress bar (no animation under prefers-reduced-motion) and a prominent Cancel button that aborts the action.
 */
export default function CountdownPanel({ label, remaining, total, onCancel }: CountdownPanelProps) {
    const percent = Math.min(100, Math.round(((total - remaining + 1) / total) * 100));
    return (
        <div className="space-y-3 pt-4 border-t border-border" data-testid="delete-countdown">
            <p role="status" aria-live="polite" className="text-sm font-bold text-red-700">
                {label} in {remaining}&hellip;
            </p>
            <div
                role="progressbar"
                aria-label="Time left to cancel"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={remaining}
                className="h-2 w-full rounded-full bg-red-100 overflow-hidden"
            >
                <div
                    className="h-full rounded-full bg-red-600 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <button
                type="button"
                onClick={onCancel}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border-2 border-foreground bg-white hover:bg-secondary-100 text-foreground font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
            >
                <X className="w-4 h-4" />
                <span>Cancel, keep it</span>
            </button>
        </div>
    );
}
