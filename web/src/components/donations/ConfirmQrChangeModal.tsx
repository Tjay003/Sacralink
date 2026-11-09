import React, { useState, useEffect, useRef } from 'react';
import {
    ShieldAlert,
    ShieldCheck,
    CheckCircle2,
    Mail,
    ArrowRight,
    QrCode,
    Smartphone,
    AlertCircle,
    Loader2,
    RefreshCw,
    Clock,
    Sparkles,
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
 * Dispatches a 6-digit email OTP with visual reference number matching.
 */
export default function ConfirmQrChangeModal({
    isOpen,
    onClose,
    churchId,
    churchName,
    changes,
    onConfirm,
}: ConfirmQrChangeModalProps) {
    const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
    const [referenceCode, setReferenceCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [mockOtp, setMockOtp] = useState<string | null>(null);
    const [sendingCode, setSendingCode] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const isOnlyRemoval = changes.length > 0 && changes.every((c) => c.changeType === 'removed');
    const uniqueChannels = Array.from(new Set(changes.map((c) => c.channel)));

    // Request new OTP code from the edge function
    const requestVerificationCode = async () => {
        if (!churchId) return;

        setSendingCode(true);
        setError(null);
        setDigits(['', '', '', '', '', '']);

        try {
            // Retrieve current user to know their email for the UI hint
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user?.email) {
                setAdminEmail(user.email);
            }

            const channelString = uniqueChannels.join(' & ') || 'offertory';
            const { data, error: fnError } = await supabase.functions.invoke('send-qr-otp', {
                body: {
                    churchId,
                    channel: channelString,
                    changes: changes.map((c) => ({
                        channel: c.channel,
                        field: c.field,
                        label: c.label,
                        changeType: c.changeType,
                        oldValue: c.oldValue,
                        newValue: c.newValue,
                    })),
                },
            });

            if (fnError) {
                throw new Error(fnError.message || 'Failed to send security verification email.');
            }

            if (!data?.success) {
                throw new Error(data?.error || 'Failed to dispatch verification code.');
            }

            setReferenceCode(data.referenceCode);
            setExpiresAt(data.expiresAt);
            if (data.mockOtp) {
                setMockOtp(data.mockOtp);
            }
            setResendCooldown(60);

            // Auto-focus first input field
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 60);
        } catch (err: unknown) {
            console.error('Error requesting verification OTP:', err);
            const msg = err instanceof Error ? err.message : 'Failed to send verification email.';
            setError(msg);
        } finally {
            setSendingCode(false);
        }
    };

    // Auto-send OTP code when modal opens
    useEffect(() => {
        if (isOpen && churchId) {
            setDigits(['', '', '', '', '', '']);
            setReferenceCode(null);
            setExpiresAt(null);
            setError(null);
            setMockOtp(null);
            setSubmitting(false);
            setIsSuccess(false);
            void requestVerificationCode();
        }
    }, [isOpen, churchId]);

    // Handle 60s cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Digit change handler
    const handleDigitChange = (index: number, val: string) => {
        const cleaned = val.replace(/\D/g, '');
        if (!cleaned) {
            const next = [...digits];
            next[index] = '';
            setDigits(next);
            return;
        }

        const digit = cleaned.slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);

        // Auto-advance to next input box
        if (index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Keyboard backspace & arrow navigation
    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (!digits[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Paste handler for 6-digit code
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasteData) return;

        const next = [...digits];
        for (let i = 0; i < pasteData.length; i++) {
            next[i] = pasteData[i];
        }
        setDigits(next);

        const nextIndex = Math.min(pasteData.length, 5);
        inputRefs.current[nextIndex]?.focus();
    };

    // Verify OTP and confirm QR changes
    const handleVerifyAndConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting || sendingCode) return;

        const fullOtp = digits.join('').trim();
        if (fullOtp.length !== 6) {
            setError('Please enter the complete 6-digit verification code.');
            return;
        }

        if (!referenceCode) {
            setError('No security reference code found. Please resend a new code.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Verify OTP via Postgres security definer RPC
            const { data, error: rpcError } = await (supabase.rpc as any)('verify_qr_otp', {
                p_church_id: churchId,
                p_reference_code: referenceCode,
                p_otp: fullOtp,
            });

            if (rpcError) {
                throw new Error(rpcError.message || 'Invalid verification code.');
            }

            if (!data) {
                throw new Error('Verification failed. Please check the code and try again.');
            }

            // Trigger the actual save/commit callback
            await onConfirm();
            setIsSuccess(true);
        } catch (err: unknown) {
            console.error('Error confirming QR change:', err);
            const msg = err instanceof Error ? err.message : 'Failed to authorize and save changes.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isComplete = digits.every((d) => d.trim().length === 1);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                setIsSuccess(false);
                onClose();
            }}
            size="lg"
            title={
                isSuccess ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-foreground">
                                Offertory Updates Verified
                            </h2>
                            <p className="text-xs text-muted">
                                Security reference code authenticated successfully
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 text-primary">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-foreground">
                                Confirm Offertory QR Update
                            </h2>
                            <p className="text-xs text-muted">
                                Security email verification is required to alter parish offertory payment channels
                            </p>
                        </div>
                    </div>
                )
            }
        >
            {isSuccess ? (
                <div className="py-6 px-1 text-center space-y-6">
                    <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 rounded-full bg-emerald-200 animate-ping opacity-25" />
                        <div className="relative w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Reference {referenceCode} Verified
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                            QR Code Successfully Changed!
                        </h3>
                        <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                            Your parish offertory payment channels and QR codes have been authenticated and securely updated. Parishioners will now scan the new QR.
                        </p>
                    </div>

                    {/* Breakdown of applied changes */}
                    <div className="max-w-md mx-auto p-4 rounded-xl bg-secondary-50/80 border border-border text-left space-y-2.5">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-secondary-600">
                            Verified &amp; Applied Updates
                        </p>
                        <div className="space-y-2">
                            {changes.map((c, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-border/60">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="font-semibold text-foreground">{c.label}</span>
                                    </div>
                                    <span
                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                            c.changeType === 'removed'
                                                ? 'bg-red-50 text-red-700 border border-red-200'
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}
                                    >
                                        {c.changeType === 'removed' ? 'Removed' : 'Updated ✓'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSuccess(false);
                                onClose();
                            }}
                            className="w-full sm:w-auto min-w-[160px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                            Done &amp; Return
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleVerifyAndConfirm} className="space-y-5">
                {/* Channel & Church Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    {uniqueChannels.map((ch) => (
                        <span
                            key={ch}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                ch === 'gcash'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>{ch === 'gcash' ? 'GCash Offertory' : 'Maya Offertory'}</span>
                        </span>
                    ))}
                    {churchName && (
                        <span className="text-xs text-muted font-medium truncate max-w-[240px]">
                            &bull; {churchName}
                        </span>
                    )}
                </div>

                {/* Security Advisory Notice */}
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="leading-relaxed">
                        <span className="font-semibold">Security Safeguard:</span> You are modifying parish offertory donation channels. To safeguard parish funds and prevent unauthorized changes, please verify the 6-digit security code sent to your email.
                    </div>
                </div>

                {/* Reference Match Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50/90 to-blue-50/40 border-2 border-blue-200/80 text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Visual Security Reference</span>
                    </div>
                    <div className="py-1">
                        {sendingCode ? (
                            <div className="inline-flex items-center gap-2 text-sm text-primary font-medium">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating security reference...</span>
                            </div>
                        ) : (
                            <div className="font-mono text-2xl sm:text-3xl font-black text-blue-950 tracking-widest selection:bg-primary/20">
                                {referenceCode || 'REF-••••'}
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-blue-900/80 max-w-sm mx-auto leading-relaxed">
                        Confirm that this matches the <strong className="text-blue-950">Reference Number</strong> in the email sent to <span className="font-medium text-blue-950">{adminEmail || 'your admin address'}</span> before entering the code.
                    </p>
                    {expiresAt && (
                        <div className="pt-1 text-[11px] font-medium text-blue-700/70">
                            Code valid until {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (10 mins)
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* 6-Digit Segmented OTP Input */}
                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                            6-Digit Security Code <span className="text-red-500">*</span>
                        </label>
                        {resendCooldown > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted font-medium">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Resend code in {resendCooldown}s</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={requestVerificationCode}
                                disabled={sendingCode || submitting}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-600 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${sendingCode ? 'animate-spin' : ''}`} />
                                <span>Resend code</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                        {digits.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={(el) => {
                                    inputRefs.current[idx] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleDigitChange(idx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(idx, e)}
                                onPaste={handlePaste}
                                disabled={submitting || sendingCode}
                                className="w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-2xl font-black text-foreground bg-white border-2 border-border rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none disabled:bg-secondary-50 shadow-2xs"
                                aria-label={`Digit ${idx + 1}`}
                            />
                        ))}
                    </div>

                    {/* Dev / Mock Mode Helper */}
                    {mockOtp && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-in fade-in">
                            <span className="flex items-center gap-1.5 font-medium">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Test / Mock Mode: Code is <strong>{mockOtp}</strong></span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDigits(mockOtp.split(''));
                                    inputRefs.current[5]?.focus();
                                }}
                                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline ml-2 cursor-pointer"
                            >
                                Auto-fill
                            </button>
                        </div>
                    )}
                </div>

                {/* Changes Summary Section */}
                <div className="space-y-3 pt-1">
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
                        disabled={submitting || sendingCode || !isComplete || !referenceCode}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${
                            isOnlyRemoval
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-primary hover:bg-primary-600 text-white'
                        }`}
                    >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                            {submitting
                                ? 'Verifying code...'
                                : isOnlyRemoval
                                ? 'Confirm & Remove QR'
                                : 'Confirm & Save Changes'}
                        </span>
                    </button>
                </div>
            </form>
            )}
        </Modal>
    );
}
