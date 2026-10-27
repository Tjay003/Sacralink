import { useState } from 'react';
import { AlertCircle, Bot, CheckCircle, XCircle, BookOpen, Building2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PriestDashboard from './PriestDashboard';
import ChurchHeader from '../../components/dashboard/ChurchHeader';
import ChurchStatsCards from '../../components/dashboard/ChurchStatsCards';
import ParishAttentionWidget from '../../components/dashboard/ParishAttentionWidget';
import ChurchDonationsSummaryCard from '../../components/dashboard/ChurchDonationsSummaryCard';
import ChurchAnnouncementsManagement from '../../components/dashboard/ChurchAnnouncementsManagement';
import LiveBroadcastManager from '../../components/dashboard/LiveBroadcastManager';
import RecentAppointmentsWidget from '../../components/dashboard/RecentAppointmentsWidget';
import RecentActivityWidget from '../../components/dashboard/RecentActivityWidget';
import AnnouncementForm from '../../components/announcements/AnnouncementForm';
import { isFeatureEnabled } from '../../config/featureFlags';
import { supabase } from '../../lib/supabase';

interface ChurchAdminDashboardProps {
    churchId: string | null;
}

export default function ChurchAdminDashboard({ churchId }: ChurchAdminDashboardProps) {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'operations' | 'schedule'>('operations');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    const isPriest = Boolean(profile?.is_priest);

    const isChurchAdmin = profile?.role === 'church_admin';
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

    const handleSyncAI = async () => {
        if (!churchId || isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');

        try {
            const { data, error } = await supabase.functions.invoke('sync-church-knowledge', {
                body: { churchId },
            });

            if (error) {
                let errorMsg = error.message;
                try {
                    const errorWithContext = error as { context?: { json?: () => Promise<{ error?: string; diagnostics?: string[] }> } };
                    const body = await errorWithContext.context?.json?.();
                    if (body?.error) errorMsg = body.error;
                    else if (body?.diagnostics) errorMsg = body.diagnostics.slice(-3).join(' | ');
                } catch { /* use original error */ }
                throw new Error(errorMsg);
            }

            setSyncStatus('success');
            setSyncMessage(`Synced ${data.chunksProcessed} knowledge chunks`);
            setLastSynced(new Date().toLocaleTimeString());
        } catch (err: unknown) {
            console.error('Sync error:', err);
            setSyncStatus('error');
            setSyncMessage(err instanceof Error ? err.message : 'Sync failed. Please try again.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 10000);
        }
    };

    if (!churchId && (!isPriest || activeTab !== 'schedule')) {
        return (
            <div className="space-y-6">
                {isPriest && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('operations')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                activeTab === 'operations'
                                    ? 'bg-primary text-white shadow-xs'
                                    : 'bg-white border border-border text-foreground hover:bg-secondary-50'
                            }`}
                        >
                            <Building2 className="w-4 h-4" />
                            Parish Operations
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('schedule')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                activeTab === 'schedule'
                                    ? 'bg-primary text-white shadow-xs'
                                    : 'bg-white border border-border text-foreground hover:bg-secondary-50'
                            }`}
                        >
                            <Calendar className="w-4 h-4 text-amber-500" />
                            My Celebrant Schedule
                        </button>
                    </div>
                )}
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-red-600 mb-4" />
                    <h3 className="text-lg font-semibold text-red-900 mb-2">No Church Assigned</h3>
                    <p className="text-sm text-red-700">
                        You are not currently assigned to a church. Please contact an administrator to be assigned to a parish.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isPriest && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('operations')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'operations'
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-white border border-border text-foreground hover:bg-secondary-50'
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Parish Operations
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'schedule'
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-white border border-border text-foreground hover:bg-secondary-50'
                        }`}
                    >
                        <Calendar className="w-4 h-4 text-amber-500" />
                        My Celebrant Schedule
                    </button>
                </div>
            )}

            {isPriest && activeTab === 'schedule' ? (
                <PriestDashboard churchId={churchId} />
            ) : (
                <div className="space-y-6">
                    {churchId && (
                        <>
                            <ChurchHeader
                                churchId={churchId}
                                onNewAnnouncement={() => setShowAnnouncementModal(true)}
                            />
                            <ChurchStatsCards churchId={churchId} />

                            {/* Top Row: Parish Attention */}
                            <div>
                                <ParishAttentionWidget churchId={churchId} />
                            </div>

                            {/* Row 2: Live Broadcast & AI Knowledge / Donations */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Left Column: 7 cols (Church Admin only) */}
                                {isChurchAdmin && (
                                    <div className="lg:col-span-7 space-y-6">
                                        <LiveBroadcastManager churchId={churchId} />
                                    </div>
                                )}

                                {/* Right Column: 5 cols if church admin, full width if super admin */}
                                <div className={`${isChurchAdmin ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-6`}>
                                    {/* 1. AI Parish Assistant */}
                                    {isFeatureEnabled('churchAiSync') && (
                                        <div className="bg-white border border-border rounded-2xl p-6 shadow-xs space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-border/70">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center border border-blue-100">
                                                        <Bot className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-serif text-lg font-bold text-foreground">AI parish assistant</h3>
                                                        <p className="text-xs text-secondary-500 font-medium">Knowledge base for parishioner questions</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Metrics Row */}
                                            <div className="space-y-2 py-1 text-xs">
                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span>Sections</span>
                                                    <span className="font-bold text-foreground">7</span>
                                                </div>
                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span>Last synced</span>
                                                    <span className="font-medium text-foreground">{lastSynced || 'Oct 13, 2026'}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-secondary-600">
                                                    <span>Status</span>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                        Needs a sync
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="space-y-2 pt-2">
                                                <button
                                                    id="sync-ai-knowledge-btn"
                                                    onClick={handleSyncAI}
                                                    disabled={isSyncing}
                                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                                                >
                                                    {isSyncing ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            <span>Syncing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Bot className="w-4 h-4" />
                                                            <span>Sync AI knowledge</span>
                                                        </>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/knowledge')}
                                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-secondary-50 text-foreground text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
                                                >
                                                    <BookOpen className="w-4 h-4 text-secondary-600" />
                                                    <span>Manage knowledge base</span>
                                                </button>
                                            </div>

                                            {syncStatus === 'success' && (
                                                <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                                                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                                    <span>{syncMessage}</span>
                                                </div>
                                            )}
                                            {syncStatus === 'error' && (
                                                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                                                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                                    <span>{syncMessage}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 2. Donations Summary Card (STRICTLY Church Admin only) */}
                                    {isChurchAdmin && (
                                        <ChurchDonationsSummaryCard churchId={churchId} />
                                    )}
                                </div>
                            </div>

                            {/* Row 3: Recent Sacrament Requests & Recent Activity (Equal Height & Aligned Baselines) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                                {isFeatureEnabled('churchRecentAppointments') ? (
                                    <>
                                        <div className="lg:col-span-7 flex flex-col">
                                            <RecentAppointmentsWidget churchId={churchId} limit={5} className="h-full" />
                                        </div>
                                        <div className="lg:col-span-5 flex flex-col">
                                            <RecentActivityWidget churchId={churchId} className="h-full" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="lg:col-span-12 flex flex-col">
                                        <RecentActivityWidget churchId={churchId} className="h-full" />
                                    </div>
                                )}
                            </div>

                            {/* Row 4: Parish Announcements & Bulletin Board (Full Width) */}
                            <ChurchAnnouncementsManagement churchId={churchId} />

                            {/* New Announcement Form Modal */}
                            {showAnnouncementModal && (
                                <AnnouncementForm
                                    type="church"
                                    churchId={churchId}
                                    onSuccess={() => setShowAnnouncementModal(false)}
                                    onCancel={() => setShowAnnouncementModal(false)}
                                />
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
