import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Heart, Search, RefreshCw, CheckCircle, XCircle, Clock, TrendingUp, Building2, ChevronDown } from 'lucide-react';
import { getAllDonations, getChurchDonations, type Donation } from '../../lib/supabase/donations';
import DonationDetailModal from '../../components/donations/DonationDetailModal';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import { formatDistanceToNow } from 'date-fns';

type StatusTab = 'pending' | 'verified' | 'rejected' | 'all';

export default function DonationsPage() {
    const { profile } = useAuth();

    // Regular users are not allowed here — redirect to Profile (which has My Donations)
    if (profile && profile.role === 'user') {
        return <Navigate to="/profile" replace />;
    }
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<StatusTab>('pending');
    const [search, setSearch] = useState('');
    const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
    const [selectedChurchId, setSelectedChurchId] = useState<string>('all');

    // Super admin / admin can pick any church
    const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
    const isChurchStaff = profile?.role === 'church_admin' || profile?.role === 'volunteer';
    const { churches } = useChurches();

    // Church staff only see their assigned church
    const effectiveChurchId = isChurchStaff
        ? (profile?.assigned_church_id || null)
        : selectedChurchId === 'all' ? null : selectedChurchId;

    const fetchDonations = useCallback(async () => {
        setLoading(true);
        let result;
        if (effectiveChurchId) {
            result = await getChurchDonations(effectiveChurchId);
        } else if (isSuperAdmin) {
            result = await getAllDonations();
        } else {
            setDonations([]);
            setLoading(false);
            return;
        }
        setDonations(result.data || []);
        setLoading(false);
    }, [effectiveChurchId, isSuperAdmin]);

    useEffect(() => { fetchDonations(); }, [fetchDonations]);

    // Active church name for display
    const activeChurchName = isChurchStaff
        ? churches.find(c => c.id === profile?.assigned_church_id)?.name || 'Your Church'
        : selectedChurchId === 'all'
            ? 'All Churches'
            : churches.find(c => c.id === selectedChurchId)?.name || 'Unknown';

    // Filter by tab + search
    const filtered = donations.filter(d => {
        const matchesTab = activeTab === 'all' || d.status === activeTab;
        const donorName = (d.donor as any)?.full_name?.toLowerCase() || '';
        const ref = d.reference_number?.toLowerCase() || '';
        const matchesSearch = !search || donorName.includes(search.toLowerCase()) || ref.includes(search.toLowerCase());
        return matchesTab && matchesSearch;
    });

    // Stats
    const pending = donations.filter(d => d.status === 'pending').length;
    const verified = donations.filter(d => d.status === 'verified');
    const totalVerifiedAmount = verified.reduce((sum, d) => sum + Number(d.amount), 0);

    const tabs: { id: StatusTab; label: string; count: number }[] = [
        { id: 'pending', label: 'Pending', count: pending },
        { id: 'verified', label: 'Verified', count: verified.length },
        { id: 'rejected', label: 'Rejected', count: donations.filter(d => d.status === 'rejected').length },
        { id: 'all', label: 'All', count: donations.length },
    ];

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-700',
            verified: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700',
        };
        const icons: Record<string, React.ReactNode> = {
            pending: <Clock className="w-3 h-3" />,
            verified: <CheckCircle className="w-3 h-3" />,
            rejected: <XCircle className="w-3 h-3" />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
                {icons[status]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Donations</h1>
                    <p className="text-muted">Verify and manage cashless donations</p>
                </div>
                <button onClick={fetchDonations} className="btn-outline flex items-center gap-2 self-start">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Church Selector (Super Admin / Admin only) */}
            {isSuperAdmin && (
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted font-medium mb-1">Viewing Donations For</p>
                            <div className="relative">
                                <select
                                    value={selectedChurchId}
                                    onChange={(e) => setSelectedChurchId(e.target.value)}
                                    className="w-full appearance-none bg-muted/10 border border-border rounded-lg px-3 pr-8 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                >
                                    <option value="all">🌐 All Churches</option>
                                    {churches.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Church Staff - show their church badge */}
            {isChurchStaff && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg w-fit">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{activeChurchName}</span>
                    <span className="text-xs text-muted">— Your assigned church</span>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-4 flex items-center gap-4">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                        <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-xs text-muted">Pending Review</p>
                        <p className="text-2xl font-bold">{pending}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <p className="text-xs text-muted">Verified Donations</p>
                        <p className="text-2xl font-bold">{verified.length}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted">Total Collected</p>
                        <p className="text-xl font-bold">
                            ₱{totalVerifiedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                            ? 'text-primary border-b-2 border-primary -mb-px'
                            : 'text-muted hover:text-foreground'
                            }`}
                    >
                        {tab.label}
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted/20 text-muted'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or reference..."
                    className="input pl-10 w-full"
                />
            </div>

            {/* Donation List */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                            <Heart className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">No donations found</h3>
                        <p className="text-muted text-sm text-center max-w-sm">
                            {activeTab === 'pending'
                                ? 'No pending donations to review.'
                                : 'No donations match your search.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map(donation => {
                            const donorName = (donation.donor as any)?.full_name || 'Anonymous';
                            const churchName = (donation.church as any)?.name || 'Unknown Church';
                            return (
                                <div
                                    key={donation.id}
                                    className="p-4 hover:bg-muted/5 cursor-pointer flex items-center justify-between gap-4 transition-colors"
                                    onClick={() => setSelectedDonation(donation)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-primary">
                                                {donorName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium truncate">{donorName}</p>
                                            {/* Only show church name when viewing all churches */}
                                            {(isSuperAdmin && selectedChurchId === 'all') && (
                                                <p className="text-xs text-primary font-medium truncate">{churchName}</p>
                                            )}
                                            <p className="text-xs text-muted truncate">
                                                Ref: {donation.reference_number || 'N/A'}
                                            </p>
                                            <p className="text-xs text-muted">
                                                {donation.created_at
                                                    ? formatDistanceToNow(new Date(donation.created_at), { addSuffix: true })
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <p className="font-bold text-primary">
                                            ₱{Number(donation.amount).toLocaleString('en-PH')}
                                        </p>
                                        {statusBadge(donation.status || 'pending')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedDonation && (
                <DonationDetailModal
                    donation={selectedDonation}
                    onClose={() => setSelectedDonation(null)}
                    onUpdated={() => { fetchDonations(); setSelectedDonation(null); }}
                />
            )}
        </div>
    );
}
