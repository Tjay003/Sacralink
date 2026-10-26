import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import { supabase } from '../../lib/supabase';
import { getDashboardAppointmentCounts, subscribeToAppointments } from '../../lib/supabase/appointments';
import UserDashboard from './UserDashboard';
import PriestDashboard from './PriestDashboard';
import ChurchAdminDashboard from './ChurchAdminDashboard';
import VolunteerDashboard from './VolunteerDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';
import UpcomingEventsTimeline from '../../components/dashboard/UpcomingEventsTimeline';
import DailyVerse from '../../components/dashboard/DailyVerse';
import StatCard from '../../components/dashboard/StatCard';
import { dashboardConfig } from '../../config/featureFlags';
import { mockTrendData } from '../../config/mockData';
import { Users, Building2, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

/**
 * DashboardPage - Main dashboard that shows different content based on user role
 * 
 * - 'user' role → UserDashboard (parishioner bookings, bookmarks, sacraments)
 * - 'priest' role → PriestDashboard (celebrant schedule, blackout, lectionary)
 * - 'church_admin' role → ChurchAdminDashboard (full parish ops, financials, staff attention)
 * - 'volunteer' role → VolunteerDashboard (liturgical header, livestream studio, announcements)
 * - 'super_admin' → SuperAdminDashboard (all-churches governance)
 */
export default function DashboardPage() {
    const { profile } = useAuth();
    const { churches } = useChurches();
    const [userCount, setUserCount] = useState(0);
    const [stats, setStats] = useState({
        pendingAppointments: 0,
        activeEvents: 0
    });

    // Fetch user count for admin dashboard
    useEffect(() => {
        if (profile?.role === 'super_admin') {
            fetchUserCount();
        }
        fetchDashboardStats();

        const unsubscribe = subscribeToAppointments(undefined, () => {
            fetchDashboardStats();
        });

        return () => {
            unsubscribe();
        };
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
            .select('*', { count: 'exact', head: true }).is('deleted_at', null);

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

            // Fetch real stats via appointments domain module
            const { pendingCount, upcomingApprovedCount } = await getDashboardAppointmentCounts();

            setStats({
                pendingAppointments: pendingCount,
                activeEvents: upcomingApprovedCount
            });

        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
        }
    };

    // Show user dashboard for normal users
    if (profile?.role === 'user') {
        return <UserDashboard />;
    }

    // Show priest dashboard for priests
    if (profile?.role === 'priest') {
        return <PriestDashboard churchId={profile.assigned_church_id || null} />;
    }

    // Show church admin dashboard for church admins
    if (profile?.role === 'church_admin') {
        return <ChurchAdminDashboard churchId={profile.assigned_church_id || null} />;
    }

    // Show dedicated volunteer dashboard for parish volunteers
    if (profile?.role === 'volunteer') {
        return <VolunteerDashboard churchId={profile.assigned_church_id || null} />;
    }

    // Show super admin dashboard for super_admin
    if (profile?.role === 'super_admin') {
        return <SuperAdminDashboard />;
    }

    // Generic fallback
    return (
        <div className="space-y-6">
            <div className="rounded-2xl shadow-sm p-6 bg-gradient-to-br from-blue-600 to-blue-400 text-white border-none">
                <h1 className="text-2xl font-bold mb-2">Welcome Back, {profile?.full_name?.split(' ')[0] || 'User'}!</h1>
                <p className="text-white/90 opacity-90">
                    You are logged in as <span className="font-semibold capitalize">{(profile?.role || 'user').replace('_', ' ')}</span>.
                    Here is what's happening today.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <UpcomingEventsTimeline />
                </div>
                <div className="space-y-6">
                    <DailyVerse />
                </div>
            </div>
        </div>
    );
}
