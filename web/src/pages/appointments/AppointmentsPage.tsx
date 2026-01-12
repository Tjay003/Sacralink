import { Calendar, Plus, Search, Filter } from 'lucide-react';

export default function AppointmentsPage() {
    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
                    <p className="text-muted">Manage sacrament bookings and schedules</p>
                </div>
                <button className="btn-primary">
                    <Plus className="w-4 h-4" />
                    New Appointment
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by name or service..."
                        className="input pl-10"
                    />
                </div>
                <button className="btn-outline">
                    <Filter className="w-4 h-4" />
                    Filters
                </button>
            </div>

            {/* Empty State */}
            <div className="card">
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mb-4">
                        <Calendar className="w-8 h-8 text-accent-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No appointments</h3>
                    <p className="text-muted text-center max-w-sm mb-6">
                        When parishioners book appointments, they will appear here for you to review and manage.
                    </p>
                </div>
            </div>
        </div>
    );
}
