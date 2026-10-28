import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, 
    Plus, 
    Search, 
    MapPin, 
    Phone, 
    Mail, 
    ChevronDown, 
    ChevronUp, 
    LayoutGrid, 
    List, 
    ShieldCheck, 
    Archive, 
    RotateCcw 
} from 'lucide-react';
import { useChurches, type Church } from '../../hooks/useChurches';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/toastContext';
import ChurchCover from '../../components/churches/ChurchCover';
import RestoreChurchModal from '../../components/churches/RestoreChurchModal';
import { StatusBadge } from '../../components/ui/StatusBadge';

/**
 * ChurchesPage - List all churches with Active / Archived views for Super Admin.
 */
export default function ChurchesPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const toast = useToast();
    const { churches, loading, error, refetch } = useChurches();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedChurchId, setExpandedChurchId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [statusTab, setStatusTab] = useState<'active' | 'archived'>('active');
    const [restoreTarget, setRestoreTarget] = useState<Church | null>(null);

    const isSuperAdmin = profile?.role === 'super_admin';
    const canAddChurch = isSuperAdmin;
    const canOnboardChurch = profile?.role !== 'church_admin';
    const hasAdminAccess = isSuperAdmin || profile?.role === 'church_admin';

    // Helper to check management permissions
    const canManage = (churchId: string) => {
        if (!profile) return false;
        if (profile.role === 'super_admin') return true;
        if (profile.role === 'church_admin' && profile.assigned_church_id === churchId) return true;
        return false;
    };

    const activeChurches = churches.filter(c => c.status !== 'archived');
    const archivedChurches = churches.filter(c => c.status === 'archived');

    // Filter churches by search query and active/archived status
    const filteredChurches = churches.filter(church => {
        // Search filter
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query ||
            church.name.toLowerCase().includes(query) ||
            church.address.toLowerCase().includes(query) ||
            (church.description ? church.description.toLowerCase().includes(query) : false) ||
            (church.email ? church.email.toLowerCase().includes(query) : false);

        if (!matchesSearch) return false;

        // Archived view (Super Admin only)
        if (isSuperAdmin && statusTab === 'archived') {
            return church.status === 'archived';
        }

        // Active view: hide archived churches completely from public/active views
        if (church.status === 'archived') {
            return false;
        }

        // Hide inactive churches from regular users
        const isVisibleToUser = church.status !== 'inactive' || hasAdminAccess;
        return isVisibleToUser;
    });

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading churches...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="card p-6">
                <div className="text-center text-red-600">
                    <p className="font-semibold mb-2">Error loading churches</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Churches</h1>
                </div>
                <div className="flex items-center gap-2.5">
                    {canOnboardChurch && (
                        <button
                            type="button"
                            onClick={() => navigate('/churches/apply')}
                            className="bg-white hover:bg-secondary-50 text-foreground border border-border/80 rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
                        >
                            <ShieldCheck className="w-4 h-4 text-secondary-500" />
                            <span>Onboard church</span>
                        </button>
                    )}
                    {canAddChurch && (
                        <button
                            type="button"
                            onClick={() => navigate('/churches/add')}
                            className="bg-primary hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-2xl shadow-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add church</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Active / Archived View Tabs for Super Admin */}
            {isSuperAdmin && (
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center p-1 rounded-2xl bg-secondary-100/60 border border-border/60 gap-1">
                        <button
                            type="button"
                            onClick={() => setStatusTab('active')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                statusTab === 'active'
                                    ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                    : 'text-secondary-500 hover:text-foreground'
                            }`}
                        >
                            <Building2 className="w-4 h-4 text-primary" />
                            <span>Active Parishes</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                statusTab === 'active' ? 'bg-primary/10 text-primary' : 'bg-secondary-200 text-muted'
                            }`}>
                                {activeChurches.length}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusTab('archived')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                statusTab === 'archived'
                                    ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold'
                                    : 'text-secondary-500 hover:text-foreground'
                            }`}
                        >
                            <Archive className="w-4 h-4 text-secondary-600" />
                            <span>Archived</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                statusTab === 'archived' ? 'bg-secondary-200 text-foreground' : 'bg-secondary-200 text-muted'
                            }`}>
                                {archivedChurches.length}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Search and Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative w-full sm:w-72 md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search churches or priests"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-2xl border border-border bg-white text-xs sm:text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-shadow"
                    />
                </div>
                
                <div className="inline-flex items-center p-1 rounded-2xl bg-secondary-100/60 border border-border/60 gap-1 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            viewMode === 'grid' 
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold' 
                                : 'text-secondary-500 hover:text-foreground'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span>Grid</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                            viewMode === 'list' 
                                ? 'bg-white text-foreground shadow-xs border border-border/70 font-bold' 
                                : 'text-secondary-500 hover:text-foreground'
                        }`}
                    >
                        <List className="w-4 h-4" />
                        <span>List</span>
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {churches.length === 0 ? (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
                            <Building2 className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No churches yet</h3>
                        <p className="text-muted text-center max-w-sm mb-6">
                            Get started by adding your first parish. You can manage their schedules, donations, and more.
                        </p>
                        {canAddChurch && (
                            <button
                                onClick={() => navigate('/churches/add')}
                                className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                Add Your First Church
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredChurches.length === 0 ? (
                                <div className="col-span-full card p-12 flex flex-col items-center justify-center text-center border-dashed">
                                    <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center mb-3">
                                        {statusTab === 'archived' ? (
                                            <Archive className="w-6 h-6 text-muted" />
                                        ) : (
                                            <Search className="w-6 h-6 text-muted" />
                                        )}
                                    </div>
                                    <p className="text-foreground font-medium">
                                        {statusTab === 'archived' ? 'No archived churches' : 'No parishes found'}
                                    </p>
                                    <p className="text-muted text-sm mt-1">
                                        {statusTab === 'archived'
                                            ? 'There are currently no churches in the archive.'
                                            : `We couldn't find any parishes matching "${searchQuery}"`}
                                    </p>
                                </div>
                            ) : (
                                filteredChurches.map((church) => (
                                    <div 
                                        key={church.id} 
                                        className="relative group hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer overflow-hidden rounded-[2rem] aspect-[3/4]"
                                        onClick={() => navigate(`/churches/${church.id}`)}
                                    >
                                        {/* Background: the church photo, or a branded design when it has none */}
                                        <div className="absolute inset-0 bg-primary-950">
                                            <ChurchCover
                                                src={church.featured_image_url}
                                                name={church.name}
                                                imageClassName="transition-transform duration-700 group-hover:scale-110 opacity-90"
                                            />
                                        </div>

                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 group-hover:opacity-90" />
                                        
                                        {/* Top Badges */}
                                        <div className="absolute top-6 right-6 z-10 flex flex-col gap-1.5 items-end">
                                            {church.status === 'archived' ? (
                                                <StatusBadge domain="church" status="archived" icon={Archive} className="shadow-lg" />
                                            ) : (
                                                <>
                                                    {church.is_live && <StatusBadge domain="broadcast" status="live" label="LIVE MASS" className="shadow-lg" />}
                                                    {(church.status === 'inactive' || church.status === 'unverified') && <StatusBadge domain="church" status={church.status} className="shadow-sm" />}
                                                    {(church.status === 'verified_active' || church.status === 'active') && !church.is_live && <StatusBadge domain="church" status={church.status} icon={ShieldCheck} className="shadow-sm" />}
                                                </>
                                            )}
                                        </div>
                                        
                                        {/* Bottom Content */}
                                        <div className="relative z-10 mt-auto p-6 text-white flex flex-col justify-end">
                                            <h3 className="text-3xl font-bold mb-1 leading-tight line-clamp-2 drop-shadow-md">{church.name}</h3>
                                            
                                            {church.description && (
                                                <p className="text-white/80 text-sm line-clamp-1 mb-4 font-medium drop-shadow-sm">{church.description}</p>
                                            )}
                                            
                                            <div className="flex flex-col gap-2 text-sm font-medium mb-6 mt-1">
                                                <div className="flex items-center gap-2 text-white/90">
                                                    <MapPin className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{church.address.split(',')[0]}</span>
                                                </div>
                                                
                                                {(church.contact_number || church.email) && (
                                                    <div className="flex items-center gap-2 text-white/90">
                                                        {church.contact_number ? (
                                                            <><Phone className="w-4 h-4 shrink-0" /><span className="truncate">{church.contact_number}</span></>
                                                        ) : (
                                                            <><Mail className="w-4 h-4 shrink-0" /><span className="truncate">{church.email}</span></>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {church.status === 'archived' && isSuperAdmin ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRestoreTarget(church);
                                                    }}
                                                    className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-full shadow-lg transition-all transform active:scale-95 flex justify-center items-center gap-2 cursor-pointer"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    <span>Restore Church</span>
                                                </button>
                                            ) : church.is_live ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/churches/${church.id}#virtual-sanctuary`);
                                                        }}
                                                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-4 rounded-full shadow-lg shadow-red-600/30 transition-all active:scale-95 flex justify-center items-center gap-2 text-sm animate-pulse cursor-pointer"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                                        Watch Live Mass
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/churches/${church.id}`);
                                                        }}
                                                        className="px-4 py-3.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold rounded-full text-sm transition-colors cursor-pointer"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="group relative w-full overflow-hidden bg-white text-black font-semibold py-3.5 px-4 rounded-full shadow-lg transition-all duration-300 transform active:scale-95 flex justify-center items-center gap-2 cursor-pointer">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
                                                    <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                                                        View Details
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Mobile Card List */}
                            <div className="md:hidden space-y-2">
                                {filteredChurches.length === 0 ? (
                                    <div className="card p-6 text-center text-muted">
                                        {statusTab === 'archived' ? 'No archived churches found' : `No churches found matching "${searchQuery}"`}
                                    </div>
                                ) : (
                                    filteredChurches.map((church) => {
                                        const isExpanded = expandedChurchId === church.id;
                                        return (
                                            <div key={church.id} className="card overflow-hidden">
                                                <button
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 transition-colors cursor-pointer"
                                                    onClick={() => setExpandedChurchId(isExpanded ? null : church.id)}
                                                >
                                                    <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center">
                                                        {church.featured_image_url
                                                            ? <img src={church.featured_image_url} alt={church.name} className="w-full h-full object-cover" />
                                                            : <Building2 className="w-5 h-5 text-primary" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-medium text-foreground truncate">{church.name}</p>
                                                            {church.status === 'archived' ? (
                                                                <StatusBadge domain="church" status="archived" size="sm" icon={Archive} />
                                                            ) : (
                                                                <>
                                                                    {church.is_live && <StatusBadge domain="broadcast" status="live" size="sm" />}
                                                                    {(church.status === 'inactive' || church.status === 'unverified') && <StatusBadge domain="church" status={church.status} size="sm" />}
                                                                    {(church.status === 'verified_active' || church.status === 'active') && !church.is_live && <StatusBadge domain="church" status={church.status} size="sm" />}
                                                                </>
                                                            )}
                                                        </div>
                                                        {church.description && (
                                                            <p className="text-xs text-muted line-clamp-1 mt-0.5">{church.description}</p>
                                                        )}
                                                    </div>
                                                    {isExpanded
                                                        ? <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" />
                                                        : <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />}
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 text-sm">
                                                        <div>
                                                            <span className="text-muted text-xs uppercase tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3"/> Location</span>
                                                            <p className="text-foreground mt-0.5 text-sm">{church.address}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted text-xs uppercase tracking-wide flex items-center gap-1"><Phone className="w-3 h-3"/> Contact</span>
                                                            <div className="space-y-1 mt-0.5">
                                                                {church.contact_number && <p className="text-foreground text-sm">{church.contact_number}</p>}
                                                                {church.email && <p className="text-foreground truncate text-sm">{church.email}</p>}
                                                                {!church.contact_number && !church.email && <p className="text-muted text-sm">No contact info</p>}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex gap-2 pt-2">
                                                            {church.status === 'archived' && isSuperAdmin ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setRestoreTarget(church);
                                                                    }}
                                                                    className="flex-1 btn-primary text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 cursor-pointer"
                                                                >
                                                                    <RotateCcw className="w-4 h-4" />
                                                                    Restore Church
                                                                </button>
                                                            ) : church.is_live ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/churches/${church.id}#virtual-sanctuary`);
                                                                    }}
                                                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg py-2 flex items-center justify-center gap-1.5 animate-pulse cursor-pointer"
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                                    Watch Live Mass
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/churches/${church.id}`);
                                                                    }}
                                                                    className="flex-1 border border-border bg-white text-foreground hover:bg-secondary-50 transition-colors text-sm font-medium rounded-lg py-2 cursor-pointer"
                                                                >
                                                                    View Details
                                                                </button>
                                                            )}
                                                            {hasAdminAccess && canManage(church.id) && church.status !== 'archived' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/churches/${church.id}/edit`);
                                                                    }}
                                                                    className="flex-1 btn-primary text-sm font-medium rounded-lg py-2 cursor-pointer"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-secondary-50 border-b border-border">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                                    Church
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                                    Location
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                                    Contact
                                                </th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-border">
                                            {filteredChurches.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-8 text-center text-muted">
                                                        {statusTab === 'archived'
                                                            ? 'No archived churches found'
                                                            : `No churches found matching "${searchQuery}"`}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredChurches.map((church) => (
                                                    <tr
                                                        key={church.id}
                                                        className="hover:bg-secondary-50 transition-colors cursor-pointer"
                                                        onClick={() => navigate(`/churches/${church.id}`)}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center">
                                                                <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center">
                                                                    {church.featured_image_url
                                                                        ? <img src={church.featured_image_url} alt={church.name} className="w-full h-full object-cover" />
                                                                        : <Building2 className="w-5 h-5 text-primary" />}
                                                                </div>
                                                                <div className="ml-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-foreground">
                                                                            {church.name}
                                                                        </span>
                                        {church.status === 'archived' ? (
                                            <StatusBadge domain="church" status="archived" size="sm" icon={Archive} />
                                        ) : (
                                            <>
                                                {church.is_live && <StatusBadge domain="broadcast" status="live" size="sm" label="LIVE MASS" />}
                                                {(church.status === 'inactive' || church.status === 'unverified') && <StatusBadge domain="church" status={church.status} size="sm" />}
                                                {(church.status === 'verified_active' || church.status === 'active') && !church.is_live && <StatusBadge domain="church" status={church.status} size="sm" />}
                                            </>
                                        )}
                                                                    </div>
                                                                    {church.description && (
                                                                        <div className="text-sm text-muted line-clamp-1">
                                                                            {church.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center text-sm text-foreground">
                                                                <MapPin className="w-4 h-4 text-muted mr-2 shrink-0" />
                                                                {church.address}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="space-y-1">
                                                                {church.contact_number && (
                                                                    <div className="flex items-center text-sm text-foreground">
                                                                        <Phone className="w-4 h-4 text-muted mr-2 shrink-0" />
                                                                        {church.contact_number}
                                                                    </div>
                                                                )}
                                                                {church.email && (
                                                                    <div className="flex items-center text-sm text-foreground">
                                                                        <Mail className="w-4 h-4 text-muted mr-2 shrink-0" />
                                                                        {church.email}
                                                                    </div>
                                                                )}
                                                                {!church.contact_number && !church.email && (
                                                                    <span className="text-sm text-muted">No contact info</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {church.status === 'archived' && isSuperAdmin ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRestoreTarget(church);
                                                                        }}
                                                                        className="btn-primary text-xs font-semibold rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-1.5 hover:shadow cursor-pointer"
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                                        Restore Church
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        {church.is_live && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigate(`/churches/${church.id}#virtual-sanctuary`);
                                                                                }}
                                                                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm flex items-center gap-1 animate-pulse cursor-pointer"
                                                                            >
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                                                                Watch Live
                                                                            </button>
                                                                        )}
                                                                        {hasAdminAccess && canManage(church.id) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigate(`/churches/${church.id}/edit`);
                                                                                }}
                                                                                className="btn-primary text-sm font-medium rounded-lg px-3 py-1.5 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Results Count */}
                                {filteredChurches.length > 0 && (
                                    <div className="px-6 py-3 border-t border-border bg-secondary-50">
                                        <p className="text-sm text-muted">
                                            Showing {filteredChurches.length} of {statusTab === 'archived' ? archivedChurches.length : activeChurches.length} churches
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Restore Church Modal */}
            {restoreTarget && (
                <RestoreChurchModal
                    churchId={restoreTarget.id}
                    churchName={restoreTarget.name}
                    onClose={() => setRestoreTarget(null)}
                    onRestored={() => {
                        const restoredName = restoreTarget.name;
                        setRestoreTarget(null);
                        refetch();
                        toast.success(`"${restoredName}" has been successfully restored with its assigned Church Admin.`);
                    }}
                />
            )}
        </div>
    );
}
