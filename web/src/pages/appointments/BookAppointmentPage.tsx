import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, FileText, CheckCircle, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getRequirements } from '../../lib/supabase/requirements';
import { uploadDocument } from '../../lib/supabase/documents';
import { notifyAdminsOfNewAppointment } from '../../lib/supabase/notifications';
import DocumentUploader from '../../components/documents/DocumentUploader';
import type { Church } from '../../types/database';

type SacramentRequirement = {
    id: string;
    requirement_name: string;
    description: string | null;
    is_required: boolean;
    allowed_file_types: string[];
    display_order: number;
};

export default function BookAppointmentPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [church, setChurch] = useState<Church | null>(null);
    const [requirements, setRequirements] = useState<SacramentRequirement[]>([]);
    const [documents, setDocuments] = useState<Map<string, File>>(new Map());
    const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Map<string, string>>(new Map());
    const [loadingChurch, setLoadingChurch] = useState(true);
    const [loadingRequirements, setLoadingRequirements] = useState(false);
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
        { value: 'Baptism', label: 'Baptism' },
        { value: 'Wedding', label: 'Wedding' },
        { value: 'Funeral', label: 'Funeral' },
        { value: 'Confirmation', label: 'Confirmation' },
        { value: 'Blessing', label: 'Blessing' },
        { value: 'Other', label: 'Other' },
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

    // Fetch Requirements when service type changes
    useEffect(() => {
        async function fetchRequirements() {
            if (!id || !formData.service_type) return;

            setLoadingRequirements(true);
            try {
                console.log('Fetching requirements for:', { churchId: id, serviceType: formData.service_type });
                const reqs = await getRequirements(id, formData.service_type.toLowerCase());
                console.log('Requirements fetched:', reqs);
                setRequirements(reqs as any);
                // Clear documents when service type changes
                setDocuments(new Map());
                setUploadedDocumentIds(new Map());
            } catch (err: any) {
                console.error('Error fetching requirements:', err);
            } finally {
                setLoadingRequirements(false);
            }
        }

        fetchRequirements();
    }, [id, formData.service_type]);

    const handleFileSelect = (requirementId: string, file: File) => {
        const newDocs = new Map(documents);
        newDocs.set(requirementId, file);
        setDocuments(newDocs);
    };

    const handleFileRemove = (requirementId: string) => {
        const newDocs = new Map(documents);
        newDocs.delete(requirementId);
        setDocuments(newDocs);

        const newUploadedIds = new Map(uploadedDocumentIds);
        newUploadedIds.delete(requirementId);
        setUploadedDocumentIds(newUploadedIds);
    };

    const validateRequiredDocuments = (): boolean => {
        const requiredReqs = requirements.filter(r => r.is_required);
        for (const req of requiredReqs) {
            if (!documents.has(req.id)) {
                setError(`Missing required document: ${req.requirement_name}`);
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id) return;

        // Validate required documents
        if (!validateRequiredDocuments()) {
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // 1. Create the appointment
            const { data: appointment, error: insertError } = await (supabase
                .from('appointments')
                // @ts-ignore - Supabase type inference issue
                .insert([{
                    user_id: user.id,
                    church_id: id,
                    service_type: formData.service_type,
                    appointment_date: formData.appointment_date,
                    appointment_time: formData.appointment_time,
                    notes: formData.notes || null,
                    status: 'pending'
                }])
                .select()
                .single() as any);

            if (insertError) throw insertError;

            // 2. Upload all documents
            const uploadPromises = Array.from(documents.entries()).map(([requirementId, file]) =>
                uploadDocument(appointment.id, requirementId, file)
            );

            await Promise.all(uploadPromises);

            // 3. Notify admins of new appointment
            if (church && user) {
                await notifyAdminsOfNewAppointment(
                    id,
                    user.user_metadata?.full_name || 'A user',
                    formData.service_type,
                    appointment.id
                );
            }

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
                        Your request for a <strong>{SERVICE_TYPES.find(t => t.value === formData.service_type)?.label}</strong> at {church.name} has been submitted.
                    </p>
                    <p className="text-sm text-gray-500">
                        The church admin will review your request and documents shortly. You will be redirected back to the church details...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
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

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                <option key={type.value} value={type.value}>{type.label}</option>
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

                    {/* Required Documents Section */}
                    {(() => {
                        console.log('Rendering requirements section:', { loadingRequirements, requirementsLength: requirements.length, requirements });
                        return null;
                    })()}
                    {loadingRequirements ? (
                        <div className="p-6 text-center border border-gray-200 rounded-lg bg-gray-50">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-gray-500 mt-2">Loading requirements...</p>
                        </div>
                    ) : requirements.length > 0 ? (
                        <div className="border-t border-gray-200 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Upload className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-semibold">Required Documents</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Please upload the following documents for your {SERVICE_TYPES.find(t => t.value === formData.service_type)?.label} request:
                            </p>

                            <div className="space-y-4">
                                {requirements.map((req) => (
                                    <DocumentUploader
                                        key={req.id}
                                        requirementId={req.id}
                                        requirementName={req.requirement_name}
                                        isRequired={req.is_required}
                                        allowedFileTypes={req.allowed_file_types}
                                        onFileSelect={(file) => handleFileSelect(req.id, file)}
                                        onFileRemove={() => handleFileRemove(req.id)}
                                        uploadedFile={documents.get(req.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : null}

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
