import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Megaphone,
    Plus,
    Search,
    Building2,
    X,
    RefreshCw,
    AlertCircle,
    Church as ChurchIcon,
    Layers,
    Lock,
    ChevronDown,
    Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import {
    getAllAnnouncements,
    getChurchAnnouncements,
    getSystemAnnouncements,
    deleteChurchAnnouncement,
    deleteSystemAnnouncement,
    subscribeToAnnouncements,
    type ChurchAnnouncement,
    type SystemAnnouncement,
    type UnifiedAnnouncement,
    type AnnouncementCategory,
    type SystemAnnouncementType,
} from '../../lib/supabase/announcements';
import {
    AnnouncementsList,
    AnnouncementForm,
} from '../../components/announcements';
import ConfirmationModal from '../../components/modals/ConfirmationModal';

type TabType = 'all' | 'church' | 'system';

const CHURCH_CATEGORIES: { value: 'all' | AnnouncementCategory; label: string }[] = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'mass_schedule', label: 'Mass Schedule' },
    { value: 'event', label: 'Events' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'reminder', label: 'Reminders' },
];

const SYSTEM_TYPES: { value: 'all' | SystemAnnouncementType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'success', label: 'Success' },
];

export default function AnnouncementsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { profile } = useAuth();
    const { churches, loading: churchesLoading } = useChurches();

    // Roles and church bindings
    const isSuperAdmin = profile?.role === 'super_admin';
    const effectiveChurchId = profile?.assigned_church_id || profile?.church_id || '';
    const isChurchAdmin = Boolean(effectiveChurchId) && (
        profile?.role === 'church_admin' ||
        profile?.role === 'admin' ||
        profile?.role === 'priest' ||
        profile?.role === 'volunteer'
    );
    const canCreate = isSuperAdmin || isChurchAdmin;

    // Resolve assigned church name
    const assignedChurchName = useMemo(() => {
        if (!effectiveChurchId) return '';
        const found = churches.find((c) => c.id === effectiveChurchId);
        return found?.name || 'Your Parish';
    }, [churches, effectiveChurchId]);

    // Active tab
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam === 'church' || tabParam === 'system' || tabParam === 'all') {
            return tabParam;
        }
        return 'all';
    });

    // Selected church filter (Locked for church admins, selectable for super admin / public)
    const [selectedChurchId, setSelectedChurchId] = useState<string>(() => {
        if (isChurchAdmin && !isSuperAdmin) {
            return effectiveChurchId;
        }
        return searchParams.get('churchId') || '';
    });

    // If profile loads later and user is a church admin, lock selected church
    useEffect(() => {
        if (isChurchAdmin && !isSuperAdmin && effectiveChurchId) {
            setSelectedChurchId(effectiveChurchId);
        }
    }, [isChurchAdmin, isSuperAdmin, effectiveChurchId]);

    // Search query & debounced term
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Category / System Type sub-filters
    const [categoryFilter, setCategoryFilter] = useState<'all' | AnnouncementCategory>('all');
    const [systemTypeFilter, setSystemTypeFilter] = useState<'all' | SystemAnnouncementType>('all');

    // Data states
    const [announcements, setAnnouncements] = useState<(ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement)[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Tab counts
    const [counts, setCounts] = useState({ all: 0, church: 0, system: 0 });

    // Modals state
    const [showCreateDropdown, setShowCreateDropdown] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formModalType, setFormModalType] = useState<'church' | 'system'>('church');
    const [editingAnnouncement, setEditingAnnouncement] = useState<ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement | null;
    }>({ isOpen: false, item: null });
    const [deleting, setDeleting] = useState(false);

    // Deep link announcement id from query params (?id=...)
    const initialOpenId = searchParams.get('id');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Sync active tab to URL
    useEffect(() => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', activeTab);
                if (selectedChurchId && !isChurchAdmin) {
                    next.set('churchId', selectedChurchId);
                } else {
                    next.delete('churchId');
                }
                return next;
            },
            { replace: true }
        );
    }, [activeTab, selectedChurchId, isChurchAdmin, setSearchParams]);

    // Determine effective church id for queries
    const activeChurchFilter = isChurchAdmin && !isSuperAdmin
        ? effectiveChurchId
        : (selectedChurchId || undefined);

    // Main fetch function
    const fetchAnnouncements = useCallback(async (isSilent = false) => {
        if (!isSilent) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }
        setError(null);

        try {
            if (activeTab === 'all') {
                const { data, error: fetchErr } = await getAllAnnouncements({
                    churchId: activeChurchFilter,
                    search: debouncedSearch || undefined,
                    includeInactiveSystem: isSuperAdmin,
                });
                if (fetchErr) throw fetchErr;
                setAnnouncements(data);
            } else if (activeTab === 'church') {
                const { data, error: fetchErr } = await getChurchAnnouncements(
                    activeChurchFilter,
                    { search: debouncedSearch || undefined }
                );
                if (fetchErr) throw fetchErr;
                setAnnouncements(data);
            } else {
                const { data, error: fetchErr } = await getSystemAnnouncements({
                    search: debouncedSearch || undefined,
                    includeInactive: isSuperAdmin,
                });
                if (fetchErr) throw fetchErr;
                setAnnouncements(data);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load announcements';
            console.error('Error loading announcements:', err);
            setError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab, activeChurchFilter, debouncedSearch, isSuperAdmin]);

    // Fetch tab overview counts
    const fetchCounts = useCallback(async () => {
        try {
            const [churchRes, systemRes] = await Promise.all([
                getChurchAnnouncements(activeChurchFilter),
                getSystemAnnouncements({ includeInactive: isSuperAdmin }),
            ]);
            const churchCount = churchRes.data?.length || 0;
            const systemCount = systemRes.data?.length || 0;
            setCounts({
                church: churchCount,
                system: systemCount,
                all: churchCount + systemCount,
            });
        } catch (err) {
            console.error('Error fetching tab counts:', err);
        }
    }, [activeChurchFilter, isSuperAdmin]);

    // Trigger data fetch on filter/tab changes
    useEffect(() => {
        void fetchAnnouncements();
        void fetchCounts();
    }, [fetchAnnouncements, fetchCounts]);

    // Realtime subscription setup
    useEffect(() => {
        const unsubscribe = subscribeToAnnouncements(activeChurchFilter, () => {
            void fetchAnnouncements(true);
            void fetchCounts();
        });

        return () => {
            unsubscribe();
        };
    }, [activeChurchFilter, fetchAnnouncements, fetchCounts]);

    // Item permission checks
    const canEditItem = useCallback((item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement): boolean => {
        if (isSuperAdmin) return true;
        if ('kind' in item) {
            if (item.kind === 'system') return false;
            return Boolean(isChurchAdmin && item.church_id && item.church_id === effectiveChurchId);
        }
        if ('church_id' in item && Boolean((item as ChurchAnnouncement).church_id)) {
            return Boolean(isChurchAdmin && (item as ChurchAnnouncement).church_id === effectiveChurchId);
        }
        return false;
    }, [isSuperAdmin, isChurchAdmin, effectiveChurchId]);

    const canDeleteItem = useCallback((item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement): boolean => {
        return canEditItem(item);
    }, [canEditItem]);

    // Filter items client-side by sub-category / system type
    const filteredAnnouncements = useMemo(() => {
        return announcements.filter((item) => {
            // Category filter for church items
            if (categoryFilter !== 'all') {
                const category = 'category' in item ? (item as ChurchAnnouncement).category : undefined;
                if (category !== categoryFilter) return false;
            }

            // System type filter for system items
            if (systemTypeFilter !== 'all') {
                const sysType = 'type' in item ? (item as SystemAnnouncement).type : undefined;
                if (sysType !== systemTypeFilter) return false;
            }

            return true;
        });
    }, [announcements, categoryFilter, systemTypeFilter]);

    // Open creation modal
    const handleOpenCreate = (type: 'church' | 'system') => {
        setEditingAnnouncement(null);
        setFormModalType(type);
        setShowCreateDropdown(false);
        setShowFormModal(true);
    };

    // Open edit modal
    const handleOpenEdit = (item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => {
        const isChurch =
            'kind' in item
                ? item.kind === 'church'
                : 'church_id' in item && Boolean((item as ChurchAnnouncement).church_id);

        setEditingAnnouncement(item);
        setFormModalType(isChurch ? 'church' : 'system');
        setShowFormModal(true);
    };

    // Handle delete action
    const handleDeleteClick = (item: ChurchAnnouncement | SystemAnnouncement | UnifiedAnnouncement) => {
        setDeleteConfirmation({ isOpen: true, item });
    };

    const handleConfirmDelete = async () => {
        const item = deleteConfirmation.item;
        if (!item) return;

        setDeleting(true);
        try {
            const isChurch =
                'kind' in item
                    ? item.kind === 'church'
                    : 'church_id' in item && Boolean((item as ChurchAnnouncement).church_id);

            const result = isChurch
                ? await deleteChurchAnnouncement(item.id)
                : await deleteSystemAnnouncement(item.id);

            if (result.error) throw result.error;

            setDeleteConfirmation({ isOpen: false, item: null });
            await fetchAnnouncements(true);
            await fetchCounts();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete announcement';
            console.error('Error deleting announcement:', err);
            alert(`Error: ${message}`);
        } finally {
            setDeleting(false);
        }
    };

    // Active filters summary
    const hasActiveFilters = Boolean(
        searchQuery ||
        (!isChurchAdmin && selectedChurchId) ||
        categoryFilter !== 'all' ||
        systemTypeFilter !== 'all'
    );

    const resetFilters = () => {
        setSearchQuery('');
        setDebouncedSearch('');
        if (!isChurchAdmin) setSelectedChurchId('');
        setCategoryFilter('all');
        setSystemTypeFilter('all');
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Announcements</h1>
                        {refreshing && (
                            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
                            </span>
                        )}
                    </div>
                    <p className="text-muted text-sm mt-0.5">
                        Share and browse important parish news, sacrament schedules, and diocese system notices
                    </p>
                </div>

                {/* Primary Action Button (Role-Aware) */}
                {canCreate && (
                    <div className="relative">
                        {isSuperAdmin && activeTab === 'all' ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                                    className="btn-primary flex items-center gap-2 shadow-sm"
                                    aria-expanded={showCreateDropdown}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>New Announcement</span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCreateDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showCreateDropdown && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-border py-1 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <button
                                            onClick={() => handleOpenCreate('church')}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-secondary-50 text-foreground transition-colors"
                                        >
                                            <ChurchIcon className="w-4 h-4 text-primary" />
                                            <div>
                                                <div className="font-medium">Parish Announcement</div>
                                                <div className="text-xs text-muted">Post for a specific church</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => handleOpenCreate('system')}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-secondary-50 text-foreground transition-colors border-t border-border/50"
                                        >
                                            <Megaphone className="w-4 h-4 text-blue-600" />
                                            <div>
                                                <div className="font-medium">System Notice</div>
                                                <div className="text-xs text-muted">App-wide system banner</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => handleOpenCreate(activeTab === 'system' ? 'system' : 'church')}
                                className="btn-primary flex items-center gap-2 shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>
                                    {activeTab === 'system'
                                        ? 'New System Notice'
                                        : isChurchAdmin
                                            ? 'New Announcement'
                                            : 'New Parish Announcement'}
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-sm text-red-700 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={() => void fetchAnnouncements()}
                        className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                </div>
            )}

            {/* Main Tabs Navigation */}
            <div className="border-b border-border">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-px">
                    {/* Tab: All */}
                    <button
                        onClick={() => {
                            setActiveTab('all');
                            setCategoryFilter('all');
                            setSystemTypeFilter('all');
                        }}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === 'all'
                                ? 'border-primary text-primary font-semibold'
                                : 'border-transparent text-muted hover:text-foreground hover:border-border'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        <span>All Announcements</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                activeTab === 'all' ? 'bg-primary/10 text-primary' : 'bg-secondary-100 text-muted'
                            }`}
                        >
                            {counts.all}
                        </span>
                    </button>

                    {/* Tab: Parish */}
                    <button
                        onClick={() => {
                            setActiveTab('church');
                            setSystemTypeFilter('all');
                        }}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === 'church'
                                ? 'border-primary text-primary font-semibold'
                                : 'border-transparent text-muted hover:text-foreground hover:border-border'
                        }`}
                    >
                        <ChurchIcon className="w-4 h-4" />
                        <span>Parish Announcements</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                activeTab === 'church' ? 'bg-primary/10 text-primary' : 'bg-secondary-100 text-muted'
                            }`}
                        >
                            {counts.church}
                        </span>
                    </button>

                    {/* Tab: System */}
                    <button
                        onClick={() => {
                            setActiveTab('system');
                            setCategoryFilter('all');
                        }}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === 'system'
                                ? 'border-primary text-primary font-semibold'
                                : 'border-transparent text-muted hover:text-foreground hover:border-border'
                        }`}
                    >
                        <Megaphone className="w-4 h-4" />
                        <span>System Notices</span>
                        <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                activeTab === 'system' ? 'bg-primary/10 text-primary' : 'bg-secondary-100 text-muted'
                            }`}
                        >
                            {counts.system}
                        </span>
                    </button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="card p-4 space-y-3 shadow-sm">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Real-time Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                                activeTab === 'system'
                                    ? 'Search system notices...'
                                    : activeTab === 'church'
                                        ? 'Search parish announcements...'
                                        : 'Search all announcements...'
                            }
                            className="input w-full pl-9 pr-8 text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5 rounded transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Church / Parish Filter (Visible on 'all' and 'church' tabs) */}
                    {activeTab !== 'system' && (
                        <div className="w-full md:w-72 flex-shrink-0">
                            {isChurchAdmin && !isSuperAdmin ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
                                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">
                                        Parish: <strong>{assignedChurchName}</strong>
                                    </span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                    <select
                                        value={selectedChurchId}
                                        onChange={(e) => setSelectedChurchId(e.target.value)}
                                        disabled={churchesLoading}
                                        className="input w-full pl-9 pr-8 text-sm truncate"
                                    >
                                        <option value="">All Parishes ({churches.length})</option>
                                        {churches.map((church) => (
                                            <option key={church.id} value={church.id}>
                                                {church.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Subcategory & Type Filter Pills */}
                <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider mr-1">Filter:</span>

                    {/* Parish Categories (when on 'church' or 'all') */}
                    {(activeTab === 'church' || activeTab === 'all') && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {CHURCH_CATEGORIES.map((cat) => {
                                const isSelected = categoryFilter === cat.value;
                                return (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => setCategoryFilter(cat.value)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                            isSelected
                                                ? 'bg-primary text-white shadow-xs'
                                                : 'bg-secondary-100 text-foreground hover:bg-secondary-200'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* System Types (when on 'system') */}
                    {activeTab === 'system' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {SYSTEM_TYPES.map((st) => {
                                const isSelected = systemTypeFilter === st.value;
                                return (
                                    <button
                                        key={st.value}
                                        type="button"
                                        onClick={() => setSystemTypeFilter(st.value)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                            isSelected
                                                ? 'bg-primary text-white shadow-xs'
                                                : 'bg-secondary-100 text-foreground hover:bg-secondary-200'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Reset Filters button */}
                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="ml-auto text-xs text-muted hover:text-foreground inline-flex items-center gap-1 transition-colors px-2 py-1"
                        >
                            <X className="w-3 h-3" /> Reset filters
                        </button>
                    )}
                </div>
            </div>

            {/* Content Feed */}
            {loading ? (
                /* Sleek Loading Skeleton */
                <div className="space-y-4">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="card p-5 border-l-4 border-gray-200 animate-pulse space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-5 w-24 bg-secondary-200 rounded-full" />
                                <div className="h-5 w-48 bg-secondary-200 rounded-md" />
                            </div>
                            <div className="h-4 w-32 bg-secondary-100 rounded" />
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-full bg-secondary-100 rounded" />
                                <div className="h-3.5 w-5/6 bg-secondary-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredAnnouncements.length === 0 ? (
                /* Rich Contextual Empty State */
                <div className="card p-10">
                    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                            {hasActiveFilters ? (
                                <Search className="w-8 h-8 text-primary" />
                            ) : (
                                <Megaphone className="w-8 h-8 text-primary" />
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1.5">
                            {hasActiveFilters
                                ? 'No matching announcements'
                                : activeTab === 'system'
                                    ? 'No system notices active'
                                    : activeTab === 'church'
                                        ? 'No parish announcements yet'
                                        : 'No announcements posted yet'}
                        </h3>
                        <p className="text-muted text-sm mb-6 leading-relaxed">
                            {hasActiveFilters
                                ? 'No announcements matched your search query or filter criteria. Try adjusting or clearing your filters.'
                                : activeTab === 'system'
                                    ? 'All systems are operating normally with no active maintenance or emergency notices.'
                                    : 'Be the first to publish important schedules, community updates, or sacrament news for parishioners.'}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap justify-center">
                            {hasActiveFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="px-4 py-2 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground text-sm font-medium transition-colors shadow-xs"
                                >
                                    Clear all filters
                                </button>
                            )}

                            {canCreate && !hasActiveFilters && (
                                <button
                                    onClick={() => handleOpenCreate(activeTab === 'system' ? 'system' : 'church')}
                                    className="btn-primary flex items-center gap-2 shadow-sm"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>
                                        {activeTab === 'system' ? 'Create System Notice' : 'Create First Announcement'}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Announcements Feed */
                <AnnouncementsList
                    announcements={filteredAnnouncements}
                    type={activeTab}
                    showActions={canCreate}
                    canEditItem={canEditItem}
                    canDeleteItem={canDeleteItem}
                    initialOpenId={initialOpenId}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteClick}
                />
            )}

            {/* Create / Edit Announcement Modal */}
            {showFormModal && (
                <AnnouncementForm
                    type={formModalType}
                    churchId={
                        formModalType === 'church'
                            ? (isChurchAdmin && !isSuperAdmin
                                ? effectiveChurchId
                                : (selectedChurchId || undefined))
                            : undefined
                    }
                    churchName={
                        formModalType === 'church'
                            ? (isChurchAdmin && !isSuperAdmin ? assignedChurchName : undefined)
                            : undefined
                    }
                    churches={churches.map((c) => ({ id: c.id, name: c.name }))}
                    announcement={editingAnnouncement || undefined}
                    onSuccess={() => {
                        setShowFormModal(false);
                        setEditingAnnouncement(null);
                        void fetchAnnouncements(true);
                        void fetchCounts();
                    }}
                    onCancel={() => {
                        setShowFormModal(false);
                        setEditingAnnouncement(null);
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                title="Delete Announcement"
                message={`Are you sure you want to delete "${deleteConfirmation.item?.title || 'this announcement'}"? This action cannot be undone and will immediately remove the notice for all parishioners.`}
                confirmLabel="Delete Notice"
                variant="danger"
                loading={deleting}
                onConfirm={() => void handleConfirmDelete()}
                onCancel={() => setDeleteConfirmation({ isOpen: false, item: null })}
            />
        </div>
    );
}
