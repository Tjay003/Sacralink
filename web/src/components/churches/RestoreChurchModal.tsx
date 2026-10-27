import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { getChurchRestoreStatus, restoreChurch, type ChurchRestoreStatus } from '../../lib/supabase/churchDeletion';
import type { Profile } from '../../types/database';
import { RotateCcw, AlertCircle, CheckCircle2, Loader2, UserCheck, Search, ShieldCheck } from 'lucide-react';

interface RestoreChurchModalProps {
    churchId: string;
    churchName: string;
    onClose: () => void;
    onRestored: () => void;
}

export default function RestoreChurchModal({ churchId, churchName, onClose, onRestored }: RestoreChurchModalProps) {
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [restoreStatus, setRestoreStatus] = useState<ChurchRestoreStatus | null>(null);
    const [eligibleUsers, setEligibleUsers] = useState<Profile[]>([]);
    const [selectedNewAdminId, setSelectedNewAdminId] = useState<string>('');
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            try {
                setLoadingStatus(true);
                setError(null);

                const status = await getChurchRestoreStatus(churchId);
                if (!isMounted) return;
                setRestoreStatus(status);

                // If cannot auto-restore, fetch eligible parishioners to assign as replacement Church Admin
                if (!status.can_auto_restore) {
                    const { data: users, error: usersErr } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('role', 'user')
                        .is('assigned_church_id', null)
                        .is('deleted_at', null)
                        .is('archived_at', null)
                        .order('full_name', { ascending: true })
                        .limit(100);

                    if (usersErr) throw usersErr;
                    if (isMounted) {
                        setEligibleUsers((users || []) as Profile[]);
                    }
                }
            } catch (err: unknown) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to check church restore status');
                }
            } finally {
                if (isMounted) {
                    setLoadingStatus(false);
                }
            }
        }

        loadData();

        return () => {
            isMounted = false;
        };
    }, [churchId]);

    const filteredUsers = eligibleUsers.filter(u => {
        const query = searchUserQuery.toLowerCase().trim();
        if (!query) return true;
        const name = (u.full_name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restoreStatus) return;

        if (!restoreStatus.can_auto_restore && !selectedNewAdminId) {
            setError('Please select an eligible user to become the new Church Admin.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);

            await restoreChurch(
                churchId,
                restoreStatus.can_auto_restore ? null : selectedNewAdminId
            );

            onRestored();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to restore church');
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={submitting ? () => {} : onClose}
            title={
                <div className="flex items-center gap-2 text-primary min-w-0 flex-1">
                    <RotateCcw className="w-5 h-5 shrink-0" />
                    <span className="text-base sm:text-lg font-bold break-words min-w-0">Restore church</span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-5">
                <div className="p-4 bg-secondary-50 rounded-2xl border border-border">
                    <p className="text-xs text-muted font-medium uppercase tracking-wider">Parish</p>
                    <p className="text-base font-bold text-foreground mt-0.5">{churchName}</p>
                </div>

                {loadingStatus ? (
                    <div className="flex items-center justify-center py-10 space-x-3 text-muted">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm font-medium">Checking admin availability and parish status...</span>
                    </div>
                ) : error && !restoreStatus ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium">
                        {error}
                    </div>
                ) : restoreStatus?.can_auto_restore ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                                <span>Former Church Admin Available</span>
                            </div>
                            <p className="text-xs text-emerald-900/90 leading-relaxed">
                                Former Church Admin{' '}
                                <strong className="font-semibold text-emerald-950">
                                    {restoreStatus.archived_admin?.full_name || restoreStatus.archived_admin?.email}
                                </strong>{' '}
                                is available and will automatically be restored as the Church Admin for this parish.
                            </p>
                            <p className="text-xs text-emerald-700/80">
                                All historical schedules, donations, appointments, and staff channels will be reactivated.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                                <span>Replacement Church Admin Required</span>
                            </div>
                            <p className="text-xs text-amber-900/90 leading-relaxed">
                                {restoreStatus?.archived_admin ? (
                                    <>
                                        Former admin{' '}
                                        <strong className="font-semibold text-amber-950">
                                            {restoreStatus.archived_admin.full_name || restoreStatus.archived_admin.email}
                                        </strong>{' '}
                                        is currently assigned to{' '}
                                        <strong className="font-semibold text-amber-950">
                                            {restoreStatus.archived_admin.current_church_name || 'another church'}
                                        </strong>
                                        {restoreStatus.archived_admin.current_role !== 'user' && ` as ${restoreStatus.archived_admin.current_role}`}. Please select a user below to become the new Church Admin to restore this church.
                                    </>
                                ) : (
                                    <>
                                        No previous Church Admin was recorded for this parish. A church cannot be restored without an admin. Please select an eligible user below to assign as Church Admin.
                                    </>
                                )}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                                Select Replacement Church Admin
                            </label>

                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search eligible parishioners by name or email..."
                                    value={searchUserQuery}
                                    onChange={(e) => setSearchUserQuery(e.target.value)}
                                    className="input w-full pl-9 text-xs sm:text-sm"
                                />
                            </div>

                            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-white shadow-2xs">
                                {filteredUsers.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted">
                                        No unassigned parishioners found matching "{searchUserQuery}"
                                    </div>
                                ) : (
                                    filteredUsers.map((u) => {
                                        const isSelected = selectedNewAdminId === u.id;
                                        return (
                                            <button
                                                type="button"
                                                key={u.id}
                                                onClick={() => setSelectedNewAdminId(u.id)}
                                                className={`w-full flex items-center justify-between p-3 text-left transition-colors cursor-pointer ${
                                                    isSelected ? 'bg-primary-50/70 text-primary-900 font-semibold' : 'hover:bg-secondary-50 text-foreground'
                                                }`}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs sm:text-sm font-medium truncate">{u.full_name || 'No name set'}</p>
                                                    <p className="text-[11px] text-muted truncate">{u.email}</p>
                                                </div>
                                                {isSelected ? (
                                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {error && restoreStatus && (
                    <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRestore} className="flex items-center gap-3 pt-3 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-100 text-foreground font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loadingStatus || submitting || (!restoreStatus?.can_auto_restore && !selectedNewAdminId)}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Restoring parish...</span>
                            </>
                        ) : (
                            <>
                                <UserCheck className="w-4 h-4" />
                                <span>Restore Church</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </Modal>
    );
}
