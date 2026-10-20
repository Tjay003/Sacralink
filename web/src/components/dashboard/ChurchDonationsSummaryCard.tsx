import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChurchDonationsSummaryCardProps {
    churchId: string;
}

export default function ChurchDonationsSummaryCard({ churchId }: ChurchDonationsSummaryCardProps) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        monthlyVerifiedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
    });

    useEffect(() => {
        if (!churchId) return;

        const fetchDonationSummary = async () => {
            try {
                setLoading(true);

                // Start of current month in UTC
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

                // 1. Verified donations this month
                const { data: verifiedData } = await supabase
                    .from('donations')
                    .select('amount')
                    .eq('church_id', churchId)
                    .eq('status', 'verified')
                    .gte('created_at', startOfMonth);

                const monthlyVerified = (verifiedData || []).reduce(
                    (sum, d) => sum + Number(d.amount || 0),
                    0
                );

                // 2. Pending donations awaiting verification
                const { data: pendingData } = await supabase
                    .from('donations')
                    .select('amount')
                    .eq('church_id', churchId)
                    .eq('status', 'pending');

                const pCount = pendingData?.length || 0;
                const pAmount = (pendingData || []).reduce(
                    (sum, d) => sum + Number(d.amount || 0),
                    0
                );

                setData({
                    monthlyVerifiedAmount: monthlyVerified,
                    pendingCount: pCount,
                    pendingAmount: pAmount,
                });
            } catch (err) {
                console.error('Error fetching church donations summary:', err);
            } finally {
                setLoading(false);
            }
        };

        void fetchDonationSummary();

        const channel = supabase
            .channel(`donations-summary-${churchId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'donations', filter: `church_id=eq.${churchId}` },
                () => {
                    void fetchDonationSummary();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [churchId]);

    return (
        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
                {/* Header with Heart Icon */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                        <Heart className="w-5 h-5 fill-emerald-500/20" />
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">Donations</h3>
                        <p className="text-xs text-secondary-500 font-medium">This month at your parish</p>
                    </div>
                </div>

                {/* Big Amount */}
                <div className="mb-4">
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                        {loading ? (
                            <span className="inline-block w-32 h-9 bg-secondary-100 rounded animate-pulse" />
                        ) : (
                            `₱ ${data.monthlyVerifiedAmount.toLocaleString('en-PH')}`
                        )}
                    </div>
                </div>

                {/* Sub-metrics */}
                <div className="space-y-2 py-3 border-t border-b border-border/70 text-xs">
                    <div className="flex items-center justify-between text-secondary-600">
                        <span>Awaiting verification</span>
                        <span className="font-bold text-foreground">
                            {data.pendingCount} {data.pendingCount === 1 ? 'gift' : 'gifts'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-secondary-600">
                        <span>On hold</span>
                        <span className="font-semibold text-secondary-700">
                            ₱ {data.pendingAmount.toLocaleString('en-PH')} on hold
                        </span>
                    </div>
                </div>
            </div>

            {/* Action button */}
            <div className="mt-5">
                <button
                    type="button"
                    onClick={() => navigate('/donations')}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Verify donations</span>
                </button>
            </div>
        </div>
    );
}
