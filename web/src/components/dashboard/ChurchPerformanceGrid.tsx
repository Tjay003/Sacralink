import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Church, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../ui/StatusBadge';
import { getDashboardAppointmentCounts } from '../../lib/supabase/appointments';

interface ChurchPerformance {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    isVerified: boolean;
    memberCount: number;
    eventCount: number;
    imageUrl?: string | null;
}

interface ChurchPerformanceGridProps {
    onSelectChurch?: (churchId: string | null) => void;
}

/**
 * ChurchPerformanceThumbnail - Displays parish photo with graceful fallback to church icon
 */
function ChurchPerformanceThumbnail({ imageUrl, churchName }: { imageUrl?: string | null; churchName: string }) {
    const [imageError, setImageError] = useState(false);

    if (imageUrl && !imageError) {
        return (
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-blue-50 border border-blue-100 flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <img
                    src={imageUrl}
                    alt={churchName}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                    loading="lazy"
                />
            </div>
        );
    }

    return (
        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <Church className="w-5 h-5 text-primary" />
        </div>
    );
}

/**
 * ChurchPerformanceGrid - Grid of parish cards showing comparative performance
 * 
 * Aligned with SacraLink Vatican & Apple aesthetic:
 * - Editorial serif header with "All parishes →" navigation
 * - Parish photo thumbnail with soft-blue church icon fallback
 * - Modern 2-tile metric display (Members, Appointments)
 * - Badges: Sacred Gold for "Verified" parishes, Emerald for "Active" parishes
 * - Strict financial privacy: NO donation or giving metrics
 * - "View Dashboard" action switches the all-churches view to the selected parish dashboard
 */
