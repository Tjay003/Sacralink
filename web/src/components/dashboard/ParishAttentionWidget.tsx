import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, FileText, Calendar, Cross, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getAppointments, type HydratedAppointment } from '../../lib/supabase/appointments';
import { isFuneralService } from '../../lib/supabase/serviceTypes';
import { useAuth } from '../../contexts/AuthContext';

interface ParishAttentionProps {
    churchId: string;
}

interface PendingDonationsSummary {
    count: number;
    totalAmount: number;
}

export default function ParishAttentionWidget({ churchId }: ParishAttentionProps) {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const isChurchAdmin = profile?.role === 'church_admin';

    const [loading, setLoading] = useState(true);
    const [donationsSummary, setDonationsSummary] = useState<PendingDonationsSummary>({ count: 0, totalAmount: 0 });
    const [pendingAppointments, setPendingAppointments] = useState<HydratedAppointment[]>([]);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            // 1. If church_admin, load pending donations summary
            let donCount = 0;
            let donAmount = 0;
            if (isChurchAdmin) {
                const { data: donationsData } = await supabase
                    .from('donations')
                    .select('amount')
                    .eq('church_id', churchId)
                    .eq('status', 'pending');

                if (donationsData) {
                    donCount = donationsData.length;
                    donAmount = donationsData.reduce((sum, d) => sum + Number(d.amount || 0), 0);
                }
            }

            // 2. Load pending appointments for this parish
            const { data: apptsData } = await getAppointments({
                churchId,
                status: 'pending',
                limit: 5,
                orderBy: 'created_at',
                ascending: true,
            });

            setDonationsSummary({ count: donCount, totalAmount: donAmount });
            setPendingAppointments(apptsData || []);
        } catch (error) {
            console.error('Error loading parish attention queue:', error);
        } finally {
            setLoading(false);
        }
    }, [churchId, isChurchAdmin]);

    useEffect(() => {
        void loadData();

        // Listen for realtime updates on appointments and donations
        const channel = supabase
            .channel(`parish-attention-${churchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments', filter: `church_id=eq.${churchId}` },
                () => { void loadData(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'donations', filter: `church_id=eq.${churchId}` },
                () => { void loadData(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [churchId, loadData]);

    const totalOpenCount = (isChurchAdmin && donationsSummary.count > 0 ? 1 : 0) + pendingAppointments.length;

    // Helper to format service type label
    const formatServiceName = (type: string, kind?: string | null) => {
        const clean = type.toLowerCase().replace(/_/g, ' ');
        // A starter service the parish renamed (or any custom one) keeps the parish's own wording
        if (kind && clean !== kind) return type;
        if (clean.includes('baptism')) return 'Baptism';
        if (clean.includes('wedding') || clean.includes('marriage')) return 'Wedding';
        if (clean.includes('mass') || clean.includes('intention')) return 'Mass intention';
        if (clean.includes('funeral') || clean.includes('burial')) return 'Funeral Mass request';
        if (clean.includes('blessing')) return 'Blessing request';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // Dynamic action button label and icon based on appointment service type
    const getActionDetails = (appt: HydratedAppointment) => {
        const type = appt.service_type.toLowerCase();
        if (appt.service_kind === 'baptism' || type.includes('baptism')) {
            return {
                label: 'Review documents',
                subtext: 'Awaiting document check · 3 of 4 attached',
                icon: FileText,
                iconBg: 'bg-amber-50 text-amber-600',
            };
        }
        if (type.includes('mass') || type.includes('intention')) {
            return {
                label: 'Schedule',
                subtext: `Needs a Mass slot on ${new Date(appt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                icon: Calendar,
                iconBg: 'bg-amber-50 text-amber-600',
            };
        }
        if (isFuneralService(appt.service_kind, appt.service_type)) {
            return {
                label: 'Assign celebrant',
                subtext: 'Urgent · no celebrant assigned yet',
                icon: Cross,
                iconBg: 'bg-blue-50 text-primary',
            };
        }
        return {
            label: 'Review request',
            subtext: `Scheduled for ${new Date(appt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            icon: Calendar,
            iconBg: 'bg-secondary-50 text-secondary-600',
        };
    };

    // Compact skeleton during initial load
    if (loading && pendingAppointments.length === 0 && donationsSummary.count === 0) {
        return (
            <div className="p-4 sm:p-5 flex items-center justify-between bg-white border border-border rounded-2xl shadow-xs animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-secondary-100" />
                    <div className="space-y-1.5">
                        <div className="h-4 bg-secondary-100 rounded w-36" />
                        <div className="h-3 bg-secondary-100 rounded w-64" />
                    </div>
                </div>
                <div className="h-8 bg-secondary-100 rounded-lg w-28" />
            </div>
        );
    }

    // Compact status banner when queue is completely all-clear (avoids massive empty card space)
    if (!loading && totalOpenCount === 0) {
        return (
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl shadow-xs transition-all">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/70">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-950">Queue is all clear</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                0 pending
                            </span>
                        </div>
                        <p className="text-xs text-emerald-800/80 mt-0.5">
                            No pending sacrament documents or donation proofs requiring attention.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                        type="button"
                        onClick={() => navigate('/appointments')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                        <span>View appointment history</span>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadData()}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1.5 transition-colors cursor-pointer"
                        title="Refresh queue"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    // Full triage queue when there are open items requiring attention
    return (
        <div className="bg-white border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-border/80 flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground tracking-tight">
                        Needs parish attention
                    </h3>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium mt-0.5">
                        Today's queue for the parish office
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-600 text-xs font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking...</span>
                    </div>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                        {totalOpenCount} open
                    </span>
                )}
            </div>

            {/* Queue List */}
            <div className="divide-y divide-border/70 flex-1">
                {/* 1. Pending Donations Verification (Visible ONLY to church_admin) */}
                {isChurchAdmin && donationsSummary.count > 0 && (
                    <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-secondary-50/50 transition-colors">
                        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                                <Heart className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                    {donationsSummary.count} donation {donationsSummary.count === 1 ? 'proof awaits' : 'proofs await'} verification
                                </p>
                                <p className="text-[11px] sm:text-xs text-secondary-500 font-medium truncate mt-0.5">
                                    ₱ {donationsSummary.totalAmount.toLocaleString('en-PH')} across {donationsSummary.count} {donationsSummary.count === 1 ? 'gift' : 'gifts'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/donations')}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                        >
                            <span>Verify</span>
                            <ChevronRight className="w-3.5 h-3.5 text-secondary-400" />
                        </button>
                    </div>
                )}

                {/* 2. Pending Sacrament Requests */}
                {pendingAppointments.map((appt) => {
                    const action = getActionDetails(appt);
                    const applicantName = appt.profile?.full_name || 'Parishioner';
                    const Icon = action.icon;

                    return (
                        <div
                            key={appt.id}
                            className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-secondary-50/50 transition-colors"
                        >
                            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-border/60 ${action.iconBg}`}>
                                    <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                                        {formatServiceName(appt.service_type, appt.service_kind)} for {applicantName}
                                    </p>
                                    <p className="text-[11px] sm:text-xs text-secondary-500 font-medium truncate mt-0.5">
                                        {action.subtext}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/appointments')}
                                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-white hover:bg-secondary-50 text-xs font-semibold text-foreground shadow-2xs transition-colors cursor-pointer"
                            >
                                <span>{action.label}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-secondary-400" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-secondary-50/60 border-t border-border flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => navigate('/appointments')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                    <span>Open all appointments</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => void loadData()}
                    className="text-[11px] font-semibold text-secondary-400 hover:text-secondary-600 transition-colors cursor-pointer"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
}
