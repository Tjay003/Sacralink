import React, { useState, useEffect, useRef } from 'react';
import {
    QrCode,
    Smartphone,
    UploadCloud,
    AlertCircle,
    CheckCircle2,
    Loader2,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { sanitizePhilippineMobileInput, isValidPhilippineMobile } from '../../lib/phoneNumbers';
import ConfirmQrChangeModal, { type QrChangeItem } from './ConfirmQrChangeModal';

export interface PaymentChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    channel: 'gcash' | 'maya';
    churchId: string;
    churchName?: string;
    currentNumber?: string | null;
    currentQrUrl?: string | null;
    onSuccess: () => void;
}

export default function PaymentChannelModal({
    isOpen,
    onClose,
    channel,
    churchId,
    churchName,
    currentNumber,
    currentQrUrl,
    onSuccess,
}: PaymentChannelModalProps) {
    const isGcash = channel === 'gcash';
    const [number, setNumber] = useState(currentNumber || '');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [isQrRemoved, setIsQrRemoved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Password confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<QrChangeItem[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Synchronize form state whenever modal opens or props change
    useEffect(() => {
        if (isOpen) {
            setNumber(currentNumber || '');
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setSelectedFile(null);
            setPreviewUrl('');
            setIsQrRemoved(false);
            setError(null);
            setSaving(false);
            setIsDragging(false);
            setShowConfirmModal(false);
            setPendingChanges([]);
        }
    }, [isOpen, currentNumber, currentQrUrl]);

    // Clean up local preview object URL to prevent memory leaks
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // Staged File Selection Handler (Does NOT upload to Supabase storage immediately)
    const handleSelectFile = (file: File) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Only JPG, PNG, and WebP images are supported.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image file size exceeds the 5MB limit.');
            return;
        }

        setError(null);

        // Revoke prior object URL if replaced before saving
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        const localUrl = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreviewUrl(localUrl);
        setIsQrRemoved(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) {
            handleSelectFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleSelectFile(file);
        }
    };

    const handleRemoveQr = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl('');
        setIsQrRemoved(true);
    };

    // User submits form: Validate inputs and check for modifications
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;

        setError(null);

        const trimmedNumber = number.trim();

        if (trimmedNumber && !isValidPhilippineMobile(trimmedNumber)) {
            setError('Please enter a valid Philippine mobile number (11 digits starting with 09, or +639XXXXXXXXX).');
            return;
        }

        const normalizedCurrentNumber = (currentNumber || '').trim();
        const normalizedNewNumber = trimmedNumber;
        const numberChanged = normalizedCurrentNumber !== normalizedNewNumber;

        const hasNewQrFile = selectedFile !== null;
        const qrWasRemoved = isQrRemoved && Boolean(currentQrUrl);
        const qrChanged = hasNewQrFile || qrWasRemoved;

        // If nothing was modified, simply close the modal
        if (!numberChanged && !qrChanged) {
            onClose();
            return;
        }

        // Prepare change summary items for the password confirmation modal
        const changes: QrChangeItem[] = [];

        if (qrChanged) {
            if (qrWasRemoved) {
                changes.push({
                    channel,
                    field: 'qr',
                    label: `${isGcash ? 'GCash' : 'Maya'} Offertory QR Code`,
                    changeType: 'removed',
                    oldValue: currentQrUrl,
                    oldPreviewUrl: currentQrUrl,
                    newValue: null,
                    newPreviewUrl: null,
                });
            } else if (hasNewQrFile) {
                changes.push({
                    channel,
                    field: 'qr',
                    label: `${isGcash ? 'GCash' : 'Maya'} Offertory QR Code`,
                    changeType: currentQrUrl ? 'replaced' : 'added',
                    oldValue: currentQrUrl,
                    oldPreviewUrl: currentQrUrl,
                    newValue: selectedFile.name,
                    newPreviewUrl: previewUrl,
                });
            }
        }

        if (numberChanged) {
            changes.push({
                channel,
                field: 'number',
                label: `${isGcash ? 'GCash' : 'Maya'} Mobile Number`,
                changeType: !normalizedCurrentNumber
                    ? 'added'
                    : !normalizedNewNumber
                    ? 'removed'
                    : 'updated',
                oldValue: normalizedCurrentNumber || null,
                newValue: normalizedNewNumber || null,
            });
        }

        setPendingChanges(changes);
        setShowConfirmModal(true);
    };

    // Executed ONLY after successful password verification in ConfirmQrChangeModal
    const handleExecuteSave = async () => {
        setSaving(true);
        setError(null);

        try {
            let finalQrUrl: string | null = currentQrUrl || null;

            // 1. Upload pending QR file to Supabase storage if selected
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop() || 'png';
                const filePath = `${churchId}/${channel}_qr_${Date.now()}.${fileExt}`;

                // Try primary donation-qr bucket first
                const { error: uploadError } = await supabase.storage
                    .from('donation-qr')
                    .upload(filePath, selectedFile, { upsert: true });

                if (uploadError) {
                    console.warn('Upload to donation-qr bucket failed, trying church-images fallback:', uploadError);
                    const { error: fallbackError } = await supabase.storage
                        .from('church-images')
                        .upload(filePath, selectedFile, { upsert: true });

                    if (fallbackError) {
                        throw new Error(
                            uploadError.message ||
                                fallbackError.message ||
                            'Failed to upload QR code image to storage'
                        );
                    }

                    const { data } = supabase.storage.from('church-images').getPublicUrl(filePath);
                    finalQrUrl = data.publicUrl;
                } else {
                    const { data } = supabase.storage.from('donation-qr').getPublicUrl(filePath);
                    finalQrUrl = data.publicUrl;
                }
            } else if (isQrRemoved) {
                finalQrUrl = null;
            }

            const trimmedNumber = number.trim();
            const finalNumber = trimmedNumber || null;

            const updatePayload = isGcash
                ? {
                      gcash_number: finalNumber,
                      ...(finalQrUrl
                          ? { gcash_qr_url: finalQrUrl, donation_qr_url: finalQrUrl }
                          : { gcash_qr_url: null, donation_qr_url: null }),
                  }
                : {
                      maya_number: finalNumber,
                      ...(finalQrUrl ? { maya_qr_url: finalQrUrl } : { maya_qr_url: null }),
                  };

            const { error: updateError } = await supabase
                .from('churches')
                .update(updatePayload)
                .eq('id', churchId);

            if (updateError) {
                throw updateError;
            }

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            onSuccess();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    // Determine what QR image to display in current modal view
    const activeQrDisplay = !isQrRemoved ? previewUrl || currentQrUrl || '' : '';

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                size="md"
                title={
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isGcash
                                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                        >
                            {isGcash ? <QrCode className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-foreground">
                                {isGcash ? 'Configure GCash Offertory' : 'Configure Maya Offertory'}
                            </h2>
                            <p className="text-xs text-muted">
                                {isGcash
                                    ? 'Set up cashless parish collections via GCash QR and mobile number'
                                    : 'Set up cashless parish collections via Maya QR and mobile number'}
                            </p>
                        </div>
                    </div>
                }
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Account / Mobile Number Input */}
                    <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                            {isGcash ? 'GCash Mobile Number' : 'Maya Mobile Number'}
                        </label>
                        <input
                            type="tel"
                            inputMode="tel"
                            value={number}
                            onChange={(e) => setNumber(sanitizePhilippineMobileInput(e.target.value))}
                            placeholder={isGcash ? '09171234567 or +639171234567' : '09181234567 or +639181234567'}
                            maxLength={number.startsWith('+') ? 13 : 11}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium font-mono text-foreground bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            disabled={saving}
                        />
                        <p className="text-xs text-muted mt-1.5 leading-relaxed">
                            {isGcash
                                ? 'Enter the 11-digit mobile number (09XXXXXXXXX) or +639XXXXXXXXX registered to your parish GCash account.'
                                : 'Enter the 11-digit mobile number (09XXXXXXXXX) or +639XXXXXXXXX registered to your parish Maya account.'}
                        </p>
                    </div>

                    {/* QR Code Upload Dropzone / Staged Preview */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                                Offertory QR Code
                            </label>
                            {selectedFile ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
                                    <CheckCircle2 className="w-3 h-3" />
                                    New QR Staged
                                </span>
                            ) : currentQrUrl && !isQrRemoved ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="w-3 h-3" />
                                    QR Configured
                                </span>
                            ) : isQrRemoved ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                    QR Marked for Removal
                                </span>
                            ) : null}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {activeQrDisplay ? (
                            <div className="p-4 border border-border rounded-2xl bg-secondary-50/50 flex flex-col sm:flex-row items-center gap-4">
                                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-xl border border-border p-2 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                    <img
                                        src={activeQrDisplay}
                                        alt={`${isGcash ? 'GCash' : 'Maya'} QR Code`}
                                        className="w-full h-full object-contain rounded-lg"
                                    />
                                </div>
                                <div className="flex-1 text-center sm:text-left min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">
                                        {isGcash ? 'GCash Offertory QR' : 'Maya Offertory QR'}
                                        {selectedFile && (
                                            <span className="ml-2 text-[10px] text-blue-600 font-normal">
                                                (Pending password confirmation)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-muted mt-1 leading-relaxed">
                                        Parishioners will be able to scan this QR code directly during online offertory and donations.
                                    </p>
                                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={saving}
                                            className="px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                                        >
                                            Replace QR
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveQr}
                                            disabled={saving}
                                            className="px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-600 transition-colors cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                                        : 'border-border hover:border-primary/50 hover:bg-secondary-50/40 bg-white'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-secondary-50 border border-border flex items-center justify-center text-muted mb-3 group-hover:scale-105 transition-transform">
                                    <UploadCloud className="w-6 h-6 text-secondary-500" />
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-foreground">
                                    Click to select QR code <span className="font-normal text-muted">or drag & drop</span>
                                </p>
                                <p className="text-[11px] text-muted mt-1">
                                    Supports JPG, PNG, or WebP up to 5MB (requires password confirmation to save)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer action buttons */}
                    <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border/80">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60 ${
                                isGcash
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Save {isGcash ? 'GCash' : 'Maya'} settings</span>
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Password Confirmation Modal for QR/Payment Changes */}
            <ConfirmQrChangeModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                churchId={churchId}
                churchName={churchName}
                changes={pendingChanges}
                onConfirm={handleExecuteSave}
            />
        </>
    );
}
