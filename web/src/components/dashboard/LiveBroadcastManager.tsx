import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Check, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../ui/StatusBadge';
import type { Church } from '../../types/database';

interface LiveBroadcastManagerProps {
    churchId: string;
}

interface ChurchLivestreamUpdatePayload {
    is_live?: boolean;
    livestream_url?: string | null;
    livestream_title?: string | null;
    livestream_platform?: 'facebook' | 'youtube';
    livestream_started_at?: string;
    updated_at?: string;
}

/**
 * Extract embed URL from YouTube or Facebook links for optional player preview
 */
function parseStreamEmbed(url?: string | null): string | null {
    if (!url || !url.trim()) return null;
    const clean = url.trim();

    // Direct iframe src extraction
    const iframeSrcMatch = clean.match(/src=["']([^"']+)["']/i);
    if (iframeSrcMatch && iframeSrcMatch[1]) {
        return iframeSrcMatch[1];
    }

    // YouTube formats
    const ytWatch = clean.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i);
    if (ytWatch && ytWatch[1]) {
        return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    }

    // Direct YouTube 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
        return `https://www.youtube-nocookie.com/embed/${clean}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    }

    // Facebook formats
    if (clean.includes('facebook.com') || clean.includes('fb.watch') || clean.includes('fb.me')) {
        const encoded = encodeURIComponent(clean);
        return `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false&autoplay=true&mute=0&allowfullscreen=true`;
    }

    return null;
}

export default function LiveBroadcastManager({ churchId }: LiveBroadcastManagerProps) {
    const navigate = useNavigate();
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
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                console.error('Error fetching broadcast details:', message);
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
                        if (updated.livestream_platform) setPlatform(updated.livestream_platform as 'facebook' | 'youtube');
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [churchId]);

    const embedUrl = useMemo(() => parseStreamEmbed(streamUrl), [streamUrl]);

    // Handle Quick Live Toggle
    const handleToggleLive = async (newLiveState: boolean) => {
        setIsLive(newLiveState);
        setSaving(true);
        setFeedback(null);

        try {
            // First attempt update via security-definer RPC
            const { error: rpcError } = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)('update_church_livestream', {
                p_church_id: churchId,
                p_is_live: newLiveState,
                p_livestream_url: streamUrl.trim() || null,
                p_livestream_title: streamTitle.trim() || null,
                p_livestream_platform: platform,
            });

            if (rpcError) {
                console.warn('Livestream RPC failed, falling back to direct table update:', rpcError);

                const updatePayload: ChurchLivestreamUpdatePayload = {
                    is_live: newLiveState,
                    livestream_url: streamUrl.trim() || null,
                    livestream_title: streamTitle.trim() || null,
                    livestream_platform: platform,
                    updated_at: new Date().toISOString(),
                };

                if (newLiveState) {
                    updatePayload.livestream_started_at = new Date().toISOString();
                }

                const { error: updateError } = await supabase
                    .from('churches')
                    .update(updatePayload)
                    .eq('id', churchId);

                if (updateError) throw updateError;
            }

            setFeedback({
                type: 'success',
                message: newLiveState ? '🔴 Broadcast is now LIVE for all parishioners!' : '⚪ Broadcast stopped. Sanctuary in standby.',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update live status.';
            console.error('Error toggling live:', message);
            setIsLive(!newLiveState); // revert
            setFeedback({
                type: 'error',
                message,
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
            // First attempt update via security-definer RPC
            const { error: rpcError } = await (supabase.rpc as unknown as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)('update_church_livestream', {
                p_church_id: churchId,
                p_is_live: isLive,
                p_livestream_url: streamUrl.trim() || null,
                p_livestream_title: streamTitle.trim() || null,
                p_livestream_platform: platform,
            });

            if (rpcError) {
                console.warn('Livestream RPC failed, falling back to direct table update:', rpcError);

                const { error: updateError } = await supabase
                    .from('churches')
                    .update({
                        livestream_url: streamUrl.trim() || null,
                        livestream_title: streamTitle.trim() || null,
                        livestream_platform: platform,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', churchId);

                if (updateError) throw updateError;
            }

            setFeedback({
                type: 'success',
                message: 'Stream details saved successfully.',
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save stream metadata.';
            console.error('Error saving stream metadata:', message);
            setFeedback({
                type: 'error',
                message,
            });
        } finally {
            setSaving(false);
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    if (loading) {
        return (
            <div className="bg-white border border-border rounded-2xl p-6 flex items-center justify-center h-48 shadow-xs">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div id="live-broadcast-section" className="bg-white border border-border rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
            {/* Header with Live Status indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Video className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-serif text-lg font-bold text-foreground">
                            Live broadcast and virtual sanctuary
                        </h3>
                        <p className="text-xs text-secondary-500 font-medium">
                            Set up and start the parish livestream
                        </p>
                    </div>
                </div>

                {isLive ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 self-start sm:self-auto">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live now
                    </span>
                ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-600 self-start sm:self-auto">
                        Standby
                    </span>
                )}
            </div>

            {/* Quick Live Toggle Switch Banner */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLive
                    ? 'bg-emerald-50/70 border-emerald-200/80'
                    : 'bg-secondary-50/70 border-border/80'
            }`}>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-foreground">
                            {isLive ? 'You are live' : 'Stream is offline'}
                        </p>
                        <StatusBadge domain="broadcast" status={isLive ? 'live' : 'offline'} size="sm" />
                    </div>
                    <p className={`text-xs mt-0.5 ${isLive ? 'text-secondary-600' : 'text-secondary-500'}`}>
                        {isLive
                            ? 'Parishioners can watch from the parish page'
                            : 'Switch on when you begin your YouTube or Facebook stream'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
                    {isLive ? (
                        <button
                            type="button"
                            onClick={() => handleToggleLive(false)}
                            disabled={saving}
                            className="w-full sm:w-auto border border-border bg-white hover:bg-secondary-50 text-foreground text-xs font-bold px-4 py-2 rounded-xl shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 transition-all"
                        >
                            End stream
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleToggleLive(true)}
                            disabled={saving}
                            className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            Go live now
                        </button>
                    )}
                </div>
            </div>

            {/* STATE A: LIVE STATE (Video Preview replaces form fields) */}
            {isLive ? (
                <div className="space-y-4">
                    {/* Live video preview: the real embedded stream */}
                    <div className="relative rounded-2xl overflow-hidden aspect-video w-full bg-black shadow-inner flex items-center justify-center">
                        {embedUrl ? (
                            <iframe
                                src={embedUrl}
                                title={streamTitle || 'Livestream Feed'}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        ) : (
                            <div className="text-center px-6">
                                <Video className="w-10 h-10 mx-auto text-white/80 mb-2" />
                                <p className="text-sm font-semibold text-white">No stream link set</p>
                                <p className="text-xs text-white/70 mt-1">Add a YouTube or Facebook link to show the video here.</p>
                            </div>
                        )}
                    </div>

                    {/* Stats 3-card grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground block">
                                {(church?.candle_count ?? 0).toLocaleString()}
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Candles lit</span>
                        </div>

                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground capitalize block">
                                {platform === 'youtube' ? 'YouTube' : 'Facebook'}
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Platform</span>
                        </div>

                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground block">
                                Live
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Status</span>
                        </div>
                    </div>

                    {feedback && (
                        <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                            feedback.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                            {feedback.type === 'success' ? (
                                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                            )}
                            <span>{feedback.message}</span>
                        </div>
                    )}

                    {/* Bottom Action Button */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate(`/churches/${churchId}?tab=livestream`)}
                            className="border border-border bg-white hover:bg-secondary-50 text-foreground text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                        >
                            <Eye className="w-3.5 h-3.5 text-secondary-500" />
                            <span>Preview Virtual Sanctuary</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* STATE B: OFFLINE STATE (Stats + Form Fields) */
                <div className="space-y-4">
                    {/* Stats 3-card grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground block">
                                {(church?.candle_count ?? 0).toLocaleString()}
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Candles lit</span>
                        </div>

                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground capitalize block">
                                {platform === 'youtube' ? 'YouTube' : 'Facebook'}
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Platform</span>
                        </div>

                        <div className="p-3.5 bg-secondary-50/50 border border-border/80 rounded-xl">
                            <span className="font-serif text-base font-bold text-foreground block">
                                Ready
                            </span>
                            <span className="text-[11px] text-secondary-500 block mt-0.5">Status</span>
                        </div>
                    </div>

                    {/* Form Fields for Title, Platform, URL */}
                    <form onSubmit={handleSaveMetadata} className="space-y-4 pt-1">
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Broadcast title
                            </label>
                            <input
                                type="text"
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                placeholder="Live Mass from La Salette"
                                className="input w-full text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Platform
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPlatform('youtube')}
                                    className={`text-xs px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                        platform === 'youtube'
                                            ? 'bg-blue-50 border border-primary/40 text-primary font-bold ring-2 ring-primary/10'
                                            : 'border border-border text-secondary-600 hover:text-foreground hover:bg-secondary-50 font-semibold'
                                    }`}
                                >
                                    YouTube
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPlatform('facebook')}
                                    className={`text-xs px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                        platform === 'facebook'
                                            ? 'bg-blue-50 border border-primary/40 text-primary font-bold ring-2 ring-primary/10'
                                            : 'border border-border text-secondary-600 hover:text-foreground hover:bg-secondary-50 font-semibold'
                                    }`}
                                >
                                    Facebook
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Livestream video link
                            </label>
                            <input
                                type="url"
                                value={streamUrl}
                                onChange={(e) => setStreamUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=poQCaeQpQu8"
                                className="input w-full text-xs font-mono"
                            />
                            <p className="text-[11px] text-secondary-500 mt-1">
                                Paste the full video link or livestream share link.
                            </p>
                        </div>

                        {feedback && (
                            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                                feedback.type === 'success'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-red-50 text-red-800 border-red-200'
                            }`}>
                                {feedback.type === 'success' ? (
                                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                                )}
                                <span>{feedback.message}</span>
                            </div>
                        )}

                        {/* Bottom Buttons Row */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-primary hover:bg-primary-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 transition-all"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>{saving ? 'Saving...' : 'Save stream info'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate(`/churches/${churchId}?tab=livestream`)}
                                className="border border-border bg-white hover:bg-secondary-50 text-foreground text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                            >
                                <Eye className="w-3.5 h-3.5 text-secondary-500" />
                                <span>Preview Virtual Sanctuary</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
