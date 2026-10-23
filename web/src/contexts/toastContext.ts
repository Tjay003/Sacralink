import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export type SuccessTone = 'success' | 'warning' | 'danger';

export interface SuccessDialogOptions {
    title: string;
    message: string;
    /** Colours the check mark: success is green, warning amber, danger red. Defaults to success. */
    tone?: SuccessTone;
}

export interface ToastApi {
    /** Opens a small centered completion dialog that closes itself after a few seconds. */
    showSuccess: (options: SuccessDialogOptions) => void;
    /** Shows a toast. Returns its id so callers can dismiss it early. */
    show: (kind: ToastKind, message: string) => number;
    success: (message: string) => number;
    error: (message: string) => number;
    info: (message: string) => number;
    dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Shows short, auto-dismissing confirmations and errors. Must be used under <ToastProvider>. */
export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}
