import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    QrCode,
    Smartphone,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';

export interface QrChangeItem {
    channel: 'gcash' | 'maya';
    field: 'qr' | 'number';
    label: string; // e.g. "GCash QR Code" or "Maya Mobile Number"
    changeType: 'added' | 'replaced' | 'removed' | 'updated';
    oldValue?: string | null;
    newValue?: string | null;
    oldPreviewUrl?: string | null;
    newPreviewUrl?: string | null;
}

export interface ConfirmQrChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    churchId: string;
    churchName?: string;
    changes: QrChangeItem[];
    onConfirm: () => Promise<void>;
}

/**
 * ConfirmQrChangeModal
 *
 * Mandatory security confirmation modal before changing or removing
 * offertory payment QR codes or mobile numbers.
 * Re-authenticates the church administrator live with their password.
 */
export default function ConfirmQrChangeModal({
    isOpen,
    onClose,
    churchId,
    churchName,
    changes,
    onConfirm,
}: ConfirmQrChangeModalProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state whenever modal opens or closes
    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setShowPassword(false);
            setSubmitting(false);
            setError(null);
        }
    }, [isOpen]);

    const isOnlyRemoval = changes.length > 0 && changes.every((c) => c.changeType === 'removed');

    const handleVerifyAndConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (!password.trim()) {
            setError('Please enter your administrator password to proceed.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // 1. Retrieve the authenticated user session
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user?.email) {
                throw new Error('No authenticated user session found. Please refresh and log in again.');
            }

            // 2. Re-authenticate live with current password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password.trim(),
            });

            if (signInError) {
                throw new Error('Incorrect password. Please verify your administrator credentials.');
            }

            // 3. Log confirmation into activity_logs (non-fatal audit trail)
            try {
                await supabase.from('activity_logs').insert({
                    user_id: user.id,
                    church_id: churchId,
                    action: 'confirm_offertory_qr_change',
                    entity_type: 'churches',
                    entity_id: churchId,
                    metadata: {
                        church_name: churchName || undefined,
                        changes: changes.map((c) => ({
                            channel: c.channel,
                            field: c.field,
                            label: c.label,
                            changeType: c.changeType,
                            oldValue: c.field === 'number' ? c.oldValue : c.oldValue ? 'configured' : 'none',
                            newValue: c.field === 'number' ? c.newValue : c.newValue ? 'updated' : 'removed',
                        })),
                        verified_at: new Date().toISOString(),
                    },
                });
            } catch (logErr) {
                console.warn('Non-fatal: Failed to write QR change to activity_logs:', logErr);
            }

            // 4. Trigger the actual save/commit callback
            await onConfirm();
            onClose();
        } catch (err: unknown) {
            console.error('Error confirming QR change:', err);
            const msg = err instanceof Error ? err.message : 'Failed to authorize and save changes.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-600">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-foreground">
                            Confirm Offertory QR Update
                        </h2>
                        <p className="text-xs text-muted">
                            Security re-authentication is required to alter parish offertory payment channels
                        </p>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleVerifyAndConfirm} className="space-y-5">
                {/* Security Advisory Notice */}
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="leading-relaxed">
                        <span className="font-semibold">Security Safeguard:</span> You are modifying parish offertory donation channels. To safeguard parish funds and prevent unauthorized changes, please verify your administrator password.
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* Changes Summary Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Pending Changes ({changes.length})
                    </h3>

                    <div className="space-y-3">
                        {changes.map((item, idx) => (
                            <div
                                key={idx}
                                className="p-3.5 border border-border rounded-xl bg-secondary-50/40 space-y-2.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {item.field === 'qr' ? (
                                            <QrCode className="w-4 h-4 text-primary" />
                                        ) : (
                                            <Smartphone className="w-4 h-4 text-secondary-600" />
                                        )}
                                        <span className="text-xs font-bold text-foreground">
                                            {item.label}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                            item.changeType === 'removed'
                                                ? 'bg-red-50 text-red-600 border-red-200'
                                                : item.changeType === 'replaced'
                                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                : item.changeType === 'added'
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}
                                    >
                                        {item.changeType === 'replaced'
                                            ? 'Replacing QR'
                                            : item.changeType === 'removed'
                                            ? 'Removing'
                                            : item.changeType === 'added'
                                            ? 'Adding New'
                                            : 'Updating'}
                                    </span>
                                </div>

                                {/* QR Code Image Preview Comparison */}
                                {item.field === 'qr' && (
                                    <div className="pt-1">
                                        {item.changeType === 'replaced' && (
                                            <div className="flex items-center justify-center sm:justify-start gap-4">
                                                {/* Old QR */}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-medium text-muted mb-1">
                                                        Current QR
                                                    </span>
                                                    <div className="w-24 h-24 rounded-lg border border-border bg-white p-1.5 shadow-2xs">
                                                        {item.oldPreviewUrl ? (
                                                            <img
                                                                src={item.oldPreviewUrl}
                                                                alt="Current QR Code"
                                                                className="w-full h-full object-contain rounded"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted">
                                                                <QrCode className="w-8 h-8 opacity-40" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <ArrowRight className="w-5 h-5 text-muted shrink-0 mt-4" />

                                                {/* New QR */}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-semibold text-primary mb-1">
                                                        New QR Preview
                                                    </span>
                                                    <div className="w-24 h-24 rounded-lg border-2 border-primary/50 bg-white p-1.5 shadow-xs ring-2 ring-primary/10">
                                                        {item.newPreviewUrl ? (
                                                            <img
                                                                src={item.newPreviewUrl}
                                                                alt="New QR Code Preview"
                                                                className="w-full h-full object-contain rounded"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted">
                                                                <QrCode className="w-8 h-8 opacity-40" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {item.changeType === 'added' && item.newPreviewUrl && (
                                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                                <div className="w-24 h-24 rounded-lg border-2 border-emerald-500/50 bg-white p-1.5 shadow-xs ring-2 ring-emerald-500/10 shrink-0">
                                                    <img
                                                        src={item.newPreviewUrl}
                                                        alt="New QR Code Preview"
                                                        className="w-full h-full object-contain rounded"
                                                    />
                                                </div>
                                                <div className="text-center sm:text-left">
                                                    <p className="text-xs font-semibold text-foreground">
                                                        New Offertory QR Code Selected
                                                    </p>
                                                    <p className="text-[11px] text-muted mt-0.5">
                                                        Parishioners will scan this image during cashless Mass offertory and donations.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {item.changeType === 'removed' && (
                                            <div className="flex items-center gap-3 p-2 bg-red-50/50 border border-red-100 rounded-lg">
                                                {item.oldPreviewUrl && (
                                                    <div className="w-14 h-14 rounded border border-red-200 bg-white p-1 shrink-0 opacity-70">
                                                        <img
                                                            src={item.oldPreviewUrl}
                                                            alt="Removed QR"
                                                            className="w-full h-full object-contain"
                                                        />
                                                    </div>
                                                )}
                                                <div className="text-xs text-red-700">
                                                    <span className="font-semibold">QR Code will be deleted.</span> Parishioners will no longer be able to scan this channel.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Phone Number Comparison */}
                                {item.field === 'number' && (
                                    <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-mono text-muted line-through bg-white px-2 py-0.5 rounded border border-border">
                                            {item.oldValue || '(Not configured)'}
                                        </span>
                                        <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                                        <span className="font-mono font-bold text-foreground bg-white px-2 py-0.5 rounded border border-primary/30 text-primary">
                                            {item.newValue || '(Removed)'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Password Input Section */}
                <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                        Administrator Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your account password to confirm"
                            autoFocus
                            disabled={submitting}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-border text-sm text-foreground bg-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={submitting}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1 rounded transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-[11px] text-muted">
                        Enter your current Sacralink password to re-authenticate and apply these changes.
                    </p>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !password.trim()}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${
                            isOnlyRemoval
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-primary hover:bg-primary-600 text-white'
                        }`}
                    >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                            {submitting
                                ? 'Verifying password...'
                                : isOnlyRemoval
                                ? 'Confirm & Remove QR'
                                : 'Confirm & Save Changes'}
                        </span>
                    </button>
                </div>
            </form>
        </Modal>
    );
}
