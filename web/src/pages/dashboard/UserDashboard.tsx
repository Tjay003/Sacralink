import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import DailyVerse from '../../components/dashboard/DailyVerse';
import { Calendar, Clock, MapPin, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { dashboardConfig } from '../../config/featureFlags';

interface Appointment {
    id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    church: {
        name: string;
    };
}

/**
 * UserDashboard - Dashboard for normal users (non-admin)
 * 
 * Shows:
 * - Daily Bible Verse
 * - Upcoming Appointments (Approved)
 * - Pending Requests status
 * - Quick Actions
 */
export default function UserDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, [profile]);

    const fetchAppointments = async () => {
        if (!profile) return;

        try {
            // Fetch user's appointments (RLS filters by user_id automatically)
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    church:churches(name)
                `)
                .neq('status', 'rejected')
                .gte('appointment_date', new Date().toISOString().split('T')[0]) // Future/Today
                .order('appointment_date', { ascending: true })
                .order('appointment_time', { ascending: true })
                .limit(5);

            if (error) throw error;
            setAppointments(data || []);
        } catch (err) {
            console.error('Error fetching user appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    const upcomingCount = appointments.filter(a => a.status === 'approved').length;
    const pendingCount = appointments.filter(a => a.status === 'pending').length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Welcome & Appointments */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Welcome Section */}
                    <div className="rounded-lg shadow-sm p-6 bg-gradient-to-r from-blue-900 to-blue-800 text-white border-none">
                        <h1 className="text-2xl font-bold mb-2">
                            Welcome, {profile?.full_name?.split(' ')[0] || 'User'}!
                        </h1>
                        <p className="text-blue-100 opacity-90">
                            You have <span className="font-bold text-white">{upcomingCount}</span> upcoming appointments and <span className="font-bold text-white">{pendingCount}</span> pending requests.
                        </p>
                    </div>

                    {/* Upcoming Appointments */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Upcoming Appointments
                            </h2>
                            <button
                                onClick={() => navigate('/appointments')}
                                className="text-sm text-primary hover:underline"
                            >
                                View All
                            </button>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <p className="text-muted text-center py-4">Loading appointments...</p>
                            ) : appointments.length > 0 ? (
                                appointments.map(app => (
                                    <div key={app.id} className="flex items-start p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        {/* Date Box */}
                                        <div className="flex-shrink-0 w-16 text-center bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden mr-4">
                                            <div className="bg-primary-50 text-primary-800 text-xs font-bold py-1 uppercase">
                                                {format(new Date(app.appointment_date), 'MMM')}
                                            </div>
                                            <div className="text-xl font-bold text-gray-800 py-1">
                                                {format(new Date(app.appointment_date), 'dd')}
                                            </div>
                                        </div>

                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-semibold text-lg text-gray-900">{app.service_type}</h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                                    ${app.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {app.status}
                                                </span>
                                            </div>

                                            <div className="flex items-center text-sm text-muted mt-1 gap-4">
                                                <div className="flex items-center">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {app.appointment_time}
                                                </div>
                                                <div className="flex items-center">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {app.church?.name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Calendar className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p>No upcoming appointments found.</p>
                                    <button
                                        onClick={() => navigate('/churches')}
                                        className="mt-2 text-primary hover:underline text-sm"
                                    >
                                        Browse churches to book one
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Verse & Actions */}
                <div className="space-y-6">
                    <DailyVerse />

                    {/* Quick Actions - Controlled by dashboardConfig */}
                    {dashboardConfig.showQuickActions && (
                        <div className="card p-6">
                            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                            <div className="space-y-3">
                                <button
                                    onClick={() => navigate('/churches')}
                                    className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                >
                                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                                        <PlusCircle className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">Book Appointment</div>
                                        <div className="text-xs text-muted">Find a church & schedule</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => navigate('/churches')}
                                    className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                >
                                    <div className="bg-purple-100 p-2 rounded-full mr-3">
                                        <span className="text-xl">⛪</span>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">Browse Churches</div>
                                        <div className="text-xs text-muted">Explore parishes</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
