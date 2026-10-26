import { useState, useEffect } from 'react';
import { Users, Calendar, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getDashboardAppointmentCounts } from '../../lib/supabase/appointments';
import StatCard from './StatCard';

interface ChurchStatsCardsProps {
    churchId: string | null;
}

/**
 * ChurchStatsCards - 4 KPI stat cards with interactive hover gradients matching DioceseStatsCards:
 * 1. Total Parishioners (purple icon, blue to-tr gradient)
 * 2. Pending Requests (yellow icon, amber to-br gradient)
 * 3. Scheduled Celebrations (blue icon, blue to-bl gradient)
 * 4. Services Completed (amber icon, blue to-tl gradient)
 */
export default function ChurchStatsCards({ churchId }: ChurchStatsCardsProps) {
    const [stats, setStats] = useState({
        members: 0,
        newMembers: 0,
        pending: 0,
        upcoming: 0,
        celebrated: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (churchId) {
            void fetchStats();
        }
    }, [churchId]);

    const fetchStats = async () => {
        if (!churchId) return;

        try {
            setLoading(true);

            // 1. Total Members & New Members (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [membersRes, newMembersRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_church_id', churchId).is('deleted_at', null),
                supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('assigned_church_id', churchId)
                    .gte('created_at', thirtyDaysAgo.toISOString()).is('deleted_at', null),
            ]);

            // 2 & 3. Pending & Upcoming Appointments
            const { pendingCount, upcomingApprovedCount } = await getDashboardAppointmentCounts(churchId);

            // 4. Completed Services (completed or approved)
            const { count: celebratedCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('church_id', churchId)
                .in('status', ['completed', 'approved']);

            setStats({
                members: membersRes.count || 0,
                newMembers: newMembersRes.count || 0,
                pending: pendingCount || 0,
                upcoming: upcomingApprovedCount || 0,
                celebrated: celebratedCount || 0,
            });
        } catch (err) {
            console.error('Error fetching church stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!churchId) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Total Parishioners */}
            <StatCard
                title="Total Parishioners"
                value={stats.members}
                icon={Users}
                trend={{
                    value: stats.newMembers,
                    isUp: true,
                    label: `${stats.newMembers} new this month`,
                }}
                iconBgColor="bg-purple-100"
                iconColor="text-purple-600"
                gradientFrom="from-purple-600"
                gradientTo="to-indigo-600"
                gradientDirection="to-tr"
                loading={loading}
            />

            {/* 2. Pending Requests */}
            <StatCard
                title="Pending Requests"
                value={stats.pending}
                icon={Calendar}
                trend={{
                    value: stats.pending,
                    isUp: false,
                    label: stats.pending > 0 ? 'Urgent attention' : 'All clear',
                }}
                iconBgColor="bg-emerald-100"
                iconColor="text-emerald-600"
                gradientFrom="from-emerald-600"
                gradientTo="to-teal-600"
                gradientDirection="to-br"
                loading={loading}
            />

            {/* 3. Scheduled Celebrations */}
            <StatCard
                title="Scheduled Celebrations"
                value={stats.upcoming}
                icon={Calendar}
                trend={{
                    value: stats.upcoming,
                    isUp: true,
                    label: 'Approved this week',
                }}
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                gradientFrom="from-blue-600"
                gradientTo="to-blue-500"
                gradientDirection="to-bl"
                loading={loading}
            />

            {/* 4. Services Completed */}
            <StatCard
                title="Services Completed"
                value={stats.celebrated}
                icon={Award}
                trend={{
                    value: stats.celebrated,
                    isUp: true,
                    label: 'Completed services',
                }}
                iconBgColor="bg-amber-100"
                iconColor="text-amber-600"
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-tl"
                loading={loading}
            />
        </div>
    );
}
