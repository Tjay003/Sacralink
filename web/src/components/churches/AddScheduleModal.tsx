import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';

interface AddScheduleModalProps {
    churchId: string;
    onClose: () => void;
    onSuccess: () => void;
}

const DAYS_OF_WEEK = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

/**
 * AddScheduleModal - Modal to add a new mass schedule
 */
export default function AddScheduleModal({ churchId, onClose, onSuccess }: AddScheduleModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        day_of_week: 'Sunday',
        time: '',
        language: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.time) {
            setError('Time is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: insertError } = await (supabase
                .from('mass_schedules') as any)
                .insert([{
                    church_id: churchId,
                    day_of_week: formData.day_of_week,
                    time: formData.time,
                    language: formData.language || null,
                }]);

            if (insertError) {
                console.error('❌ Error adding schedule:', insertError);
                setError(insertError.message);
                setLoading(false);
                return;
            }

            console.log('✅ Schedule added successfully');
            onSuccess();
            onClose();
        } catch (err) {
            console.error('❌ Unexpected error:', err);
            setError('Failed to add schedule');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Add Mass Schedule</h2>
                    <button
                        onClick={onClose}
                        className="text-muted hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Day of Week */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Day of Week <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.day_of_week}
                            onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            required
                        >
                            {DAYS_OF_WEEK.map((day) => (
                                <option key={day} value={day}>
                                    {day}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Time <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="time"
                            value={formData.time}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            required
                        />
                    </div>

                    {/* Language */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Language (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.language}
                            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                            disabled={loading}
                            className="input w-full"
                            placeholder="e.g., English, Tagalog, Latin"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1"
                        >
                            {loading ? 'Adding...' : 'Add Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
