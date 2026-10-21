import { useState, useEffect, useRef } from 'react';
import {
    BookOpen,
    Heart,
    Scroll,
    Check,
    Copy,
    Calendar,
    QrCode,
    Upload,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Lock,
    ExternalLink,
    X,
    Download,
    FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { submitDonation, submitQuickOffering } from '../../lib/supabase/donations';
import { getDailyReadings, ACT_OF_SPIRITUAL_COMMUNION, type LiturgicalDay } from '../../lib/liturgy';
import { useNavigate } from 'react-router-dom';
import type { Church } from '../../hooks/useChurches';

interface VirtualSanctuarySidebarProps {
    church: Church;
    activeTab?: 'liturgy' | 'intentions' | 'offertory';
    onTabChange?: (tab: 'liturgy' | 'intentions' | 'offertory') => void;
    onClose?: () => void;
    className?: string;
}

interface MassIntentionItem {
    id: string;
    requested_date: string;
    notes: string | null;
    status: string | null;
    category: 'thanksgiving' | 'soul' | 'healing';
    donorName: string;
}

function categorizeIntention(notes?: string | null): 'thanksgiving' | 'soul' | 'healing' {
    if (!notes) return 'healing';
    const text = notes.toLowerCase();
    if (text.includes('soul') || text.includes('memorial') || text.includes('death') || text.includes('deceased') || text.includes('requiem') || text.includes('rip') || text.includes('repose')) {
        return 'soul';
    }
    if (text.includes('thanksgiving') || text.includes('birthday') || text.includes('anniversary') || text.includes('gratitude') || text.includes('salamat')) {
        return 'thanksgiving';
    }
    return 'healing';
}

export default function VirtualSanctuarySidebar({
    church,
    activeTab = 'liturgy',
    onTabChange,
    onClose,
    className = '',
}: VirtualSanctuarySidebarProps) {
    const navigate = useNavigate();
    const [currentTab, setCurrentTab] = useState<'liturgy' | 'intentions' | 'offertory'>(activeTab);

    // Sync external active tab
    useEffect(() => {
        if (activeTab) setCurrentTab(activeTab);
    }, [activeTab]);

    const setTab = (t: 'liturgy' | 'intentions' | 'offertory') => {
        setCurrentTab(t);
        onTabChange?.(t);
    };

    // Liturgy readings state
    const readings: LiturgicalDay = getDailyReadings();
    const [copiedLiturgy, setCopiedLiturgy] = useState(false);
    const [copiedPrayer, setCopiedPrayer] = useState(false);

    // Intentions state
    const [intentions, setIntentions] = useState<MassIntentionItem[]>([]);
    const [loadingIntentions, setLoadingIntentions] = useState(false);

    // Offertory state
    const isUnverified = church.status === 'unverified' || (church.status && church.status !== 'verified_active' && church.status !== 'active');
    const cashlessPaused = church.accept_cashless === false;
    const hasGcash = !isUnverified && !cashlessPaused && !!(church.gcash_number || church.gcash_qr_url);
    const hasMaya = !isUnverified && !cashlessPaused && !!(church.maya_number || church.maya_qr_url);
    const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'maya'>(hasGcash ? 'gcash' : 'maya');
    const [offertoryAmount, setOffertoryAmount] = useState('100');
    const [offertoryRef, setOffertoryRef] = useState('');
    const [offertoryProof, setOffertoryProof] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [submittingDonation, setSubmittingDonation] = useState(false);
    const [donationError, setDonationError] = useState<string | null>(null);
    const [donationSuccess, setDonationSuccess] = useState(false);
    const [showAsSupporter, setShowAsSupporter] = useState(true);
    const [requestOfficialReceipt, setRequestOfficialReceipt] = useState(false);
    const [isQuickBlessing, setIsQuickBlessing] = useState(false);
    const [copiedOffertoryNumber, setCopiedOffertoryNumber] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeOffertoryNumber = paymentMethod === 'gcash' ? church.gcash_number : church.maya_number;
    const activeOffertoryQr = paymentMethod === 'gcash' ? church.gcash_qr_url : church.maya_qr_url;
    const activeOffertoryLabel = paymentMethod === 'gcash' ? 'GCash' : 'Maya';

    const handleCopyOffertoryNumber = async () => {
        if (!activeOffertoryNumber) return;
        try {
            await navigator.clipboard.writeText(activeOffertoryNumber);
            setCopiedOffertoryNumber(true);
            setTimeout(() => setCopiedOffertoryNumber(false), 2000);
        } catch {
            // Fallback
        }
    };

    const handleDownloadOffertoryQr = () => {
        if (!activeOffertoryQr) return;
        try {
            const link = document.createElement('a');
            link.href = activeOffertoryQr;
            link.download = `${church.name.replace(/[^a-zA-Z0-9]/g, '_')}_${activeOffertoryLabel}_QR.png`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            window.open(activeOffertoryQr, '_blank');
        }
    };

    // Fetch mass intentions for church
    useEffect(() => {
        if (!church.id) return;
        const fetchIntentions = async () => {
            setLoadingIntentions(true);
            try {
                const { data, error: fetchErr } = await supabase
                    .from('appointments')
                    .select(`
                        id,
                        appointment_date,
                        notes,
                        status,
                        user_id,
                        profiles:profiles!appointments_user_id_fkey (
                            full_name
                        )
                    `)
                    .eq('church_id', church.id)
                    .eq('service_type', 'mass_intention')
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (fetchErr) {
                    console.error('Error fetching mass intentions:', fetchErr);
                    return;
                }

                if (data) {
                    type RawIntention = {
                        id: string;
                        appointment_date?: string | null;
                        requested_date?: string | null;
                        notes?: string | null;
                        status?: string | null;
                        profiles?: { full_name?: string | null } | null;
                    };
                    const mapped: MassIntentionItem[] = (data as unknown as RawIntention[]).map((item) => {
                        const rawNotes = item.notes || 'Special intention for the Holy Mass';
                        const fullName = item.profiles?.full_name || 'Parishioner';
                        return {
                            id: item.id,
                            requested_date: item.appointment_date || item.requested_date || '',
                            notes: rawNotes,
                            status: item.status || null,
                            category: categorizeIntention(rawNotes),
                            donorName: fullName,
                        };
                    });
                    setIntentions(mapped);
                }
            } catch (err) {
                console.error('Error fetching mass intentions:', err);
            } finally {
                setLoadingIntentions(false);
            }
        };

        fetchIntentions();
    }, [church.id]);

    const handleCopyReadings = async () => {
        const textToCopy = `${readings.title} (${readings.date})\n\nHoly Gospel: ${readings.gospel.citation}\n${readings.gospel.text}\n\n${ACT_OF_SPIRITUAL_COMMUNION.title} (${ACT_OF_SPIRITUAL_COMMUNION.author}):\n${ACT_OF_SPIRITUAL_COMMUNION.prayer}`;
        await navigator.clipboard.writeText(textToCopy);
        setCopiedLiturgy(true);
        setTimeout(() => setCopiedLiturgy(false), 2500);
    };

    const handleCopyPrayer = async () => {
        const textToCopy = `${ACT_OF_SPIRITUAL_COMMUNION.title} (${ACT_OF_SPIRITUAL_COMMUNION.author}):\n\n"${ACT_OF_SPIRITUAL_COMMUNION.prayer}"`;
        await navigator.clipboard.writeText(textToCopy);
        setCopiedPrayer(true);
        setTimeout(() => setCopiedPrayer(false), 2500);
    };

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setOffertoryProof(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setProofPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDonationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setDonationError(null);

        if (isUnverified) {
            setDonationError('Cashless offertory is temporarily locked pending diocese verification.');
            return;
        }

        if (cashlessPaused) {
            setDonationError('This parish has paused cashless donations. Please try again later.');
            return;
        }

        setSubmittingDonation(true);
        try {
            if (!requestOfficialReceipt) {
                // Tier A: Frictionless Quick Love Offering (Zero required inputs)
                const result = await submitQuickOffering({
                    churchId: church.id,
                    paymentMethod,
                    amount: parseFloat(offertoryAmount) || 0,
                });

                if (result.error) {
                    setDonationError(result.error.message || 'Failed to submit love offering.');
                } else {
                    setIsQuickBlessing(true);
                    setDonationSuccess(true);
                }
            } else {
                // Tier B: Recorded Official Acknowledgment
                const amountNum = parseFloat(offertoryAmount);
                if (isNaN(amountNum) || amountNum <= 0) {
                    setDonationError('Please enter a valid donation amount.');
                    setSubmittingDonation(false);
                    return;
                }

                if (!offertoryRef.trim()) {
                    setDonationError('Please enter the GCash/Maya transaction reference number.');
                    setSubmittingDonation(false);
                    return;
                }

                if (!offertoryProof) {
                    setDonationError('Please upload a screenshot of your payment confirmation.');
                    setSubmittingDonation(false);
                    return;
                }

                const result = await submitDonation({
                    churchId: church.id,
                    amount: amountNum,
                    referenceNumber: offertoryRef.trim(),
                    proofFile: offertoryProof,
                    showAsSupporter,
                    paymentMethod,
                });

                if (result.error) {
                    setDonationError(result.error.message || 'Failed to submit donation.');
                } else {
                    setIsQuickBlessing(false);
                    setDonationSuccess(true);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setDonationError(message);
        } finally {
            setSubmittingDonation(false);
        }
    };

    const thanksgivingIntentions = intentions.filter((i) => i.category === 'thanksgiving');
    const soulIntentions = intentions.filter((i) => i.category === 'soul');
    const healingIntentions = intentions.filter((i) => i.category === 'healing');

    return (
        <div className={`overflow-hidden flex flex-col text-foreground bg-white dark:bg-card ${className ? className : 'card shadow-sm border border-border rounded-2xl'}`}>
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-border bg-secondary-50 dark:bg-secondary-900/40 p-2 gap-1 shrink-0">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <button
                        type="button"
                        onClick={() => setTab('liturgy')}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            currentTab === 'liturgy'
                                ? 'bg-primary text-white shadow-sm shadow-blue-500/20'
                                : 'text-muted hover:text-foreground hover:bg-secondary-100 dark:hover:bg-secondary-800/60'
                        }`}
                        title="Daily Gospel & Spiritual Communion"
                    >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Gospel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setTab('intentions')}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            currentTab === 'intentions'
                                ? 'bg-primary text-white shadow-sm shadow-blue-500/20'
                                : 'text-muted hover:text-foreground hover:bg-secondary-100 dark:hover:bg-secondary-800/60'
                        }`}
                        title="Mass Intentions"
                    >
                        <Scroll className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Intentions</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setTab('offertory')}
                        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                            currentTab === 'offertory'
                                ? 'bg-primary text-white shadow-sm shadow-blue-500/20'
                                : 'text-muted hover:text-foreground hover:bg-secondary-100 dark:hover:bg-secondary-800/60'
                        }`}
                        title="Digital Offertory"
                    >
                        <Heart className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Offertory</span>
                    </button>
                </div>

                {onClose && (
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-1.5 rounded-xl text-muted hover:text-foreground hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-all duration-200 shrink-0 cursor-pointer ml-1 hover:-translate-y-0.5 active:scale-95"
                        title="Close"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Tab Body */}
            <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto max-h-[75vh] scrollbar-thin">
                {/* ── TAB 1: DAILY GOSPEL & SPIRITUAL COMMUNION ── */}
                {currentTab === 'liturgy' && (
                    <div className="space-y-5 animate-in text-foreground">
                        {/* Liturgy Metadata Card */}
                        <div className="bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-2xl p-4 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                        {readings.season} • {readings.colorName}
                                    </span>
                                </div>
                                <h4 className="font-bold text-base text-foreground">{readings.title}</h4>
                                <p className="text-xs text-muted flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {readings.date}
                                </p>
                            </div>

                            <button
                                onClick={handleCopyReadings}
                                className="p-2 rounded-xl bg-white dark:bg-secondary-800 border border-border hover:bg-secondary-50 dark:hover:bg-secondary-700 text-muted hover:text-foreground transition-all duration-200 shadow-xs hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                                title="Copy Gospel & Prayer"
                            >
                                {copiedLiturgy ? <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in-50" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Holy Gospel Card */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>Holy Gospel of the Day</span>
                                </span>
                                <span className="text-xs font-mono font-semibold text-foreground/80 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                                    {readings.gospel.citation}
                                </span>
                            </div>
                            <div className="bg-secondary-50/80 dark:bg-secondary-900/40 p-4 sm:p-5 rounded-2xl border border-amber-300/80 dark:border-amber-700/50 space-y-3 shadow-xs">
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium italic">
                                    {readings.gospelAcclamation.verse}
                                </p>
                                <p className="text-xs sm:text-sm text-foreground leading-relaxed font-serif">
                                    {readings.gospel.text}
                                </p>
                            </div>
                        </div>

                        {/* Liturgical Meditation */}
                        {readings.reflection && (
                            <div className="bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-2xl p-4 space-y-1.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Liturgical Meditation</span>
                                </div>
                                <p className="text-xs text-muted leading-relaxed italic">
                                    "{readings.reflection}"
                                </p>
                            </div>
                        )}

                        {/* An Act of Spiritual Communion (Official Catholic Prayer for Online Masses) */}
                        <div className="space-y-2 pt-2 border-t border-border/70">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>An Act of Spiritual Communion</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-muted bg-secondary-100 dark:bg-secondary-800 px-2 py-0.5 rounded-md">
                                        Communion Rite
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyPrayer}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted hover:text-foreground hover:bg-amber-100/60 dark:hover:bg-amber-900/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-800/50 transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs"
                                        title="Copy Spiritual Communion Prayer"
                                    >
                                        {copiedPrayer ? (
                                            <>
                                                <Check className="w-3 h-3 text-emerald-600 animate-in zoom-in-50" />
                                                <span className="text-[10px] text-emerald-600 font-semibold">Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                <span className="text-[10px]">Copy Prayer</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-card border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 space-y-2.5 shadow-xs transition-all">
                                <p className="text-[11px] text-muted leading-snug">
                                    {ACT_OF_SPIRITUAL_COMMUNION.rubric}
                                </p>
                                <p className="text-xs sm:text-sm text-foreground/90 font-serif leading-relaxed italic border-l-2 border-amber-400 dark:border-amber-600 pl-3">
                                    "{ACT_OF_SPIRITUAL_COMMUNION.prayer}"
                                </p>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium text-right">
                                    — {ACT_OF_SPIRITUAL_COMMUNION.author}
                                </p>
                            </div>
                        </div>

                        {/* Official Lectionary Readings Link */}
                        <div className="pt-1">
                            <a
                                href={readings.officialReadingsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-3 rounded-xl border border-border hover:border-primary/40 bg-secondary-50/50 hover:bg-secondary-100 dark:bg-secondary-900/30 dark:hover:bg-secondary-800/60 text-muted hover:text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs"
                            >
                                <BookOpen className="w-3.5 h-3.5 text-primary" />
                                <span>View Full Official Lectionary Readings (USCCB)</span>
                                <ExternalLink className="w-3.5 h-3.5 text-muted" />
                            </a>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: MASS INTENTIONS ── */}
                {currentTab === 'intentions' && (
                    <div className="space-y-5 animate-in text-foreground">
                        <div className="flex items-center justify-between bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-2xl p-4">
                            <div>
                                <h4 className="font-bold text-sm text-foreground">Parish Mass Intentions</h4>
                                <p className="text-xs text-muted">Approved intentions offered in today’s Holy Sacrifice</p>
                            </div>
                            <button
                                onClick={() => navigate(`/appointments/book?churchId=${church.id}&sacrament=mass_intention`)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all duration-200 shrink-0 shadow-xs hover:shadow-md hover:shadow-amber-500/20 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                            >
                                + Book Intention
                            </button>
                        </div>

                        {loadingIntentions ? (
                            <div className="py-12 text-center text-xs text-muted space-y-2">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                                <p>Loading sacred intentions...</p>
                            </div>
                        ) : intentions.length === 0 ? (
                            <div className="text-center py-12 px-4 bg-secondary-50/40 dark:bg-secondary-900/20 rounded-2xl border border-dashed border-border space-y-3">
                                <Scroll className="w-8 h-8 text-muted/60 mx-auto" />
                                <p className="text-xs font-semibold text-foreground">No mass intentions booked yet for this parish</p>
                                <p className="text-[11px] text-muted max-w-xs mx-auto">
                                    Offer thanksgiving, prayers for deceased loved ones, or special intentions for upcoming masses.
                                </p>
                                <button
                                    onClick={() => navigate(`/appointments/book?churchId=${church.id}&sacrament=mass_intention`)}
                                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-700 text-white font-bold text-xs transition-all duration-200 inline-block shadow-xs hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                                >
                                    Offer an Intention
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Thanksgiving */}
                                {thanksgivingIntentions.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                                            <span>🕊️</span>
                                            <span>Thanksgiving & Birthdays ({thanksgivingIntentions.length})</span>
                                        </div>
                                        <div className="space-y-2">
                                            {thanksgivingIntentions.map((item) => (
                                                <div key={item.id} className="bg-white dark:bg-card border border-amber-200 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600 rounded-2xl p-3 space-y-1.5 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                                                    <p className="text-xs font-medium text-foreground">{item.notes}</p>
                                                    <div className="flex items-center justify-between text-[10px] text-muted">
                                                        <span>Offered by: {item.donorName}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold uppercase">Thanksgiving</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Memorial / Souls */}
                                {soulIntentions.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                            <span>🕯️</span>
                                            <span>Repose of Souls ({soulIntentions.length})</span>
                                        </div>
                                        <div className="space-y-2">
                                            {soulIntentions.map((item) => (
                                                <div key={item.id} className="bg-white dark:bg-card border border-indigo-200 dark:border-indigo-800/40 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-3 space-y-1.5 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                                                    <p className="text-xs font-medium text-foreground">{item.notes}</p>
                                                    <div className="flex items-center justify-between text-[10px] text-muted">
                                                        <span>Offered by: {item.donorName}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold uppercase">Eternal Rest</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Healing / Special Petitions */}
                                {healingIntentions.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                            <span>🌿</span>
                                            <span>Healing & Special Intentions ({healingIntentions.length})</span>
                                        </div>
                                        <div className="space-y-2">
                                            {healingIntentions.map((item) => (
                                                <div key={item.id} className="bg-white dark:bg-card border border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-2xl p-3 space-y-1.5 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200">
                                                    <p className="text-xs font-medium text-foreground">{item.notes}</p>
                                                    <div className="flex items-center justify-between text-[10px] text-muted">
                                                        <span>Offered by: {item.donorName}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold uppercase">Petition</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 3: DIGITAL OFFERTORY ── */}
                {currentTab === 'offertory' && (
                    <div className="space-y-5 animate-in text-foreground">
                        {isUnverified || cashlessPaused ? (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                                <div className="flex items-center gap-2 font-bold">
                                    <Lock className="w-4 h-4" />
                                    <span>{isUnverified ? 'Cashless Offertory Temporarily Locked' : 'Cashless Offertory Paused'}</span>
                                </div>
                                <p className="text-muted text-[11px] leading-relaxed">
                                    {isUnverified
                                        ? 'This parish is currently completing diocese verification. In accordance with church transparency protocols, digital collections will open once verified.'
                                        : 'This parish has temporarily paused GCash and Maya donations. Please check back later or contact the parish office.'}
                                </p>
                            </div>
                        ) : donationSuccess ? (
                            isQuickBlessing ? (
                                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-6 text-center space-y-3.5 animate-in">
                                    <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-500 shadow-xs relative">
                                        <Sparkles className="w-7 h-7 animate-pulse" />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-xs">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 mb-1.5">
                                            Spiritual Blessing
                                        </span>
                                        <h4 className="text-base font-bold text-foreground">Love Offering Received 🙏</h4>
                                        <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                                            Thank you for your generous heart! Your digital love offering has been received to sustain this parish's broadcast and altar ministries.
                                        </p>
                                        <p className="text-[11px] text-muted italic mt-2.5 bg-white/70 dark:bg-card/70 p-2.5 rounded-xl border border-border leading-relaxed">
                                            &ldquo;Each of you should give what you have decided in your heart to give, for God loves a cheerful giver.&rdquo;
                                            <span className="block mt-0.5 font-semibold not-italic text-secondary-600 dark:text-secondary-400">
                                                — 2 Corinthians 9:7
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDonationSuccess(false);
                                        }}
                                        className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
                                    >
                                        Amen 🙏
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-3xl p-6 text-center space-y-3 animate-in">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-7 h-7" />
                                    </div>
                                    <h4 className="text-base font-bold text-foreground">Blessing & Gratitude!</h4>
                                    <p className="text-xs text-muted leading-relaxed">
                                        Your love offering of ₱{parseFloat(offertoryAmount || '0').toLocaleString()} has been received and logged for official verification by the parish office.
                                    </p>
                                    {offertoryRef && (
                                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
                                            Ref: {offertoryRef}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDonationSuccess(false);
                                            setOffertoryRef('');
                                            setOffertoryProof(null);
                                            setProofPreview(null);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-800 dark:hover:bg-secondary-700 text-foreground font-bold text-xs transition-colors cursor-pointer"
                                    >
                                        Make Another Offering
                                    </button>
                                </div>
                            )
                        ) : (
                            <form onSubmit={handleDonationSubmit} className="space-y-4">
                                {/* Parish QR & Payment Method Switcher */}
                                <div className="bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-2xl p-4 space-y-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        {hasGcash && (
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('gcash')}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                    paymentMethod === 'gcash'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'bg-white dark:bg-secondary-800 border border-border text-muted hover:text-foreground'
                                                }`}
                                            >
                                                GCash
                                            </button>
                                        )}
                                        {hasMaya && (
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('maya')}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                    paymentMethod === 'maya'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-white dark:bg-secondary-800 border border-border text-muted hover:text-foreground'
                                                }`}
                                            >
                                                Maya
                                            </button>
                                        )}
                                    </div>

                                    {/* QR Image Display */}
                                    <div className="py-1">
                                        {activeOffertoryQr ? (
                                            <div className="space-y-2">
                                                <img
                                                    src={activeOffertoryQr}
                                                    alt={`${activeOffertoryLabel} QR`}
                                                    className="w-40 h-40 mx-auto rounded-xl object-contain border border-border bg-white p-2 shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleDownloadOffertoryQr}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-secondary-800 border border-border hover:bg-secondary-50 dark:hover:bg-secondary-700 text-foreground transition-all active:scale-95 shadow-xs cursor-pointer"
                                                >
                                                    <Download className="w-3 h-3 text-muted" />
                                                    <span>Save QR Image</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-40 h-40 mx-auto rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted p-3 text-center bg-white dark:bg-secondary-900/40">
                                                <QrCode className="w-8 h-8 mb-1 opacity-50 text-muted" />
                                                <span className="text-[10px]">Scan QR or send to account below</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Account Number with 1-Tap Copy */}
                                    {activeOffertoryNumber && (
                                        <div className="bg-white dark:bg-card border border-border/80 rounded-xl p-2.5 text-center shadow-xs">
                                            <div className="text-xs">
                                                <span className="text-muted">{activeOffertoryLabel} No: </span>
                                                <span className="font-mono font-bold text-foreground">
                                                    {activeOffertoryNumber}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyOffertoryNumber}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary-50 dark:bg-secondary-800 border border-border hover:bg-secondary-100 dark:hover:bg-secondary-700 text-foreground transition-all active:scale-95 shadow-xs cursor-pointer"
                                                >
                                                    {copiedOffertoryNumber ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                            <span className="text-emerald-600 font-bold">Copied!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3 text-muted" />
                                                            <span>Copy Number</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Preset Amount Buttons */}
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                                        Love Offering Amount (₱)
                                    </label>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {['50', '100', '200', '500'].map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setOffertoryAmount(amt)}
                                                className={`py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer active:scale-95 hover:border-primary ${
                                                    offertoryAmount === amt
                                                        ? 'bg-primary text-white border-primary shadow-xs shadow-blue-500/20'
                                                        : 'bg-white dark:bg-secondary-800 border-border text-foreground hover:bg-secondary-50 dark:hover:bg-secondary-700'
                                                }`}
                                            >
                                                ₱{amt}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="number"
                                        value={offertoryAmount}
                                        onChange={(e) => setOffertoryAmount(e.target.value)}
                                        placeholder="Enter custom amount"
                                        className="input text-xs w-full"
                                        min="1"
                                    />
                                </div>

                                {/* ── DUAL-TIER TOGGLE: Request Official Acknowledgment ── */}
                                <div className="border-t border-border pt-3">
                                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border bg-secondary-50/50 hover:bg-secondary-50 cursor-pointer transition-colors select-none">
                                        <input
                                            type="checkbox"
                                            checked={requestOfficialReceipt}
                                            onChange={(e) => {
                                                setRequestOfficialReceipt(e.target.checked);
                                                setDonationError(null);
                                            }}
                                            className="mt-0.5 w-3.5 h-3.5 rounded text-primary accent-primary flex-shrink-0 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                                Request Recorded Acknowledgment
                                            </span>
                                            <p className="text-[11px] text-muted mt-0.5 leading-snug">
                                                Check this to submit reference numbers & proof screenshots for official parish records.
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                {/* ── TIER A: 1-TAP FRICTIONLESS OFFERING BUTTON (Default) ── */}
                                {!requestOfficialReceipt && (
                                    <div className="space-y-2 pt-1">
                                        <button
                                            type="submit"
                                            disabled={submittingDonation || (!hasGcash && !hasMaya)}
                                            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {submittingDonation ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Recording Offering...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Heart className="w-4 h-4 fill-white" />
                                                    <span>I have sent my offering 🙏</span>
                                                </>
                                            )}
                                        </button>
                                        <p className="text-[10px] text-center text-muted">
                                            1-tap offertory · No transaction reference or screenshot required
                                        </p>
                                    </div>
                                )}

                                {/* ── TIER B: OFFICIAL VERIFICATION INPUTS (Opt-in) ── */}
                                {requestOfficialReceipt && (
                                    <div className="space-y-3.5 pt-1 animate-in">
                                        {/* Reference Number */}
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Transaction Reference Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={offertoryRef}
                                                onChange={(e) => setOffertoryRef(e.target.value)}
                                                placeholder="e.g., GCash/Maya Ref (12+ digits)"
                                                className="input text-xs w-full font-mono"
                                                required
                                            />
                                        </div>

                                        {/* Proof of Payment File Upload */}
                                        <div>
                                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                                Upload Payment Screenshot <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleProofFileChange}
                                                accept="image/*"
                                                className="hidden"
                                            />
                                            {proofPreview ? (
                                                <div className="relative rounded-2xl overflow-hidden border border-border max-h-36 group">
                                                    <img src={proofPreview} alt="Proof" className="w-full h-36 object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white font-semibold transition-opacity"
                                                    >
                                                        Change Screenshot
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full py-3 bg-white dark:bg-secondary-800 border border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-xs text-muted hover:text-foreground hover:border-primary transition-colors cursor-pointer"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    <span>Attach Receipt Screenshot</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Supporter wall option */}
                                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={showAsSupporter}
                                                onChange={(e) => setShowAsSupporter(e.target.checked)}
                                                className="rounded border-border text-primary focus:ring-primary"
                                            />
                                            <span>Display on parish donor & supporter honor roll</span>
                                        </label>

                                        <button
                                            type="submit"
                                            disabled={submittingDonation}
                                            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                        >
                                            {submittingDonation ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>Submitting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4" />
                                                    <span>Submit for Official Verification</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {donationError && (
                                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{donationError}</span>
                                    </div>
                                )}
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
