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

export interface PaymentChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    channel: 'gcash' | 'maya';
    churchId: string;
    currentNumber?: string | null;
    currentQrUrl?: string | null;
    onSuccess: () => void;
}

export default function PaymentChannelModal({
    isOpen,
    onClose,
    channel,
    churchId,
    currentNumber,
    currentQrUrl,
    onSuccess,
}: PaymentChannelModalProps) {
    const isGcash = channel === 'gcash';
    const [number, setNumber] = useState(currentNumber || '');
    const [qrUrl, setQrUrl] = useState(currentQrUrl || '');
    const [uploadingQr, setUploadingQr] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Synchronize form state whenever modal opens or props change
    useEffect(() => {
        if (isOpen) {
            setNumber(currentNumber || '');
            setQrUrl(currentQrUrl || '');
            setError(null);
            setUploadingQr(false);
            setSaving(false);
            setIsDragging(false);
        }
    }, [isOpen, currentNumber, currentQrUrl]);

    // File Upload Handler
    const handleUploadFile = async (file: File) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Only JPG, PNG, and WebP images are supported.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image file size exceeds the 5MB limit.');
            return;
        }

        setUploadingQr(true);
        setError(null);

        try {
            const fileExt = file.name.split('.').pop() || 'png';
            const filePath = `${churchId}/${channel}_qr_${Date.now()}.${fileExt}`;

            let uploadedPublicUrl = '';
            // Attempt primary upload to donation-qr bucket
            const { error: uploadError } = await supabase.storage
                .from('donation-qr')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.warn('Upload to donation-qr bucket failed, trying church-images fallback:', uploadError);
                const { error: fallbackError } = await supabase.storage
                    .from('church-images')
                    .upload(filePath, file, { upsert: true });

                if (fallbackError) {
                    throw new Error(uploadError.message || fallbackError.message || 'Failed to upload QR code image');
                }

                const { data } = supabase.storage.from('church-images').getPublicUrl(filePath);
                uploadedPublicUrl = data.publicUrl;
            } else {
                const { data } = supabase.storage.from('donation-qr').getPublicUrl(filePath);
                uploadedPublicUrl = data.publicUrl;
            }

            setQrUrl(uploadedPublicUrl);
        } catch (err: unknown) {
            console.error('Error uploading QR code:', err);
            const msg = err instanceof Error ? err.message : 'Failed to upload QR code image';
            setError(msg);
        } finally {
            setUploadingQr(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) {
            void handleUploadFile(file);
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
            void handleUploadFile(file);
        }
    };

    const handleRemoveQr = () => {
        setQrUrl('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving || uploadingQr) return;

        setSaving(true);
        setError(null);

        try {
            const trimmedNumber = number.trim() || null;
            const finalQr = qrUrl.trim() || null;

            const updatePayload = isGcash
                ? {
                    gcash_number: trimmedNumber,
                    ...(finalQr
                        ? { gcash_qr_url: finalQr, donation_qr_url: finalQr }
                        : { gcash_qr_url: null, donation_qr_url: null }),
                  }
                : {
                    maya_number: trimmedNumber,
                    ...(finalQr
                        ? { maya_qr_url: finalQr }
                        : { maya_qr_url: null }),
                  };

            const { error: updateError } = await supabase
                .from('churches')
                .update(updatePayload)
                .eq('id', churchId);

            if (updateError) {
                throw updateError;
            }

            onSuccess();
            onClose();
        } catch (err: unknown) {
            console.error('Error saving payment channel settings:', err);
            const msg = err instanceof Error ? err.message : 'Failed to update payment settings';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    return (
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
                        {isGcash ? 'GCash Mobile Number' : 'Maya Account / Mobile Number'}
                    </label>
                    <input
                        type="text"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder={isGcash ? '0917 123 4567' : '0918 123 4567 or Merchant ID'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        disabled={saving}
                    />
                    <p className="text-xs text-muted mt-1.5 leading-relaxed">
                        {isGcash
                            ? 'Enter the 11-digit mobile number registered to your parish GCash account.'
                            : 'Enter the Maya registered mobile number or merchant ID for your parish offertory.'}
                    </p>
                </div>

                {/* QR Code Upload Dropzone */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                            Offertory QR Code
                        </label>
                        {qrUrl && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3" />
                                QR Uploaded
                            </span>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {uploadingQr ? (
                        <div className="p-8 border-2 border-dashed border-primary/40 bg-blue-50/30 rounded-2xl flex flex-col items-center justify-center text-center">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                            <p className="text-xs font-semibold text-foreground">Uploading QR code...</p>
                            <p className="text-[11px] text-muted mt-0.5">Storing in secure parish storage</p>
                        </div>
                    ) : qrUrl ? (
                        <div className="p-4 border border-border rounded-2xl bg-secondary-50/50 flex flex-col sm:flex-row items-center gap-4">
                            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-xl border border-border p-2 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                <img
                                    src={qrUrl}
                                    alt={`${isGcash ? 'GCash' : 'Maya'} QR Code`}
                                    className="w-full h-full object-contain rounded-lg"
                                />
                            </div>
                            <div className="flex-1 text-center sm:text-left min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">
                                    {isGcash ? 'GCash Offertory QR' : 'Maya Offertory QR'}
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
                                Click to upload QR code <span className="font-normal text-muted">or drag & drop</span>
                            </p>
                            <p className="text-[11px] text-muted mt-1">
                                Supports JPG, PNG, or WebP up to 5MB
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer action buttons */}
                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border/80">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving || uploadingQr}
                        className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || uploadingQr}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60 ${
                            isGcash
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{saving ? 'Saving changes...' : `Save ${isGcash ? 'GCash' : 'Maya'} settings`}</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
}
