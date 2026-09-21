import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
    showCloseButton?: boolean;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[96vw] h-[94vh]',
};

export default function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    showCloseButton = true,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    header,
    footer,
    className = '',
    bodyClassName = '',
    headerClassName = '',
    footerClassName = '',
}: ModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose, closeOnEscape]);

    if (!isOpen) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${size === 'full' ? 'p-1 sm:p-2' : 'p-3 sm:p-4 sm:py-6'} overflow-y-auto`}>
            {/* Full-screen backdrop with blur and fade animation */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-modal-overlay"
                onClick={() => {
                    if (closeOnBackdropClick) onClose();
                }}
                aria-hidden="true"
            />

            {/* Modal dialog card with smooth scale & slide-in */}
            <div
                role="dialog"
                aria-modal="true"
                className={cn(
                    'relative bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden animate-modal z-10',
                    sizeClasses[size],
                    size === 'full' ? 'max-h-[96vh]' : 'max-h-[90vh]',
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: custom header or title + description */}
                {header ? (
                    header
                ) : (title || showCloseButton) ? (
                    <div className={cn('flex items-start justify-between p-4 sm:p-6 border-b border-border flex-shrink-0', headerClassName)}>
                        <div className="min-w-0 flex-1 pr-3 sm:pr-4">
                            {typeof title === 'string' ? (
                                <h2 className="text-lg sm:text-xl font-bold text-foreground break-words">{title}</h2>
                            ) : (
                                title
                            )}
                            {description && (
                                <p className="text-xs sm:text-sm text-muted mt-1 break-words">{description}</p>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-secondary-100 transition-colors flex-shrink-0"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                ) : null}

                {/* Body Content */}
                <div
                    className={cn(
                        'overflow-y-auto flex-1 min-h-0 scrollbar-thin',
                        !bodyClassName.includes('p-') && !bodyClassName.includes('p0') && 'p-4 sm:p-6',
                        bodyClassName
                    )}
                >
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className={cn('p-4 sm:p-6 border-t border-border bg-gray-50/50 flex-shrink-0 flex items-center justify-end gap-3', footerClassName)}>
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
