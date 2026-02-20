import { useState, useRef } from 'react';
import { X, Heart, Upload, ImageIcon, CheckCircle, QrCode, AlertCircle } from 'lucide-react';
import { submitDonation } from '../../lib/supabase/donations';
import qrSample from '../../assets/qrPh/qr Sample.png';

interface Church {
    id: string;
    name: string;
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
        <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {msg}
        </p>
    );
}

interface QrDisplayProps {
    qrUrl?: string | null;
    label: string;
    color: string;
}
function QrDisplay({ qrUrl, label, color }: QrDisplayProps) {
    if (qrUrl) {
        return (
            <div className="text-center">
                <p className="text-xs text-muted mb-2">Scan to pay via {label}</p>
                <img
                    src={qrUrl}
                    alt={`${label} QR Code`}
                    className="w-44 h-44 mx-auto rounded-xl object-contain border border-border"
                />
                <p className="text-xs text-muted mt-2">Open {label} → Scan QR Code</p>
            </div>
        );
    }
    return (
        <div className="text-center space-y-2">
            <p className="text-xs text-muted">QR Code</p>
            <div className="relative inline-block">
                <img
                    src={qrSample}
                    alt="Sample QR"
                    className="w-44 h-44 mx-auto rounded-xl object-contain border border-dashed border-border opacity-30 grayscale"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <QrCode className={`w-7 h-7 ${color}`} />
                    <span className="text-xs font-semibold text-muted bg-background/80 px-2 py-0.5 rounded-full">
                        QR not set up yet
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function SubmitDonationModal({ church, onClose, onSuccess }: SubmitDonationModalProps) {
    const hasGcash = !!(church.gcash_number);
    const hasMaya = !!(church.maya_number);

    const defaultTab: PaymentTab = hasGcash ? 'gcash' : 'maya';
    const [activeTab, setActiveTab] = useState<PaymentTab>(defaultTab);

    // Form values
    const [amount, setAmount] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);

    // Per-field validation errors
    const [amountErr, setAmountErr] = useState('');
    const [refErr, setRefErr] = useState('');
    const [proofErr, setProofErr] = useState('');

    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Validation helpers ─────────────────────────────────────
    const validateAmount = (val: string) => {
        if (!val) return 'Amount is required';
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) return 'Enter a valid amount';
        if (num < 1) return 'Minimum donation is ₱1';
        if (num > 1_000_000) return 'Amount seems too large';
        return '';
    };

    const validateRef = (val: string) => {
        if (!val.trim()) return 'Reference number is required';
        if (val.trim().length < 6) return 'Reference number must be at least 6 characters';
        if (val.trim().length > 30) return 'Reference number is too long';
        return '';
    };

    const validateProof = (file: File | null) => {
        if (!file) return 'Payment screenshot is required';
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) return 'Only JPG, PNG, or WebP images are allowed';
        if (file.size > 10 * 1024 * 1024) return 'File must be under 10MB';
        return '';
    };

    // ── Handlers ───────────────────────────────────────────────
    const handleAmountChange = (val: string) => {
        setAmount(val);
        setAmountErr(validateAmount(val));
    };

    const handleRefChange = (val: string) => {
        setReferenceNumber(val);
        setRefErr(validateRef(val));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        const err = validateProof(file);
        setProofErr(err);
        if (!file || err) return;
        setProofFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setProofPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        // Run all validations
        const aErr = validateAmount(amount);
        const rErr = validateRef(referenceNumber);
        const pErr = validateProof(proofFile);

        setAmountErr(aErr);
        setRefErr(rErr);
        setProofErr(pErr);

        if (aErr || rErr || pErr) return;

        setLoading(true);
        const { error } = await submitDonation({
            churchId: church.id,
            amount: parseFloat(amount),
            referenceNumber: referenceNumber.trim(),
            proofFile: proofFile!,
        });

        if (error) {
            setSubmitError(error.message || 'Failed to submit. Please try again.');
            setLoading(false);
            return;
        }

        setSubmitted(true);
        setLoading(false);
        setTimeout(() => { onSuccess(); onClose(); }, 2500);
    };

    // ── Success screen ─────────────────────────────────────────
    if (submitted) {
        return (
            <>
                <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="card p-8 max-w-sm w-full text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Donation Submitted!</h2>
                        <p className="text-muted text-sm">
                            Thank you for your generosity 🙏<br />
                            The church admin will verify your donation shortly.
                        </p>
                    </div>
                </div>
            </>
        );
    }

    // ── Active payment info ────────────────────────────────────
    const activeNumber = activeTab === 'gcash' ? church.gcash_number : church.maya_number;
    const activeQr = activeTab === 'gcash' ? church.gcash_qr_url : church.maya_qr_url;
    const activeLabel = activeTab === 'gcash' ? 'GCash' : 'Maya';
    const activeColor = activeTab === 'gcash' ? 'text-blue-500' : 'text-green-500';
    const activeBgTab = activeTab === 'gcash' ? 'bg-blue-500' : 'bg-green-500';

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="card max-w-md w-full max-h-[92vh] overflow-y-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Heart className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">Donate to {church.name}</h2>
                                <p className="text-xs text-muted">Your generosity helps the community 🙏</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-muted hover:text-foreground">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">

                        {/* Step 1 — Choose method */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                                Step 1 — Choose Payment Method
                            </p>

                            {/* Tabs — only show tabs that exist */}
                            <div className="flex gap-2">
                                {hasGcash && (
                                    <button
                                        onClick={() => setActiveTab('gcash')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'gcash' ? 'bg-blue-500 text-white' : 'bg-muted/20 text-muted hover:bg-muted/30'
                                            }`}
                                    >
                                        💙 GCash
                                    </button>
                                )}
                                {hasMaya && (
                                    <button
                                        onClick={() => setActiveTab('maya')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'maya' ? 'bg-green-500 text-white' : 'bg-muted/20 text-muted hover:bg-muted/30'
                                            }`}
                                    >
                                        🟢 Maya
                                    </button>
                                )}
                                {!hasGcash && !hasMaya && (
                                    <div className="flex-1 py-2 px-3 rounded-lg text-sm text-muted bg-muted/10 text-center">
                                        No payment methods configured
                                    </div>
                                )}
                            </div>

                            {/* Payment info card */}
                            {(hasGcash || hasMaya) && (
                                <div className={`mt-3 p-4 rounded-xl border ${activeTab === 'gcash' ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'
                                    }`}>
                                    {/* Number */}
                                    {activeNumber && (
                                        <div className="text-center mb-3">
                                            <p className="text-xs text-muted mb-1">{activeLabel} Number</p>
                                            <p className={`text-2xl font-bold tracking-widest ${activeColor}`}>
                                                {activeNumber}
                                            </p>
                                            <p className="text-xs text-muted mt-1">
                                                Open {activeLabel} → Send Money → Enter number above
                                            </p>
                                        </div>
                                    )}

                                    {/* QR per merchant */}
                                    <QrDisplay qrUrl={activeQr} label={activeLabel} color={activeColor} />
                                </div>
                            )}
                        </div>

                        {/* Step 2 — Fill in details */}
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                                Step 2 — Fill in Payment Details
                            </p>

                            {/* Global submit error */}
                            {submitError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {submitError}
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Amount Donated (₱) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium">₱</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        className={`input w-full pl-8 ${amountErr ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                                        placeholder="0.00"
                                        min="1"
                                        step="0.01"
                                        disabled={loading}
                                    />
                                </div>
                                {amountErr && <FieldError msg={amountErr} />}
                            </div>

                            {/* Reference Number */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Reference Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={referenceNumber}
                                    onChange={(e) => handleRefChange(e.target.value)}
                                    className={`input w-full ${refErr ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}
                                    placeholder="e.g., 1234567890"
                                    disabled={loading}
                                    maxLength={30}
                                />
                                {refErr
                                    ? <FieldError msg={refErr} />
                                    : <p className="text-xs text-muted mt-1">Found in your {activeLabel} transaction history</p>
                                }
                            </div>

                            {/* Screenshot Upload */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Payment Screenshot <span className="text-red-500">*</span>
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {proofPreview ? (
                                    <div className="relative">
                                        <img
                                            src={proofPreview}
                                            alt="Payment proof"
                                            className="w-full rounded-xl max-h-48 object-contain bg-muted/10 border border-border"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => { setProofFile(null); setProofPreview(null); setProofErr(''); }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors ${proofErr
                                            ? 'border-red-300 text-red-400 hover:border-red-400'
                                            : 'border-border text-muted hover:border-primary hover:text-primary'
                                            }`}
                                    >
                                        <ImageIcon className="w-8 h-8" />
                                        <span className="text-sm font-medium">Click to upload screenshot</span>
                                        <span className="text-xs">JPG, PNG, WebP · max 10MB</span>
                                    </button>
                                )}
                                {proofErr && <FieldError msg={proofErr} />}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn-secondary flex-1"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || (!hasGcash && !hasMaya)}
                                    className={`flex-1 flex items-center justify-center gap-2 font-medium py-2 px-4 rounded-lg text-white transition-colors ${loading || (!hasGcash && !hasMaya)
                                        ? 'bg-muted cursor-not-allowed'
                                        : `${activeBgTab} hover:opacity-90`
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Submit Donation
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
