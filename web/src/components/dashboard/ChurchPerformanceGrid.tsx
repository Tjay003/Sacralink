import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChurchPerformance {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    memberCount: number;
    eventCount: number;
}

/**
 * ChurchPerformanceGrid - Grid of church cards showing comparative performance
 * 
 * Features:
 * - Shows all churches with key metrics
 * - Sorted by member count (descending)
 * - "View Dashboard" button for each church
 * - Status badges (Active/Inactive)
 */
export default function ChurchPerformanceGrid() {
    const navigate = useNavigate();
    const [churches, setChurches] = useState<ChurchPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChurchPerformance();
    }, []);

    const fetchChurchPerformance = async () => {
        try {
            setLoading(true);

            // Fetch all churches
            const { data: churchesData, error: churchesError } = await supabase
                .from('churches')
                .select('id, name, status');

            if (churchesError) throw churchesError;

            // Fetch member counts for each church
            const performanceData: ChurchPerformance[] = await Promise.all(
                (churchesData || []).map(async (church) => {
                    // Count members
                    const { count: memberCount } = await supabase
                        .from('profiles')
                        .select('*', { count: 'exact', head: true })
                        .eq('assigned_church_id', church.id);

                    // Count approved future events
                    const { count: eventCount } = await supabase
                        .from('appointments')
                        .select('*', { count: 'exact', head: true })
                        .eq('church_id', church.id)
                        .eq('status', 'approved')
                        .gte('appointment_date', new Date().toISOString().split('T')[0]);

                    return {
                        id: church.id,
                        name: church.name,
                        status: church.status as 'active' | 'inactive',
                        memberCount: memberCount || 0,
                        eventCount: eventCount || 0,
                    };
                })
            );

            // Sort by member count (descending)
            performanceData.sort((a, b) => b.memberCount - a.memberCount);

            setChurches(performanceData);
        } catch (err) {
            console.error('Error fetching church performance:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-card border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 text-foreground">Church Performance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="p-4 bg-muted rounded-lg animate-pulse">
                            <div className="h-5 bg-muted-foreground/20 rounded w-2/3 mb-3" />
                            <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
                            <div className="h-4 bg-muted-foreground/20 rounded w-1/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (churches.length === 0) {
        return (
            <div className="bg-card border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 text-foreground">Church Performance</h2>
                <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No churches found</p>
                    <button
                        onClick={() => navigate('/churches')}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                        Add Your First Church
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border rounded-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Church Performance</h2>
                    <p className="text-sm text-muted-foreground">Comparative metrics across all parishes</p>
                </div>
                <button
                    onClick={() => navigate('/churches')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                    Manage All
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            {/* Church Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {churches.map((church) => (
                    <div
                        key={church.id}
                        className="p-4 bg-background border rounded-lg hover:shadow-md transition-shadow"
                    >
                        {/* Church Name & Status */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Building2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                                <h3 className="font-semibold text-foreground truncate">{church.name}</h3>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${church.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                {church.status}
                            </span>
                        </div>

                        {/* Metrics */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                <span>{church.memberCount} member{church.memberCount !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <span>{church.eventCount} active event{church.eventCount !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* View Dashboard Button */}
                        <button
                            onClick={() => navigate(`/dashboard?church=${church.id}`)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            View Dashboard
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
