import { X, AlertTriangle } from 'lucide-react';

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
 * ConfirmationModal - Reusable confirmation dialog
 * 
 * Features:
 * - Customizable title, message, and button labels
 * - Different visual variants (danger, warning, info)
 * - Loading state support
 * - Accessible keyboard navigation
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
    if (!isOpen) return null;

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="p-2 hover:bg-secondary-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className={`flex items-start gap-3 p-4 rounded-lg border ${variantStyles[variant]}`}>
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p className="text-sm">{message}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="btn-secondary flex-1 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${buttonStyles[variant]}`}
                    >
                        {loading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
