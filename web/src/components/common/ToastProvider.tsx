import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type SuccessDialogOptions, type ToastApi, type ToastKind } from '../../contexts/toastContext';
import SuccessDialog from './SuccessDialog';

interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 4;

const KIND_STYLES: Record<ToastKind, { box: string; icon: ReactNode }> = {
    success: {
        box: 'border-emerald-200 bg-white',
        icon: <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-hidden="true" />,
    },
    error: {
        box: 'border-red-200 bg-white',
        icon: <AlertCircle className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />,
    },
    info: {
        box: 'border-blue-200 bg-white',
        icon: <Info className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />,
    },
};

/**
 * ToastProvider - mounted once in the app shell. Toasts stack bottom-right on desktop and bottom-center on phones,
 * announce themselves politely to screen readers (errors assertively) and dismiss after about four seconds.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [dialog, setDialog] = useState<SuccessDialogOptions | null>(null);
    const closeDialog = useCallback(() => setDialog(null), []);
    const nextId = useRef(1);
    const timers = useRef(new Map<number, number>());

    const dismiss = useCallback((id: number) => {
        const timer = timers.current.get(id);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((kind: ToastKind, message: string) => {
        const id = nextId.current++;
        setToasts((prev) => [...prev, { id, kind, message }].slice(-MAX_VISIBLE));
        timers.current.set(id, window.setTimeout(() => dismiss(id), kind === 'error' ? AUTO_DISMISS_MS + 2000 : AUTO_DISMISS_MS));
        return id;
    }, [dismiss]);

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((timer) => window.clearTimeout(timer));
            pending.clear();
        };
    }, []);

    const api = useMemo<ToastApi>(() => ({
        show,
        success: (message) => show('success', message),
        error: (message) => show('error', message),
        info: (message) => show('info', message),
        dismiss,
        showSuccess: setDialog,
    }), [show, dismiss]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            {dialog && <SuccessDialog {...dialog} onClose={closeDialog} />}
            {createPortal(
                <div
                    className="fixed z-[10000] inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:bottom-4 flex flex-col items-center sm:items-end gap-2 pointer-events-none"
                    aria-label="Notifications"
                >
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            role={toast.kind === 'error' ? 'alert' : 'status'}
                            aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
                            data-toast={toast.kind}
                            className={`pointer-events-auto w-full sm:w-auto sm:min-w-[18rem] sm:max-w-sm flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none ${KIND_STYLES[toast.kind].box}`}
                        >
                            {KIND_STYLES[toast.kind].icon}
                            <p className="flex-1 min-w-0 text-sm font-medium text-foreground break-words">{toast.message}</p>
                            <button
                                type="button"
                                onClick={() => dismiss(toast.id)}
                                className="p-0.5 rounded-md text-muted hover:text-foreground hover:bg-secondary-100 transition-colors shrink-0"
                                aria-label="Dismiss notification"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body,
            )}
        </ToastContext.Provider>
    );
}
