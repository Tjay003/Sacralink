import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChurches } from '../../hooks/useChurches';
import {
    getAppointments,
    subscribeToAppointments,
    type HydratedAppointment as Appointment,
} from '../../lib/supabase/appointments';
import { getUserFavoriteChurchIds } from '../../lib/supabase/churchFavorites';
import UserGreetingBanner from '../../components/dashboard/user/UserGreetingBanner';
import UserQuickActions from '../../components/dashboard/user/UserQuickActions';
import UserNextAppointmentCard from '../../components/dashboard/user/UserNextAppointmentCard';
import UserOtherAppointmentsCard from '../../components/dashboard/user/UserOtherAppointmentsCard';
import UserHomeParishCard from '../../components/dashboard/user/UserHomeParishCard';
import UserAnnouncementsCard from '../../components/dashboard/user/UserAnnouncementsCard';
import DailyVerse from '../../components/dashboard/DailyVerse';
import ParishInquiryModal from '../../components/churches/ParishInquiryModal';

/**
 * UserDashboard - Simplified Bento-grid Dashboard for Parishioners / Users.
 * Designed with high legibility, clean light mode ("Apple meets The Vatican"),
 * and zero emojis (Lucide icons only).
 */
export default function UserDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { churches, loading: churchesLoading } = useChurches();

    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [favoriteChurchIds, setFavoriteChurchIds] = useState<string[]>([]);
    const [selectedChurchId, setSelectedChurchId] = useState<string | null>(() => {
        return localStorage.getItem('selectedChurchId') || null;
    });

    // Parish Inquiry Modal state
    const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
    const [inquiryChurchId, setInquiryChurchId] = useState<string | null>(null);
    const [inquiryChurchName, setInquiryChurchName] = useState<string | undefined>(undefined);

    // Active churches only (hide archived parishes from user dashboard)
    const activeChurches = churches.filter(c => c.status !== 'archived');

    // Fetch user favorite churches
    useEffect(() => {
        if (!profile?.id) return;
        let cancelled = false;

        async function loadFavorites() {
            try {
                const ids = await getUserFavoriteChurchIds(profile!.id);
                if (!cancelled) {
                    setFavoriteChurchIds(ids);
                }
            } catch (err) {
                console.error('Error loading favorite churches:', err);
            }
        }

        loadFavorites();

        return () => {
            cancelled = true;
        };
    }, [profile?.id]);

    // Synchronize and validate selectedChurchId against active churches or resolve fallback
    useEffect(() => {
        if (churchesLoading) return;

        // When no active churches are available
        if (activeChurches.length === 0) {
            if (selectedChurchId !== null) {
                setSelectedChurchId(null);
            }
            if (localStorage.getItem('selectedChurchId')) {
                localStorage.removeItem('selectedChurchId');
            }
            return;
        }

        const savedId = localStorage.getItem('selectedChurchId');
        const candidateId = selectedChurchId || savedId;

        if (candidateId) {
            const existsInActive = activeChurches.some(c => c.id === candidateId);
            if (!existsInActive) {
                // Orphaned ID (parish was deleted or archived): clear from localStorage & fallback
                localStorage.removeItem('selectedChurchId');
                const firstActiveFavorite = favoriteChurchIds.find(favId =>
                    activeChurches.some(c => c.id === favId)
                );
                const fallbackId = firstActiveFavorite || activeChurches[0]?.id || null;
                setSelectedChurchId(fallbackId);
                if (fallbackId) {
                    localStorage.setItem('selectedChurchId', fallbackId);
                }
            } else if (selectedChurchId !== candidateId) {
                setSelectedChurchId(candidateId);
            }
        } else {
            // No church currently selected: pick first active favorite, or first active church
            const firstActiveFavorite = favoriteChurchIds.find(favId =>
                activeChurches.some(c => c.id === favId)
            );
            const fallbackId = firstActiveFavorite || activeChurches[0]?.id || null;
            setSelectedChurchId(fallbackId);
            if (fallbackId) {
                localStorage.setItem('selectedChurchId', fallbackId);
            }
        }
    }, [churchesLoading, churches, favoriteChurchIds, selectedChurchId]);

    // Save selected church to localStorage
    const handleSelectChurch = useCallback((churchId: string) => {
        setSelectedChurchId(churchId);
        localStorage.setItem('selectedChurchId', churchId);
    }, []);

    // Fetch appointments for this user
    const fetchAppointments = useCallback(async () => {
        if (!profile?.id) return;

        try {
            const { data, error } = await getAppointments({
                userId: profile.id,
                upcomingOnly: false,
                excludeRejected: false,
                orderBy: 'appointment_date',
                ascending: true,
                limit: 10,
            });

            if (error) throw error;
            setAppointments(data || []);
        } catch (err) {
            console.error('Error fetching user appointments:', err);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchAppointments();

        if (!profile?.id) return;

        const unsubscribe = subscribeToAppointments({ userId: profile.id }, () => {
            fetchAppointments();
        });

        return () => {
            unsubscribe();
        };
    }, [profile?.id, fetchAppointments]);

    // Open Parish Office ticket / inquiry modal
    const handleOpenInquiry = (churchId: string, churchName?: string | null) => {
        setInquiryChurchId(churchId);
        setInquiryChurchName(churchName || undefined);
        setInquiryModalOpen(true);
    };

    const handleInquirySuccess = (conversationId: string) => {
        setInquiryModalOpen(false);
        navigate(`/messages?conversation=${conversationId}`);
    };

    // Find current home church object (handles empty churches or no selection cleanly)
    const selectedChurch = selectedChurchId
        ? (activeChurches.find(c => c.id === selectedChurchId) || null)
        : null;

    // Filter appointments into "Next Appointment" (hero) and "Other Appointments"
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingAppointments = appointments.filter(a => {
        const status = a.status as string;
        return a.appointment_date >= todayStr && status !== 'cancelled' && status !== 'completed' && status !== 'celebrated';
    });

    const nextAppointment = upcomingAppointments.length > 0
        ? upcomingAppointments[0]
        : (appointments.length > 0 ? appointments[0] : null);

    const otherAppointments = appointments.filter(a => a.id !== nextAppointment?.id);

    return (
        <div className="space-y-6">
            {/* 1. Full-width Liturgical Greeting Banner across the entire dashboard */}
            <UserGreetingBanner
                userName={profile?.full_name}
                churchName={selectedChurch?.name}
            />

            {/* Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Quick Actions, Next Appointment, Other Appointments */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 2. Quick Action Cards (Book, Schedules, Watch Live) */}
                    <UserQuickActions
                        churchId={selectedChurch?.id}
                    />

                    {/* 3. Your next appointment (State A highlight box, View details, Message Office) */}
                    <UserNextAppointmentCard
                        appointment={nextAppointment}
                        onMessageOffice={handleOpenInquiry}
                        homeChurchId={selectedChurch?.id}
                    />

                    {/* 4. Other appointments */}
                    <UserOtherAppointmentsCard
                        appointments={otherAppointments}
                    />

                    {/* 5. News and Announcements in row format aligned with the left column */}
                    <UserAnnouncementsCard
                        churchId={selectedChurch?.id}
                        churchName={selectedChurch?.name}
                    />
                </div>

                {/* Right Column: Home Parish & Daily Verse */}
                <div className="space-y-6">
                    {/* 6. My Home Parish Card with schedule and favorites dropdown */}
                    <UserHomeParishCard
                        church={selectedChurch}
                        allChurches={activeChurches}
                        favoriteChurchIds={favoriteChurchIds}
                        onSelectChurch={handleSelectChurch}
                    />

                    {/* 7. Daily Verse (Warm amber parchment card) */}
                    <DailyVerse variant="parchment" />
                </div>
            </div>

            {/* Parish Inquiry Modal */}
            {profile && (
                <ParishInquiryModal
                    isOpen={inquiryModalOpen}
                    onClose={() => setInquiryModalOpen(false)}
                    churchId={inquiryChurchId}
                    churchName={inquiryChurchName}
                    userId={profile.id}
                    parishOptions={activeChurches.map(c => ({ id: c.id, name: c.name }))}
                    defaultChurchId={selectedChurch?.id}
                    onSuccess={handleInquirySuccess}
                />
            )}
        </div>
    );
}
