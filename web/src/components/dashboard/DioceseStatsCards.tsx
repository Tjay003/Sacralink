import { useState, useEffect } from 'react';
import { Building2, Users, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatCard from './StatCard';

/**
 * DioceseStatsCards - Aggregate statistics across all churches (or one church)
 */

interface Props {
    selectedChurchId?: string | null;
}

export default function DioceseStatsCards({ selectedChurchId = null }: Props) {
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
    }, [selectedChurchId]); // re-fetch when church filter changes

    const fetchDioceseStats = async () => {
        try {
            setLoading(true);

            // 1. Total Churches (always diocese-wide)
            const { data: churchesData, error: churchesError } = await supabase
                .from('churches')
                .select('id, is_active');

            if (churchesError) throw churchesError;

            const totalChurches = churchesData?.length || 0;
            const activeChurches = churchesData?.filter(c => c.is_active).length || 0;

            // 2. Total Members — filtered by church if one is selected
            let membersQuery = supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            if (selectedChurchId) {
                membersQuery = membersQuery.eq('assigned_church_id', selectedChurchId);
            } else {
                // All Churches: count everyone (all users)
                // Remove the .not filter so we include all registered users
                membersQuery = supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });
            }

            const { count: totalMembers, error: membersError } = await membersQuery;
            if (membersError) throw membersError;

            // 3. Active Events — filtered by church if one is selected
            let eventsQuery = supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .gte('appointment_date', new Date().toISOString().split('T')[0]);

            if (selectedChurchId) {
                eventsQuery = eventsQuery.eq('church_id', selectedChurchId);
            }

            const { count: activeEvents, error: eventsError } = await eventsQuery;
            if (eventsError) throw eventsError;

            // 4. New Members (last 30 days) — filtered by church if one is selected
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let newMembersQuery = supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (selectedChurchId) {
                newMembersQuery = newMembersQuery.eq('assigned_church_id', selectedChurchId);
            }

            const { count: newMembers, error: newMembersError } = await newMembersQuery;
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
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
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
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-br"
                loading={loading}
            />

            {/* Total Members */}
            <StatCard
                title={selectedChurchId ? 'Church Members' : 'Total Members'}
                value={loading ? '...' : stats.totalMembers}
                icon={Users}
                trend={{
                    value: parseFloat(growthPercentage),
                    isUp: stats.newMembers > 0,
                    label: `${stats.newMembers} new this month`
                }}
                iconBgColor="bg-purple-100"
                iconColor="text-purple-600"
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-tr"
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
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-bl"
                loading={loading}
            />

            {/* Growth Rate (Hidden for now)
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
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-tl"
                loading={loading}
            /> */}
        </div>
    );
}
