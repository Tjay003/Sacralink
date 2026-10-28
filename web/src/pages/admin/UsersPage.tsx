import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { directFetchProfiles, directFetchChurches } from '../../lib/directApi';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, Church, UserRole } from '../../types/database';
import EditRoleModal from '../../components/admin/EditRoleModal';
import DemoteConfirmModal from '../../components/admin/DemoteConfirmModal';
import DeleteUserModal from '../../components/admin/DeleteUserModal';
import SuspendUserModal from '../../components/admin/SuspendUserModal';
import ParishInquiryModal from '../../components/churches/ParishInquiryModal';
import { reactivateUser, restoreUserAccount, purgeExpiredArchivedUsers } from '../../lib/supabase/profiles';
import { effectiveChurchId, getRoleEditBlock, isStaffRole, isVisibleToChurchAdmin } from '../../lib/roleEditing';
import RowActionsMenu, { type RowAction } from '../../components/common/RowActionsMenu';
import { useToast } from '../../contexts/toastContext';
import TransferOwnershipModal from '../../components/admin/TransferOwnershipModal';
import Pagination from '../../components/common/Pagination';
import { AccessDeniedView } from '../../components/auth/RoleRoute';
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
    Mail,
    MapPin,
    Crown,
    ShieldCheck,
    Cross,
    Users,
    RotateCcw,
    Trash2,
    UserMinus,
    UserX,
    UserCheck,
    X,
    Archive,
    Clock,
    Loader2
} from 'lucide-react';

/**
 * UsersPage - Admin page for managing all users with Church Categorization,
 * Multi-Column Sorting, Group by Parish Accordion Mode, and Sole Super Admin Ownership Transfer.
 */

// Role hierarchy for sorting (lower number = higher priority)
const ROLE_PRIORITY: Record<UserRole, number> = {
    'super_admin': 1,
    'admin': 2, // dormant enum value, kept only because Record<UserRole, number> requires every member
    'church_admin': 3,
    'priest': 4,
    'volunteer': 5,
    'user': 6
};

const isParishioner = (user: Profile) => !user.role || user.role === 'user';

function calculateRoleStats(userList: Profile[]) {
    return {
        admins: userList.filter(u => u.role === 'church_admin' || u.role === 'super_admin').length,
        volunteers: userList.filter(u => u.role === 'volunteer').length,
        priests: userList.filter(u => u.role === 'priest' || u.is_priest).length,
        users: userList.filter(u => !u.role || u.role === 'user').length,
    };
}

type SortField = 'role' | 'church' | 'name' | 'created_at';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'grouped';
type DirectoryTab = 'staff' | 'parishioners' | 'all';

