import { useState, useRef } from 'react';
import {
    Heart,
    Check,
    Download,
    Copy,
    AlertCircle,
    ShieldAlert,
    ShieldCheck,
    X,
    FileText,
    Users,
    QrCode,
} from 'lucide-react';
import { submitDonation } from '../../lib/supabase/donations';
import qrSample from '../../assets/qrPh/qr Sample.png';
import Modal from '../ui/Modal';

interface Church {
    id: string;
    name: string;
    status?: string | null;
    accept_cashless?: boolean | null;
    gcash_number?: string | null;
    maya_number?: string | null;
    gcash_qr_url?: string | null;
    maya_qr_url?: string | null;
}

interface SubmitDonationModalProps {
    church: Church;
    onClose: () => void;
    onSuccess: () => void;
}

type PaymentTab = 'gcash' | 'maya';

function FieldError({ msg }: { msg: string }) {
    return (
        <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1 font-sans font-medium">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{msg}</span>
        </p>
    );
}

interface QrDisplayProps {
    qrUrl?: string | null;
    label: string;
    onDownload: () => void;
}

function QrDisplay({ qrUrl, label, onDownload }: QrDisplayProps) {
    if (qrUrl) {
        return (
            <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-blue-100/60 shadow-sm">
                    <img
                        src={qrUrl}
                        alt={`${label} QR Code`}
                        className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-xl"
                    />
                </div>
                <div className="mt-2.5 flex items-center justify-center">
                    <button
                        type="button"
                        onClick={onDownload}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-blue-100/80 hover:bg-blue-50/50 text-foreground transition-all active:scale-95 shadow-2xs cursor-pointer font-sans"
                    >
                        <Download className="w-3.5 h-3.5 text-muted" />
                        <span>Save QR</span>
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center">
            <div className="relative p-4 bg-white rounded-2xl sm:rounded-3xl border border-dashed border-blue-200/70 shadow-sm">
                <img
                    src={qrSample}
                    alt="Sample QR"
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-xl opacity-30 grayscale"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="p-2 rounded-full bg-blue-50 text-blue-500">
                        <QrCode className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-muted bg-white/95 px-2.5 py-0.5 rounded-full border border-blue-100 shadow-2xs">
                        QR not set up yet
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function SubmitDonationModal({ church, onClose, onSuccess }: SubmitDonationModalProps) {
    const isUnverified = church.status === 'unverified' || (church.status && church.status !== 'verified_active' && church.status !== 'active');
    const cashlessPaused = church.accept_cashless === false;
    const hasGcash = !isUnverified && !cashlessPaused && !!(church.gcash_number || church.gcash_qr_url);
    const hasMaya = !isUnverified && !cashlessPaused && !!(church.maya_number || church.maya_qr_url);

    const defaultTab: PaymentTab = hasGcash ? 'gcash' : 'maya';
    const [activeTab, setActiveTab] = useState<PaymentTab>(defaultTab);

    // ── DUAL-TIER SELECTION: Quick Offertory vs Official Acknowledgment ──
    const [requestOfficialReceipt, setRequestOfficialReceipt] = useState(false);

    // Clipboard status
    const [copiedNumber, setCopiedNumber] = useState(false);

    // Form values — default to 100 matching the inspiration mockup
    const [amount, setAmount] = useState('100');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);

    // Validation errors
    const [amountErr, setAmountErr] = useState('');
    const [refErr, setRefErr] = useState('');
    const [proofErr, setProofErr] = useState('');

    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submittedOfficial, setSubmittedOfficial] = useState(false);
    const [showAsSupporter, setShowAsSupporter] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeNumber = activeTab === 'gcash' ? church.gcash_number : church.maya_number;
    const activeQr = activeTab === 'gcash' ? church.gcash_qr_url : church.maya_qr_url;
    const activeLabel = activeTab === 'gcash' ? 'GCash' : 'Maya';

    const QUICK_AMOUNTS = ['100', '300', '500', '1,000'];

    // ── Clipboard & Download handlers ──────────────────────────
    const handleCopyNumber = async () => {
        if (!activeNumber) return;
        try {
            await navigator.clipboard.writeText(activeNumber);
            setCopiedNumber(true);
            setTimeout(() => setCopiedNumber(false), 2000);
        } catch {
            // Fallback
        }
    };

    const handleDownloadQr = () => {
        if (!activeQr) return;
        try {
            const link = document.createElement('a');
            link.href = activeQr;
            link.download = `${church.name.replace(/[^a-zA-Z0-9]/g, '_')}_${activeLabel}_QR.png`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            window.open(activeQr, '_blank');
        }
    };

    // ── Validation helpers ─────────────────────────────────────
    const validateAmount = (val: string) => {
        if (!val) return 'Amount is required';
        const raw = val.replace(/,/g, '');
        const num = parseFloat(raw);
        if (isNaN(num) || num <= 0) return 'Enter a valid amount';
        if (num < 1) return 'Minimum donation is ₱1';
        if (num > 1_000_000) return 'Amount seems too large';
        return '';
    };

    const validateRef = (val: string, isRequired: boolean) => {
        if (!isRequired) return '';
        if (!val.trim()) return 'Reference number is required for official acknowledgment';
        if (val.trim().length < 6) return 'Reference number must be at least 6 characters';
        if (val.trim().length > 30) return 'Reference number is too long';
        return '';
    };

    const validateProof = (file: File | null, isRequired: boolean) => {
        if (!isRequired) return '';
        if (!file) return 'Payment screenshot is required for official acknowledgment';
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) return 'Only JPG, PNG, or WebP images are allowed';
        if (file.size > 10 * 1024 * 1024) return 'File must be under 10MB';
        return '';
    };

    // ── Handlers ───────────────────────────────────────────────
    /** Keeps digits and at most one decimal point, so pasted or typed text can never leave the amount non-numeric. */
    const sanitizeAmount = (val: string) => {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const firstDot = cleaned.indexOf('.');
        return firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    };

    const handleAmountChange = (val: string) => {
        const next = sanitizeAmount(val);
        setAmount(next);
        setAmountErr(validateAmount(next));
    };

    const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length === 1 && !/[0-9.]/.test(e.key)) e.preventDefault();
    };

    const handleChipClick = (amtString: string) => {
        const raw = amtString.replace(/,/g, '');
        setAmount(raw);
        setAmountErr(validateAmount(raw));
    };

    const handleRefChange = (val: string) => {
        setReferenceNumber(val);
        setRefErr(validateRef(val, requestOfficialReceipt));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        const err = validateProof(file, requestOfficialReceipt);
        setProofErr(err);
        if (!file || err) return;
        setProofFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setProofPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // ── Submit Handler ─────────────────────────────────────────
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (loading) return;
        setSubmitError('');

        if (isUnverified) {
            setSubmitError('Donations are locked. This parish is pending diocese verification.');
            return;
        }

        if (cashlessPaused) {
            setSubmitError('This parish has paused cashless donations. Please try again later.');
            return;
        }

        const aErr = validateAmount(amount);
        const rErr = validateRef(referenceNumber, requestOfficialReceipt);
        const pErr = validateProof(proofFile, requestOfficialReceipt);

        setAmountErr(aErr);
        setRefErr(rErr);
        setProofErr(pErr);

        if (aErr || rErr || pErr) return;

        setLoading(true);
        const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;

        const { error } = await submitDonation({
            churchId: church.id,
            amount: parsedAmount,
            referenceNumber: requestOfficialReceipt && referenceNumber.trim() ? referenceNumber.trim() : null,
            proofFile: requestOfficialReceipt ? (proofFile || null) : null,
            showAsSupporter: requestOfficialReceipt ? showAsSupporter : false,
            notes: notes.trim() || null,
            paymentMethod: activeTab,
        });

        setLoading(false);

        if (error) {
            setSubmitError(error.message || 'Failed to submit donation. Please try again.');
            return;
        }

        setSubmittedOfficial(requestOfficialReceipt);
        setSubmitted(true);
        setTimeout(() => {
            onSuccess();
            onClose();
        }, 3200);
    };

    // ── Success State with Newsreader Serif Typography (No Emojis) ──
    if (submitted) {
        return (
            <Modal
                isOpen={true}
                onClose={() => {
                    onSuccess();
                    onClose();
                }}
                size="sm"
                showCloseButton={false}
            >
                <div className="text-center py-6 px-2 space-y-4 animate-in">
                    <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-2xs">
                        <Check className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    <div>
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2 font-sans">
                            {submittedOfficial ? 'Official Acknowledgment Logged' : 'Love Offering Received'}
                        </span>
                        <h2 className="font-serif font-bold text-2xl text-foreground">
                            {submittedOfficial ? 'Acknowledgment Requested' : 'Thank you for your gift'}
                        </h2>
                        <p className="text-xs text-muted leading-relaxed mt-2 font-sans">
                            {submittedOfficial ? (
                                <>
                                    Thank you for your generous gift of <span className="font-bold text-foreground">₱{parseFloat(amount || '0').toLocaleString()}</span>. The parish finance office will verify reference <span className="font-mono font-bold text-foreground">{referenceNumber}</span> and record your official acknowledgment.
                                </>
                            ) : (
                                <>
                                    Your love offering to <span className="font-semibold text-foreground">{church.name}</span> has been received. May the Lord bless your generosity and dedication.
                                </>
                            )}
                        </p>
                        <p className="font-serif italic text-xs text-secondary-700 mt-4 bg-secondary-50 p-3.5 rounded-xl border border-border leading-relaxed text-center">
                            &ldquo;Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.&rdquo;
                            <span className="block mt-1 font-sans font-semibold not-italic text-[11px] text-secondary-500">
                                — 2 Corinthians 9:7
                            </span>
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                onSuccess();
                                onClose();
                            }}
                            className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer font-sans"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    const currentNumericAmount = parseFloat(amount.replace(/,/g, '')) || 0;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="3xl"
            showCloseButton={false}
            bodyClassName="p-0 overflow-y-auto"
            className="rounded-3xl border border-border shadow-2xl max-w-4xl"
        >
            <div className="flex flex-col bg-white">
                {/* ── HEADER ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
                            <Heart className="w-5 h-5 text-rose-500 stroke-[2] fill-none" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-serif font-bold text-lg sm:text-xl text-foreground truncate leading-tight tracking-tight">
                                Donate to {church.name}
                            </h2>
                            <p className="text-xs text-muted truncate mt-0.5 font-sans">
                                Sent directly to the parish. They confirm every gift.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!isUnverified ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs font-sans">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Verified parish</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs font-sans">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pending</span>
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl border border-border text-slate-500 hover:text-foreground hover:bg-slate-50 transition-colors ml-1 cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── UNVERIFIED WARNING OR SUBMIT ERROR BANNER ─────────────── */}
                {isUnverified && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 font-sans">
                        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-xs sm:text-sm">Parish Verification Pending</p>
                            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                This parish is currently undergoing Diocese anti-fraud and clergy credentials verification. Cashless offerings are locked until verified by the Diocese Chancery.
                            </p>
                        </div>
                    </div>
                )}

                {cashlessPaused && !isUnverified && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 font-sans">
                        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-xs sm:text-sm">Cashless Donations Paused</p>
                            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                This parish has temporarily paused GCash and Maya donations. Please check back later or contact the parish office.
                            </p>
                        </div>
                    </div>
                )}

                {submitError && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm text-red-700 font-sans">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                        <span>{submitError}</span>
                    </div>
                )}

                {/* ── 2-COLUMN LAYOUT ON DESKTOP / STACKED ON MOBILE ──────── */}
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-border">
                    {/* ──── LEFT COLUMN: QR & PAYMENT METHOD (md:col-span-5) ──── */}
                    <div className="md:col-span-5 p-4 sm:p-6 bg-[#F0F7FF] border-r border-blue-100/60 flex flex-col justify-between space-y-6">
                        <div className="space-y-4">
                            {/* Pay With Label */}
                            <div>
                                <span className="text-xs font-bold text-slate-800 tracking-wide font-sans">
                                    Pay with
                                </span>

                                {/* GCash / Maya Pill Tabs matching inspo */}
                                <div className="mt-2.5 bg-white p-1 rounded-2xl border border-blue-100/80 shadow-2xs flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('gcash')}
                                        disabled={!hasGcash}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer font-sans ${
                                            activeTab === 'gcash'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${activeTab === 'gcash' ? 'bg-blue-200' : 'bg-blue-500'}`} />
                                        <span>GCash</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('maya')}
                                        disabled={!hasMaya}
                                        className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer font-sans ${
                                            activeTab === 'maya'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${activeTab === 'maya' ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                                        <span>Maya</span>
                                    </button>
                                </div>
                            </div>

                            {/* QR Code Container */}
                            <div className="flex flex-col items-center">
                                <QrDisplay
                                    qrUrl={activeQr}
                                    label={activeLabel}
                                    onDownload={handleDownloadQr}
                                />
                            </div>

                            {/* Account Number Copy Utility (if available) */}
                            {activeNumber && (
                                <div className="bg-white border border-blue-100/60 rounded-2xl p-3 text-center shadow-2xs">
                                    <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-0.5 font-sans">
                                        {activeLabel} Account Number
                                    </p>
                                    <p className="text-lg font-mono font-bold tracking-wider text-foreground">
                                        {activeNumber}
                                    </p>
                                    <div className="mt-1.5 flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={handleCopyNumber}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50/60 border border-blue-100 hover:bg-blue-100/60 text-blue-900 transition-all active:scale-95 shadow-2xs cursor-pointer font-sans"
                                        >
                                            {copiedNumber ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span className="text-emerald-600 font-bold">Copied</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                                                    <span>Copy number</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Scan Helper Text */}
                            <div className="text-center px-2">
                                <p className="text-sm font-bold text-foreground font-sans">
                                    Scan with {activeLabel}
                                </p>
                                <p className="text-xs text-muted mt-1 leading-relaxed max-w-[260px] mx-auto font-sans">
                                    Open {activeLabel}, choose Scan QR, and pay the amount you enter on the right.
                                </p>
                            </div>
                        </div>

                        {/* Security Trust Note */}
                        <div className="pt-3 border-t border-blue-100/80">
                            <div className="flex items-start gap-2 text-muted">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-muted leading-relaxed font-sans">
                                    Payments go straight to the parish account. SacraLink never holds your money.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ──── RIGHT COLUMN: FORM & INPUTS (md:col-span-7) ───────── */}
                    <div className="md:col-span-7 p-4 sm:p-6 bg-white flex flex-col justify-between space-y-5">
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {/* Amount Section with Newsreader Serif Input */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-wide mb-1.5 font-sans">
                                    Amount
                                </label>

                                <div className="relative flex items-center bg-white border border-border rounded-2xl px-4 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-2xs">
                                    <span className="font-serif font-bold text-2xl sm:text-3xl text-slate-800 select-none mr-2.5">
                                        ₱
                                    </span>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        onKeyDown={handleAmountKeyDown}
                                        placeholder="100"
                                        disabled={loading}
                                        className="w-full bg-transparent font-serif font-bold text-2xl sm:text-3xl text-slate-800 placeholder:text-muted/30 focus:outline-none"
                                    />
                                </div>
                                {amountErr && <FieldError msg={amountErr} />}

                                {/* Quick Amount Chips matching inspo */}
                                <div className="grid grid-cols-4 gap-2 mt-2.5">
                                    {QUICK_AMOUNTS.map((amt) => {
                                        const raw = amt.replace(/,/g, '');
                                        const isSelected = amount.replace(/,/g, '') === raw;
                                        return (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => handleChipClick(amt)}
                                                className={`py-1.5 sm:py-2 px-3 rounded-full text-xs sm:text-sm font-semibold border transition-all cursor-pointer font-sans active:scale-95 ${
                                                    isSelected
                                                        ? 'bg-blue-50/50 text-blue-600 border-blue-600 shadow-2xs'
                                                        : 'bg-white border-border text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                ₱{amt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Note or Intention (optional) */}
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-wide mb-1.5 font-sans">
                                    Note or intention (optional)
                                </label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-border font-sans text-xs sm:text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                    placeholder="For example, for the church renovation or mass intention"
                                    disabled={loading}
                                />
                            </div>

                            {/* ── DUAL-TIER OPT-IN CARD: Official Parish Acknowledgment ── */}
                            <div className="pt-1">
                                <div
                                    onClick={() => {
                                        if (loading) return;
                                        setRequestOfficialReceipt(!requestOfficialReceipt);
                                        setRefErr('');
                                        setProofErr('');
                                    }}
                                    className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                                        requestOfficialReceipt
                                            ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20 shadow-2xs'
                                            : 'border-border bg-white hover:border-blue-300 hover:bg-blue-50/20'
                                    }`}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === ' ' || e.key === 'Enter') {
                                            e.preventDefault();
                                            if (loading) return;
                                            setRequestOfficialReceipt(!requestOfficialReceipt);
                                            setRefErr('');
                                            setProofErr('');
                                        }
                                    }}
                                >
                                    {/* Left Icon Container */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors border ${
                                        requestOfficialReceipt
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        <FileText className="w-5 h-5 stroke-[2]" />
                                    </div>

                                    {/* Center Content */}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 font-sans leading-tight block">
                                            Request Official Parish Acknowledgment / Intention Receipt
                                        </span>
                                        <p className="text-[11px] sm:text-xs text-muted mt-0.5 leading-relaxed font-sans">
                                            Check this to submit reference numbers & proof screenshots for official parish records, mass intention listings, or financial acknowledgment.
                                        </p>
                                    </div>

                                    {/* Right: Modern iOS-style toggle */}
                                    <div className="relative inline-flex items-center flex-shrink-0 pl-1">
                                        <input
                                            type="checkbox"
                                            checked={requestOfficialReceipt}
                                            onChange={(e) => {
                                                setRequestOfficialReceipt(e.target.checked);
                                                setRefErr('');
                                                setProofErr('');
                                            }}
                                            disabled={loading}
                                            className="sr-only peer"
                                            tabIndex={-1}
                                        />
                                        <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative ${
                                            requestOfficialReceipt ? 'bg-blue-600' : 'bg-slate-200'
                                        }`}>
                                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out absolute top-0.5 ${
                                                requestOfficialReceipt ? 'translate-x-5.5' : 'translate-x-0.5'
                                            }`} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── EXPANDED OFFICIAL ACKNOWLEDGMENT FIELDS (Tier B) ── */}
                            {requestOfficialReceipt && (
                                <div className="space-y-4 pt-1 animate-in">
                                    {/* Reference Number */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-wide mb-1.5 font-sans">
                                            Reference number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={referenceNumber}
                                            onChange={(e) => handleRefChange(e.target.value)}
                                            className={`w-full px-3.5 py-2.5 rounded-xl border font-sans text-xs sm:text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all ${
                                                refErr ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-border'
                                            }`}
                                            placeholder="From your payment receipt"
                                            disabled={loading}
                                            maxLength={30}
                                        />
                                        {refErr ? (
                                            <FieldError msg={refErr} />
                                        ) : (
                                            <p className="text-xs text-muted mt-1 font-sans">
                                                At least 6 characters. Found in your {activeLabel} transaction history.
                                            </p>
                                        )}
                                    </div>

                                    {/* Proof of Payment Screenshot Upload */}
                                    <div>
                                        <label className="block text-xs sm:text-sm font-bold text-slate-800 tracking-wide mb-1.5 font-sans">
                                            Proof of payment <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />

                                        {proofPreview ? (
                                            <div className="relative rounded-2xl border border-border p-2 bg-slate-50">
                                                <img
                                                    src={proofPreview}
                                                    alt="Payment proof"
                                                    className="w-full rounded-xl max-h-36 object-contain bg-white border border-border"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProofFile(null);
                                                        setProofPreview(null);
                                                        setProofErr('');
                                                    }}
                                                    className="absolute top-3.5 right-3.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-colors cursor-pointer"
                                                    aria-label="Remove image"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="border border-dashed border-border rounded-2xl p-3 sm:p-4 flex items-center justify-between bg-white hover:border-slate-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs sm:text-sm font-semibold text-slate-800 font-sans">
                                                            Attach a screenshot
                                                        </p>
                                                        <p className="text-[11px] text-muted font-sans">
                                                            JPG, PNG or WebP, up to 10 MB
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-3.5 py-2 rounded-xl border border-border text-xs font-semibold text-slate-700 hover:bg-slate-50 bg-white transition-all shadow-2xs cursor-pointer font-sans"
                                                >
                                                    Attach screenshot
                                                </button>
                                            </div>
                                        )}
                                        {proofErr && <FieldError msg={proofErr} />}
                                    </div>

                                    {/* Supporters Wall Toggle Row (ONLY for verified recorded donors) */}
                                    <div className="p-3 sm:p-3.5 bg-white rounded-2xl border border-border">
                                        <label className="flex items-center justify-between cursor-pointer select-none">
                                            <div className="flex items-center gap-2.5 pr-2">
                                                <Users className="w-4 h-4 text-slate-600" />
                                                <div>
                                                    <span className="text-xs sm:text-sm font-semibold text-slate-800 font-sans block">
                                                        Show my name on the parish supporters honor roll
                                                    </span>
                                                    <span className="text-[11px] text-muted font-sans block">
                                                        Verified benefactors list. Donation amount remains confidential.
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Clean iOS-Style Toggle Switch */}
                                            <div className="relative inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={showAsSupporter}
                                                    onChange={(e) => setShowAsSupporter(e.target.checked)}
                                                    disabled={loading}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </form>

                        {/* ── FOOTER / BOTTOM STICKY BAR ───────────────────── */}
                        <div className="pt-4 border-t border-border flex items-center justify-between gap-3 sticky bottom-0 bg-white">
                            <div>
                                <span className="block text-xs text-muted font-sans">
                                    You are donating
                                </span>
                                <span className="font-serif font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
                                    ₱ {currentNumericAmount > 0 ? currentNumericAmount.toLocaleString() : '0'}
                                </span>
                            </div>

                            <div>
                                <button
                                    type="button"
                                    onClick={() => handleSubmit()}
                                    disabled={loading || (!hasGcash && !hasMaya)}
                                    className="py-2.5 sm:py-3 px-6 rounded-2xl font-semibold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 font-sans"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : !requestOfficialReceipt ? (
                                        <>
                                            <Heart className="w-4 h-4 stroke-[2] fill-none" />
                                            <span>I have sent my offering</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 stroke-[2.5]" />
                                            <span>Submit for verification</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
