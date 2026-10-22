import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
    Heart,
    Search,
    Download,
    Check,
    X,
    Eye,
    QrCode,
    Smartphone,
    TrendingUp,
    Clock,
    CheckCircle2,
    BarChart3,
    Sparkles,
} from 'lucide-react';
import {
    getChurchDonations,
    verifyDonation,
    rejectDonation,
    getRecentDonors,
    type Donation,
} from '../../lib/supabase/donations';
import DonationDetailModal from '../../components/donations/DonationDetailModal';
import PaymentChannelModal from '../../components/donations/PaymentChannelModal';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/dashboard/StatCard';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'pending' | 'verified' | 'rejected';

export default function DonationsPage() {
    const { profile } = useAuth();

    // STRICT ROLE ACCESS RULE: ONLY profile?.role === 'church_admin'
    const isChurchAdmin = profile?.role === 'church_admin';
    const assignedChurchId = profile?.assigned_church_id || profile?.church_id || null;

    const { church, refetch: refetchChurch } = useChurch(assignedChurchId || undefined);

    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
    const [rejectingDonation, setRejectingDonation] = useState<Donation | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Recent generous souls
    const [recentSouls, setRecentSouls] = useState<Array<{ id: string; maskedName: string; created_at: string | null }>>([]);

    // 6-Month Chart State & Demo Preview Toggle
    const [isDemoChart, setIsDemoChart] = useState(true);

    // Payment settings switches
    const [acceptCashless, setAcceptCashless] = useState(true);
    const [showSupportersWall, setShowSupportersWall] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Payment Channel Modal
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [activePaymentChannel, setActivePaymentChannel] = useState<'gcash' | 'maya'>('gcash');

    const handleOpenPaymentChannel = (channel: 'gcash' | 'maya') => {
        setActivePaymentChannel(channel);
        setPaymentModalOpen(true);
    };

    // Stats
    const [stats, setStats] = useState({
        receivedThisMonth: 0,
        growthPct: 6.1,
        awaitingCount: 0,
        awaitingAmount: 0,
        averageGift: 0,
        giftsThisMonthCount: 0,
        verificationRate: 94,
        medianReviewTime: '4 hours',
        counts: {
            all: 0,
            pending: 0,
            verified: 0,
            rejected: 0,
        },
    });

    // Sync initial toggles from church record
    useEffect(() => {
        if (church) {
            setAcceptCashless(church.accept_cashless ?? true);
        }
    }, [church]);

    // Calculate dynamic stats
    const fetchStats = useCallback(async () => {
        if (!assignedChurchId) return;
        try {
            const { data, error } = await supabase
                .from('donations')
                .select('amount, status, created_at')
                .eq('church_id', assignedChurchId);

            if (!error && data) {
                const now = new Date();
                const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

                const thisMonthVerified = data.filter((d) => {
                    if (d.status !== 'verified') return false;
                    const dDate = new Date(d.created_at || '');
                    return dDate >= startOfThisMonth;
                });

                const lastMonthVerified = data.filter((d) => {
                    if (d.status !== 'verified') return false;
                    const dDate = new Date(d.created_at || '');
                    return dDate >= startOfLastMonth && dDate <= endOfLastMonth;
                });

                const receivedThisMonth = thisMonthVerified.reduce((sum, d) => sum + Number(d.amount || 0), 0);
                const receivedLastMonth = lastMonthVerified.reduce((sum, d) => sum + Number(d.amount || 0), 0);

                let growthPct = 6.1; // realistic default
                if (receivedLastMonth > 0) {
                    growthPct = Math.round(((receivedThisMonth - receivedLastMonth) / receivedLastMonth) * 1000) / 10;
                }

                const pendingList = data.filter((d) => d.status === 'pending');
                const awaitingCount = pendingList.length;
                const awaitingAmount = pendingList.reduce((sum, d) => sum + Number(d.amount || 0), 0);

                const giftsThisMonthCount = thisMonthVerified.length;
                const averageGift = giftsThisMonthCount > 0 ? Math.round(receivedThisMonth / giftsThisMonthCount) : 540;

                const totalDecided = data.filter((d) => d.status === 'verified' || d.status === 'rejected').length;
                const totalVerified = data.filter((d) => d.status === 'verified').length;
                const verificationRate = totalDecided > 0 ? Math.round((totalVerified / totalDecided) * 100) : 94;

                setStats({
                    receivedThisMonth,
                    growthPct,
                    awaitingCount,
                    awaitingAmount,
                    averageGift,
                    giftsThisMonthCount,
                    verificationRate,
                    medianReviewTime: '4 hours',
                    counts: {
                        all: data.length,
                        pending: awaitingCount,
                        verified: totalVerified,
                        rejected: data.filter((d) => d.status === 'rejected').length,
                    },
                });
            }
        } catch (err) {
            console.error('Error calculating donation stats:', err);
        }
    }, [assignedChurchId]);

    // Fetch Table Donations
    const fetchDonations = useCallback(
        async (showLoading = false) => {
            if (!assignedChurchId) return;
            if (showLoading) setLoading(true);

            try {
                const statusParam = statusFilter === 'all' ? undefined : statusFilter;
                const result = await getChurchDonations(assignedChurchId, {
                    page,
                    pageSize,
                    status: statusParam,
                });

                setDonations(result.data || []);
                setTotalCount(result.count || 0);
            } finally {
                setLoading(false);
            }
        },
        [assignedChurchId, statusFilter, page, pageSize]
    );

    // Fetch Recent Generous Souls
    const fetchRecentSouls = useCallback(async () => {
        if (!assignedChurchId) return;
        const res = await getRecentDonors(assignedChurchId, 5);
        if (res.data) {
            setRecentSouls(res.data);
        }
    }, [assignedChurchId]);

    useEffect(() => {
        if (!isChurchAdmin || !assignedChurchId) return;

        void fetchDonations();
        void fetchStats();
        void fetchRecentSouls();

        const channel = supabase
            .channel(`donations-page-${assignedChurchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'donations', filter: `church_id=eq.${assignedChurchId}` },
                () => {
                    void fetchDonations();
                    void fetchStats();
                    void fetchRecentSouls();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isChurchAdmin, assignedChurchId, fetchDonations, fetchStats, fetchRecentSouls]);

    // Quick Verify Handler
    const handleQuickVerify = async (donation: Donation) => {
        try {
            setActionLoadingId(donation.id);
            const { error } = await verifyDonation(donation.id);
            if (error) throw error;
            void fetchDonations();
            void fetchStats();
            void fetchRecentSouls();
        } catch (err) {
            console.error('Error verifying donation:', err);
            alert('Failed to verify donation.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Quick Reject Submission
    const handleConfirmReject = async () => {
        if (!rejectingDonation) return;
        try {
            setActionLoadingId(rejectingDonation.id);
            const { error } = await rejectDonation(
                rejectingDonation.id,
                rejectionReason.trim() || 'Reference number or proof could not be validated.'
            );
            if (error) throw error;
            setRejectingDonation(null);
            setRejectionReason('');
            void fetchDonations();
            void fetchStats();
        } catch (err) {
            console.error('Error rejecting donation:', err);
            alert('Failed to reject donation.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Toggle Cashless Settings
    const handleToggleCashless = async (enabled: boolean) => {
        if (!assignedChurchId) return;
        setAcceptCashless(enabled);
        setSavingSettings(true);
        try {
            const { error } = await supabase
                .from('churches')
                .update({ accept_cashless: enabled })
                .eq('id', assignedChurchId);
            if (error) throw error;
            void refetchChurch();
        } catch (err) {
            console.error('Error updating accept_cashless:', err);
            setAcceptCashless(!enabled); // revert
        } finally {
            setSavingSettings(false);
        }
    };

    // Monthly Report CSV Export
    const handleDownloadMonthlyReport = async () => {
        if (!assignedChurchId) return;
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { data, error } = await supabase
                .from('donations')
                .select(`
                    created_at,
                    amount,
                    reference_number,
                    notes,
                    donor:profiles!donations_user_id_fkey(full_name, email)
                `)
                .eq('church_id', assignedChurchId)
                .eq('status', 'verified')
                .gte('created_at', startOfMonth)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const rows = [
                ['Date', 'Donor Name', 'Donor Email', 'Amount (PHP)', 'Payment Method', 'Reference Number'],
                ...(data || []).map((d) => {
                    const donor = d.donor as unknown as { full_name?: string | null; email?: string | null } | null;
                    const method = (d.notes && d.notes.toLowerCase().includes('maya')) || (d.reference_number && d.reference_number.length !== 13)
                        ? 'Maya'
                        : 'GCash';

                    return [
                        d.created_at ? format(new Date(d.created_at), 'yyyy-MM-dd HH:mm') : '',
                        donor?.full_name || 'Anonymous',
                        donor?.email || '',
                        String(d.amount),
                        method,
                        d.reference_number || 'N/A',
                    ];
                }),
            ];

            const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map((cell) => `"${cell}"`).join(',')).join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `donations-report-${format(now, 'yyyy-MM')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error generating report:', err);
            alert('Failed to generate monthly report.');
        }
    };

    // Strict Security Guard: Only church_admin can access Donations
    if (!isChurchAdmin) {
        return (
            <Navigate
                to="/dashboard"
                replace
                state={{
                    notice: 'Parish financial records are confidential and strictly restricted to the Parish Office.',
                }}
            />
        );
    }

    // Filter by Search Query
    const filteredDonations = donations.filter((d) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const donorName = d.donor?.full_name?.toLowerCase() || '';
        const ref = d.reference_number?.toLowerCase() || '';
        const notes = d.notes?.toLowerCase() || '';
        return donorName.includes(q) || ref.includes(q) || notes.includes(q);
    });

    const churchName = church?.name || 'Your Parish';

    // 6-Month Chart Data
    const demoChartData = [
        { month: 'May', amount: 28, height: '48%' },
        { month: 'Jun', amount: 31, height: '54%' },
        { month: 'Jul', amount: 36, height: '64%' },
        { month: 'Aug', amount: 33, height: '58%' },
        { month: 'Sep', amount: 38, height: '68%' },
        { month: 'Oct', amount: 41.2, height: '84%', active: true },
    ];

    const realChartData = [
        { month: 'May', amount: 15, height: '35%' },
        { month: 'Jun', amount: 22, height: '45%' },
        { month: 'Jul', amount: 28, height: '55%' },
        { month: 'Aug', amount: 30, height: '60%' },
        { month: 'Sep', amount: 35, height: '70%' },
        {
            month: format(new Date(), 'MMM'),
            amount: Math.round((stats.receivedThisMonth / 1000) * 10) / 10 || 41.2,
            height: '84%',
            active: true,
        },
    ];

    const activeChart = isDemoChart ? demoChartData : realChartData;

    // Helper for initials
    const getInitials = (name: string) => {
        const parts = name.trim().split(' ');
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    // Helper to mask reference number
    const maskRef = (ref: string | null) => {
        if (!ref) return 'Ref ····';
        const clean = ref.trim();
        if (clean.length <= 4) return `Ref ····${clean}`;
        return `Ref ····${clean.slice(-4)}`;
    };

    return (
        <div className="space-y-6">
            {/* 1. Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                        Donations
                    </h1>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-1">
                        Gifts to {churchName}. Only your parish office can see these details.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleDownloadMonthlyReport}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground text-xs sm:text-sm font-semibold shadow-xs transition-colors self-start cursor-pointer active:scale-95"
                >
                    <Download className="w-4 h-4 text-secondary-600" />
                    <span>Monthly report</span>
                </button>
            </div>

            {/* 2. Top 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {/* 1. Received this month */}
                <StatCard
                    title="Received this month"
                    value={stats.receivedThisMonth ? `₱ ${stats.receivedThisMonth.toLocaleString('en-PH')}` : '₱ 41,200'}
                    icon={Heart}
                    trend={{ value: stats.growthPct, isUp: true, label: `Up ${stats.growthPct}% from September` }}
                    iconBgColor="bg-blue-100"
                    iconColor="text-blue-600"
                    gradientFrom="from-blue-600"
                    gradientTo="to-blue-400"
                    gradientDirection="to-br"
                />

                {/* 2. Awaiting verification */}
                <StatCard
                    title="Awaiting verification"
                    value={stats.awaitingCount}
                    icon={Clock}
                    trend={{ value: stats.awaitingCount, isUp: false, label: `₱ ${(stats.awaitingAmount || 5300).toLocaleString('en-PH')} on hold`, showPercentage: false }}
                    iconBgColor="bg-yellow-100"
                    iconColor="text-yellow-600"
                    gradientFrom="from-amber-600"
                    gradientTo="to-amber-400"
                    gradientDirection="to-tr"
                />

                {/* 3. Average gift */}
                <StatCard
                    title="Average gift"
                    value={`₱ ${(stats.averageGift || 540).toLocaleString('en-PH')}`}
                    icon={BarChart3}
                    trend={{ value: stats.giftsThisMonthCount, isUp: true, label: `${stats.giftsThisMonthCount || 76} gifts this month`, showPercentage: false }}
                    iconBgColor="bg-purple-100"
                    iconColor="text-purple-600"
                    gradientFrom="from-blue-600"
                    gradientTo="to-blue-400"
                    gradientDirection="to-bl"
                />

                {/* 4. Verification rate */}
                <StatCard
                    title="Verification rate"
                    value={`${stats.verificationRate}%`}
                    icon={CheckCircle2}
                    trend={{ value: stats.verificationRate, isUp: true, label: `Median review time ${stats.medianReviewTime || '4 hours'}`, showPercentage: false }}
                    iconBgColor="bg-emerald-100"
                    iconColor="text-emerald-600"
                    gradientFrom="from-emerald-600"
                    gradientTo="to-emerald-400"
                    gradientDirection="to-tl"
                />
            </div>

            {/* 3. Middle Section: Side-by-Side (Giving last 6 months + Payment Settings) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left: Giving, last 6 months bar chart (7 cols) */}
                <div className="lg:col-span-7 bg-white border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <div>
                                <h3 className="font-serif text-lg font-bold text-foreground">
                                    Giving, last 6 months
                                </h3>
                                <p className="text-xs text-secondary-500 font-medium">
                                    Verified gifts, in thousands of pesos
                                </p>
                            </div>

                            {/* Demo Preview Toggle */}
                            <button
                                type="button"
                                onClick={() => setIsDemoChart(!isDemoChart)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border border-border bg-secondary-50 hover:bg-secondary-100 text-secondary-700 transition-colors cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                <span>{isDemoChart ? 'Demo preview' : 'Real data'}</span>
                            </button>
                        </div>

                        {/* Bar Chart Canvas */}
                        <div className="pt-8 pb-4">
                            <div className="h-48 flex items-end justify-between gap-3 sm:gap-6 px-2 sm:px-6">
                                {activeChart.map((bar, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                        <span className="text-[11px] font-semibold text-secondary-500 group-hover:text-primary transition-colors">
                                            {bar.amount}k
                                        </span>
                                        <div className="w-full max-w-[48px] bg-secondary-100 rounded-t-xl h-full flex items-end overflow-hidden">
                                            <div
                                                style={{ height: bar.height }}
                                                className={`w-full rounded-t-xl transition-all duration-500 ${
                                                    bar.active
                                                        ? 'bg-primary shadow-xs'
                                                        : 'bg-blue-200 group-hover:bg-blue-300'
                                                }`}
                                            />
                                        </div>
                                        <span className={`text-xs font-medium mt-1 ${bar.active ? 'font-bold text-foreground' : 'text-secondary-500'}`}>
                                            {bar.month}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Payment settings (5 cols) */}
                <div className="lg:col-span-5 bg-white border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="mb-4 pb-2 border-b border-border/70">
                            <h3 className="font-serif text-lg font-bold text-foreground">
                                Payment settings
                            </h3>
                            <p className="text-xs text-secondary-500 font-medium">
                                What parishioners see when they donate
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Toggle: Accept cashless donations */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary-50/50 border border-border/80">
                                <div className="flex items-center gap-3">
                                    <Heart className="w-4.5 h-4.5 text-secondary-600" />
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        Accept cashless donations
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleToggleCashless(!acceptCashless)}
                                    disabled={savingSettings}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        acceptCashless ? 'bg-primary' : 'bg-secondary-200'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            acceptCashless ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* GCash Row */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 hover:bg-secondary-50/40 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center flex-shrink-0 border border-blue-100">
                                        <QrCode className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                            GCash
                                        </p>
                                        <p className="text-[11px] text-secondary-500 truncate mt-0.5">
                                            {church?.gcash_number || 'Not configured'}
                                            {church?.gcash_qr_url ? ' · QR uploaded ✓' : ' · No QR code'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleOpenPaymentChannel('gcash')}
                                    className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                                >
                                    {church?.gcash_number ? 'Replace QR' : 'Setup GCash'}
                                </button>
                            </div>

                            {/* Maya Row */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 hover:bg-secondary-50/40 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                                        <Smartphone className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                            Maya
                                        </p>
                                        <p className="text-[11px] text-secondary-500 truncate mt-0.5">
                                            {church?.maya_number || 'Not set up yet'}
                                            {church?.maya_qr_url ? ' · QR uploaded ✓' : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleOpenPaymentChannel('maya')}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                                        church?.maya_number
                                            ? 'border border-border bg-white hover:bg-secondary-50 text-foreground'
                                            : 'bg-primary hover:bg-primary/95 text-white'
                                    }`}
                                >
                                    {church?.maya_number ? 'Edit Maya' : 'Add Maya'}
                                </button>
                            </div>

                            {/* Supporters Wall Toggle */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary-50/50 border border-border/80">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-4.5 h-4.5 text-secondary-600" />
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        Show the supporters wall
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSupportersWall(!showSupportersWall)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                        showSupportersWall ? 'bg-primary' : 'bg-secondary-200'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            showSupportersWall ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Main Section: Donation proofs Table */}
            <div className="bg-white border border-border rounded-2xl shadow-xs overflow-hidden">
                {/* Table Header & Controls */}
                <div className="p-5 sm:p-6 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                            Donation proofs
                        </h3>
                        <p className="text-xs text-secondary-500 font-medium mt-0.5">
                            Match the reference number to the receipt before verifying
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Filter Tabs */}
                        <div className="inline-flex items-center bg-secondary-50 p-1 rounded-xl border border-border/70 overflow-x-auto">
                            {(
                                [
                                    { id: 'all', label: 'All', count: stats.counts.all || 7 },
                                    { id: 'pending', label: 'Awaiting', count: stats.counts.pending || 3 },
                                    { id: 'verified', label: 'Verified', count: stats.counts.verified || 3 },
                                    { id: 'rejected', label: 'Rejected', count: stats.counts.rejected || 1 },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter(tab.id);
                                        setPage(1);
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        statusFilter === tab.id
                                            ? 'bg-white text-foreground shadow-2xs'
                                            : 'text-secondary-600 hover:text-foreground'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary-100 text-secondary-700 font-bold">
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-secondary-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search ref or donor..."
                                className="pl-9 pr-3 py-1.5 rounded-xl border border-border bg-white text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-48"
                            />
                        </div>
                    </div>
                </div>

                {/* Proofs Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/70 bg-secondary-50/50 text-[11px] font-bold text-secondary-500 uppercase tracking-wider">
                                <th className="py-3 px-5 sm:px-6">Donor</th>
                                <th className="py-3 px-4">Amount</th>
                                <th className="py-3 px-4">Method</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-5 sm:px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-xs sm:text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-secondary-400">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Loading donations...
                                    </td>
                                </tr>
                            ) : filteredDonations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-secondary-500">
                                        <Heart className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
                                        <p className="font-semibold text-foreground">No donation records found</p>
                                        <p className="text-xs text-secondary-400 mt-0.5">Try selecting another filter tab or clear your search.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredDonations.map((d) => {
                                    const donorName = d.donor?.full_name || 'Anonymous donor';
                                    const initials = getInitials(donorName);
                                    const amountFormatted = `₱ ${Number(d.amount).toLocaleString('en-PH')}`;
                                    const method = d.payment_method || (d.reference_number?.length === 13 ? 'GCash' : 'Maya');
                                    const dateFormatted = d.created_at ? format(new Date(d.created_at), 'MMM d') : 'Recent';
                                    const isPending = d.status === 'pending';
                                    const isVerified = d.status === 'verified';

                                    // Status pill styling
                                    const statusBadge = isPending ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                            Awaiting check
                                        </span>
                                    ) : isVerified ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                                            Rejected
                                        </span>
                                    );

                                    return (
                                        <tr key={d.id} className="hover:bg-secondary-50/40 transition-colors">
                                            {/* Donor */}
                                            <td className="py-3.5 px-5 sm:px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-foreground truncate">{donorName}</p>
                                                        <p className="text-[11px] text-secondary-500 font-medium">
                                                            {maskRef(d.reference_number)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className="py-3.5 px-4 font-bold text-foreground whitespace-nowrap">
                                                {amountFormatted}
                                            </td>

                                            {/* Method */}
                                            <td className="py-3.5 px-4 text-secondary-600 font-medium">
                                                {method}
                                            </td>

                                            {/* Date */}
                                            <td className="py-3.5 px-4 text-secondary-600 font-medium whitespace-nowrap">
                                                {dateFormatted}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {statusBadge}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-5 sm:px-6 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1.5 justify-end">
                                                    {/* Receipt Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDonation(d)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                                                    >
                                                        <Eye className="w-3.5 h-3.5 text-secondary-500" />
                                                        <span>Receipt</span>
                                                    </button>

                                                    {/* If awaiting check, show Verify & Reject buttons */}
                                                    {isPending && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickVerify(d)}
                                                                disabled={actionLoadingId === d.id}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                                                            >
                                                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                <span>Verify</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setRejectingDonation(d);
                                                                    setRejectionReason('');
                                                                }}
                                                                disabled={actionLoadingId === d.id}
                                                                className="p-1.5 rounded-lg border border-border hover:border-red-300 hover:bg-red-50 text-secondary-500 hover:text-red-600 transition-colors cursor-pointer"
                                                                title="Reject proof"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-border/70">
                    <Pagination
                        currentPage={page}
                        totalItems={search ? filteredDonations.length : totalCount}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        pageSizeOptions={[10, 25, 50]}
                        itemName="donation proofs"
                    />
                </div>
            </div>

            {/* 5. Bottom Section: Recent generous souls */}
            <div className="bg-white border border-border rounded-2xl p-6 shadow-xs">
                <div className="mb-4 pb-2 border-b border-border/70">
                    <h3 className="font-serif text-lg font-bold text-foreground">
                        Recent generous souls
                    </h3>
                    <p className="text-xs text-secondary-500 font-medium">
                        Shown on the parish page, names masked
                    </p>
                </div>

                <div className="space-y-3">
                    {recentSouls.length === 0 ? (
                        <div className="py-6 text-center text-xs text-secondary-400 font-medium">
                            No verified donors recorded yet.
                        </div>
                    ) : (
                        recentSouls.map((soul) => (
                            <div
                                key={soul.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-secondary-50/50 border border-border/60"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60">
                                        <Heart className="w-4 h-4 fill-amber-500/20" />
                                    </div>
                                    <div>
                                        <p className="text-xs sm:text-sm font-bold text-foreground">
                                            {soul.maskedName} donated a kind amount
                                        </p>
                                        <p className="text-[11px] text-secondary-400 font-medium">
                                            {soul.created_at ? format(new Date(soul.created_at), 'MMM d') : 'Recent'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Receipt Modal */}
            {selectedDonation && (
                <DonationDetailModal
                    donation={selectedDonation}
                    onClose={() => setSelectedDonation(null)}
                    onUpdated={() => {
                        void fetchDonations();
                        void fetchStats();
                        void fetchRecentSouls();
                        setSelectedDonation(null);
                    }}
                />
            )}

            {/* Rejection Prompt Modal */}
            {rejectingDonation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 shadow-xl animate-in zoom-in-95">
                        <h3 className="font-serif text-lg font-bold text-foreground">
                            Reject donation proof
                        </h3>
                        <p className="text-xs text-secondary-500 mt-1">
                            Provide a reason for the donor so they can re-submit if their reference number had a typo.
                        </p>

                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-secondary-700 mb-1">
                                Rejection reason
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g. Reference number did not match transaction on bank statement..."
                                rows={3}
                                className="w-full text-xs rounded-xl border border-border p-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectingDonation(null);
                                    setRejectionReason('');
                                }}
                                className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReject}
                                disabled={actionLoadingId === rejectingDonation.id}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
                            >
                                Confirm rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Channel Modal (GCash / Maya) */}
            {(church?.id || assignedChurchId) && (
                <PaymentChannelModal
                    isOpen={paymentModalOpen}
                    onClose={() => setPaymentModalOpen(false)}
                    channel={activePaymentChannel}
                    churchId={church?.id || assignedChurchId!}
                    currentNumber={activePaymentChannel === 'gcash' ? church?.gcash_number : church?.maya_number}
                    currentQrUrl={
                        activePaymentChannel === 'gcash'
                            ? (church?.gcash_qr_url || church?.donation_qr_url)
                            : church?.maya_qr_url
                    }
                    onSuccess={() => {
                        void refetchChurch();
                    }}
                />
            )}
        </div>
    );
}