export default function ChurchPerformanceGrid({ onSelectChurch }: ChurchPerformanceGridProps = {}) {
    const navigate = useNavigate();
    const [churches, setChurches] = useState<ChurchPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChurchPerformance();
    }, []);

    const fetchChurchPerformance = async () => {
        try {
            setLoading(true);

            // Fetch all churches with status, active state, and featured photo
            const { data: churchesData, error: churchesError } = await supabase
                .from('churches')
                .select('id, name, is_active, status, featured_image_url');

            if (churchesError) throw churchesError;

            // Fetch member counts, appointment counts, and fallback gallery image if needed
            const performanceData: ChurchPerformance[] = await Promise.all(
                (churchesData || []).map(async (church) => {
                    // Count members registered under this church
                    const memberCountPromise = supabase
                        .from('profiles')
                        .select('*', { count: 'exact', head: true })
                        .eq('assigned_church_id', church.id).is('deleted_at', null);

                    // Count approved future appointments/events via appointments domain module
                    const appointmentCountPromise = getDashboardAppointmentCounts(church.id);

                    // If featured_image_url is not set, attempt to fetch the first image from church_images
                    let resolvedImageUrl = church.featured_image_url || null;
                    if (!resolvedImageUrl) {
                        try {
                            const { data: galleryImages } = await supabase
                                .from('church_images')
                                .select('image_url')
                                .eq('church_id', church.id)
                                .order('display_order', { ascending: true })
                                .limit(1);

                            if (galleryImages && galleryImages.length > 0 && galleryImages[0].image_url) {
                                resolvedImageUrl = galleryImages[0].image_url;
                            }
                        } catch {
                            // Fallback gracefully if church_images table is inaccessible
                        }
                    }

                    const [{ count: memberCount }, { upcomingApprovedCount }] = await Promise.all([
                        memberCountPromise,
                        appointmentCountPromise,
                    ]);

                    const isVerified = church.status === 'verified_active';

                    return {
                        id: church.id,
                        name: church.name,
                        status: church.is_active ? 'active' : 'inactive' as 'active' | 'inactive',
                        isVerified,
                        memberCount: memberCount || 0,
                        eventCount: upcomingApprovedCount,
                        imageUrl: resolvedImageUrl,
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
            <div className="space-y-4">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                        <div className="h-7 w-48 bg-secondary-100 rounded-lg animate-pulse" />
                        <div className="h-4 w-64 bg-secondary-100 rounded-md animate-pulse" />
                    </div>
                    <div className="h-5 w-24 bg-secondary-100 rounded-md animate-pulse" />
                </div>

                {/* Cards Skeleton Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="bg-white border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between animate-pulse"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-11 h-11 rounded-2xl bg-secondary-100" />
                                        <div className="space-y-1.5 min-w-0">
                                            <div className="h-4 w-32 bg-secondary-200 rounded" />
                                            <div className="h-3 w-20 bg-secondary-100 rounded" />
                                        </div>
                                    </div>
                                    <div className="h-5 w-14 bg-secondary-100 rounded-full" />
                                </div>

                                <div className="grid grid-cols-2 gap-3 my-4">
                                    <div className="p-3 rounded-xl bg-secondary-50 border border-border/50 h-16" />
                                    <div className="p-3 rounded-xl bg-secondary-50 border border-border/50 h-16" />
                                </div>
                            </div>

                            <div className="h-10 bg-secondary-100 rounded-xl w-full mt-2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (churches.length === 0) {
        return (
            <div className="bg-white border border-border/80 rounded-2xl p-8 sm:p-12 shadow-xs text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary mx-auto mb-4 shadow-2xs">
                    <Church className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground tracking-tight mb-1">
                    No parishes registered yet
                </h3>
                <p className="text-sm text-secondary-500 max-w-md mx-auto mb-6">
                    Connect and approve parish applications to begin monitoring community growth and liturgy appointments.
                </p>
                <button
                    onClick={() => navigate('/churches')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                >
                    <span>Manage Parishes</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                    <h2 className="font-serif text-2xl font-bold text-foreground tracking-tight">
                        Parish performance
                    </h2>
                    <p className="text-xs sm:text-sm text-secondary-500 font-medium">
                        Live parish engagement, community members, and upcoming sacrament appointments
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/churches')}
                    className="text-sm font-semibold text-primary hover:text-blue-700 inline-flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                >
                    <span>All parishes</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>

            {/* Parish Performance Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {churches.map((church) => {
                    const isActive = church.status === 'active';

                    return (
                        <div
                            key={church.id}
                            className="bg-white border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                            {/* Card Top */}
                            <div>
                                {/* Row 1: Icon, Name, and Status Badge */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ChurchPerformanceThumbnail
                                            imageUrl={church.imageUrl}
                                            churchName={church.name}
                                        />
                                        <div className="min-w-0">
                                            <h3
                                                className="font-bold text-foreground text-base tracking-tight truncate"
                                                title={church.name}
                                            >
                                                {church.name}
                                            </h3>
                                            <p className="text-xs text-secondary-500 font-medium truncate">
                                                Parish community
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Badge: Gold if verified, Green if active, Gray if inactive */}
                                    <StatusBadge domain="church" status={church.isVerified ? 'verified_active' : isActive ? 'active' : 'inactive'} />
                                 </div>

                                 {/* Metric Tiles (Strictly members & appointments; zero financial metrics) */}
                                 <div className="grid grid-cols-2 gap-3 my-4">
                                     {/* Tile 1: Members */}
                                     <div className="p-3 rounded-xl bg-secondary-50/70 border border-border/60 flex flex-col justify-center">
                                         <span className="text-lg font-bold text-foreground leading-tight">
                                             {church.memberCount.toLocaleString()}
                                         </span>
                                         <span className="text-xs font-medium text-secondary-500 mt-0.5">
                                             Members
                                         </span>
                                     </div>

                                     {/* Tile 2: Appointments */}
                                     <div className="p-3 rounded-xl bg-secondary-50/70 border border-border/60 flex flex-col justify-center">
                                         <span className="text-lg font-bold text-foreground leading-tight">
                                             {church.eventCount.toLocaleString()}
                                         </span>
                                         <span className="text-xs font-medium text-secondary-500 mt-0.5">
                                             Appointments
                                         </span>
                                     </div>
                                 </div>
                            </div>

                            {/* Card Bottom: View Dashboard CTA (Switches all-churches view to this parish) */}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onSelectChurch) {
                                            onSelectChurch(church.id);
                                        } else {
                                            navigate(`/dashboard?church=${church.id}`);
                                        }
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                                >
                                    <span>View Dashboard</span>
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
