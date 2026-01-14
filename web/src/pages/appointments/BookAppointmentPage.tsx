import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Church } from '../../types/database';

export default function BookAppointmentPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [church, setChurch] = useState<Church | null>(null);
    const [loadingChurch, setLoadingChurch] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        service_type: 'Baptism',
        appointment_date: '',
        appointment_time: '',
        notes: ''
    });

    const SERVICE_TYPES = [
        'Baptism',
        'Wedding',
        'Funeral',
        'Confirmation',
        'Blessing',
        'Other'
    ];

    // Fetch Church Details
    useEffect(() => {
        async function fetchChurch() {
            if (!id) return;

            try {
                const { data, error } = await supabase
                    .from('churches')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setChurch(data);
            } catch (err: any) {
                console.error('Error fetching church:', err);
                setError('Failed to load church details.');
            } finally {
                setLoadingChurch(false);
            }
        }

        fetchChurch();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id) return;

        setSubmitting(true);
        setError('');

        try {
            const { error: insertError } = await (supabase
                .from('appointments') as any)
                .insert([{
                    user_id: user.id,
                    church_id: id,
                    service_type: formData.service_type,
                    appointment_date: formData.appointment_date,
                    appointment_time: formData.appointment_time,
                    notes: formData.notes || null,
                    status: 'pending'
                }]);

            if (insertError) throw insertError;

            setSuccess('Appointment request submitted successfully!');

            // Redirect after a short delay
            setTimeout(() => {
                navigate(`/churches/${id}`);
            }, 2000);

        } catch (err: any) {
            console.error('Error booking appointment:', err);
            setError(err.message || 'Failed to submit appointment request.');
            setSubmitting(false);
        }
    };

    if (loadingChurch) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!church) {
        return (
            <div className="p-4 text-center">
                <p className="text-red-500">Church not found.</p>
                <button onClick={() => navigate('/churches')} className="text-primary hover:underline mt-2">
                    Back to Churches
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="max-w-xl mx-auto p-6">
                <div className="card text-center p-8 space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-700">Request Sent!</h2>
                    <p className="text-gray-600">
                        Your request for a <strong>{formData.service_type}</strong> at {church.name} has been submitted.
                    </p>
                    <p className="text-sm text-gray-500">
                        The church admin will review your request shortly. You will be redirected back to the church details...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <button
                onClick={() => navigate(`/churches/${id}`)}
                className="flex items-center text-gray-500 hover:text-gray-900"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to {church.name}
            </button>

            <div className="card p-6">
                <h1 className="text-2xl font-bold mb-2">Book an Appointment</h1>
                <p className="text-gray-500 mb-6">Request a sacrament or service at {church.name}</p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Service Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Service Type
                        </label>
                        <select
                            required
                            value={formData.service_type}
                            onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                            className="input-field"
                        >
                            {SERVICE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Preferred Date
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    value={formData.appointment_date}
                                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Preferred Time
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <input
                                    type="time"
                                    required
                                    value={formData.appointment_time}
                                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                                    className="input-field pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Special Requests / Notes
                        </label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <textarea
                                rows={4}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input-field pl-10 pt-2"
                                placeholder="Any specific details..."
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary w-full justify-center"
                        >
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
