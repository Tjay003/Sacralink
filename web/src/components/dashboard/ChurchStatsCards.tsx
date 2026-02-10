import { useState, useEffect } from 'react';
import { Users, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import StatCard from './StatCard';

interface ChurchStatsCardsProps {
    churchId: string | null;
}

/**
 * ChurchStatsCards - Display church-specific statistics
 * 
 * Shows:
 * - Total Members (users assigned to this church)
 * - Pending Appointments
 * - Upcoming Events (approved future appointments)
 */
export default function ChurchStatsCards({ churchId }: ChurchStatsCardsProps) {
    const [stats, setStats] = useState({
        members: 0,
        pending: 0,
        upcoming: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (churchId) {
            fetchStats();
        }
    }, [churchId]);

    const fetchStats = async () => {
        if (!churchId) return;

        try {
            setLoading(true);

            // 1. Total Members
            const { count: memberCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_church_id', churchId);

            // 2. Pending Appointments
            const { count: pendingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('church_id', churchId)
                .eq('status', 'pending');

            // 3. Upcoming Events (approved + future)
            const { count: upcomingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('church_id', churchId)
                .eq('status', 'approved')
                .gte('appointment_date', new Date().toISOString().split('T')[0]);

            setStats({
                members: memberCount || 0,
                pending: pendingCount || 0,
                upcoming: upcomingCount || 0
            });
        } catch (err) {
            console.error('Error fetching church stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!churchId) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
                title="Total Members"
                value={stats.members}
                icon={Users}
                iconBgColor="bg-blue-100"
                iconColor="text-blue-600"
                gradientFrom="from-blue-600"
                gradientTo="to-blue-400"
                gradientDirection="to-br"
                loading={loading}
            />

            <StatCard
                title="Pending Appointments"
                value={stats.pending}
                icon={Calendar}
                iconBgColor="bg-yellow-100"
                iconColor="text-yellow-600"
                gradientFrom="from-yellow-600"
                gradientTo="to-yellow-400"
                gradientDirection="to-br"
                loading={loading}
            />

            <StatCard
                title="Upcoming Events"
                value={stats.upcoming}
                icon={TrendingUp}
                iconBgColor="bg-green-100"
                iconColor="text-green-600"
                gradientFrom="from-green-600"
                gradientTo="to-green-400"
                gradientDirection="to-br"
                loading={loading}
            />
        </div>
    );
}