export default function UsersPage() {
    const { profile: currentUser, session, refreshProfile } = useAuth();
    const toast = useToast();
    const [churches, setChurches] = useState<Church[]>([]);

    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
    const [restoringUserId, setRestoringUserId] = useState<string | null>(null);
    const [directoryTab, setDirectoryTab] = useState<DirectoryTab>(
        currentUser?.role === 'church_admin' ? 'staff' : 'all'
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [urlParams] = useSearchParams();
    const focusUserId = urlParams.get('user');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [churchFilter, setChurchFilter] = useState<string>(
        currentUser?.role === 'church_admin' ? (currentUser.assigned_church_id || 'all') : 'all'
    );
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [sortField, setSortField] = useState<SortField>('role');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [demoteTarget, setDemoteTarget] = useState<Profile | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
    const [requestTarget, setRequestTarget] = useState<Profile | null>(null);
    const [suspendTarget, setSuspendTarget] = useState<Profile | null>(null);

    const [transferTargetUser, setTransferTargetUser] = useState<Profile | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [collapsedChurchIds, setCollapsedChurchIds] = useState<Set<string>>(new Set());

    const isAuthorized = currentUser?.role === 'super_admin' || currentUser?.role === 'church_admin';

    // When currentUser loads or changes, ensure church_admin defaults properly
    useEffect(() => {
        if (currentUser?.role === 'church_admin') {
            if (currentUser.assigned_church_id) {
                setChurchFilter(currentUser.assigned_church_id);
            }
            setDirectoryTab(prev => (prev === 'all' ? 'staff' : prev));
        }
    }, [currentUser]);

    const fetchData = useCallback(async () => {
        if (!currentUser) return;
        if (!isAuthorized) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const token = session?.access_token || '';

            // Auto-purge any expired archived accounts (7+ days old) on load
            if (currentUser?.role === 'super_admin') {
                try {
                    await purgeExpiredArchivedUsers();
                } catch (e) {
                    console.warn('Auto-purge expired users notice:', e);
                }
            }

            // Fetch without pagination truncation so church's staff members and parishioners are properly loaded
            const [profilesRes, churchesRes] = await Promise.all([
                token
                    ? directFetchProfiles(token)
                    : Promise.resolve({ data: [], count: 0 }),
                directFetchChurches(),
            ]);

            if (profilesRes) {
                setUsers(profilesRes.data || []);
            }
            if (churchesRes) {
                setChurches(churchesRes);
            }
        } catch (error) {
            console.error('Error fetching users and churches:', error);
            toast.error('Could not load the user list. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    }, [session, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ?user=<id> from a ticket review panel: narrow the directory to that person once, on first load
    const [focusApplied, setFocusApplied] = useState(false);
    useEffect(() => {
        if (focusApplied || !focusUserId || users.length === 0) return;
        const focused = users.find((p) => p.id === focusUserId);
        if (focused?.email) setSearchQuery(focused.email);
        setFocusApplied(true);
    }, [focusApplied, focusUserId, users]);

    // Fast lookup map for Church names
    const churchMap = useMemo(() => {
        const map = new Map<string, string>();
        churches.forEach(c => map.set(c.id, c.name));
        return map;
    }, [churches]);

    const churchObjectMap = useMemo(() => {
        const map = new Map<string, Church>();
        churches.forEach(c => map.set(c.id, c));
        return map;
    }, [churches]);

    const getChurchName = useCallback((churchId?: string | null) => {
        if (!churchId) return 'Unassigned';
        return churchMap.get(churchId) || 'Unknown Parish';
    }, [churchMap]);

    /**
     * Everything except the directory tab: role scope (what this role may see), search, role and church filters.
     * Excludes archived users (who are presented in the Archived tab).
     * Tab counts and rows both come from this one list, so a tab's number always equals the rows it shows.
     */
    const scopedUsers = useMemo(() => {
        let filtered = users.filter(user => !user.archived_at);

        // 1. Role visibility. A Church Admin sees their church's staff, their church's Parishioners and
        //    Parishioners with no church; a Super Admin sees everyone.
        if (currentUser?.role === 'church_admin') {
            filtered = filtered.filter(user => isVisibleToChurchAdmin(user, currentUser.assigned_church_id));
        }

        // 2. Search query (matches name, email, or church name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(user => {
                const name = (user.full_name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                const churchName = getChurchName(effectiveChurchId(user)).toLowerCase();
                return name.includes(query) || email.includes(query) || churchName.includes(query);
            });
        }

        // 3. Filter by role
        if (roleFilter !== 'all') {
            if (roleFilter === 'suspended') {
                filtered = filtered.filter(user => !!user.suspended_at);
            } else if (roleFilter === 'priest') {
                filtered = filtered.filter(user => (user.role || 'user') === 'priest' || !!user.is_priest);
            } else {
                filtered = filtered.filter(user => (user.role || 'user') === roleFilter);
            }
        }

        // 4. Filter by church (assigned church for staff, home church for Parishioners). A Church Admin is already
        //    limited to their own scope above and the parish selector is locked, so it is not applied again.
        if (churchFilter !== 'all' && currentUser?.role !== 'church_admin') {
            if (churchFilter === 'unassigned') {
                filtered = filtered.filter(user => !effectiveChurchId(user));
            } else {
                filtered = filtered.filter(user => effectiveChurchId(user) === churchFilter);
            }
        }

        return filtered;
    }, [users, currentUser, searchQuery, roleFilter, churchFilter, getChurchName]);

    // Counts for the Directory tabs
    const tabCounts = useMemo(() => {
        const parishioners = scopedUsers.filter(isParishioner).length;
        return { staff: scopedUsers.length - parishioners, parishioners, all: scopedUsers.length };
    }, [scopedUsers]);

    const activeUsersCount = useMemo(() => users.filter(u => !u.archived_at).length, [users]);
    const archivedUsersCount = useMemo(() => users.filter(u => Boolean(u.archived_at)).length, [users]);

    const archivedUsers = useMemo(() => {
        let list = users.filter(user => Boolean(user.archived_at));
        if (currentUser?.role === 'church_admin') {
            list = list.filter(user => isVisibleToChurchAdmin(user, currentUser.assigned_church_id));
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            list = list.filter(user => {
                const name = (user.full_name || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(query) || email.includes(query);
            });
        }
        return list;
    }, [users, currentUser, searchQuery]);

    const getDaysUntilDeletion = (archivedAt: string | null | undefined): { days: number; text: string } => {
        if (!archivedAt) return { days: 7, text: '7 days left before permanent deletion' };
        const archivedDate = new Date(archivedAt).getTime();
        const purgeDate = archivedDate + 7 * 24 * 60 * 60 * 1000;
        const diffMs = purgeDate - Date.now();
        const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        if (daysLeft <= 0) {
            return { days: 0, text: 'Expiring soon' };
        }
        if (daysLeft === 1) {
            return { days: 1, text: '1 day left before permanent deletion' };
        }
        return { days: daysLeft, text: `${daysLeft} days left before permanent deletion` };
    };

    const handleRestoreUser = async (user: Profile) => {
        try {
            setRestoringUserId(user.id);
            await restoreUserAccount(user.id);
            toast.showSuccess({
                title: 'User restored',
                message: `${userLabel(user)} has been restored to Active Parishioners.`,
                tone: 'success',
            });
            await fetchData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to restore user account');
        } finally {
            setRestoringUserId(null);
        }
    };

    // Tab + Sort Logic
    const filteredUsers = useMemo(() => {
        const filtered = scopedUsers.filter(user => {
            if (directoryTab === 'staff') return !isParishioner(user);
            if (directoryTab === 'parishioners') return isParishioner(user);
            return true;
        });

        // Multi-column Sorting
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
                    const churchA = effectiveChurchId(a) ? getChurchName(effectiveChurchId(a)) : 'ZZZ_Unassigned';
                    const churchB = effectiveChurchId(b) ? getChurchName(effectiveChurchId(b)) : 'ZZZ_Unassigned';
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
    }, [scopedUsers, directoryTab, sortField, sortOrder, getChurchName]);

    // Paginated users for flat table mode
    const paginatedUsers = useMemo(() => {
        return filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredUsers, currentPage, itemsPerPage]);

    // Reset pagination on filter or tab change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, churchFilter, sortField, sortOrder, directoryTab]);

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
            if (currentUser?.role === 'church_admin' && church.id !== currentUser.assigned_church_id) return;
            if (churchFilter !== 'all' && churchFilter !== church.id && currentUser?.role !== 'church_admin') return;
            const churchUsers = filteredUsers.filter(u => effectiveChurchId(u) === church.id);
            
            // Only show churches with users matching the filter or if explicitly filtered
            if (churchUsers.length > 0 || (currentUser?.role === 'church_admin' && church.id === currentUser.assigned_church_id)) {
                groups.push({
                    churchId: church.id,
                    churchName: church.name,
                    address: church.address,
                    users: churchUsers,
                    stats: calculateRoleStats(churchUsers),
                });
            }
        });

        // Unassigned bucket
        const unassignedUsers = filteredUsers.filter(u => !effectiveChurchId(u));
        if (unassignedUsers.length > 0) {
            groups.push({
                churchId: 'unassigned',
                churchName: 'General / Parishioners Available',
                address: 'Parishioners available for sacrament care or volunteer promotion',
                users: unassignedUsers,
                stats: calculateRoleStats(unassignedUsers),
            });
        }

        return groups;
    }, [churches, filteredUsers, churchFilter, currentUser]);

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

    const userLabel = (user: Profile | null | undefined) => user?.full_name || user?.email || 'The user';

    const handleDemoted = () => {
        toast.success(`${userLabel(demoteTarget)} is now a Parishioner.`);
        setDemoteTarget(null);
        fetchData();
        refreshProfile();
    };

    const handleDeleted = () => {
        toast.showSuccess({
            title: 'User archived',
            message: `${userLabel(deleteTarget)} was moved to the 7-day Archive. They can be restored before permanent deletion.`,
            tone: 'warning',
        });
        setDeleteTarget(null);
        fetchData();
    };

    const handleSuspended = () => {
        toast.showSuccess({
            title: 'User suspended',
            message: `${userLabel(suspendTarget)} was signed out and cannot sign in until reactivated.`,
            tone: 'warning',
        });
        setSuspendTarget(null);
        fetchData();
    };

    const handleReactivate = async (user: Profile) => {
        try {
            await reactivateUser(user.id);
            toast.showSuccess({
                title: 'User reactivated',
                message: `${userLabel(user)} can sign in again with their previous role.`,
                tone: 'success',
            });
            fetchData();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to reactivate the user');
        }
    };

    const handleRoleUpdated = () => {
        toast.success(`Role updated for ${userLabel(selectedUser)}.`);
        fetchData();
        refreshProfile();
        setShowEditModal(false);
        setSelectedUser(null);
    };

    const handleTransferOwnership = (user: Profile) => {
        setTransferTargetUser(user);
        setShowTransferModal(true);
    };

    const handleTransferSuccess = () => {
        toast.success(`Platform ownership was transferred to ${userLabel(transferTargetUser)}. Your account is now a Parishioner.`);
        setShowTransferModal(false);
        setTransferTargetUser(null);
        fetchData();
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
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

    const isSuperAdmin = currentUser?.role === 'super_admin';
    // A Church Admin cannot delete accounts; they ask the Super Admin with a ticket
    const canRequestDeletion = (user: Profile) =>
        currentUser?.role === 'church_admin' && user.id !== currentUser.id && user.role !== 'super_admin' && !user.deleted_at;

    /**
     * One compact primary action (Edit role) plus a "..." menu for everything else. The same permission rules as
     * before decide which menu items exist; people who cannot be edited keep a single disabled button with its reason.
     */
    const renderRowActions = (user: Profile, layout: 'row' | 'card') => {
        const fullWidth = layout === 'card';
        if (user.role === 'super_admin') {
            return (
                <button
                    type="button"
                    disabled
                    title="Platform Owner role cannot be modified."
                    className={`${fullWidth ? 'w-full py-2' : 'py-1.5'} px-3 rounded-lg border border-border bg-secondary-100 text-muted text-xs font-semibold opacity-60 cursor-not-allowed`}
                >
                    Owner Locked
                </button>
            );
        }
        if (user.id === currentUser?.id) {
            return (
                <button
                    type="button"
                    disabled
                    title="You cannot change your own role."
                    className={`${fullWidth ? 'w-full py-2' : 'py-1.5'} px-3.5 rounded-lg border border-border bg-secondary-100 text-muted text-xs font-semibold opacity-60 cursor-not-allowed`}
                >
                    Your account
                </button>
            );
        }

        const actions: RowAction[] = [];
        if (isStaffRole(user.role) && !getRoleEditBlock(currentUser, user)) {
            actions.push({ key: 'demote', label: 'Demote to Parishioner', tone: 'danger', icon: <UserMinus className="w-4 h-4" />, onSelect: () => setDemoteTarget(user) });
        }
        if (isSuperAdmin) {
            actions.push(user.suspended_at
                ? { key: 'reactivate', label: 'Reactivate user', tone: 'success', icon: <UserCheck className="w-4 h-4" />, onSelect: () => void handleReactivate(user) }
                : { key: 'suspend', label: 'Suspend user', tone: 'warning', icon: <UserX className="w-4 h-4" />, onSelect: () => setSuspendTarget(user) });
            actions.push({ key: 'delete', label: 'Delete user', tone: 'danger', icon: <Trash2 className="w-4 h-4" />, onSelect: () => setDeleteTarget(user) });
        }
        if (canRequestDeletion(user)) {
            actions.push({ key: 'request-deletion', label: 'Request deletion', tone: 'danger', icon: <Trash2 className="w-4 h-4" />, onSelect: () => setRequestTarget(user) });
        }

        return (
            <div className={`flex items-center gap-2 ${fullWidth ? 'w-full' : 'justify-end'}`}>
                <button
                    type="button"
                    onClick={() => handleEditRole(user)}
                    className={`btn-primary text-white text-xs px-3.5 py-2 rounded-lg shadow-sm font-semibold ${fullWidth ? 'flex-1' : ''}`}
                >
                    Edit role
                </button>
                <RowActionsMenu actions={actions} label={`More actions for ${userLabel(user)}`} />
            </div>
        );
    };

    const hasActiveFilters = Boolean(
        searchQuery.trim() ||
        roleFilter !== 'all' ||
        (isSuperAdmin && churchFilter !== 'all') ||
        sortField !== 'role' ||
        sortOrder !== 'asc'
    );

    const handleResetFilters = () => {
        setSearchQuery('');
        setRoleFilter('all');
        if (isSuperAdmin) {
            setChurchFilter('all');
        }
        setSortField('role');
        setSortOrder('asc');
    };

    if (currentUser && !isAuthorized) {
        return <AccessDeniedView />;
    }

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
                    <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="text-xs sm:text-sm text-secondary-500 font-normal mt-1">Audit roles, permissions, and church assignments across all churches</p>
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

            {/* Active / Archived Status Switcher */}
            <div className="flex items-center gap-2">
                <div className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/60 dark:bg-secondary-800/60 border border-border/60 gap-1">
                    <button
                        type="button"
                        onClick={() => setStatusFilter('active')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            statusFilter === 'active'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-xs'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>Active Accounts</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            statusFilter === 'active'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-secondary-200/80 dark:bg-secondary-700 text-muted'
                        }`}>
                            {activeUsersCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('archived')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            statusFilter === 'archived'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-xs'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <Archive className="w-3.5 h-3.5 text-amber-600" />
                        <span>Archived</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            statusFilter === 'archived'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-secondary-200/80 dark:bg-secondary-700 text-muted'
                        }`}>
                            {archivedUsersCount}
                        </span>
                    </button>
                </div>
            </div>

            {statusFilter === 'archived' ? (
                <div className="space-y-4">
                    {/* Informational banner */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-900 leading-relaxed">
                            <span className="font-bold text-amber-950">7-Day Temporary Archive Window:</span> Accounts in the archive have their login blocked and pending requests cancelled, while their names, emails, and transaction histories are safely preserved. Accounts can be restored to Active Parishioners at any time before the countdown expires. After 7 days, accounts are permanently deleted and anonymized.
                        </div>
                    </div>

                    {/* Search Toolbar for Archived Users */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72 md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search archived users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-2xl border border-border bg-white text-xs sm:text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-shadow"
                            />
                        </div>
                    </div>

                    {/* Archived Table */}
                    {archivedUsers.length === 0 ? (
                        <div className="card p-12 text-center border-dashed">
                            <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center mx-auto mb-3 text-muted">
                                <Archive className="w-6 h-6" />
                            </div>
                            <p className="text-foreground font-medium">No archived users</p>
                            <p className="text-muted text-xs mt-1">
                                {searchQuery ? `No archived users match "${searchQuery}"` : 'There are currently no users in the 7-day archive window.'}
                            </p>
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-secondary-50 border-b border-border">
                                        <tr>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">User</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Archived Date</th>
                                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Countdown Before Auto-Delete</th>
                                            <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-white">
                                        {archivedUsers.map((user) => {
                                            const countdown = getDaysUntilDeletion(user.archived_at);
                                            const isRestoring = restoringUserId === user.id;
                                            const archivedDateFormatted = user.archived_at
                                                ? new Date(user.archived_at).toLocaleDateString(undefined, {
                                                      year: 'numeric',
                                                      month: 'short',
                                                      day: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : 'Unknown date';

                                            return (
                                                <tr key={user.id} className="hover:bg-secondary-50/60 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center font-bold text-secondary-600 text-sm overflow-hidden shrink-0">
                                                                {user.avatar_url ? (
                                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    (user.full_name || user.email || 'U')[0].toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-foreground truncate">{user.full_name || 'No name set'}</p>
                                                                <p className="text-xs text-muted truncate">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-secondary-600 whitespace-nowrap">
                                                        {archivedDateFormatted}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
                                                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                            <span>{countdown.text}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRestoreUser(user)}
                                                            disabled={isRestoring}
                                                            className="btn-primary text-xs font-semibold rounded-xl px-3.5 py-2 inline-flex items-center gap-1.5 shadow-xs cursor-pointer hover:shadow active:scale-95 disabled:opacity-50"
                                                        >
                                                            {isRestoring ? (
                                                                <>
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    <span>Restoring...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <UserCheck className="w-3.5 h-3.5" />
                                                                    <span>Restore User</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Directory Category Segmented Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary-100/60 dark:bg-secondary-800/60 border border-border/60 gap-1 max-w-full flex-wrap">
                    <button
                        type="button"
                        onClick={() => setDirectoryTab('staff')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            directoryTab === 'staff'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-xs'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        <span>Parish Staff & Clergy</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            directoryTab === 'staff'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-secondary-200/80 dark:bg-secondary-700 text-muted'
                        }`}>
                            {tabCounts.staff}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirectoryTab('parishioners')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            directoryTab === 'parishioners'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-xs'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Parishioners</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            directoryTab === 'parishioners'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-secondary-200/80 dark:bg-secondary-700 text-muted'
                        }`}>
                            {tabCounts.parishioners}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDirectoryTab('all')}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            directoryTab === 'all'
                                ? 'bg-white dark:bg-secondary-700 text-foreground shadow-xs'
                                : 'text-muted hover:text-foreground'
                        }`}
                    >
                        <List className="w-3.5 h-3.5 text-muted" />
                        <span>All Accounts</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold ${
                            directoryTab === 'all'
                                ? 'bg-secondary-200 text-foreground dark:bg-secondary-600'
                                : 'bg-secondary-200/80 dark:bg-secondary-700 text-muted'
                        }`}>
                            {tabCounts.all}
                        </span>
                    </button>
                </div>
            </div>

            {/* Pristine Modern Filter & Search Toolbar */}
            <div className="space-y-3">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
                    {/* Search Input (Pill Style) */}
                    <div className="relative flex-1 max-w-full xl:max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or parish..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 rounded-full border border-border text-xs sm:text-sm bg-white dark:bg-secondary-800 text-foreground placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs transition-shadow"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 dark:hover:text-secondary-200 cursor-pointer p-0.5 rounded-full transition-colors"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdowns (Clean Rounded-Full Pills) */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Role Dropdown */}
                        <div className="relative inline-block shrink-0">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                aria-label="Filter by role"
                                className={`appearance-none rounded-full pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                                    roleFilter !== 'all'
                                        ? 'border border-primary/50 text-primary font-semibold bg-blue-50/30 dark:bg-primary/10 dark:text-blue-300'
                                        : 'bg-white dark:bg-secondary-800 border border-border text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-700/60'
                                }`}
                            >
                                <option value="all">All Roles (Default)</option>
                                <option value="super_admin">Super Admin (Platform Owner)</option>
                                <option value="church_admin">Church Admin</option>
                                <option value="priest">Priest</option>
                                <option value="volunteer">Volunteer</option>
                                <option value="user">Parishioner / User</option>
                                <option value="suspended">Suspended</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-500 pointer-events-none" />
                        </div>

                        {/* Parish Dropdown */}
                        <div className="relative inline-block shrink-0 max-w-[200px] sm:max-w-[240px]">
                            <select
                                value={churchFilter}
                                onChange={(e) => setChurchFilter(e.target.value)}
                                aria-label="Filter by parish"
                                disabled={!isSuperAdmin}
                                className={`w-full truncate appearance-none rounded-full pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                                    churchFilter !== 'all'
                                        ? 'border border-primary/50 text-primary font-semibold bg-blue-50/30 dark:bg-primary/10 dark:text-blue-300'
                                        : 'bg-white dark:bg-secondary-800 border border-border text-secondary-700 dark:text-secondary-200 hover:bg-secondary-50 dark:hover:bg-secondary-700/60'
                                }`}
                            >
                                {isSuperAdmin && (
                                    <>
                                        <option value="all">All Parishes (Default)</option>
                                        <option value="unassigned">No Church Assigned (Unassigned)</option>
                                    </>
                                )}
                                {churches.map((church) => (
                                    <option key={church.id} value={church.id}>
                                        {church.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-500 pointer-events-none" />
                        </div>

                        {/* Sort Dropdown + Order Button */}
                        <div className={`inline-flex items-center shrink-0 rounded-full shadow-2xs focus-within:ring-2 focus-within:ring-primary/20 transition-colors ${
                            sortField !== 'role' || sortOrder !== 'asc'
                                ? 'border border-primary/50 bg-blue-50/30 dark:bg-primary/10'
                                : 'bg-white dark:bg-secondary-800 border border-border'
                        }`}>
                            <div className="relative">
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                    aria-label="Sort users by"
                                    className={`appearance-none bg-transparent pl-3.5 pr-7 py-2 text-xs sm:text-sm font-medium hover:bg-secondary-50 dark:hover:bg-secondary-700/60 cursor-pointer focus:outline-none rounded-l-full transition-colors ${
                                        sortField !== 'role' || sortOrder !== 'asc'
                                            ? 'text-primary font-semibold dark:text-blue-300'
                                            : 'text-secondary-700 dark:text-secondary-200'
                                    }`}
                                >
                                    <option value="role">Sort: Role Priority (Default)</option>
                                    <option value="church">Sort: Assigned Parish</option>
                                    <option value="name">Sort: Full Name</option>
                                    <option value="created_at">Sort: Registration Date</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-500 pointer-events-none" />
                            </div>
                            <div className="h-4 w-px bg-border/80" />
                            <button
                                type="button"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                title={sortOrder === 'asc' ? 'Ascending Order (Default)' : 'Descending Order (Click to return to Ascending - Default)'}
                                aria-label={sortOrder === 'asc' ? 'Ascending order' : 'Descending order'}
                                className="px-2.5 py-2 text-secondary-600 dark:text-secondary-300 hover:text-foreground hover:bg-secondary-50 dark:hover:bg-secondary-700/60 rounded-r-full transition-colors flex items-center justify-center cursor-pointer"
                            >
                                {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        {/* Reset Filters Button */}
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-secondary-100/80 hover:bg-secondary-200/80 dark:bg-secondary-800 dark:hover:bg-secondary-700 text-secondary-700 dark:text-secondary-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
                                title="Reset all filters and sorting to defaults"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-secondary-500" />
                                <span>Reset to defaults</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Summary Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
                    <span>
                        {viewMode === 'grouped' ? (
                            <>
                                Showing <strong className="text-foreground">{filteredUsers.length}</strong>{' '}
                                {directoryTab === 'staff' ? 'parish staff & clergy' : directoryTab === 'parishioners' ? 'parishioners' : 'users'}
                                {filteredUsers.length !== users.length && (
                                    <span className="text-muted/70"> ({users.length} total accessible)</span>
                                )}
                            </>
                        ) : filteredUsers.length !== users.length ? (
                            <span className="text-secondary-600 dark:text-secondary-300 font-medium">
                                Filtered view: <strong className="text-foreground">{filteredUsers.length}</strong> matching of <span className="text-muted/80">{users.length} total accessible</span>
                            </span>
                        ) : null}
                    </span>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="sm:hidden text-xs font-semibold text-secondary-500 hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Reset all filters and sorting to defaults"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-secondary-400" />
                            <span>Reset to defaults</span>
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
                                                    {group.users.map((user) => {
                                                        const isUserSuperAdmin = user.role === 'super_admin';
                                                        return (
                                                            <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary-50/40 dark:hover:bg-secondary-900/20 transition-colors">
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    {user.avatar_url ? (
                                                                        <img
                                                                            src={user.avatar_url}
                                                                            alt={user.full_name || 'User'}
                                                                            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
                                                                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-sm font-semibold text-foreground truncate" title={user.full_name || 'No name'}>
                                                                                {user.full_name || 'No name set'}
                                                                            </span>
                                                                            {isUserSuperAdmin ? (
                                                                                <span className="px-2.5 py-0.5 inline-flex items-center gap-1 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm">
                                                                                    <Crown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                                                                    <span>Platform Owner</span>
                                                                                </span>
                                                                            ) : (
                                                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                                                    {formatRole(user.role || 'user')}
                                                                                </span>
                                                                            )}
                                                                            {user.suspended_at ? (
                                                                                <span title={user.suspension_reason ? `Suspended: ${user.suspension_reason}` : 'Suspended'} className="inline-flex shrink-0">
                                                                                    <StatusBadge domain="user" status="suspended" size="sm" />
                                                                                </span>
                                                                            ) : !user.archived_at && (
                                                                                <StatusBadge domain="user" status="active" size="sm" />
                                                                            )}
                                                                            {user.is_priest && user.role !== 'priest' && (
                                                                                <span className="px-2 py-0.5 inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-sm" title="Ordained Catholic Priest">
                                                                                    <Cross className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                                    <span>Priest / Celebrant</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 text-xs text-muted mt-0.5 flex-wrap">
                                                                            <span className="flex items-center gap-1 min-w-0 max-w-full">
                                                                                <Mail className="w-3 h-3 text-muted/70 flex-shrink-0" />
                                                                                <span className="truncate" title={user.email || undefined}>{user.email}</span>
                                                                            </span>
                                                                            <span className="flex items-center gap-1 whitespace-nowrap">
                                                                                <Calendar className="w-3 h-3 text-muted/70 flex-shrink-0" />
                                                                                Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                                                    {renderRowActions(user, 'row')}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
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
                    {/* Mobile & Tablet Responsive Card Grid (< lg) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
                        {paginatedUsers.length === 0 ? (
                            <div className="col-span-full card p-8 text-center text-muted">
                                No users found matching current filters.
                            </div>
                        ) : (
                            paginatedUsers.map((user) => {
                                const churchName = getChurchName(effectiveChurchId(user));
                                const isUserSuperAdmin = user.role === 'super_admin';
                                return (
                                    <div
                                        key={user.id}
                                        className="card p-4 sm:p-5 border border-border/80 flex flex-col justify-between gap-3.5 shadow-sm hover:border-primary/30 transition-all"
                                    >
                                        <div className="space-y-3">
                                            {/* Top: Avatar, Name & Role Badge */}
                                            <div className="flex items-start gap-3 min-w-0">
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={user.full_name || 'User'}
                                                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-sm font-bold text-foreground truncate" title={user.full_name || 'No name'}>
                                                        {user.full_name || 'No name set'}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                        {isUserSuperAdmin ? (
                                                            <span className="px-2.5 py-0.5 inline-flex items-center gap-1 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm">
                                                                <Crown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                                                <span>Platform Owner</span>
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                                {formatRole(user.role || 'user')}
                                                            </span>
                                                        )}
                                                                            {user.suspended_at ? (
                                                                                <span title={user.suspension_reason ? `Suspended: ${user.suspension_reason}` : 'Suspended'} className="inline-flex shrink-0">
                                                                                    <StatusBadge domain="user" status="suspended" size="sm" />
                                                                                </span>
                                                                            ) : !user.archived_at && (
                                                                                <StatusBadge domain="user" status="active" size="sm" />
                                                                            )}
                                                        {user.is_priest && user.role !== 'priest' && (
                                                            <span className="px-2 py-0.5 inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-sm" title="Ordained Catholic Priest">
                                                                <Cross className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                <span>Clergy</span>
                                                            </span>
                                                        )}
                                                        {effectiveChurchId(user) && (
                                                            <span className="px-2 py-0.5 inline-flex text-xs font-medium rounded-md bg-secondary-100 dark:bg-secondary-800 text-foreground border border-border truncate max-w-[150px]">
                                                                {churchName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details: Email, Assigned Parish, Registered */}
                                            <div className="space-y-2 pt-2.5 border-t border-border/60 text-xs">
                                                <div className="flex items-center gap-2 text-muted min-w-0">
                                                    <Mail className="w-3.5 h-3.5 flex-shrink-0 text-muted/70" />
                                                    <span className="text-foreground truncate" title={user.email || undefined}>
                                                        {user.email}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted min-w-0">
                                                    <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                                                    <span className="text-foreground truncate" title={churchName}>
                                                        {effectiveChurchId(user) ? (
                                                            <span className="font-medium text-foreground">{churchName}</span>
                                                        ) : (
                                                            <span className="text-muted italic">Unassigned</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted">
                                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-muted/70" />
                                                    <span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Action Buttons */}
                                        <div className="pt-2 border-t border-border/60">
                                            {renderRowActions(user, 'card')}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Table (>= lg) */}
                    <div className="hidden lg:block card overflow-hidden border border-border/80">
                        <div>
                            <table className="w-full table-fixed">
                                <thead className="bg-secondary-50 dark:bg-secondary-900/60 border-b border-border text-left text-xs font-semibold text-muted uppercase tracking-wider">
                                    <tr>
                                        <th className="w-[34%] px-4 xl:px-5 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>User &amp; Email</span>
                                                {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="w-[30%] px-4 xl:px-5 py-3.5">
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <button type="button" className="flex items-center gap-1.5 uppercase tracking-wider font-semibold hover:text-foreground cursor-pointer" onClick={() => handleSort('role')}>
                                                    <span>Role</span>
                                                    {sortField === 'role' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                                </button>
                                                <span aria-hidden="true">&amp;</span>
                                                <button type="button" className="flex items-center gap-1.5 uppercase tracking-wider font-semibold hover:text-foreground cursor-pointer" onClick={() => handleSort('church')}>
                                                    <span>Assigned Parish</span>
                                                    {sortField === 'church' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="w-[14%] px-4 xl:px-5 py-3.5 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('created_at')}>
                                            <div className="flex items-center gap-1.5">
                                                <span>Registered</span>
                                                {sortField === 'created_at' && (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />)}
                                            </div>
                                        </th>
                                        <th className="w-[22%] px-4 xl:px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-white dark:bg-card">
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-10 text-center text-muted">
                                                No users found matching current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedUsers.map((user) => {
                                            const churchName = getChurchName(effectiveChurchId(user));
                                            const isUserSuperAdmin = user.role === 'super_admin';
                                            return (
                                                <tr key={user.id} className="hover:bg-secondary-50/60 dark:hover:bg-secondary-900/30 transition-colors">
                                                    {/* User & Email */}
                                                    <td className="px-4 xl:px-5 py-3.5 align-top">
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            {user.avatar_url ? (
                                                                <img
                                                                    src={user.avatar_url}
                                                                    alt={user.full_name || 'User'}
                                                                    className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center flex-shrink-0 text-xs">
                                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-semibold text-foreground break-words">
                                                                    {user.full_name || 'No name'}
                                                                </div>
                                                                <div className="text-xs text-muted mt-0.5 break-all" title={user.email || undefined}>
                                                                    {user.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Role & Assigned Parish */}
                                                    <td className="px-4 xl:px-5 py-3.5 align-top">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {isUserSuperAdmin ? (
                                                                <span className="px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm">
                                                                    <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                                                    <span>Platform Owner</span>
                                                                </span>
                                                            ) : (
                                                                <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full border ${getRoleBadgeClass(user.role || 'user')}`}>
                                                                    {formatRole(user.role || 'user')}
                                                                </span>
                                                            )}
                                                                            {user.suspended_at ? (
                                                                                <span title={user.suspension_reason ? `Suspended: ${user.suspension_reason}` : 'Suspended'} className="inline-flex shrink-0">
                                                                                    <StatusBadge domain="user" status="suspended" size="sm" />
                                                                                </span>
                                                                            ) : !user.archived_at && (
                                                                                <StatusBadge domain="user" status="active" size="sm" />
                                                                            )}
                                                            {user.is_priest && user.role !== 'priest' && (
                                                                <span className="px-2 py-0.5 inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 shadow-sm" title="Ordained Catholic Priest">
                                                                    <Cross className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                                    <span>Priest</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Assigned Church with Interactive Hover Tooltip */}
                                                        <div className="mt-2 text-sm">
                                                            {effectiveChurchId(user) ? (
                                                                <div className="relative group/church block">
                                                                    <div className="flex items-start gap-1.5 text-foreground font-medium cursor-help min-w-0">
                                                                        <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                                                        <span className="break-words min-w-0 border-b border-dotted border-border/80 group-hover/church:border-primary group-hover/church:text-primary transition-colors">
                                                                            {churchName}
                                                                        </span>
                                                                    </div>
                                                                    {/* Tooltip Card on Hover */}
                                                                    <div className="absolute left-0 top-full mt-2 hidden group-hover/church:flex flex-col z-50 w-64 max-w-full p-3 bg-white text-foreground rounded-xl shadow-2xl border border-border whitespace-normal break-words pointer-events-none animate-in fade-in zoom-in-95">
                                                                        <div className="flex items-start gap-2 mb-1.5">
                                                                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                                                                                <Building2 className="w-4 h-4" />
                                                                            </div>
                                                                            <p className="font-bold text-xs text-foreground leading-snug break-words">
                                                                                {churchName}
                                                                            </p>
                                                                        </div>
                                                                        {churchObjectMap.get(effectiveChurchId(user) ?? '')?.address && (
                                                                            <div className="flex items-start gap-1.5 mt-1 text-[11px] text-muted leading-normal break-words">
                                                                                <MapPin className="w-3.5 h-3.5 text-muted/70 shrink-0 mt-0.5" />
                                                                                <span className="break-words">
                                                                                    {churchObjectMap.get(effectiveChurchId(user) ?? '')?.address}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted">
                                                                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                                                Verified Parish
                                                                            </span>
                                                                            <span className="font-medium text-muted">San Jose del Monte, Bulacan</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted/60 text-xs italic">Unassigned</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Registered Date */}
                                                    <td className="px-4 xl:px-5 py-3.5 align-top text-sm text-muted">
                                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 xl:px-5 py-3.5 align-top text-right text-sm font-medium">
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {renderRowActions(user, 'row')}
                                                        </div>
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
                    {(filteredUsers.length > 0) && (
                        <Pagination
                            currentPage={currentPage}
                            totalItems={filteredUsers.length}
                            pageSize={itemsPerPage}
                            onPageChange={(page) => setCurrentPage(page)}
                            onPageSizeChange={(size) => {
                                setItemsPerPage(size);
                                setCurrentPage(1);
                            }}
                            pageSizeOptions={[10, 25, 50]}
                            itemName={directoryTab === 'staff' ? 'staff members' : directoryTab === 'parishioners' ? 'parishioners' : 'users'}
                        />
                    )}
                </>
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
                    onOpenTransferModal={handleTransferOwnership}
                />
            )}

            {/* Demote to Parishioner confirmation */}
            {demoteTarget && (
                <DemoteConfirmModal
                    user={demoteTarget}
                    churchName={demoteTarget.assigned_church_id ? getChurchName(demoteTarget.assigned_church_id) : null}
                    onClose={() => setDemoteTarget(null)}
                    onSuccess={handleDemoted}
                />
            )}

            {/* Delete user confirmation (Super Admin only) */}
            {requestTarget && currentUser && currentUser.assigned_church_id && (
                <ParishInquiryModal
                    isOpen
                    onClose={() => setRequestTarget(null)}
                    userId={currentUser.id}
                    role={currentUser.role ?? undefined}
                    lane="platform"
                    defaultChurchId={currentUser.assigned_church_id}
                    churchId={currentUser.assigned_church_id}
                    initialCategory="user_deletion_request"
                    initialSubjectUser={{ id: requestTarget.id, name: requestTarget.full_name || requestTarget.email || 'Unnamed user' }}
                    onSuccess={() => {
                        toast.showSuccess({
                            title: 'Request sent',
                            message: `The Super Admin will review the deletion request for ${userLabel(requestTarget)}.`,
                            tone: 'success',
                        });
                        setRequestTarget(null);
                    }}
                />
            )}
            {deleteTarget && isSuperAdmin && (
                <DeleteUserModal
                    user={deleteTarget}
                    isLastChurchAdmin={
                        deleteTarget.role === 'church_admin' &&
                        !!deleteTarget.assigned_church_id &&
                        !users.some(u => u.id !== deleteTarget.id && u.role === 'church_admin' && u.assigned_church_id === deleteTarget.assigned_church_id && !u.archived_at)
                    }
                    onClose={() => setDeleteTarget(null)}
                    onSuccess={handleDeleted}
                />
            )}

            {/* Suspend user (Super Admin only) */}
            {suspendTarget && isSuperAdmin && (
                <SuspendUserModal
                    user={suspendTarget}
                    onClose={() => setSuspendTarget(null)}
                    onSuccess={handleSuspended}
                />
            )}

            {/* Transfer Ownership Modal */}
            {showTransferModal && transferTargetUser && (
                <TransferOwnershipModal
                    isOpen={showTransferModal}
                    user={transferTargetUser}
                    onClose={() => {
                        setShowTransferModal(false);
                        setTransferTargetUser(null);
                    }}
                    onSuccess={handleTransferSuccess}
                />
            )}
        </div>
    );
}
