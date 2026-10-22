import { useState, useEffect, useCallback } from 'react';
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    CalendarOff,
    Moon,
    Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../ui/Modal';
import {
    getPriestAvailability,
    upsertDayOff,
    addBlackoutPeriod,
    deleteBlackoutPeriod,
    DAY_NAMES,
    type PriestAvailability,
    type PriestAvailabilityData,
} from '../../lib/supabase/priestAvailability';

export interface PriestAvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    priestId: string;
    churchId?: string | null;
    onAvailabilityUpdated?: () => void;
}

function parseErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null) {
        const obj = err as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message) return obj.message;
        if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description;
    }
    return fallback;
}

export default function PriestAvailabilityModal({
    isOpen,
    onClose,
    priestId,
    churchId,
    onAvailabilityUpdated,
}: PriestAvailabilityModalProps) {
    const [loading, setLoading] = useState(true);
    const [availability, setAvailability] = useState<PriestAvailabilityData | null>(null);

    // Day Off form state
    const [selectedDayOff, setSelectedDayOff] = useState<number | null>(null);
    const [savingDayOff, setSavingDayOff] = useState(false);
    const [dayOffSuccess, setDayOffSuccess] = useState(false);

    // Blackout form state
    const [blackoutStart, setBlackoutStart] = useState('');
    const [blackoutEnd, setBlackoutEnd] = useState('');
    const [blackoutReason, setBlackoutReason] = useState('Annual Retreat');
    const [addingBlackout, setAddingBlackout] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Alert feedback
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!priestId) return;
        try {
            setLoading(true);
            setErrorMsg(null);
            const { data, error } = await getPriestAvailability(priestId);
            if (error) throw error;
            setAvailability(data);
            setSelectedDayOff(data?.recurringDayOff ?? null);
        } catch (err) {
            console.error('Error fetching priest availability:', err);
            setErrorMsg(parseErrorMessage(err, 'Failed to load availability data.'));
        } finally {
            setLoading(false);
        }
    }, [priestId]);

    useEffect(() => {
        if (isOpen) {
            void loadData();
            setDayOffSuccess(false);
        }
    }, [isOpen, loadData]);

    const handleSaveDayOff = async () => {
        if (!priestId) return;
        try {
            setSavingDayOff(true);
            setErrorMsg(null);
            setDayOffSuccess(false);

            const { error } = await upsertDayOff(priestId, churchId ?? null, selectedDayOff);
            if (error) throw error;

            setDayOffSuccess(true);
            await loadData();
            onAvailabilityUpdated?.();
            setTimeout(() => setDayOffSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving day off:', err);
            setErrorMsg(parseErrorMessage(err, 'Failed to update day off.'));
        } finally {
            setSavingDayOff(false);
        }
    };

    const handleAddBlackout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!priestId || !blackoutStart || !blackoutEnd) {
            setErrorMsg('Please select both start and end dates.');
            return;
        }

        if (blackoutStart > blackoutEnd) {
            setErrorMsg('The retreat start date cannot be later than the end date.');
            return;
        }

        try {
            setAddingBlackout(true);
            setErrorMsg(null);

            const { error } = await addBlackoutPeriod(
                priestId,
                churchId ?? null,
                blackoutStart,
                blackoutEnd,
                blackoutReason.trim() || 'Clergy Retreat / Leave'
            );

            if (error) throw error;

            setBlackoutStart('');
            setBlackoutEnd('');
            setBlackoutReason('Annual Retreat');
            await loadData();
            onAvailabilityUpdated?.();
        } catch (err) {
            console.error('Error adding blackout period:', err);
            setErrorMsg(parseErrorMessage(err, 'Failed to schedule retreat.'));
        } finally {
            setAddingBlackout(false);
        }
    };

    const handleDeleteBlackout = async (id: string) => {
        try {
            setDeletingId(id);
            setErrorMsg(null);

            const { success, error } = await deleteBlackoutPeriod(id);
            if (error || !success) {
                throw error || new Error('Failed to remove leave period.');
            }

            await loadData();
            onAvailabilityUpdated?.();
        } catch (err) {
            console.error('Error deleting blackout period:', err);
            setErrorMsg(parseErrorMessage(err, 'Failed to remove leave period.'));
        } finally {
            setDeletingId(null);
        }
    };

    const formatDateSafe = (dateStr: string | null) => {
        if (!dateStr) return '';
        try {
            const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const [y, m, d] = clean.split('-').map(Number);
            return format(new Date(y, m - 1, d), 'MMM d, yyyy');
        } catch {
            return dateStr;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-primary">
                        <CalendarOff className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">
                            Clergy Availability & Rota Management
                        </h3>
                        <p className="text-xs text-muted">
                            Configure Father's weekly day off and scheduled retreat periods
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                {errorMsg && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {loading ? (
                    <div className="py-12 text-center text-muted">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-xs font-medium">Loading clergy availability records...</p>
                    </div>
                ) : (
                    <>
                        {/* Section 1: Canonical Weekly Day Off */}
                        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Moon className="w-4 h-4 text-amber-600" />
                                        <h4 className="text-sm font-bold text-foreground">
                                            Canonical Weekly Day Off
                                        </h4>
                                    </div>
                                    <p className="text-xs text-muted leading-relaxed">
                                        Under Canon law, priests maintain a designated weekly day of rest for spiritual replenishment and personal prayer.
                                    </p>
                                </div>

                                {availability?.recurringDayOff !== null && availability?.recurringDayOff !== undefined && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                        Every {DAY_NAMES[availability.recurringDayOff]}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                                <div className="flex-1">
                                    <label htmlFor="day-off-select" className="sr-only">
                                        Select designated day off
                                    </label>
                                    <select
                                        id="day-off-select"
                                        value={selectedDayOff === null ? '' : selectedDayOff}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedDayOff(val === '' ? null : Number(val));
                                        }}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-white text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                                    >
                                        <option value="">No designated day off (Available all week)</option>
                                        {DAY_NAMES.map((name, index) => (
                                            <option key={name} value={index}>
                                                Every {name} (Canonical Day Off)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSaveDayOff}
                                    disabled={savingDayOff}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-2xs shrink-0 cursor-pointer"
                                >
                                    {savingDayOff ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : dayOffSuccess ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            <span>Saved!</span>
                                        </>
                                    ) : (
                                        <span>Save Day Off</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Section 2: Scheduled Retreats & Blackout Leaves */}
                        <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        Scheduled Retreats & Leaves
                                    </h4>
                                </div>
                                <p className="text-xs text-muted leading-relaxed">
                                    Block out multi-day periods such as the annual clergy retreat, study leave, or convalescence to prevent automated parish scheduling.
                                </p>
                            </div>

                            {/* Add Blackout Form */}
                            <form
                                onSubmit={handleAddBlackout}
                                className="p-4 rounded-xl border border-border/80 bg-secondary-50/60 space-y-3"
                            >
                                <span className="text-xs font-semibold text-secondary-900 block">
                                    Schedule New Leave / Retreat Period
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-medium text-muted block mb-1">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={blackoutStart}
                                            onChange={(e) => setBlackoutStart(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-medium text-muted block mb-1">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={blackoutEnd}
                                            onChange={(e) => setBlackoutEnd(e.target.value)}
                                            required
                                            min={blackoutStart || undefined}
                                            className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-medium text-muted block mb-1">
                                        Nature / Purpose of Leave
                                    </label>
                                    <input
                                        type="text"
                                        value={blackoutReason}
                                        onChange={(e) => setBlackoutReason(e.target.value)}
                                        placeholder="e.g. Annual Retreat, Canonical Study Leave..."
                                        required
                                        className="w-full px-3 py-2 rounded-xl border border-border bg-white text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs placeholder:text-muted"
                                    />
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        disabled={addingBlackout || !blackoutStart || !blackoutEnd}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
                                    >
                                        {addingBlackout ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Scheduling...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Leave Interval</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Existing Blackout Periods List */}
                            <div className="space-y-2 pt-2">
                                <h5 className="text-xs font-semibold text-secondary-900">
                                    Active & Upcoming Leave Periods ({availability?.blackoutPeriods.length || 0})
                                </h5>

                                {(!availability?.blackoutPeriods || availability.blackoutPeriods.length === 0) ? (
                                    <div className="py-6 text-center rounded-xl border border-dashed border-border bg-secondary-50/40 text-muted">
                                        <Calendar className="w-8 h-8 text-secondary-300 mx-auto mb-1.5" />
                                        <p className="text-xs">No scheduled leave or retreat periods on record.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/60 rounded-xl border border-border overflow-hidden">
                                        {availability.blackoutPeriods.map((period: PriestAvailability) => (
                                            <div
                                                key={period.id}
                                                className="p-3 bg-white flex items-center justify-between gap-3 hover:bg-secondary-50/50 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-xs text-foreground truncate">
                                                            {period.reason || 'Clergy Retreat'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                                                        <Calendar className="w-3 h-3 text-secondary-400" />
                                                        <span>
                                                            {formatDateSafe(period.blackout_start)}
                                                            {' – '}
                                                            {formatDateSafe(period.blackout_end)}
                                                        </span>
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteBlackout(period.id)}
                                                    disabled={deletingId === period.id}
                                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                                                    title="Remove leave period"
                                                >
                                                    {deletingId === period.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
