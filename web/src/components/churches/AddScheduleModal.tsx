import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';

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
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Add Mass Schedule"
            size="md"
        >
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
                    <label className="block text-sm font-medium mb-1.5">
                        Day of Week <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={formData.day_of_week}
                        onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                        disabled={loading}
                        className="input w-full"
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
                    <label className="block text-sm font-medium mb-1.5">
                        Time <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        disabled={loading}
                        required
                        className="input w-full"
                    />
                </div>

                {/* Language */}
                <div>
                    <label className="block text-sm font-medium mb-1.5">
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
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-sm"
                    >
                        {loading ? 'Adding...' : 'Add Schedule'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
