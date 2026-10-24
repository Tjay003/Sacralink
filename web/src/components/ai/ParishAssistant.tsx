import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X, ChevronDown, Church, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getUserFavoriteChurchIds } from '../../lib/supabase/churchFavorites';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import chatbotIcon from '../../assets/chatbotIcon.png';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ChurchOption {
    id: string;
    name: string;
}

const STARTER_CHIPS = [
    'What are the Mass schedules?',
    'Book a sacrament',
    'My appointments',
    'Talk to the parish office',
];

export default function ParishAssistant() {
    const { profile } = useAuth();
    const location = useLocation();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [churches, setChurches] = useState<ChurchOption[]>([]);
    const [activeChurchId, setActiveChurchId] = useState<string | null>(null);
    const [showChurchPicker, setShowChurchPicker] = useState(false);
    const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Fetch available active churches
    useEffect(() => {
        let isCancelled = false;
        async function loadChurches() {
            try {
                const { data } = await supabase
                    .from('churches')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('name');
                if (!isCancelled && data) {
                    setChurches(data);
                }
            } catch (err) {
                console.error('Failed to load churches for assistant:', err);
            }
        }
        void loadChurches();
        return () => {
            isCancelled = true;
        };
    }, []);

    // 2. Determine active parish:
    // - On `/churches/:id`, use that parish
    // - Elsewhere, use favourite parish, or prompt with chips
    useEffect(() => {
        const churchMatch = location.pathname.match(/\/churches\/([0-9a-fA-F-]+)/);
        const routeChurchId = churchMatch ? churchMatch[1] : null;

        if (routeChurchId) {
            setActiveChurchId(routeChurchId);
            return;
        }

        // If not on a parish page, default to favourite parish if activeChurchId is not already set
        if (!activeChurchId && profile?.id) {
            let isCancelled = false;
            async function resolveDefaultParish() {
                try {
                    const favorites = await getUserFavoriteChurchIds(profile!.id);
                    if (isCancelled) return;
                    if (favorites.length > 0) {
                        setActiveChurchId(favorites[0]);
                    } else if (profile?.church_id) {
                        setActiveChurchId(profile.church_id);
                    }
                } catch (err) {
                    console.error('Error resolving favourite parish:', err);
                }
            }
            void resolveDefaultParish();
            return () => {
                isCancelled = true;
            };
        }
    }, [location.pathname, profile, activeChurchId]);

    const activeChurch = churches.find((c) => c.id === activeChurchId);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);

    const handleSendMessage = useCallback(
        async (questionText: string, overrideChurchId?: string) => {
            const trimmed = questionText.trim();
            if (!trimmed || isLoading) return;

            const targetChurchId = overrideChurchId ?? activeChurchId;

            // If question is parish-specific and no parish is selected yet, prompt with parish chips
            const isParishQuestion = /mass|schedule|misa|sacrament|bautismo|kumpil|wedding|kasal/i.test(trimmed);
            if (!targetChurchId && isParishQuestion && churches.length > 0) {
                setMessages((prev) => [
                    ...prev,
                    { id: `user-${Date.now()}`, role: 'user', content: trimmed },
                    {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content:
                            'Which parish would you like to inquire about? Please select from the churches below:',
                    },
                ]);
                setPendingQuestion(trimmed);
                return;
            }

            const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: trimmed };
            setMessages((prev) => [...prev, userMsg]);
            setIsLoading(true);
            setPendingQuestion(null);

            try {
                // Prepare conversation history
                const historyPayload = messages.slice(-6).map((m) => ({
                    role: m.role,
                    content: m.content,
                }));

                const { data, error } = await supabase.functions.invoke('parish-assistant', {
                    body: {
                        message: trimmed,
                        churchId: targetChurchId,
                        conversationHistory: historyPayload,
                    },
                });

                if (error) {
                    throw error;
                }

                const replyText =
                    data?.reply ||
                    "I'm sorry, I couldn't get an answer at this time. Please try again or contact the parish office.";

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: replyText,
                    },
                ]);
            } catch (err: unknown) {
                console.error('Error invoking parish-assistant edge function:', err);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `assistant-err-${Date.now()}`,
                        role: 'assistant',
                        content:
                            "I'm having trouble connecting to the parish assistant service. Please check your connection or contact the parish office directly.",
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        },
        [activeChurchId, churches.length, isLoading, messages]
    );

    const handleSelectChurchFromChip = (church: ChurchOption) => {
        setActiveChurchId(church.id);
        setShowChurchPicker(false);
        if (pendingQuestion) {
            void handleSendMessage(pendingQuestion, church.id);
        }
    };

    // The assistant is strictly for Parishioners (role 'user').
    // Staff roles (church_admin, priest, volunteer, super_admin) never see it.
    if (profile?.role !== 'user') {
        return null;
    }

    return (
        <>
            {/* Floating Toggle Button */}
            {!isOpen && (
                <button
                    data-testid="parish-assistant-button"
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary hover:bg-primary-600 text-white px-4 py-3 rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-primary/20"
                    aria-label="Open AI Parish Assistant"
                >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-white/20 p-0.5 flex items-center justify-center">
                        <img src={chatbotIcon} alt="AI" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight pr-1">Parish Assistant</span>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </button>
            )}

            {/* Assistant Dialog Window */}
            {isOpen && (
                <div
                    data-testid="parish-assistant-panel"
                    className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[410px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-5rem)] flex flex-col bg-white border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
                >
                    {/* Header */}
                    <div className="bg-white border-b border-border px-4 py-3 flex items-center justify-between gap-2 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-200 bg-amber-50 p-0.5 flex-shrink-0">
                                <img
                                    src={chatbotIcon}
                                    alt="Parish Assistant"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </div>
                            <div className="min-w-0 flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="text-sm font-bold text-foreground truncate">
                                        Parish Assistant
                                    </h2>
                                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                        AI
                                    </span>
                                </div>

                                {/* Active Parish Chip & Selector */}
                                <div className="relative">
                                    <button
                                        data-testid="parish-assistant-church-chip"
                                        onClick={() => setShowChurchPicker(!showChurchPicker)}
                                        className="text-[11px] text-muted hover:text-foreground flex items-center gap-1 truncate font-medium hover:underline text-left"
                                        title="Switch parish"
                                    >
                                        <Church className="w-3 h-3 text-primary flex-shrink-0" />
                                        <span className="truncate max-w-[170px] sm:max-w-[200px]">
                                            {activeChurch?.name || 'Select Parish'}
                                        </span>
                                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                    </button>

                                    {/* Church Picker Dropdown */}
                                    {showChurchPicker && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowChurchPicker(false)}
                                            />
                                            <div className="absolute left-0 top-full mt-1.5 w-64 max-h-48 overflow-y-auto bg-white border border-border rounded-xl shadow-xl py-1 z-20">
                                                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider border-b border-border">
                                                    Select Active Parish
                                                </div>
                                                {churches.length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-muted">
                                                        No active parishes found
                                                    </div>
                                                ) : (
                                                    churches.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => handleSelectChurchFromChip(c)}
                                                            className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors ${
                                                                c.id === activeChurchId
                                                                    ? 'bg-primary/10 text-primary font-semibold'
                                                                    : 'text-foreground hover:bg-secondary-50'
                                                            }`}
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Close button */}
                        <button
                            data-testid="parish-assistant-close"
                            onClick={() => setIsOpen(false)}
                            className="text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-secondary-100 transition-colors"
                            aria-label="Close assistant"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Chat Messages Flow */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-background/50">
                        {/* Welcome card if empty */}
                        {messages.length === 0 && (
                            <div className="card bg-white border border-border rounded-2xl p-4 shadow-xs text-center space-y-2 mt-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    Peace be with you!
                                </h3>
                                <p className="text-xs text-muted leading-relaxed">
                                    I can help you check live Mass schedules, guide sacrament bookings, or connect with the parish office.
                                </p>
                            </div>
                        )}

                        {/* Render conversation turns */}
                        {messages.map((m) => (
                            <div key={m.id} data-testid={m.role === 'assistant' ? 'assistant-reply' : undefined}>
                                <ChatMessage role={m.role} content={m.content} />
                            </div>
                        ))}

                        {/* Parish Selection Chips if prompted */}
                        {pendingQuestion && !activeChurchId && churches.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {churches.map((church) => (
                                    <button
                                        key={church.id}
                                        onClick={() => handleSelectChurchFromChip(church)}
                                        className="text-xs bg-white hover:bg-primary hover:text-white text-secondary-800 font-medium px-3 py-1.5 rounded-full border border-border shadow-xs transition-colors"
                                    >
                                        {church.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Thinking / Loading indicator */}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted py-1 pl-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                <span>Consulting live parish records...</span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Starter Quick-Tap Chips (Always available or when conversation is fresh) */}
                    <div className="px-3 pt-2 pb-1 bg-white border-t border-border/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {STARTER_CHIPS.map((chip) => (
                            <button
                                key={chip}
                                onClick={() => void handleSendMessage(chip)}
                                disabled={isLoading}
                                className="whitespace-nowrap text-xs bg-secondary-50 hover:bg-secondary-100 text-secondary-800 font-medium px-3 py-1.5 rounded-full border border-border transition-all active:scale-95 disabled:opacity-50"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>

                    {/* Chat Input */}
                    <ChatInput onSend={(txt) => void handleSendMessage(txt)} disabled={isLoading} />
                </div>
            )}
        </>
    );
}
