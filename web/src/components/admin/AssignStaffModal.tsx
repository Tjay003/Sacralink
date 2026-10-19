import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { directFetchProfiles, directUpdateProfile } from '../../lib/directApi';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { 
    Search, 
    X, 
    Cross, 
    ShieldCheck, 
    UserCheck, 
    UserPlus, 
    Users, 
    Loader2, 
    AlertCircle, 
    Building2,
    Check
} from 'lucide-react';

export interface AssignStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    churchId: string;
    churchName: string;
    onSuccess: () => void;
}

type AssignableRole = 'church_admin' | 'priest' | 'volunteer';

export default function AssignStaffModal({
    isOpen,
    onClose,
    churchId,
    churchName,
    onSuccess
}: AssignStaffModalProps) {
    const { session, profile: currentProfile } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

    const [selectedRole, setSelectedRole] = useState<AssignableRole>('church_admin');
    const [isPriest, setIsPriest] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Reset state whenever modal is opened or closed
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUser(null);
            setSelectedRole('church_admin');
            setIsPriest(false);
            setError('');
        }
    }, [isOpen]);

    // Debounced search for profiles
    useEffect(() => {
        if (!isOpen || selectedUser) return;

        const trimmed = searchQuery.trim();
        if (!trimmed) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setError('');

        const timer = setTimeout(async () => {
            try {
                const token = session?.access_token || '';
                const result = await directFetchProfiles(token, {
                    search: trimmed,
                    pageSize: 15,
                });
                setSearchResults(result.data || []);
            } catch (err) {
                console.error('Failed to search profiles:', err);
                setError('Failed to search users. Please try again.');
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, isOpen, selectedUser, session?.access_token]);

    const handleSelectUser = (user: Profile) => {
        if (user.role === 'super_admin') {
            setError('Super Admin accounts cannot be assigned as parish staff.');
            return;
        }

        setError('');
        setSelectedUser(user);

        // Prepopulate sensible defaults based on selected user
        if (user.role === 'priest' || user.is_priest) {
            setSelectedRole(user.role === 'priest' ? 'priest' : 'church_admin');
            setIsPriest(true);
        } else if (user.role === 'church_admin') {
            setSelectedRole('church_admin');
            setIsPriest(Boolean(user.is_priest));
        } else if (user.role === 'volunteer') {
            setSelectedRole('volunteer');
            setIsPriest(false);
        } else {
            setSelectedRole('church_admin');
            setIsPriest(false);
        }
    };

    const handleClearSelectedUser = () => {
        setSelectedUser(null);
        setError('');
    };

    const handleRoleChange = (newRole: AssignableRole) => {
        setSelectedRole(newRole);
        if (newRole === 'priest') {
            setIsPriest(true);
        } else if (newRole === 'volunteer') {
            setIsPriest(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedUser) {
            setError('Please search and select a user to assign.');
            return;
        }

        if (!session?.access_token) {
            setError('No active session found. Please re-login.');
            return;
        }

        setSubmitting(true);
        setError('');

        const finalIsPriest = selectedRole === 'priest' ? true : (selectedRole === 'church_admin' ? isPriest : false);

        try {
            const result = await directUpdateProfile(
                selectedUser.id,
                {
                    assigned_church_id: churchId,
                    church_id: churchId,
                    role: selectedRole,
                    is_priest: finalIsPriest,
                },
                session.access_token
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to update user parish assignment.');
            }

            // Log activity log for chancery governance audit trail
            try {
                if (currentProfile?.id) {
                    await supabase.from('activity_logs').insert({
                        user_id: currentProfile.id,
                        action: 'assign_parish_staff',
                        entity_type: 'churches',
                        entity_id: churchId,
                        metadata: {
                            assigned_user_id: selectedUser.id,
                            assigned_user_name: selectedUser.full_name,
                            role: selectedRole,
                            is_priest: finalIsPriest,
                            church_name: churchName,
                        },
                    });
                }
            } catch (auditErr) {
                console.warn('Could not record activity log:', auditErr);
            }

            onSuccess();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to assign staff member';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-foreground">Assign Staff / Clergy</h2>
                        <p className="text-xs text-muted truncate max-w-sm sm:max-w-md">
                            {churchName}
                        </p>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error Banner */}
                {error && (
                    <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                        <p className="font-medium leading-relaxed">{error}</p>
                    </div>
                )}

                {/* Section 1: User Search & Selection */}
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                        Select User Account
                    </label>

                    {!selectedUser ? (
                        <div className="space-y-3">
                            {/* Search Input */}
                            <div className="relative">
                                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by full name or email address..."
                                    className="input w-full pl-9 pr-9 text-sm"
                                    autoFocus
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="p-1 rounded-lg text-muted hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                                        aria-label="Clear search"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Search Results / Status */}
                            <div className="border border-border rounded-2xl overflow-hidden bg-white max-h-60 overflow-y-auto divide-y divide-border/60">
                                {isSearching ? (
                                    <div className="p-6 text-center text-muted">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                                        <p className="text-xs">Searching user accounts...</p>
                                    </div>
                                ) : searchQuery.trim() === '' ? (
                                    <div className="p-6 text-center text-muted">
                                        <Users className="w-6 h-6 mx-auto mb-1.5 opacity-40 text-secondary-400" />
                                        <p className="text-xs font-medium text-foreground">Search Registered Users</p>
                                        <p className="text-[11px] text-muted mt-0.5">
                                            Type a parishioner or clergy member's name or email above.
                                        </p>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="p-6 text-center text-muted">
                                        <p className="text-xs font-medium text-foreground">No users found</p>
                                        <p className="text-[11px] text-muted mt-0.5">
                                            No user matches "{searchQuery}". Ensure they have created an account.
                                        </p>
                                    </div>
                                ) : (
                                    searchResults.map((user) => {
                                        const isCurrentParish = user.assigned_church_id === churchId;
                                        const isSuperAdmin = user.role === 'super_admin';
                                        const initials = (user.full_name || user.email || 'U')
                                            .split(' ')
                                            .map((n: string) => n[0])
                                            .slice(0, 2)
                                            .join('')
                                            .toUpperCase();

                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => !isSuperAdmin && handleSelectUser(user)}
                                                className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                                                    isSuperAdmin
                                                        ? 'opacity-50 cursor-not-allowed bg-secondary-50/50'
                                                        : 'hover:bg-secondary-50 cursor-pointer active:bg-secondary-100/60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-full bg-secondary-100 border border-border flex items-center justify-center font-bold text-xs text-secondary-700 shrink-0 overflow-hidden">
                                                        {user.avatar_url ? (
                                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            initials
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-sm text-foreground truncate">
                                                                {user.full_name || 'Unnamed User'}
                                                            </p>
                                                            {user.is_priest && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    <Cross className="w-2.5 h-2.5 text-amber-600" />
                                                                    <span>Clergy</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isCurrentParish && (
                                                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <Check className="w-3 h-3" />
                                                            <span>Assigned</span>
                                                        </span>
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                                        user.role === 'super_admin'
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                            : user.role === 'priest'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            : user.role === 'church_admin'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : user.role === 'volunteer'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-secondary-100 text-secondary-600 border border-secondary-200'
                                                    }`}>
                                                        {user.role ? user.role.replace('_', ' ') : 'Parishioner'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Selected User Preview Card */
                        <div className="p-4 rounded-2xl border-2 border-primary/30 bg-blue-50/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-white border border-blue-200 shadow-2xs flex items-center justify-center font-bold text-sm text-primary shrink-0 overflow-hidden">
                                    {selectedUser.avatar_url ? (
                                        <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        (selectedUser.full_name || selectedUser.email || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm sm:text-base text-foreground truncate">
                                            {selectedUser.full_name || 'Unnamed User'}
                                        </p>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-primary border border-blue-200">
                                            Selected
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted truncate mt-0.5">{selectedUser.email}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleClearSelectedUser}
                                className="px-3 py-1.5 rounded-xl border border-border bg-white hover:bg-secondary-100 text-xs font-semibold text-secondary-700 transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                                Change
                            </button>
                        </div>
                    )}
                </div>

                {/* Section 2: Parish Role Selection */}
                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                        Assigned Parish Role
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Church Admin Option */}
                        <div
                            onClick={() => handleRoleChange('church_admin')}
                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                                selectedRole === 'church_admin'
                                    ? 'border-primary bg-primary-50/40 shadow-xs'
                                    : 'border-border bg-white hover:bg-secondary-50/60'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                    selectedRole === 'church_admin' ? 'bg-primary text-white' : 'bg-secondary-100 text-secondary-600'
                                }`}>
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                {selectedRole === 'church_admin' && (
                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                )}
                            </div>
                            <h4 className="text-xs font-bold text-foreground">Church Admin</h4>
                            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                                Office manager, records, and appointments
                            </p>
                        </div>

                        {/* Priest / Clergy Option */}
                        <div
                            onClick={() => handleRoleChange('priest')}
                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                                selectedRole === 'priest'
                                    ? 'border-amber-500 bg-amber-50/40 shadow-xs'
                                    : 'border-border bg-white hover:bg-secondary-50/60'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                    selectedRole === 'priest' ? 'bg-amber-500 text-white' : 'bg-secondary-100 text-secondary-600'
                                }`}>
                                    <Cross className="w-4 h-4" />
                                </div>
                                {selectedRole === 'priest' && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                )}
                            </div>
                            <h4 className="text-xs font-bold text-foreground">Parish Priest</h4>
                            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                                Sacramental celebrant & spiritual pastor
                            </p>
                        </div>

                        {/* Volunteer Option */}
                        <div
                            onClick={() => handleRoleChange('volunteer')}
                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                                selectedRole === 'volunteer'
                                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                                    : 'border-border bg-white hover:bg-secondary-50/60'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                    selectedRole === 'volunteer' ? 'bg-emerald-600 text-white' : 'bg-secondary-100 text-secondary-600'
                                }`}>
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                {selectedRole === 'volunteer' && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                )}
                            </div>
                            <h4 className="text-xs font-bold text-foreground">Parish Volunteer</h4>
                            <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                                Ministry support, announcements & assistance
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 3: Clergy Status Details */}
                {selectedRole === 'priest' ? (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
                        <Cross className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Authorized Sacramental Celebrant</p>
                            <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                                Dedicated Priest accounts are canonically authorized to preside over Eucharistic Liturgies and parish sacraments.
                            </p>
                        </div>
                    </div>
                ) : selectedRole === 'church_admin' ? (
                    <div className="p-3.5 rounded-2xl border border-border bg-white shadow-2xs flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 transition-colors ${
                                isPriest ? 'bg-amber-100 text-amber-600' : 'bg-secondary-100 text-secondary-500'
                            }`}>
                                <Cross className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <label
                                    htmlFor="is-priest-toggle"
                                    className="text-xs font-bold text-foreground block cursor-pointer select-none"
                                >
                                    Ordained Catholic Priest
                                </label>
                                <p className="text-[11px] text-muted leading-relaxed">
                                    Check if this parish administrator is also an ordained priest celebrating sacraments.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            id="is-priest-toggle"
                            role="switch"
                            aria-checked={isPriest}
                            onClick={() => setIsPriest(!isPriest)}
                            disabled={submitting}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                isPriest ? 'bg-amber-500' : 'bg-secondary-200'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                    isPriest ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                ) : null}

                {/* Parish Assignment Summary Preview */}
                <div className="p-3 bg-secondary-50 rounded-xl border border-border text-xs flex items-center gap-2.5 text-secondary-700">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span>
                        Will be assigned to <strong className="text-foreground">{churchName}</strong>
                    </span>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!selectedUser || submitting}
                        className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Assigning to Parish...</span>
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Assign to Parish</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
