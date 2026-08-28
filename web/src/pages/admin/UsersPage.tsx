import { useState, useEffect, useMemo, useCallback } from 'react';
import { directFetchProfiles, directFetchChurches } from '../../lib/directApi';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, Church } from '../../types/database';
import EditRoleModal from '../../components/admin/EditRoleModal';
import { 
    Building2, 
    Layers, 
    List, 
    ArrowUp, 
    ArrowDown, 
    ChevronDown, 
    ChevronUp, 
    Search,
    Calendar,
    Mail
} from 'lucide-react';

/**
 * UsersPage - Admin page for managing all users with Church Categorization,
 * Multi-Column Sorting, and Group by Parish Accordion Mode.
 */

// Role hierarchy for sorting (lower number = higher priority)
const ROLE_PRIORITY: Record<string, number> = {
    'super_admin': 1,
    'admin': 2,
    'church_admin': 3,
    'priest': 4,
    'volunteer': 5,
    'user': 6
};

type SortField = 'role' | 'church' | 'name' | 'created_at';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'grouped';

export default function UsersPage() {
    const { profile: currentUser, session } = useAuth();
    const [churches, setChurches] = useState<Church[]>([]);

    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [churchFilter, setChurchFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [sortField, setSortField] = useState<SortField>('role');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [collapsedChurchIds, setCollapsedChurchIds] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const token = session?.access_token || '';
            const [profilesRes, churchesRes] = await Promise.all([
                token ? directFetchProfiles(token) : Promise.resolve([]),
                directFetchChurches(),
            ]);

            if (profilesRes) {
                setUsers(profilesRes);
            }
            if (churchesRes) {
                setChurches(churchesRes as Church[]);
            }
        } catch (error) {
            console.error('Error fetching users and churches:', error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fast lookup map for Church names
    const churchMap = useMemo(() => {
        const map = new Map<string, string>();
        churches.forEach(c => map.set(c.id, c.name));
        return map;
    }, [churches]);

    const getChurchName = useCallback((churchId?: string | null) => {
        if (!churchId) return 'Unassigned';
        return churchMap.get(churchId) || 'Unknown Parish';
    }, [churchMap]);

    // Filter & Sort Logic
    const filteredUsers = useMemo(() => {
        let filtered = [...users];

        // 1. Role visibility restrictions for church_admin
        if (currentUser?.role === 'church_admin') {
            filtered = filtered.filter(user => {
                if (user.role === 'super_admin' || user.role === 'admin') return false;
                const isAssignedToMyChurch = user.assigned_church_id === currentUser.assigned_church_id;
                const isRegularUser = !user.role || user.role === 'user';
                return isAssignedToMyChurch || isRegularUser;
            });
        }

        // 2. Search query (matches name, email, or church name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(user => {
                const name = (user.full_name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const churchName = getChurchName(user.assigned_church_id).toLowerCase();
                return name.includes(query) || email.includes(query) || churchName.includes(query);
            });
        }

        // 3. Filter by role
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => (user.role || 'user') === roleFilter);
        }

        // 4. Filter by church
        if (churchFilter !== 'all') {
            if (churchFilter === 'unassigned') {
                filtered = filtered.filter(user => !user.assigned_church_id);
            } else {
                filtered = filtered.filter(user => user.assigned_church_id === churchFilter);
            }
        }

        // 5. Multi-column Sorting
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'role': {
                    const priorityA = ROLE_PRIORITY[a.role || 'user'] || 999;
                    const priorityB = ROLE_PRIORITY[b.role || 'user'] || 999;
                    comparison = priorityA - priorityB;
                    if (comparison === 0) {
                        comparison = (a.full_name || '').localeCompare(b.full_name || '');
                    }
                    break;
                }
                case 'church': {
                    const churchA = a.assigned_church_id ? getChurchName(a.assigned_church_id) : 'ZZZ_Unassigned';
                    const churchB = b.assigned_church_id ? getChurchName(b.assigned_church_id) : 'ZZZ_Unassigned';
                    comparison = churchA.localeCompare(churchB);
                    if (comparison === 0) {
                        comparison = (a.full_name || '').localeCompare(b.full_name || '');
                    }
                    break;
                }
                case 'name': {
                    const nameA = (a.full_name || '').toLowerCase();
                    const nameB = (b.full_name || '').toLowerCase();
                    comparison = nameA.localeCompare(nameB);
                    break;
                }
                case 'created_at': {
                    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    comparison = timeA - timeB;
                    break;
                }
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [users, currentUser, searchQuery, roleFilter, churchFilter, sortField, sortOrder, getChurchName]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, churchFilter, sortField, sortOrder]);

    // Group users by parish for Accordion Mode
    const groupedByParish = useMemo(() => {
        const groups: {
            churchId: string;
            churchName: string;
            address?: string | null;
            users: Profile[];
            stats: { admins: number; volunteers: number; priests: number; users: number };
        }[] = [];

        // Church buckets
        churches.forEach(church => {
            if (churchFilter !== 'all' && churchFilter !== church.id) return;
            const churchUsers = filteredUsers.filter(u => u.assigned_church_id === church.id);
            
            // Only show churches with users matching the filter or if explicitly filtered
            if (churchUsers.length > 0 || churchFilter === church.id) {
                const stats = {
                    admins: churchUsers.filter(u => u.role === 'church_admin' || u.role === 'admin' || u.role === 'super_admin').length,
                    volunteers: churchUsers.filter(u => u.role === 'volunteer').length,
                    priests: churchUsers.filter(u => u.role === 'priest').length,
                    users: churchUsers.filter(u => !u.role || u.role === 'user').length,
                };
                groups.push({
                    churchId: church.id,
                    churchName: church.name,
                    address: church.address,
                    users: churchUsers,
                    stats,
                });
            }
        });

        // Unassigned bucket
        if (churchFilter === 'all' || churchFilter === 'unassigned') {
            const unassignedUsers = filteredUsers.filter(u => !u.assigned_church_id);
            if (unassignedUsers.length > 0) {
                const stats = {
                    admins: unassignedUsers.filter(u => u.role === 'super_admin' || u.role === 'admin').length,
                    volunteers: unassignedUsers.filter(u => u.role === 'volunteer').length,
                    priests: unassignedUsers.filter(u => u.role === 'priest').length,
                    users: unassignedUsers.filter(u => !u.role || u.role === 'user').length,
                };
                groups.push({
                    churchId: 'unassigned',
                    churchName: 'General / Unassigned Users',
                    address: 'Not currently assigned to a specific parish',
                    users: unassignedUsers,
                    stats,
                });
            }
        }

        return groups;
    }, [churches, filteredUsers, churchFilter]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'created_at' ? 'desc' : 'asc');
        }
    };

    const toggleChurchAccordion = (churchId: string) => {
        setCollapsedChurchIds(prev => {
            const next = new Set(prev);
            if (next.has(churchId)) {
                next.delete(churchId);
            } else {
                next.add(churchId);
            }
            return next;
        });
    };

    const handleEditRole = (user: Profile) => {
        setSelectedUser(user);
        setShowEditModal(true);
    };

    const handleRoleUpdated = () => {
        fetchData();
        setShowEditModal(false);
        setSelectedUser(null);
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
            case 'admin':
                return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
            case 'church_admin':
                return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
            case 'priest':
                return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
            case 'volunteer':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
            case 'user':
            default:
                return 'bg-secondary-100 text-secondary-700 border-secondary-200 dark:bg-secondary-800/40 dark:text-secondary-300 dark:border-secondary-700';
        }
    };

    const formatRole = (role: string) => {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const isSuperOrDioceseAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm font-medium text-muted">Loading user accounts and parish records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">User Management</h1>
                    <p className="text-sm text-muted">Audit roles, permissions, and church assignments across the diocese</p>
                </div>

                {/* View Switcher Toggle */}
                <div className="flex items-center gap-2 self-start sm:self-auto bg-secondary-100 dark:bg-secondary-800/60 p-1 rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            viewMode === 'table'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-sm'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <List className="w-3.5 h-3.5" />
                        <span>Flat Table</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('grouped')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            viewMode === 'grouped'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-sm'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Group by Parish</span>
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="card p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                            Search Users
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input !pl-10 w-full text-sm"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                            Filter by Role
                        </label>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-full text-sm"
                        >
                            <option value="all">All Roles</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Diocese Admin</option>
                            <option value="church_admin">Church Admin</option>
                            <option value="priest">Priest</option>
                            <option value="volunteer">Volunteer</option>
                            <option value="user">Parishioner / User</option>
                        </select>
                    </div>

                    {/* Church Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                            Filter by Parish
                        </label>
                        <select
                            value={churchFilter}
                            onChange={(e) => setChurchFilter(e.target.value)}
                            className="input w-full text-sm"
                            disabled={!isSuperOrDioceseAdmin}
                        >
                            <option value="all">All Parishes / Churches</option>
                            <option value="unassigned">No Church Assigned (Unassigned)</option>
                            {churches.map((church) => (
                                <option key={church.id} value={church.id}>
                                    {church.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Dropdown */}
                    <div>
                        <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                            Sort Users
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={sortField}
                                onChange={(e) => setSortField(e.target.value as SortField)}
                                className="input w-full text-sm"
                            >
                                <option value="role">Role Priority</option>
                                <option value="church">Assigned Parish</option>
                                <option value="name">Full Name</option>
                                <option value="created_at">Registration Date</option>
                            </select>
                            <button
                                type="button"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                title={sortOrder === 'asc' ? 'Ascending Order' : 'Descending Order'}
                                className="px-3 py-2 border border-border rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors text-muted hover:text-foreground flex-shrink-0"
                            >
                                {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Summary Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted">
                    <span>
                        Showing <strong className="text-foreground">{filteredUsers.length}</strong> of{' '}
                        <strong className="text-foreground">{users.length}</strong> total users
                    </span>
                    {(searchQuery || roleFilter !== 'all' || churchFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setRoleFilter('all');
                                setChurchFilter('all');
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE A: GROUP BY PARISH ACCORDION MODE                    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'grouped' && (
                <div className="space-y-4">
                    {groupedByParish.length === 0 ? (
                        <div className="card p-8 text-center text-muted">
                            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted/40" />
                            <p className="font-semibold text-foreground">No parishes or users match the filter criteria</p>
                            <p className="text-xs text-muted mt-1">Try resetting search or adjusting your parish filter</p>
                        </div>
                    ) : (
                        groupedByParish.map((group) => {
                            const isCollapsed = collapsedChurchIds.has(group.churchId);
                            return (
                                <div key={group.churchId} className="card overflow-hidden border border-border/80 shadow-sm transition-all">
                                    {/* Accordion Church Header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleChurchAccordion(group.churchId)}
                                        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-secondary-50/70 dark:bg-secondary-900/40 hover:bg-secondary-100/70 dark:hover:bg-secondary-850 transition-colors text-left gap-3"
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex-shrink-0 mt-0.5 sm:mt-0">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base font-bold text-foreground truncate">
                                                        {group.churchName}
                                                    </h3>
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                                        {group.users.length} {group.users.length === 1 ? 'Member' : 'Members'}
                                                    </span>
                                                </div>
                                                {group.address && (
                                                    <p className="text-xs text-muted truncate mt-0.5">{group.address}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Breakdown Pills & Toggle */}
                                        <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                {group.stats.admins > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800">
                                                        {group.stats.admins} Admins
                                                    </span>
                                                )}
                                                {group.stats.priests > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-800">
                                                        {group.stats.priests} Priests
                                                    </span>
                                                )}
                                                {group.stats.volunteers > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800">
                                                        {group.stats.volunteers} Volunteers
                                                    </span>
                                                )}
                                                {group.stats.users > 0 && (
                                                    <span className="px-2 py-0.5 rounded-md bg-secondary-200/60 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300 font-medium">
                                                        {group.stats.users} Parishioners
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-1 rounded-lg text-muted">
                                                {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </button>

                                    {/* Accordion Roster Content */}
                                    {!isCollapsed && (
                                        <div className="border-t border-border/80">
                                            {group.users.length === 0 ? (
                                                <div className="p-6 text-center text-xs text-muted">
                                                    No staff or parishioners currently assigned to this church.
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-border">
                                                    {group.users.map((user) => (
                                                        <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary-50/40 dark:hover:bg-secondary-900/20 transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                {user.avatar_url ? (
                                                                    <img
                                                                        src={user.avatar_url}
                                                                        alt={user.full_name || 'User'}
                                                                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">
                                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-sm font-semibold text-foreground truncate">
                                                                            {user.full_name || 'No name set'}
                                                                        </span>
                                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                                            {formatRole(user.role || 'user')}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-xs text-muted mt-0.5 flex-wrap">
                                                                        <span className="flex items-center gap-1">
                                                                            <Mail className="w-3 h-3 text-muted/70" />
                                                                            {user.email}
                                                                        </span>
                                                                        <span className="flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3 text-muted/70" />
                                                                            Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="self-end sm:self-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditRole(user)}
                                                                    disabled={user.id === currentUser?.id}
                                                                    className="btn-primary text-white text-xs px-3.5 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                                                >
                                                                    Edit Role
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE B: FLAT TABLE MODE                                  */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'table' && (
                <>
                    {/* Mobile Card List (< md) */}
                    <div className="md:hidden space-y-3">
                        {filteredUsers.length === 0 ? (
                            <div className="card p-6 text-center text-muted">No users found</div>
                        ) : (
                            filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => {
                                const isExpanded = expandedUserId === user.id;
                                const churchName = getChurchName(user.assigned_church_id);
                                return (
                                    <div key={user.id} className="card overflow-hidden border border-border/80">
                                        <button
                                            type="button"
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary-50 dark:hover:bg-secondary-900/30 transition-colors"
                                            onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                        >
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.full_name || 'User'} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{user.full_name || 'No name'}</p>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                        {formatRole(user.role || 'user')}
                                                    </span>
                                                    {user.assigned_church_id && (
                                                        <span className="px-2 py-0.5 inline-flex text-xs font-medium rounded-md bg-secondary-100 dark:bg-secondary-800 text-foreground border border-border truncate max-w-[140px]">
                                                            {churchName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />}
                                        </button>

                                        {isExpanded && (
                                            <div className="px-4 pb-4 pt-2 border-t border-border space-y-2.5 text-xs">
                                                <div>
                                                    <span className="text-muted uppercase font-semibold tracking-wider">Email</span>
                                                    <p className="text-foreground break-all text-sm mt-0.5">{user.email}</p>
                                                </div>
                                                <div>
                                                    <span className="text-muted uppercase font-semibold tracking-wider">Assigned Parish</span>
                                                    <p className="text-foreground text-sm mt-0.5 flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-primary" />
                                                        {churchName}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted uppercase font-semibold tracking-wider">Registered</span>
                                                    <p className="text-foreground text-sm mt-0.5">
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleEditRole(user)}
                                                    disabled={user.id === currentUser?.id}
                                                    className="mt-3 w-full btn-primary text-white px-3 py-2 text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold"
                                                >
                                                    Edit Role & Parish Access
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block card overflow-hidden border border-border/80">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-secondary-50 dark:bg-secondary-900/60 border-b border-border text-left text-xs font-semibold text-muted uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>User</span>
                                                {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-3.5">Email</th>
                                        <th className="px-6 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('role')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>Role</span>
                                                {sortField === 'role' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('church')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>Assigned Parish</span>
                                                {sortField === 'church' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('created_at')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>Registered</span>
                                                {sortField === 'created_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-white dark:bg-card">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-10 text-center text-muted">
                                                No users found matching current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => {
                                            const churchName = getChurchName(user.assigned_church_id);
                                            return (
                                                <tr key={user.id} className="hover:bg-secondary-50/60 dark:hover:bg-secondary-900/30 transition-colors">
                                                    {/* User & Avatar */}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            {user.avatar_url ? (
                                                                <img
                                                                    src={user.avatar_url}
                                                                    alt={user.full_name || 'User'}
                                                                    className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0">
                                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                                </div>
                                                            )}
                                                            <div className="text-sm font-semibold text-foreground">
                                                                {user.full_name || 'No name'}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Email */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                        {user.email}
                                                    </td>

                                                    {/* Role */}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                            {formatRole(user.role || 'user')}
                                                        </span>
                                                    </td>

                                                    {/* Assigned Church */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        {user.assigned_church_id ? (
                                                            <div className="flex items-center gap-1.5 text-foreground font-medium">
                                                                <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                                                <span className="truncate max-w-[200px]" title={churchName}>
                                                                    {churchName}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted/60 text-xs italic">Unassigned</span>
                                                        )}
                                                    </td>

                                                    {/* Registered Date */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleEditRole(user)}
                                                            disabled={user.id === currentUser?.id}
                                                            className="btn-primary text-white text-xs px-3.5 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold"
                                                        >
                                                            Edit Role
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {filteredUsers.length > 0 && (
                        <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-muted text-center sm:text-left">
                                Showing <strong className="text-foreground">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredUsers.length)}</strong> to{' '}
                                <strong className="text-foreground">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</strong> of{' '}
                                <strong className="text-foreground">{filteredUsers.length}</strong> users
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>

                                {(() => {
                                    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
                                    const pages = [];
                                    const maxVisible = 5;

                                    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

                                    if (endPage - startPage < maxVisible - 1) {
                                        startPage = Math.max(1, endPage - maxVisible + 1);
                                    }

                                    for (let i = startPage; i <= endPage; i++) {
                                        pages.push(
                                            <button
                                                key={i}
                                                onClick={() => setCurrentPage(i)}
                                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                                                    currentPage === i
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'border-border hover:bg-secondary-50 dark:hover:bg-secondary-800 text-foreground'
                                                }`}
                                            >
                                                {i}
                                            </button>
                                        );
                                    }

                                    return pages;
                                })()}

                                <button
                                    onClick={() => setCurrentPage(Math.min(Math.ceil(filteredUsers.length / itemsPerPage), currentPage + 1))}
                                    disabled={currentPage >= Math.ceil(filteredUsers.length / itemsPerPage)}
                                    className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Edit Role Modal */}
            {showEditModal && selectedUser && (
                <EditRoleModal
                    user={selectedUser}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={handleRoleUpdated}
                />
            )}
        </div>
    );
}
