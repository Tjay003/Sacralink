import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SuccessDialogOptions, SuccessTone } from '../../contexts/toastContext';

const AUTO_CLOSE_MS = 4000;

const TONE_STYLES: Record<SuccessTone, { ring: string; stroke: string; bg: string }> = {
    success: { ring: 'ring-emerald-100', stroke: 'text-success', bg: 'bg-emerald-50' },
    warning: { ring: 'ring-amber-100', stroke: 'text-amber-600', bg: 'bg-amber-50' },
    danger: { ring: 'ring-red-100', stroke: 'text-destructive', bg: 'bg-red-50' },
};

interface SuccessDialogProps extends SuccessDialogOptions {
    onClose: () => void;
}

/**
 * SuccessDialog - a small centered confirmation with a self-drawing check mark. It closes by itself after about four
 * seconds unless the pointer is over it, closes on Escape or Done, moves focus to Done and gives focus back on close.
 */
export default function SuccessDialog({ title, message, tone = 'success', onClose }: SuccessDialogProps) {
    const doneRef = useRef<HTMLButtonElement>(null);
    const [hovered, setHovered] = useState(false);
    const styles = TONE_STYLES[tone];

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        doneRef.current?.focus();
        return () => {
            if (previous && document.contains(previous)) previous.focus();
        };
    }, []);

    useEffect(() => {
        if (hovered) return undefined;
        const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
        return () => window.clearTimeout(timer);
    }, [hovered, onClose]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                doneRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-900/40 animate-modal-overlay motion-reduce:animate-none"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="success-dialog-title"
                aria-describedby="success-dialog-message"
                data-testid="success-dialog"
                data-tone={tone}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className="card w-full max-w-sm bg-white border border-border rounded-2xl shadow-lg p-6 text-center animate-modal motion-reduce:animate-none"
            >
                <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-8 ${styles.bg} ${styles.ring}`}>
                    <svg viewBox="0 0 52 52" className={`h-10 w-10 ${styles.stroke}`} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle className="success-check-circle" cx="26" cy="26" r="23" pathLength="1" />
                        <path className="success-check-tick" d="M15 27l8 8 14-16" pathLength="1" />
                    </svg>
                </div>
                <h2 id="success-dialog-title" className="text-lg font-bold text-foreground">{title}</h2>
                <p id="success-dialog-message" className="mt-1.5 text-sm text-secondary-700 break-words">{message}</p>
                <button
                    ref={doneRef}
                    type="button"
                    onClick={onClose}
                    className="mt-5 w-full px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                    Done
                </button>
            </div>
        </div>,
        document.body,
    );
}
