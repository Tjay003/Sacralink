import { useAuth } from '../../contexts/AuthContext';

/**
 * UserDashboard - Dashboard for normal users (non-admin)
 * 
 * This is a simplified dashboard for users with 'user' role.
 * They can view their profile, upcoming appointments, and browse churches/events.
 * 
 * Admin features are hidden from this view.
 */
export default function UserDashboard() {
    const { profile } = useAuth();

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="card p-6">
                <h1 className="text-2xl font-bold mb-2">
                    Welcome, {profile?.full_name || 'User'}!
                </h1>
                <p className="text-muted">
                    Your church community dashboard
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Upcoming Appointments</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                        <div className="text-4xl">📅</div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Events This Month</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                        <div className="text-4xl">🎉</div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Prayer Requests</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                        <div className="text-4xl">🙏</div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button className="btn-secondary p-4 text-left">
                        <div className="text-2xl mb-2">📅</div>
                        <div className="font-semibold">Book Appointment</div>
                        <div className="text-sm text-muted">Schedule a meeting</div>
                    </button>

                    <button className="btn-secondary p-4 text-left">
                        <div className="text-2xl mb-2">⛪</div>
                        <div className="font-semibold">Browse Churches</div>
                        <div className="text-sm text-muted">Find nearby churches</div>
                    </button>

                    <button className="btn-secondary p-4 text-left">
                        <div className="text-2xl mb-2">🎉</div>
                        <div className="font-semibold">View Events</div>
                        <div className="text-sm text-muted">Upcoming activities</div>
                    </button>

                    <button className="btn-secondary p-4 text-left">
                        <div className="text-2xl mb-2">💰</div>
                        <div className="font-semibold">Make Donation</div>
                        <div className="text-sm text-muted">Support your church</div>
                    </button>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                <div className="text-center py-8 text-muted">
                    <p>No recent activity</p>
                    <p className="text-sm mt-2">Your appointments and events will appear here</p>
                </div>
            </div>
        </div>
    );
}
