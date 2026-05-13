import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, MapPin, Phone, Mail, ChevronDown, ChevronUp, LayoutGrid, List } from 'lucide-react';
import { useChurches } from '../../hooks/useChurches';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ChurchesPage - List all churches
 * 
 * Features:
 * - Display all churches in a table
 * - Search churches by name
 * - Navigate to add/edit/view pages
 * - Loading and error states
 */
export default function ChurchesPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { churches, loading, error } = useChurches();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedChurchId, setExpandedChurchId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Helper to check management permissions
    const canManage = (churchId: string) => {
        if (!profile) return false;
        if (profile.role === 'super_admin') return true;
        if ((profile.role === 'church_admin' || profile.role === 'volunteer') && profile.assigned_church_id === churchId) return true;
        if (profile.role === 'admin' && profile.assigned_church_id === churchId) return true;
        return false;
    };

    const canAddChurch = profile?.role === 'super_admin';
    const hasAdminAccess = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'church_admin' || profile?.role === 'volunteer';

    // Filter churches by search query and status
    const filteredChurches = churches.filter(church => {
        // Search filter
        const matchesSearch = church.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            church.address.toLowerCase().includes(searchQuery.toLowerCase());

        // Status filter - hide inactive churches from regular users
        const isVisibleToUser = church.status !== 'inactive' || hasAdminAccess;

        return matchesSearch && isVisibleToUser;
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
                    <h1 className="text-2xl font-bold">Churches</h1>
                    <p className="text-muted">Manage parishes in your diocese</p>
                </div>
                {canAddChurch && (
                    <button
                        onClick={() => navigate('/churches/add')}
                        className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Church
                    </button>
                )}
            </div>

            {/* Search and Toggle */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search churches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input w-full !pl-10"
                    />
                </div>
                
                <div className="flex items-center bg-secondary-50 p-1 rounded-lg border border-border sm:ml-auto w-full sm:w-auto">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'grid' 
                                ? 'bg-white text-primary shadow-sm ring-1 ring-border/50' 
                                : 'text-muted hover:text-foreground hover:bg-secondary-100'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        <span className="sm:hidden md:inline">Grid</span>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            viewMode === 'list' 
                                ? 'bg-white text-primary shadow-sm ring-1 ring-border/50' 
                                : 'text-muted hover:text-foreground hover:bg-secondary-100'
                        }`}
                    >
                        <List className="w-4 h-4" />
                        <span className="sm:hidden md:inline">List</span>
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
                                className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2"
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
                                        <Search className="w-6 h-6 text-muted" />
                                    </div>
                                    <p className="text-foreground font-medium">No churches found</p>
                                    <p className="text-muted text-sm mt-1">We couldn't find any churches matching "{searchQuery}"</p>
                                </div>
                            ) : (
                                filteredChurches.map((church) => (
                                    <div 
                                        key={church.id} 
                                        className="relative group hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer overflow-hidden rounded-[2rem] aspect-[3/4]"
                                        onClick={() => navigate(`/churches/${church.id}`)}
                                    >
                                        {/* Background Image */}
                                        <div className="absolute inset-0 bg-gray-900">
                                            {/* Use featured_image_url if exists, otherwise use a beautiful generic church image */}
                                            <img 
                                                src={church.featured_image_url || "https://images.unsplash.com/photo-1548625361-ec85301ff7a6?auto=format&fit=crop&q=80&w=800"} 
                                                alt={church.name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90"
                                            />
                                        </div>

                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 group-hover:opacity-90" />
                                        
                                        {/* Top Badge — Inactive only */}
                                        {church.status === 'inactive' && (
                                            <div className="absolute top-6 right-6 z-10">
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/90 text-white shadow-sm backdrop-blur-md">
                                                    Inactive
                                                </span>
                                            </div>
                                        )}
                                        
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

                                            <button className="group relative w-full overflow-hidden bg-white text-black font-semibold py-3.5 px-4 rounded-full shadow-lg transition-all duration-300 transform active:scale-95 flex justify-center items-center gap-2">
                                                {/* Gradient background that fades in */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
                                                
                                                {/* Button Text */}
                                                <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                                                    View Details
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* ── Mobile Card List (visible on < md) ── */}
                            <div className="md:hidden space-y-2">
                                {filteredChurches.length === 0 ? (
                                    <div className="card p-6 text-center text-muted">No churches found matching "{searchQuery}"</div>
                        ) : (
                            filteredChurches.map((church) => {
                                const isExpanded = expandedChurchId === church.id;
                                return (
                                    <div key={church.id} className="card overflow-hidden">
                                        <button
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 transition-colors"
                                            onClick={() => setExpandedChurchId(isExpanded ? null : church.id)}
                                        >
                                            <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center">
                                                {church.featured_image_url
                                                    ? <img src={church.featured_image_url} alt={church.name} className="w-full h-full object-cover" />
                                                    : <Building2 className="w-5 h-5 text-primary" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-foreground truncate">{church.name}</p>
                                                    {church.status === 'inactive' && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 flex-shrink-0">
                                                            🔒 Inactive
                                                        </span>
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
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/churches/${church.id}`);
                                                        }}
                                                        className="flex-1 border border-border bg-white text-foreground hover:bg-secondary-50 transition-colors text-sm font-medium rounded-lg py-2"
                                                    >
                                                        View Details
                                                    </button>
                                                    {hasAdminAccess && canManage(church.id) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/churches/${church.id}/edit`);
                                                            }}
                                                            className="flex-1 btn-primary text-sm font-medium rounded-lg py-2"
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

                    {/* ── Desktop Table (hidden on mobile) ── */}
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
                                        {hasAdminAccess && (
                                            <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                                                Actions
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-border">
                                    {filteredChurches.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted">
                                                No churches found matching "{searchQuery}"
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
                                                                {church.status === 'inactive' && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                        🔒 Inactive
                                                                    </span>
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
                                                        <MapPin className="w-4 h-4 text-muted mr-2" />
                                                        {church.address}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {church.contact_number && (
                                                            <div className="flex items-center text-sm text-foreground">
                                                                <Phone className="w-4 h-4 text-muted mr-2" />
                                                                {church.contact_number}
                                                            </div>
                                                        )}
                                                        {church.email && (
                                                            <div className="flex items-center text-sm text-foreground">
                                                                <Mail className="w-4 h-4 text-muted mr-2" />
                                                                {church.email}
                                                            </div>
                                                        )}
                                                        {!church.contact_number && !church.email && (
                                                            <span className="text-sm text-muted">No contact info</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {hasAdminAccess && (
                                                    <td className="px-6 py-4 text-right">
                                                        {canManage(church.id) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate(`/churches/${church.id}/edit`);
                                                                }}
                                                                className="btn-primary text-sm font-medium rounded-lg px-3 py-1.5 shadow-sm hover:shadow active:scale-95 transition-all"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
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
                                    Showing {filteredChurches.length} of {churches.length} churches
                                </p>
                            </div>
                        )}
                    </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
