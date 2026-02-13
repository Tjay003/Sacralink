import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format, isSameDay, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import 'react-calendar/dist/Calendar.css'; // Import default styles

// Custom styles to override default calendar appearance to match theme
const calendarStyles = `
  .react-calendar {
    width: 100%;
    border: none;
    font-family: inherit;
    background: white;
    border-radius: 0.5rem;
  }
  .react-calendar__tile {
    padding: 1rem 0.5rem;
    position: relative;
  }
  .react-calendar__tile--active {
    background: #4f46e5 !important;
    color: white !important;
    border-radius: 0.5rem;
  }
  .react-calendar__tile--now {
    background: #eef2ff;
    border-radius: 0.5rem;
  }
  .react-calendar__tile:enabled:hover,
  .react-calendar__tile:enabled:focus {
    background-color: #e0e7ff;
    border-radius: 0.5rem;
  }
  .has-appointment::after {
    content: '';
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 6px;
    height: 6px;
    background-color: #4f46e5;
    border-radius: 50%;
  }
  .has-appointment.react-calendar__tile--active::after {
    background-color: white;
  }
`;

interface Appointment {
    id: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    profile?: {
        full_name: string;
    };
    church?: {
        name: string;
    };
}

export default function DashboardCalendar() {
    const { profile } = useAuth();
    const [date, setDate] = useState<Date>(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [_loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAppointments();
    }, [profile]);

    const fetchAppointments = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            // Note: RLS policies automatically filter this query
            // Admins/Volunteers see their church's appointments
            // Super Admins see all
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    profile:profiles(full_name),
                    church:churches(name)
                `)
                .neq('status', 'rejected') // Don't show rejected
                .gte('appointment_date', new Date().toISOString().split('T')[0]); // Only future/today

            if (error) throw error;
            setAppointments((data || []) as any);
        } catch (err) {
            console.error('Error fetching calendar appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    // Get appointments for selected date
    const selectedDateAppointments = appointments.filter(app =>
        isSameDay(parseISO(app.appointment_date), date)
    );

    // Check if a date has appointments
    const tileClassName = ({ date, view }: { date: Date, view: string }) => {
        if (view === 'month') {
            const hasApp = appointments.some(app =>
                isSameDay(parseISO(app.appointment_date), date)
            );
            return hasApp ? 'has-appointment' : null;
        }
        return null;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <style>{calendarStyles}</style>

            {/* Calendar Widget */}
            <div className="lg:col-span-2 card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Calendar</h2>
                </div>
                <div className="calendar-container">
                    <Calendar
                        onChange={(value) => setDate(value as Date)}
                        value={date}
                        tileClassName={tileClassName}
                        minDate={new Date()}
                        className="shadow-sm"
                    />
                </div>
            </div>

            {/* Selected Date Details */}
            <div className="card p-6 flex flex-col h-full bg-gray-50 border-none">
                <h3 className="text-lg font-semibold mb-1">
                    {format(date, 'MMMM d, yyyy')}
                </h3>
                <p className="text-muted text-sm mb-4">
                    {format(date, 'EEEE')}
                </p>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                    {selectedDateAppointments.length > 0 ? (
                        selectedDateAppointments.map(app => (
                            <div key={app.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize
                                        ${app.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {app.status}
                                    </span>
                                    <div className="flex items-center text-xs text-muted">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {app.appointment_time}
                                    </div>
                                </div>
                                <h4 className="font-semibold text-primary">{app.service_type}</h4>
                                <div className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {app.profile?.full_name || 'Guest'}
                                </div>
                                <div className="text-xs text-muted mt-1">
                                    {app.church?.name}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-muted">
                            <CalendarIcon className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">No appointments</p>
                            <button
                                onClick={() => {/* potentially navigate to add */ }}
                                className="mt-4 text-xs btn-secondary hidden" // Hidden for now
                            >
                                Schedule Event
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
