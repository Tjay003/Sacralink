import { useState, useEffect } from 'react';
import { directFetchProfiles } from '../../lib/directApi';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile } from '../../types/database';
import EditRoleModal from '../../components/admin/EditRoleModal';

/**
 * UsersPage - Admin page for managing all users
 * 
 * Features:
 * - View all registered users in a table
 * - Search users by name or email
 * - Filter users by role
 * - Edit user roles
 * - View user details
 */
// Role hierarchy for sorting (lower number = higher priority)
const ROLE_PRIORITY: Record<string, number> = {
    'super_admin': 1,
    'admin': 2,
    'church_admin': 3,
    'volunteer': 4,
    'user': 5
};

export default function UsersPage() {
    const { profile: currentUser, session } = useAuth();
    const [users, setUsers] = useState<Profile[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Fetch all users
    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users when search or filter changes
    useEffect(() => {
        filterUsers();
    }, [searchQuery, roleFilter, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);

            // Fetch all profiles using direct API
            if (!session) return;

            const profiles = await directFetchProfiles(session.access_token);

            if (profiles) {
                setUsers(profiles);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let filtered = [...users];

        // Filter by role visibility restrictions
        if (currentUser?.role === 'church_admin') {
            filtered = filtered.filter(user => {
                // Hide Super Admins and Admins
                if (user.role === 'super_admin' || user.role === 'admin') return false;

                // Show users if they are assigned to the same church
                // OR if they are basic users/volunteers assigned to same church
                // OR if they are unassigned users (no role OR user role, AND no assigned church)
                const isAssignedToMyChurch = user.assigned_church_id === currentUser.assigned_church_id;
                const isUnassigned = (!user.role || user.role === 'user') && !user.assigned_church_id;

                return isAssignedToMyChurch || isUnassigned;
            });
        }

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(user =>
                user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filter by role
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        // Sort by role hierarchy, then by name
        filtered.sort((a, b) => {
            const roleA = ROLE_PRIORITY[a.role] || 999;
            const roleB = ROLE_PRIORITY[b.role] || 999;

            if (roleA !== roleB) {
                return roleA - roleB; // Lower priority number comes first
            }

            // Same role, sort by name
            const nameA = a.full_name || '';
            const nameB = b.full_name || '';
            return nameA.localeCompare(nameB);
        });

        setFilteredUsers(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    };

    const handleEditRole = (user: Profile) => {
        setSelectedUser(user);
        setShowEditModal(true);
    };

    const handleRoleUpdated = () => {
        fetchUsers(); // Refresh user list
        setShowEditModal(false);
        setSelectedUser(null);
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-purple-100 text-purple-700';
            case 'admin':
                return 'bg-blue-100 text-blue-700';
            case 'user':
                return 'bg-gray-100 text-gray-700';
            case 'volunteer':
                return 'bg-green-100 text-green-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const formatRole = (role: string) => {
        return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted">Loading users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">User Management</h1>
                    <p className="text-muted">Manage user accounts and permissions</p>
                </div>
                <div className="text-sm text-muted">
                    Total Users: <span className="font-semibold text-foreground">{users.length}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Search Users</label>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input w-full"
                        />
                    </div>

                    {/* Role Filter */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Filter by Role</label>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-full"
                        >
                            <option value="all">All Roles</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="church_admin">Church Admin</option>
                            <option value="volunteer">Volunteer</option>
                            <option value="user">User</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-secondary-50 border-b border-border">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                    Role
                                </th>
                                {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                        Assigned Church
                                    </th>
                                )}
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                                    Registered
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-border">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-muted">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((user) => (
                                    <tr key={user.id} className="hover:bg-secondary-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    {user.avatar_url ? (
                                                        <img
                                                            src={user.avatar_url}
                                                            alt={user.full_name || 'User'}
                                                            className="h-10 w-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                                            <span className="text-primary font-semibold">
                                                                {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-foreground">
                                                        {user.full_name || 'No name'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-foreground">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(user.role)}`}>
                                                {formatRole(user.role)}
                                            </span>
                                        </td>
                                        {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                                {/* Requires fetching church name, for now showing ID or "None" */}
                                                {/* Optimization: In a real app we'd join churches, but for now let's just show if they have one */}
                                                {user.assigned_church_id ? (
                                                    <span className="text-primary truncate block max-w-[150px]" title={user.assigned_church_id}>
                                                        Assigned
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEditRole(user)}
                                                disabled={user.id === currentUser?.id}
                                                className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Edit Role
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Pagination Controls */}
            {filteredUsers.length > 0 && (
                <div className="card p-4 flex items-center justify-between">
                    <div className="text-sm text-muted">
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredUsers.length)} to{' '}
                        {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        
                        {(() => {
                            const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
                            const pages = [];
                            const maxVisible = 5;
                            
                            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                            let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                            
                            if (endPage - startPage < maxVisible - 1) {
                                startPage = Math.max(1, endPage - maxVisible + 1);
                            }
                            
                            for (let i = startPage; i <= endPage; i++) {
                                pages.push(
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i)}
                                        className={`px-3 py-1 text-sm border rounded-md ${
                                            currentPage === i
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-gray-300 hover:bg-gray-50'
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
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
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

