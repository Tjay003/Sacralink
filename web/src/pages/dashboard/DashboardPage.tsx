import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import UserDashboard from './UserDashboard';
import UpcomingEventsTimeline from '../../components/dashboard/UpcomingEventsTimeline';
import DailyVerse from '../../components/dashboard/DailyVerse';
import StatCard from '../../components/dashboard/StatCard';
import { dashboardConfig } from '../../config/featureFlags';
import { mockTrendData } from '../../config/mockData';
import { Users, Building2, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

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
    const [stats, setStats] = useState({
        pendingAppointments: 0,
        activeEvents: 0
    });

    // Fetch user count for admin dashboard
    useEffect(() => {
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
            fetchUserCount();
        }
        fetchDashboardStats();
    }, [profile]);

    const fetchUserCount = async () => {
        // Use mock data if enabled
        if (dashboardConfig.useMockData) {
            setUserCount(dashboardConfig.mockData.totalUsers);
            return;
        }

        // Fetch real data from Supabase
        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        setUserCount(count || 0);
    };

    const fetchDashboardStats = async () => {
        try {
            // Use mock data if enabled
            if (dashboardConfig.useMockData) {
                setStats({
                    pendingAppointments: dashboardConfig.mockData.pendingRequests,
                    activeEvents: dashboardConfig.mockData.upcomingAppointments
                });
                return;
            }

            // Fetch real data from Supabase
            // 1. Pending Appointments (RLS filtered)
            const { count: pendingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // 2. Active Events (Mass Schedules count for now, or events if we had them)
            // For now, let's just count total mass schedules across accessible churches
            // Since mass_schedules doesn't have RLS that filters by church assignment deeply in a simple count query without join
            // We'll trust the RLS policies on a joined query or simplistic approach
            // Actually, we can just query mass_schedules directly if policies allow, but let's be safe
            // and act as if "Active Events" = "Upcoming Approved Appointments" + "Regular Masses"
            // For simplicity in this iteration: Count of "Approved" appointments in future
            const { count: activeCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gte('appointment_date', new Date().toISOString());

            setStats({
                pendingAppointments: pendingCount || 0,
                activeEvents: activeCount || 0
            });

        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        }
    };

    // Show user dashboard for normal users
    if (profile?.role === 'user') {
        return <UserDashboard />;
    }

    // Show admin dashboard for admin, super_admin, church_admin, and volunteer
    return (
        <div className="space-y-6">
            {/* Admin Dashboard Header */}
            <div className="rounded-lg shadow-sm p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white border-none">
                <h1 className="text-2xl font-bold mb-2">Welcome Back, {profile?.full_name?.split(' ')[0] || 'User'}!</h1>
                <p className="text-white/90 opacity-90">
                    You are logged in as <span className="font-semibold capitalize">{profile?.role.replace('_', ' ')}</span>.
                    Here is what's happening today.
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Users - Hidden for Church Admin & Volunteer */}
                {profile?.role !== 'church_admin' && profile?.role !== 'volunteer' && (
                    <StatCard
                        title="Total Users"
                        value={dashboardConfig.useMockData ? mockTrendData.totalUsers.value : userCount}
                        icon={Users}
                        trend={mockTrendData.totalUsers.trend}
                        iconBgColor="bg-blue-100"
                        iconColor="text-blue-600"
                        gradientFrom="from-blue-600"
                        gradientTo="to-blue-400"
                        gradientDirection="to-br"
                    />
                )}

                {/* Total Churches - Hidden for Church Admin & Volunteer */}
                {profile?.role !== 'church_admin' && profile?.role !== 'volunteer' && (
                    <StatCard
                        title="Total Churches"
                        value={dashboardConfig.useMockData ? mockTrendData.totalChurches.value : churches.length}
                        icon={Building2}
                        trend={mockTrendData.totalChurches.trend}
                        iconBgColor="bg-purple-100"
                        iconColor="text-purple-600"
                        gradientFrom="from-blue-600"
                        gradientTo="to-blue-400"
                        gradientDirection="to-tr"
                    />
                )}

                {/* Pending Requests */}
                <StatCard
                    title="Pending Requests"
                    value={dashboardConfig.useMockData ? mockTrendData.pendingRequests.value : stats.pendingAppointments}
                    icon={CalendarIcon}
                    trend={mockTrendData.pendingRequests.trend}
                    iconBgColor="bg-yellow-100"
                    iconColor="text-yellow-600"
                    gradientFrom="from-blue-600"
                    gradientTo="to-blue-400"
                    gradientDirection="to-bl"
                />

                {/* Upcoming Events */}
                <StatCard
                    title="Upcoming Events"
                    value={dashboardConfig.useMockData ? mockTrendData.upcomingEvents.value : stats.activeEvents}
                    icon={TrendingUp}
                    trend={mockTrendData.upcomingEvents.trend}
                    iconBgColor="bg-emerald-100"
                    iconColor="text-emerald-600"
                    gradientFrom="from-blue-600"
                    gradientTo="to-blue-400"
                    gradientDirection="to-tl"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column (2/3): Upcoming Events */}
                <div className="lg:col-span-2 space-y-6">
                    <UpcomingEventsTimeline />
                </div>

                {/* Right Column (1/3): Quick Actions & Verse */}
                <div className="space-y-6">
                    <DailyVerse />

                    {/* Quick Actions - Controlled by dashboardConfig */}
                    {dashboardConfig.showQuickActions && (
                        <div className="card p-6">
                            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                            <div className="space-y-3">
                                {profile?.role !== 'volunteer' && (
                                    <button
                                        onClick={() => navigate('/users')}
                                        className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                    >
                                        <div className="bg-blue-100 p-2 rounded-full mr-3">
                                            <span className="text-lg">👥</span>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">Manage Users</div>
                                            <div className="text-xs text-muted">View and edit user roles</div>
                                        </div>
                                    </button>
                                )}

                                {profile?.role === 'volunteer' && profile.assigned_church_id && (
                                    <button
                                        onClick={() => navigate(`/churches/${profile.assigned_church_id}`)}
                                        className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                    >
                                        <div className="bg-purple-100 p-2 rounded-full mr-3">
                                            <span className="text-lg">⛪</span>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">My Church</div>
                                            <div className="text-xs text-muted">Update church details</div>
                                        </div>
                                    </button>
                                )}

                                {profile?.role !== 'volunteer' && (
                                    <button
                                        onClick={() => navigate('/churches')}
                                        className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                    >
                                        <div className="bg-purple-100 p-2 rounded-full mr-3">
                                            <span className="text-lg">⛪</span>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm">Manage Churches</div>
                                            <div className="text-xs text-muted">AAdd or edit parishes</div>
                                        </div>
                                    </button>
                                )}

                                <button
                                    onClick={() => navigate('/appointments')}
                                    className="w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 text-left"
                                >
                                    <div className="bg-yellow-100 p-2 rounded-full mr-3">
                                        <span className="text-lg">📅</span>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">Appointments</div>
                                        <div className="text-xs text-muted">Review pending requests</div>
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
