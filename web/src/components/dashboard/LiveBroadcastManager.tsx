import { useState, useEffect } from 'react';
import { Radio, Flame, Check, AlertCircle, ExternalLink, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Church } from '../../types/database';

interface LiveBroadcastManagerProps {
    churchId: string;
}

export default function LiveBroadcastManager({ churchId }: LiveBroadcastManagerProps) {
    const [church, setChurch] = useState<Church | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [streamUrl, setStreamUrl] = useState('');
    const [streamTitle, setStreamTitle] = useState('');
    const [platform, setPlatform] = useState<'facebook' | 'youtube'>('youtube');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch initial church broadcast data
    useEffect(() => {
        if (!churchId) return;

        const fetchChurchData = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('churches')
                    .select('id, name, is_live, livestream_url, livestream_title, livestream_platform, candle_count, livestream_started_at')
                    .eq('id', churchId)
                    .single();

                if (error) throw error;
                if (data) {
                    setChurch(data as Church);
                    setIsLive(Boolean(data.is_live));
                    setStreamUrl(data.livestream_url || '');
                    setStreamTitle(data.livestream_title || '');
                    setPlatform((data.livestream_platform as 'facebook' | 'youtube') || 'youtube');
                }
            } catch (err: any) {
                console.error('Error fetching broadcast details:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchChurchData();

        // Realtime subscription for church stream changes
        const channel = supabase
            .channel(`church-broadcast:${churchId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'churches', filter: `id=eq.${churchId}` },
                (payload) => {
                    if (payload.new) {
                        const updated = payload.new as Church;
                        setChurch(updated);
                        setIsLive(Boolean(updated.is_live));
                        if (updated.livestream_url !== undefined) setStreamUrl(updated.livestream_url || '');
                        if (updated.livestream_title !== undefined) setStreamTitle(updated.livestream_title || '');
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [churchId]);

    // Handle Quick Live Toggle
    const handleToggleLive = async (newLiveState: boolean) => {
        setIsLive(newLiveState);
        setSaving(true);
        setFeedback(null);

        try {
            const updatePayload: any = {
                is_live: newLiveState,
                livestream_url: streamUrl.trim() || null,
                livestream_title: streamTitle.trim() || null,
                livestream_platform: platform,
                updated_at: new Date().toISOString(),
            };

            if (newLiveState) {
                updatePayload.livestream_started_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('churches')
                .update(updatePayload)
                .eq('id', churchId);

            if (error) throw error;

            setFeedback({
                type: 'success',
                message: newLiveState ? '🔴 Broadcast is now LIVE for all parishioners!' : '⚪ Broadcast stopped. Sanctuary in standby.',
            });
        } catch (err: any) {
            console.error('Error toggling live:', err);
            setIsLive(!newLiveState); // revert
            setFeedback({
                type: 'error',
                message: err.message || 'Failed to update live status.',
            });
        } finally {
            setSaving(false);
            setTimeout(() => setFeedback(null), 6000);
        }
    };

    // Save metadata without toggling
    const handleSaveMetadata = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFeedback(null);

        try {
            const { error } = await supabase
                .from('churches')
                .update({
                    livestream_url: streamUrl.trim() || null,
                    livestream_title: streamTitle.trim() || null,
                    livestream_platform: platform,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', churchId);

            if (error) throw error;

            setFeedback({
                type: 'success',
                message: 'Stream details saved successfully.',
            });
        } catch (err: any) {
            console.error('Error saving stream metadata:', err);
            setFeedback({
                type: 'error',
                message: err.message || 'Failed to save stream metadata.',
            });
        } finally {
            setSaving(false);
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    if (loading) {
        return (
            <div className="card p-6 flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="card p-6 space-y-5 border border-border shadow-sm">
            {/* Header with Live Status indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                        isLive
                            ? 'bg-red-500/15 border border-red-500/30 text-red-600 animate-pulse'
                            : 'bg-secondary-100 text-secondary-600 border border-border'
                    }`}>
                        <Radio className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-foreground">Live Broadcast Manager</h3>
                            {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-xs animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    LIVE NOW
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-600 border border-border">
                                    Standby / Offline
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted">
                            Broadcast Holy Mass directly to parishioners at zero hosting cost.
                        </p>
                    </div>
                </div>

                <a
                    href={`/churches/${churchId}#virtual-sanctuary`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary-50 hover:bg-white dark:hover:bg-secondary-800 text-xs font-medium text-foreground transition-colors group self-start sm:self-auto shadow-xs"
                >
                    <span>Preview Sanctuary</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
                </a>
            </div>

            {/* Quick Live Toggle Switch Banner */}
            <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${
                isLive
                    ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                    : 'bg-secondary-50 dark:bg-secondary-900/30 border-border'
            }`}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-600 animate-ping' : 'bg-secondary-400'}`} />
                    <div>
                        <p className="text-xs font-bold text-foreground">
                            {isLive ? 'Broadcasting to Virtual Sanctuary' : 'Stream is currently offline'}
                        </p>
                        <p className="text-[11px] text-muted">
                            {isLive
                                ? 'Parishioners can view and pray in realtime.'
                                : 'Toggle live when beginning your Facebook or YouTube stream.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={() => handleToggleLive(!isLive)}
                        disabled={saving || (!isLive && !streamUrl.trim())}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer ${
                            isLive
                                ? 'bg-secondary-900 hover:bg-black text-white'
                                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                        } disabled:opacity-50`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-secondary-400' : 'bg-white animate-ping'}`} />
                        <span>{isLive ? 'Stop Broadcast' : '🔴 Go Live Now'}</span>
                    </button>
                </div>
            </div>

            {/* Live Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-xl">
                    <span className="text-[11px] text-muted block">Candles Lit</span>
                    <div className="flex items-center gap-1.5 mt-1 font-bold text-foreground">
                        <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>{(church?.candle_count || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="p-3 bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-xl">
                    <span className="text-[11px] text-muted block">Platform</span>
                    <span className="font-bold text-foreground capitalize mt-1 block">
                        {platform} Live
                    </span>
                </div>

                <div className="p-3 bg-secondary-50/60 dark:bg-secondary-900/30 border border-border rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-muted block">Status</span>
                    <span className={`font-bold mt-1 block ${isLive ? 'text-red-600' : 'text-muted'}`}>
                        {isLive ? 'Transmitting' : 'Ready'}
                    </span>
                </div>
            </div>

            {/* Form Fields for URL and Title */}
            <form onSubmit={handleSaveMetadata} className="space-y-4 pt-1">
                <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Broadcast Title
                    </label>
                    <input
                        type="text"
                        value={streamTitle}
                        onChange={(e) => setStreamTitle(e.target.value)}
                        placeholder="e.g., Sunday 8:00 AM Solemn Mass • 23rd Sunday in Ordinary Time"
                        className="input w-full text-xs"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-foreground">
                            Livestream Video URL
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPlatform('youtube')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all border ${
                                    platform === 'youtube'
                                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900'
                                        : 'text-muted hover:text-foreground border-transparent'
                                }`}
                            >
                                YouTube
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlatform('facebook')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all border ${
                                    platform === 'facebook'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900'
                                        : 'text-muted hover:text-foreground border-transparent'
                                }`}
                            >
                                Facebook
                            </button>
                        </div>
                    </div>
                    <input
                        type="url"
                        value={streamUrl}
                        onChange={(e) => setStreamUrl(e.target.value)}
                        placeholder="e.g., https://youtube.com/watch?v=... or https://fb.watch/..."
                        className="input w-full text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted mt-1">
                        Paste the full video link or livestream share URL from YouTube or Facebook.
                    </p>
                </div>

                {feedback && (
                    <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300'
                            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
                    }`}>
                        {feedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                        <span>{feedback.message}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Stream Info'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
