import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

/**
 * ConfirmationModal - Reusable confirmation dialog backed by centralized Modal primitive
 */
export default function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    onConfirm,
    onCancel,
    loading = false,
}: ConfirmationModalProps) {
    const variantStyles = {
        danger: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const buttonStyles = {
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        info: 'bg-blue-600 hover:bg-blue-700 text-white',
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="md"
            footer={
                <div className="flex gap-3 w-full">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 shadow-sm ${buttonStyles[variant]}`}
                    >
                        {loading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            }
        >
            <div className={`flex items-start gap-3 p-4 rounded-xl border ${variantStyles[variant]}`}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">{message}</p>
            </div>
        </Modal>
    );
}

