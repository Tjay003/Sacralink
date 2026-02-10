import { useState, useEffect } from 'react';
import { Building2, Users, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatCard from './StatCard';

/**
 * DioceseStatsCards - Aggregate statistics across all churches
 * 
 * Metrics:
 * - Total Churches (active/inactive)
 * - Total Members (all assigned users)
 * - Active Events (approved future appointments)
 * - Growth Rate (new members last 30 days)
 */
export default function DioceseStatsCards() {
    const [stats, setStats] = useState({
        totalChurches: 0,
        activeChurches: 0,
        totalMembers: 0,
        activeEvents: 0,
        newMembers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDioceseStats();
    }, []);

    const fetchDioceseStats = async () => {
        try {
            setLoading(true);

            // 1. Total Churches (with active count)
            const { data: churchesData, error: churchesError } = await supabase
                .from('churches')
                .select('id, status');

            if (churchesError) throw churchesError;

            const totalChurches = churchesData?.length || 0;
            const activeChurches = churchesData?.filter(c => c.status === 'active').length || 0;

            // 2. Total Members (users assigned to a church)
            const { count: totalMembers, error: membersError } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .not('assigned_church_id', 'is', null);

            if (membersError) throw membersError;

            // 3. Active Events (approved appointments in the future)
            const { count: activeEvents, error: eventsError } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gte('appointment_date', new Date().toISOString().split('T')[0]);

            if (eventsError) throw eventsError;

            // 4. New Members (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count: newMembers, error: newMembersError } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .not('assigned_church_id', 'is', null)
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (newMembersError) throw newMembersError;

            setStats({
                totalChurches,
                activeChurches,
                totalMembers: totalMembers || 0,
                activeEvents: activeEvents || 0,
                newMembers: newMembers || 0,
            });

        } catch (err) {
            console.error('Error fetching diocese stats:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate growth percentage
    const growthPercentage = stats.totalMembers > 0
        ? ((stats.newMembers / stats.totalMembers) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Churches */}
            <StatCard
                title="Total Churches"
                value={loading ? '...' : stats.totalChurches}
                icon={Building2}
                trend={{
                    value: stats.activeChurches,
                    isUp: true,
                    label: `${stats.activeChurches} active`
                }}
                iconBgColor="bg-purple-100"
                iconColor="text-purple-600"
                gradientFrom="from-blue-900"
                gradientTo="to-blue-800"
                loading={loading}
            />

            {/* Total Members */}
            <StatCard
                title="Total Members"
                value={loading ? '...' : stats.totalMembers}
                icon={Users}
                trend={{
                    value: parseFloat(growthPercentage),
                    isUp: stats.newMembers > 0,
                    label: `${stats.newMembers} new this month`
                }}
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                gradientFrom="from-blue-900"
                gradientTo="to-blue-800"
                loading={loading}
            />

            {/* Active Events */}
            <StatCard
                title="Active Events"
                value={loading ? '...' : stats.activeEvents}
                icon={Calendar}
                trend={{
                    value: 0,
                    isUp: true,
                    label: 'Upcoming appointments'
                }}
                iconBgColor="bg-yellow-100"
                iconColor="text-yellow-600"
                gradientFrom="from-blue-900"
                gradientTo="to-blue-800"
                loading={loading}
            />

            {/* Growth Rate */}
            <StatCard
                title="Growth Rate"
                value={loading ? '...' : `${growthPercentage}%`}
                icon={TrendingUp}
                trend={{
                    value: parseFloat(growthPercentage),
                    isUp: stats.newMembers > 0,
                    label: 'Last 30 days'
                }}
                iconBgColor="bg-emerald-100"
                iconColor="text-emerald-600"
                gradientFrom="from-blue-900"
                gradientTo="to-blue-800"
                loading={loading}
            />
        </div>
    );
}
