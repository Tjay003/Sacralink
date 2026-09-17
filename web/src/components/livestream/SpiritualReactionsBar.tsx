import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Flame, X, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../ui/Modal';
import type { Church } from '../../types/database';

interface SpiritualReactionsBarProps {
    church: Church;
    onCandleCountChange?: (count: number) => void;
    currentCandleCount?: number;
}

interface FloatingReaction {
    id: string;
    text: string;
    icon: string;
    left: number; // percentage 10% - 90%
    color: string;
}

const BLESSING_PRESETS = [
    {
        label: 'Amen',
        icon: '🕊️',
        color: 'from-amber-400 to-amber-600',
        hoverStyle: 'hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/30 dark:hover:text-amber-300 dark:hover:border-amber-700',
    },
    {
        label: 'Lord hear our prayer',
        icon: '🙏',
        color: 'from-purple-400 to-purple-600',
        hoverStyle: 'hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 dark:hover:bg-purple-950/30 dark:hover:text-purple-300 dark:hover:border-purple-700',
    },
    {
        label: 'God Bless',
        icon: '❤️',
        color: 'from-rose-400 to-rose-600',
        hoverStyle: 'hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 dark:hover:border-rose-700',
    },
];

export default function SpiritualReactionsBar({
    church,
    onCandleCountChange,
    currentCandleCount,
}: SpiritualReactionsBarProps) {
    const [candleCount, setCandleCount] = useState<number>(currentCandleCount ?? church.candle_count ?? 0);
    const [isLighting, setIsLighting] = useState(false);
    const [showIntentionModal, setShowIntentionModal] = useState(false);
    const [intentionText, setIntentionText] = useState('');
    const [justLit, setJustLit] = useState(false);
    const [reactions, setReactions] = useState<FloatingReaction[]>([]);
    const channelRef = useRef<any>(null);

    // Sync candle count with church prop
    useEffect(() => {
        if (church.candle_count !== undefined && church.candle_count !== null) {
            setCandleCount(church.candle_count);
        }
    }, [church.candle_count]);

    // Supabase Realtime for candle count & floating reaction broadcasts
    useEffect(() => {
        if (!church.id) return;

        const channelName = `virtual-sanctuary:${church.id}`;
        const channel = supabase.channel(channelName);

        channel
            .on('broadcast', { event: 'spiritual_reaction' }, ({ payload }) => {
                triggerLocalReaction(payload.label, payload.icon, payload.color);
            })
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'churches',
                    filter: `id=eq.${church.id}`,
                },
                (payload) => {
                    if (payload.new && typeof payload.new.candle_count === 'number') {
                        setCandleCount(payload.new.candle_count);
                        onCandleCountChange?.(payload.new.candle_count);
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
    }, [church.id, onCandleCountChange]);

    const triggerLocalReaction = (text: string, icon: string, color: string) => {
        const id = `${Date.now()}-${Math.random()}`;
        const left = Math.floor(Math.random() * 70) + 15; // 15% - 85%
        const newReaction: FloatingReaction = { id, text, icon, left, color };

        setReactions((prev) => [...prev.slice(-15), newReaction]);

        setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
        }, 3200);
    };

    const handleSendReaction = async (preset: typeof BLESSING_PRESETS[0]) => {
        triggerLocalReaction(preset.label, preset.icon, preset.color);

        try {
            if (channelRef.current) {
                await channelRef.current.send({
                    type: 'broadcast',
                    event: 'spiritual_reaction',
                    payload: preset,
                });
            }
        } catch {
            // Non-critical fallback
        }
    };

    const handleLightCandleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (isLighting) return;

        setIsLighting(true);
        setShowIntentionModal(false);

        // Optimistic UI increment
        const nextCount = candleCount + 1;
        setCandleCount(nextCount);
        onCandleCountChange?.(nextCount);
        setJustLit(true);
        triggerLocalReaction('Candle Lit in Prayer', '🕯️', 'from-amber-400 to-amber-600');

        try {
            const { data, error } = await supabase.rpc('light_church_candle', {
                target_church_id: church.id,
                user_intention: intentionText.trim() || null,
            });

            if (error) {
                console.error('Error lighting candle:', error);
            } else if (typeof data === 'number') {
                setCandleCount(data);
                onCandleCountChange?.(data);
            }
        } catch (err) {
            console.error('RPC Error:', err);
        } finally {
            setIsLighting(false);
            setIntentionText('');
            setTimeout(() => setJustLit(false), 4000);
        }
    };

    return (
        <div className="relative w-full">
            {/* Floating Spiritual Reactions Container Overlay (portaled to document.body for true viewport positioning) */}
            {createPortal(
                <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
                    {reactions.map((r) => (
                        <div
                            key={r.id}
                            style={{ left: `${r.left}%` }}
                            className="absolute bottom-24 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-card/95 text-foreground font-semibold text-xs shadow-lg border border-border backdrop-blur-md animate-float-blessing"
                        >
                            <span>{r.icon}</span>
                            <span className={`bg-gradient-to-r ${r.color} bg-clip-text text-transparent font-bold`}>
                                {r.text}
                            </span>
                        </div>
                    ))}
                </div>,
                document.body
            )}

            {/* Spiritual Interactions Toolbar Card */}
            <div className="card bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                {/* Upper Tier: Interactive Virtual Candle Lighting */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shadow-xs group">
                                <Flame className={`w-6 h-6 text-amber-500 ${justLit ? 'fill-amber-500 animate-bounce' : 'fill-amber-500/40 group-hover:fill-amber-500'} transition-all`} />
                            </div>
                            {justLit && (
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                                </span>
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-foreground tracking-tight">Virtual Sanctuary Candles</h4>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold text-xs border border-amber-200 dark:border-amber-800">
                                    {candleCount.toLocaleString()} Lit
                                </span>
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                                {justLit ? '✨ May God hear your silent prayer' : 'Offer a silent intention & light a candle in prayer'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowIntentionModal(true)}
                        disabled={isLighting}
                        className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95 transition-all duration-300 text-white font-bold text-xs shadow-sm flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 hover:-translate-y-0.5"
                    >
                        <Flame className="w-4 h-4 fill-white text-white transition-transform duration-300 group-hover:scale-110" />
                        <span>{isLighting ? 'Lighting...' : 'Light a Candle'}</span>
                    </button>
                </div>

                {/* Lower Tier: Spiritual Blessings & Reactions */}
                <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-muted flex items-center gap-1.5 shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Share a Blessing:</span>
                    </span>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {BLESSING_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handleSendReaction(preset)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 hover:scale-105 hover:-translate-y-0.5 active:scale-95 shadow-xs cursor-pointer border bg-white dark:bg-card text-foreground border-border ${preset.hoverStyle}`}
                            >
                                <span className="transition-transform duration-200">{preset.icon}</span>
                                <span>{preset.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Prayer Intention Modal (uses standard createPortal to document.body for viewport centering) */}
            <Modal
                isOpen={showIntentionModal}
                onClose={() => setShowIntentionModal(false)}
                size="md"
                showCloseButton={false}
            >
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                                <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-base text-foreground break-words">Light a Sanctuary Candle</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium truncate">{church.name}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowIntentionModal(false)}
                            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors cursor-pointer shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-xs text-muted leading-relaxed">
                        Your virtual candle will burn in communion with our parish altar. You may leave an optional silent intention or petition below.
                    </p>

                    <form onSubmit={handleLightCandleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                                Silent Intention / Prayer (Optional)
                            </label>
                            <textarea
                                value={intentionText}
                                onChange={(e) => setIntentionText(e.target.value)}
                                placeholder="e.g., For good health, peace in our family, Thanksgiving for blessings..."
                                className="input text-xs w-full h-24 p-3 resize-none font-sans"
                                maxLength={300}
                            />
                            <span className="text-[10px] text-muted float-right mt-1">
                                {intentionText.length}/300
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setShowIntentionModal(false)}
                                className="px-4 py-2 rounded-xl bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-800 dark:hover:bg-secondary-700 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLighting}
                                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95 transition-all duration-300 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:-translate-y-0.5"
                            >
                                <Flame className="w-4 h-4 fill-white text-white" />
                                <span>{isLighting ? 'Offering...' : 'Offer & Light Candle'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
}
