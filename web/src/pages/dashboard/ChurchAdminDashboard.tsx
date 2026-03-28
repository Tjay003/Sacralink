import { useState } from 'react';
import { AlertCircle, Bot, CheckCircle, XCircle } from 'lucide-react';
import { SystemAnnouncementsBanner } from '../../components/announcements';
import ChurchHeader from '../../components/dashboard/ChurchHeader';
import ChurchStatsCards from '../../components/dashboard/ChurchStatsCards';
import ChurchAnnouncementsManagement from '../../components/dashboard/ChurchAnnouncementsManagement';
import RecentAppointmentsWidget from '../../components/dashboard/RecentAppointmentsWidget';
import DailyVerse from '../../components/dashboard/DailyVerse';
import { isFeatureEnabled } from '../../config/featureFlags';
import { supabase } from '../../lib/supabase';

interface ChurchAdminDashboardProps {
    churchId: string | null;
}

export default function ChurchAdminDashboard({ churchId }: ChurchAdminDashboardProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    const handleSyncAI = async () => {
        if (!churchId || isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');

        try {
            const { data, error } = await supabase.functions.invoke('sync-church-knowledge', {
                body: { churchId },
            });

            if (error) {
                // Extract detailed error from the response body
                let errorMsg = error.message;
                try {
                    const body = await (error as any).context?.json?.();
                    if (body?.error) errorMsg = body.error;
                    else if (body?.diagnostics) errorMsg = body.diagnostics.slice(-3).join(' | ');
                } catch { /* use original error */ }
                throw new Error(errorMsg);
            }

            setSyncStatus('success');
            setSyncMessage(`Synced ${data.chunksProcessed} knowledge chunks`);
            setLastSynced(new Date().toLocaleTimeString());
        } catch (err: any) {
            console.error('Sync error:', err);
            setSyncStatus('error');
            setSyncMessage(err.message || 'Sync failed. Please try again.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 10000);
        }
    };

    if (!churchId) {
        return (
            <div className="space-y-6">
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
            <SystemAnnouncementsBanner />
            <ChurchHeader churchId={churchId} />
            <ChurchStatsCards churchId={churchId} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    <ChurchAnnouncementsManagement churchId={churchId} />
                    {isFeatureEnabled('churchRecentAppointments') && (
                        <RecentAppointmentsWidget churchId={churchId} limit={5} />
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <DailyVerse />

                    {/* AI Knowledge Sync */}
                    <div className="bg-card border rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Bot className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-foreground">AI Parish Assistant</h3>
                        </div>
                        <p className="text-xs text-muted mb-4 leading-relaxed">
                            Sync your church data so the AI chatbot can accurately answer parishioner questions.
                        </p>

                        <button
                            id="sync-ai-knowledge-btn"
                            onClick={handleSyncAI}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                            {isSyncing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <Bot className="w-4 h-4" />
                                    Sync AI Knowledge Base
                                </>
                            )}
                        </button>

                        {syncStatus === 'success' && (
                            <div className="mt-3 flex items-start gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-green-700">{syncMessage}</p>
                            </div>
                        )}
                        {syncStatus === 'error' && (
                            <div className="mt-3 flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-red-700">{syncMessage}</p>
                            </div>
                        )}
                        {lastSynced && (
                            <p className="text-xs text-muted mt-2 text-center">Last synced at {lastSynced}</p>
                        )}
                    </div>

                    {/* Quick Links */}
                    {isFeatureEnabled('churchQuickLinks') && (
                        <div className="bg-card border rounded-lg p-6">
                            <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
                            <div className="space-y-2">
                                <a
                                    href={`/churches/${churchId}`}
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    📍 My Church Details
                                </a>
                                <a
                                    href="/appointments"
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    📅 All Appointments
                                </a>
                                <a
                                    href="/donations"
                                    className="block w-full text-left px-4 py-3 bg-background border rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                                >
                                    💝 Donations
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
