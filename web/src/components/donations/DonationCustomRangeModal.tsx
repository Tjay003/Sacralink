import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Calendar, Sparkles, AlertCircle } from 'lucide-react';
import {
    format,
    subDays,
    startOfYear,
    subYears,
    endOfYear,
    parseISO,
    isValid,
    differenceInDays,
} from 'date-fns';

interface DonationCustomRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRange: { start: Date; end: Date };
    onApply: (start: Date, end: Date) => void;
}

export default function DonationCustomRangeModal({
    isOpen,
    onClose,
    currentRange,
    onApply,
}: DonationCustomRangeModalProps) {
    const [startStr, setStartStr] = useState<string>('');
    const [endStr, setEndStr] = useState<string>('');
    const [activePreset, setActivePreset] = useState<string | null>(null);

    // Sync with incoming range when modal opens
    useEffect(() => {
        if (isOpen) {
            setStartStr(format(currentRange.start, 'yyyy-MM-dd'));
            setEndStr(format(currentRange.end, 'yyyy-MM-dd'));
            setActivePreset(null);
        }
    }, [isOpen, currentRange]);

    const handlePreset = (presetName: string, getDates: () => { start: Date; end: Date }) => {
        const { start, end } = getDates();
        setStartStr(format(start, 'yyyy-MM-dd'));
        setEndStr(format(end, 'yyyy-MM-dd'));
        setActivePreset(presetName);
    };

    const startDate = startStr ? parseISO(startStr) : null;
    const endDate = endStr ? parseISO(endStr) : null;

    const isStartValid = startDate ? isValid(startDate) : false;
    const isEndValid = endDate ? isValid(endDate) : false;
    const isChronological = isStartValid && isEndValid && startDate! <= endDate!;
    const canApply = isStartValid && isEndValid && isChronological;

    const dayCount = isChronological && startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (canApply && startDate && endDate) {
            onApply(startDate, endDate);
            onClose();
        }
    };

    const presets = [
        {
            id: '30d',
            label: 'Last 30 Days',
            getDates: () => {
                const now = new Date();
                return { start: subDays(now, 29), end: now };
            },
        },
        {
            id: '90d',
            label: 'Last 90 Days',
            getDates: () => {
                const now = new Date();
                return { start: subDays(now, 89), end: now };
            },
        },
        {
            id: 'ytd',
            label: 'This Year (YTD)',
            getDates: () => {
                const now = new Date();
                return { start: startOfYear(now), end: now };
            },
        },
        {
            id: 'prev_year',
            label: 'Previous Year',
            getDates: () => {
                const now = new Date();
                const prev = subYears(now, 1);
                return { start: startOfYear(prev), end: endOfYear(prev) };
            },
        },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center border border-blue-100 flex-shrink-0">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">Custom Date Range</h3>
                        <p className="text-xs text-secondary-500 font-normal">Filter donation giving by your chosen timeframe</p>
                    </div>
                </div>
            }
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Quick Presets */}
                <div>
                    <label className="block text-xs font-semibold text-secondary-700 mb-2">
                        Quick Presets
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset) => {
                            const isSelected = activePreset === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handlePreset(preset.id, preset.getDates)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center justify-between cursor-pointer ${
                                        isSelected
                                            ? 'border-primary bg-primary-50/60 text-primary font-bold shadow-xs'
                                            : 'border-border bg-white hover:bg-secondary-50 text-foreground'
                                    }`}
                                >
                                    <span>{preset.label}</span>
                                    {isSelected && <Sparkles className="w-3.5 h-3.5 text-primary" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Date Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                        <label className="block text-xs font-semibold text-secondary-700 mb-1">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={startStr}
                            onChange={(e) => {
                                setStartStr(e.target.value);
                                setActivePreset(null);
                            }}
                            className="w-full text-xs rounded-xl border border-border p-2.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-secondary-700 mb-1">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={endStr}
                            onChange={(e) => {
                                setEndStr(e.target.value);
                                setActivePreset(null);
                            }}
                            className="w-full text-xs rounded-xl border border-border p-2.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                </div>

                {/* Validation / Summary */}
                {!isChronological && startStr && endStr && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Start date must be before or equal to the end date.</span>
                    </div>
                )}

                {canApply && startDate && endDate && (
                    <div className="p-3 rounded-xl bg-secondary-50 border border-border/80 text-xs text-secondary-700">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                                {format(startDate, 'MMM d, yyyy')} – {format(endDate, 'MMM d, yyyy')}
                            </span>
                            <span className="text-[11px] font-bold text-primary bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
                                {dayCount} {dayCount === 1 ? 'day' : 'days'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Modal Footer */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-foreground hover:bg-secondary-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canApply}
                        className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Apply Filter
                    </button>
                </div>
            </form>
        </Modal>
    );
}
