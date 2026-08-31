import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle,
    Upload,
    AlertTriangle,
    Calendar,
    MapPin,
    Clock,
    Sparkles,
    ArrowRight,
    Check
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getRequirements } from '../../lib/supabase/requirements';
import { createAppointmentWithDocuments } from '../../lib/supabase/appointments';
import {
    evaluateSlotAndRecommendations,
    formatDateDisplay,
    formatTimeDisplay,
    type AvailabilityCheckResult,
    type SlotRecommendation
} from '../../lib/recommender';
import DocumentUploader from '../../components/documents/DocumentUploader';
import type { Church, Database } from '../../types/database';

type SacramentRequirement = Database['public']['Tables']['sacrament_requirements']['Row'];

export default function BookAppointmentPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // State
    const [church, setChurch] = useState<Church | null>(null);
    const [allChurches, setAllChurches] = useState<Church[]>([]);
    const [requirements, setRequirements] = useState<SacramentRequirement[]>([]);
    const [documents, setDocuments] = useState<Map<string, File>>(new Map());
    const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Map<string, string>>(new Map());
    const [loadingChurch, setLoadingChurch] = useState(true);
    const [loadingRequirements, setLoadingRequirements] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Availability & Recommender State
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [availabilityResult, setAvailabilityResult] = useState<AvailabilityCheckResult | null>(null);

    // Initial state from navigation if passed
    const locationState = location.state as { date?: string; time?: string; service_type?: string } | undefined;

    // Form Data
    const [formData, setFormData] = useState({
        service_type: locationState?.service_type || 'Baptism',
        appointment_date: locationState?.date || '',
        appointment_time: locationState?.time || '',
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

    // Fetch All Active Churches for Cross-Parish Recommendations
    useEffect(() => {
        async function fetchAllChurches() {
            try {
                const { data, error } = await supabase
                    .from('churches')
                    .select('*')
                    .order('name', { ascending: true });

                if (error) throw error;
                setAllChurches(data || []);
            } catch (err) {
                console.error('Error fetching churches for recommender:', err);
            }
        }

        fetchAllChurches();
    }, []);

    // Fetch Current Church Details
    useEffect(() => {
        async function fetchChurch() {
            if (!id) return;

            try {
                setLoadingChurch(true);
                const { data, error } = await supabase
                    .from('churches')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setChurch(data);
            } catch (err) {
                console.error('Error fetching church:', err);
                setError('Failed to load church details.');
            } finally {
                setLoadingChurch(false);
            }
        }

        fetchChurch();
    }, [id]);

    // Fetch Requirements when service type or church changes
    useEffect(() => {
        async function fetchRequirements() {
            if (!id || !formData.service_type) return;

            setLoadingRequirements(true);
            try {
                const reqs = await getRequirements(id, formData.service_type.toLowerCase());
                setRequirements(reqs);
                // Clear documents when service type changes
                setDocuments(new Map());
                setUploadedDocumentIds(new Map());
            } catch (err) {
                console.error('Error fetching requirements:', err);
            } finally {
                setLoadingRequirements(false);
            }
        }

        fetchRequirements();
    }, [id, formData.service_type]);

    // Real-Time Availability Check & Recommender Engine
    const runAvailabilityCheck = useCallback(async (
        curChurch: Church,
        serviceType: string,
        date: string,
        time: string
    ) => {
        if (!date || !time) {
            setAvailabilityResult(null);
            return;
        }

        setCheckingAvailability(true);
        try {
            const result = await evaluateSlotAndRecommendations(
                curChurch,
                allChurches,
                serviceType,
                date,
                time
            );
            setAvailabilityResult(result);
        } catch (err) {
            console.error('Error checking availability:', err);
        } finally {
            setCheckingAvailability(false);
        }
    }, [allChurches]);

    // Trigger check on date, time, service_type, or church change
    useEffect(() => {
        if (!church || !formData.appointment_date || !formData.appointment_time) {
            setAvailabilityResult(null);
            return;
        }

        const timer = setTimeout(() => {
            runAvailabilityCheck(
                church,
                formData.service_type,
                formData.appointment_date,
                formData.appointment_time
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [church, formData.service_type, formData.appointment_date, formData.appointment_time, runAvailabilityCheck]);

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

    // Handler for Card A: Select same church next slot
    const handleSelectSameChurchSlot = (rec: SlotRecommendation) => {
        setFormData(prev => ({
            ...prev,
            appointment_date: rec.date,
            appointment_time: rec.time
        }));
        setError('');
    };

    // Handler for Card B: Select nearest alternative parish
    const handleSelectAlternativeParish = (rec: SlotRecommendation) => {
        setFormData(prev => ({
            ...prev,
            appointment_date: rec.date,
            appointment_time: rec.time
        }));
        setError('');
        navigate(`/churches/${rec.churchId}/book`, {
            replace: true,
            state: {
                date: rec.date,
                time: rec.time,
                service_type: formData.service_type
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !id) return;

        if (availabilityResult && !availabilityResult.isAvailable) {
            setError('The selected slot is unavailable. Please select an alternative slot or change the date and time.');
            return;
        }

        // Validate required documents
        if (!validateRequiredDocuments()) {
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const { error: bookingError } = await createAppointmentWithDocuments({
                userId: user.id,
                churchId: id,
                serviceType: formData.service_type,
                appointmentDate: formData.appointment_date,
                appointmentTime: formData.appointment_time,
                notes: formData.notes,
                userName: user.user_metadata?.full_name || 'A user',
                documents,
            });

            if (bookingError) throw bookingError;

            setSuccess('Appointment request submitted successfully!');

            // Redirect after a short delay
            setTimeout(() => {
                navigate(`/churches/${id}`);
            }, 2000);

        } catch (err) {
            console.error('Error booking appointment:', err);
            const message = err instanceof Error ? err.message : 'Failed to submit appointment request.';
            setError(message);
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
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-700 dark:text-green-400">Request Sent!</h2>
                    <p className="text-gray-600 dark:text-gray-300">
                        Your request for a <strong>{SERVICE_TYPES.find(t => t.value === formData.service_type)?.label}</strong> at {church.name} has been submitted.
                    </p>
                    <p className="text-sm text-gray-500">
                        The church admin will review your request and documents shortly. You will be redirected back to the church details...
                    </p>
                </div>
            </div>
        );
    }

    const isSlotConflict = availabilityResult && !availabilityResult.isAvailable;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <button
                type="button"
                onClick={() => navigate(`/churches/${id}`)}
                className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to {church.name}
            </button>

            <div className="card p-6">
                <h1 className="text-2xl font-bold mb-2">Book an Appointment</h1>
                <p className="text-gray-500 mb-6">Request a sacrament or service at {church.name}</p>

                {error && (
                    <div className="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Service Type */}
                    <div>
                        <label htmlFor="service_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Service Type
                        </label>
                        <select
                            id="service_type"
                            required
                            value={formData.service_type}
                            onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                            className="input w-full"
                        >
                            {SERVICE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Preferred Date
                            </label>
                            <div>
                                <input
                                    id="appointment_date"
                                    type="date"
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    value={formData.appointment_date}
                                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                                    className="input w-full"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="appointment_time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Preferred Time
                            </label>
                            <div className="relative">
                                <input
                                    id="appointment_time"
                                    type="time"
                                    required
                                    value={formData.appointment_time}
                                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                                    className="input w-full"
                                />
                                {checkingAvailability && (
                                    <div className="absolute right-3 top-2.5 flex items-center gap-1.5 text-xs text-muted">
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary"></div>
                                        <span>Checking...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SMART RECOMMENDATIONS SECTION (RENDERED WHEN SLOT IS UNAVAILABLE) */}
                    {isSlotConflict && (
                        <div
                            data-testid="smart-recommendations-section"
                            className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-5 space-y-4 animate-in"
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300 mt-0.5">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                                            Selected Slot Unavailable
                                        </h3>
                                        <span className="badge badge-warning text-xs">Schedule Conflict</span>
                                    </div>
                                    <p className="text-sm text-amber-800/90 dark:text-amber-300/80">
                                        <strong>{church.name}</strong> is already booked or unavailable on{' '}
                                        <span className="font-medium underline">
                                            {formatDateDisplay(formData.appointment_date)} at {formatTimeDisplay(formData.appointment_time)}
                                        </span>.
                                        {availabilityResult?.conflictReason && ` (${availabilityResult.conflictReason})`}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                        Recommended Smart Alternatives
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* CARD A: Earliest Next Available Slot at Current Parish */}
                                    {availabilityResult.sameChurchAlternative ? (
                                        <div
                                            data-testid="recommendation-card-same-church"
                                            className="bg-white dark:bg-gray-900 border border-primary/20 hover:border-primary/50 rounded-xl p-4.5 shadow-xs flex flex-col justify-between transition-all"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="badge badge-primary flex items-center gap-1.5 font-medium">
                                                        <Calendar className="w-3.5 h-3.5" /> Same Parish
                                                    </span>
                                                    <span className="text-xs text-primary font-medium">Earliest Slot</span>
                                                </div>

                                                <div>
                                                    <h5 className="font-bold text-gray-900 dark:text-white text-base">
                                                        {availabilityResult.sameChurchAlternative.churchName}
                                                    </h5>
                                                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                                        {availabilityResult.sameChurchAlternative.churchAddress || church.address}
                                                    </p>
                                                </div>

                                                <div className="bg-primary-50 dark:bg-primary-950/40 border border-primary-100 dark:border-primary-900/50 rounded-lg p-3 space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-primary-800 dark:text-primary-300">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>
                                                            {availabilityResult.sameChurchAlternative.formattedDate}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-primary">
                                                        {availabilityResult.sameChurchAlternative.formattedTime}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectSameChurchSlot(availabilityResult.sameChurchAlternative!)}
                                                className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg"
                                            >
                                                <Check className="w-4 h-4" />
                                                Select This Slot
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-900 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                                            No additional slots found in the next 14 days at this parish.
                                        </div>
                                    )}

                                    {/* CARD B: Nearest Alternative Parish Offering Sacrament on Requested Date */}
                                    {availabilityResult.nearbyChurchAlternative ? (
                                        <div
                                            data-testid="recommendation-card-nearby-church"
                                            className="bg-white dark:bg-gray-900 border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl p-4.5 shadow-xs flex flex-col justify-between transition-all"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                                                        <MapPin className="w-3.5 h-3.5" /> Nearest Parish
                                                    </span>
                                                    <span
                                                        data-testid="nearby-church-distance-badge"
                                                        className="badge bg-emerald-200/80 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-200 font-bold flex items-center gap-1 text-xs"
                                                    >
                                                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                                                        {availabilityResult.nearbyChurchAlternative.distanceFormatted}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h5 className="font-bold text-gray-900 dark:text-white text-base">
                                                        {availabilityResult.nearbyChurchAlternative.churchName}
                                                    </h5>
                                                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                                                        {availabilityResult.nearbyChurchAlternative.churchAddress}
                                                    </p>
                                                </div>

                                                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-3 space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>
                                                            {availabilityResult.nearbyChurchAlternative.formattedDate}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                                        {availabilityResult.nearbyChurchAlternative.formattedTime}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectAlternativeParish(availabilityResult.nearbyChurchAlternative!)}
                                                className="btn bg-emerald-600 hover:bg-emerald-700 text-white w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors"
                                            >
                                                <ArrowRight className="w-4 h-4" />
                                                Select This Parish
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-900 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                                            No nearby alternative parishes found with open slots on this date.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Special Requests / Notes
                        </label>
                        <div>
                            <textarea
                                rows={4}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input pt-2 w-full min-h-[100px]"
                                placeholder="Any specific details..."
                            />
                        </div>
                    </div>

                    {/* Required Documents Section */}
                    {loadingRequirements ? (
                        <div className="p-6 text-center border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                            <p className="text-sm text-gray-500 mt-2">Loading requirements...</p>
                        </div>
                    ) : requirements.length > 0 ? (
                        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Upload className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-semibold">Required Documents</h3>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Please upload the following documents for your {SERVICE_TYPES.find(t => t.value === formData.service_type)?.label} request:
                            </p>

                            <div className="space-y-4">
                                {requirements.map((req) => (
                                    <DocumentUploader
                                        key={req.id}
                                        requirementId={req.id}
                                        requirementName={req.requirement_name}
                                        isRequired={Boolean(req.is_required)}
                                        allowedFileTypes={req.allowed_file_types || undefined}
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
                            disabled={submitting || Boolean(isSlotConflict)}
                            className="btn-primary w-full justify-center rounded-lg py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : isSlotConflict ? 'Slot Unavailable - Select Alternative Above' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
