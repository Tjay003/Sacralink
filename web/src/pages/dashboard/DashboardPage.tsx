import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import UserDashboard from './UserDashboard';

/**
 * DashboardPage - Main dashboard that shows different content based on user role
 * 
 * - 'user' role → UserDashboard (limited features)
 * - 'admin' and 'super_admin' → Admin dashboard (full features with stats)
 */
export default function DashboardPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { churches } = useChurches();
    const [userCount, setUserCount] = useState(0);

    // Fetch user count for admin dashboard
    useEffect(() => {
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
            fetchUserCount();
        }
    }, [profile]);

    const fetchUserCount = async () => {
        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        setUserCount(count || 0);
    };

    // Show user dashboard for normal users
    if (profile?.role === 'user') {
        return <UserDashboard />;
    }

    // Show admin dashboard for admin and super_admin
    return (
        <div className="space-y-6">
            {/* Admin Dashboard */}
            <div className="card p-6">
                <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
                <p className="text-muted">
                    Welcome, {profile?.full_name}! You have {profile?.role} access.
                </p>
            </div>

            {/* Admin Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Total Users</p>
                            <p className="text-2xl font-bold">{userCount}</p>
                        </div>
                        <div className="text-4xl">👥</div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Total Churches</p>
                            <p className="text-2xl font-bold">{churches.length}</p>
                        </div>
                        <div className="text-4xl">⛪</div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Pending Appointments</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                        <div className="text-4xl">📅</div>
                    </div>
                </div>

                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted">Active Events</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                        <div className="text-4xl">🎉</div>
                    </div>
                </div>
            </div>

            {/* Admin Quick Actions */}
            <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4">Admin Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/users')}
                        className="btn-primary p-4 text-left"
                    >
                        <div className="text-2xl mb-2">👥</div>
                        <div className="font-semibold">Manage Users</div>
                        <div className="text-sm opacity-80">View and edit users</div>
                    </button>

                    <button
                        onClick={() => navigate('/churches')}
                        className="btn-primary p-4 text-left"
                    >
                        <div className="text-2xl mb-2">⛪</div>
                        <div className="font-semibold">Manage Churches</div>
                        <div className="text-sm opacity-80">Add or edit churches</div>
                    </button>

                    <button
                        onClick={() => navigate('/appointments')}
                        className="btn-primary p-4 text-left"
                    >
                        <div className="text-2xl mb-2">📅</div>
                        <div className="font-semibold">View Appointments</div>
                        <div className="text-sm opacity-80">Approve requests</div>
                    </button>

                    <button className="btn-primary p-4 text-left">
                        <div className="text-2xl mb-2">📊</div>
                        <div className="font-semibold">View Reports</div>
                        <div className="text-sm opacity-80">Analytics & insights</div>
                    </button>
                </div>
            </div>
        </div>
    );
}
