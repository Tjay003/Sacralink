import { useState, useEffect } from 'react';
import { Building2, Users } from 'lucide-react';
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
                .select('*', { count: 'exact', head: true }).is('deleted_at', null);

            if (selectedChurchId) {
                membersQuery = membersQuery.eq('assigned_church_id', selectedChurchId);
            } else {
                // All Churches: count everyone (all users)
                // Remove the .not filter so we include all registered users
                membersQuery = supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true }).is('deleted_at', null);
            }

            const { count: totalMembers, error: membersError } = await membersQuery;
            if (membersError) throw membersError;

            // 3. New Members (last 30 days) — filtered by church if one is selected
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let newMembersQuery = supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString()).is('deleted_at', null);

            if (selectedChurchId) {
                newMembersQuery = newMembersQuery.eq('assigned_church_id', selectedChurchId);
            }

            const { count: newMembers, error: newMembersError } = await newMembersQuery;
            if (newMembersError) throw newMembersError;

            setStats({
                totalChurches,
                activeChurches,
                totalMembers: totalMembers || 0,
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                gradientTo="to-blue-500"
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
                gradientFrom="from-purple-600"
                gradientTo="to-indigo-600"
                gradientDirection="to-tr"
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
                gradientFrom="from-purple-600"
                gradientTo="to-blue-500"
                gradientDirection="to-tl"
                loading={loading}
            /> */}
        </div>
    );
}
