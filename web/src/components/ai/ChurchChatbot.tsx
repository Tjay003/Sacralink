import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';
import chatbotIcon from '../../assets/chatbotIcon.png';
import { askParishAI, generateFallbackResponse } from '../../lib/supabase/aiFallback';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    feedback?: 'up' | 'down' | null;
}

interface ChurchChatbotProps {
    churchId: string;
    churchName: string;
}

// Quick-tap starter chips shown before the user types
const STARTER_CHIPS = [
    'What are the Mass schedules?',
    'How do I book a baptism?',
    'What are the requirements for wedding?',
    'When is the office open?',
    'What ministries can I join?',
];

export default function ChurchChatbot({ churchId, churchName }: ChurchChatbotProps) {
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showGreetingBubble, setShowGreetingBubble] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

    // Mount check & greeting bubble timer (auto-dismiss on scroll or after 7s to prevent clutter)
    useEffect(() => {
        setMounted(true);

        const timer = setTimeout(() => {
            setShowGreetingBubble(true);
        }, 800);

        const dismissTimer = setTimeout(() => {
            setShowGreetingBubble(false);
        }, 7500);

        const handleScroll = () => {
            setShowGreetingBubble(false);
        };
        window.addEventListener('scroll', handleScroll, { passive: true, once: true });

        return () => {
            clearTimeout(timer);
            clearTimeout(dismissTimer);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // History limit: only send last 6 messages to keep prompt size small
    const MAX_HISTORY = 6;

    // Initialize with welcome message when first opened
    useEffect(() => {
        if (isOpen && !hasInitialized.current) {
            hasInitialized.current = true;
            setMessages([
                {
                    role: 'assistant',
                    content: `Hi! I'm the ${churchName} Parish Assistant. Ask me anything about our masses, sacraments, or services! 🙏`,
                },
            ]);
        }
    }, [isOpen, churchName]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading, isOpen]);

    const handleSend = async (message: string) => {
        setError(null);

        const userMessage: Message = { role: 'user', content: message };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Trim history to last MAX_HISTORY messages (exclude the brand-new user message)
            const conversationHistory = newMessages.slice(0, -1).slice(-MAX_HISTORY);

            const result = await askParishAI({
                churchId,
                churchName,
                message,
                conversationHistory,
            });

            setMessages(prev => [...prev, { role: 'assistant', content: result.reply, feedback: null }]);
        } catch (err: unknown) {
            console.error('Chatbot error, attempting fallback:', err);
            try {
                const fallback = await generateFallbackResponse(message, churchId, churchName);
                setMessages(prev => [...prev, { role: 'assistant', content: fallback.reply, feedback: null }]);
            } catch (fallbackErr: unknown) {
                const errMsg = fallbackErr instanceof Error ? fallbackErr.message : 'Unable to load parish information.';
                console.error('Fallback error:', errMsg);
                setError(errMsg);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'The assistant is temporarily unavailable. Please contact the parish office directly.',
                    feedback: null,
                }]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeedback = (index: number, vote: 'up' | 'down') => {
        setMessages(prev =>
            prev.map((msg, i) =>
                i === index
                    ? { ...msg, feedback: msg.feedback === vote ? null : vote }
                    : msg
            )
        );
    };

    const showStarters = messages.length === 1 && messages[0].role === 'assistant' && !isLoading;

    if (!mounted) return null;

    return createPortal(
        <>
            {/* Floating Sticky Chatbot Widget */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 pointer-events-auto">
                {/* Greeting Popover Bubble (Shown on page load) */}
                {!isOpen && showGreetingBubble && (
                    <div className="relative bg-white border border-border shadow-xl rounded-2xl p-3.5 max-w-[280px] sm:max-w-xs transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowGreetingBubble(false);
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-secondary-100 hover:bg-secondary-200 text-secondary-600 flex items-center justify-center transition-colors shadow-xs"
                            aria-label="Dismiss greeting"
                        >
                            <X className="w-3 h-3" />
                        </button>
                        <div
                            onClick={() => {
                                setIsOpen(true);
                                setShowGreetingBubble(false);
                            }}
                            className="cursor-pointer group"
                        >
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 uppercase tracking-wider">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    Parish AI
                                </span>
                                <span className="text-[11px] text-muted font-medium truncate">Online • Ready to help</span>
                            </div>
                            <p className="text-xs text-foreground font-medium leading-relaxed group-hover:text-primary transition-colors">
                                Have questions about Mass schedules, baptisms, or requirements? Ask me! 🙏
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                                <span>Start conversation</span>
                                <span>→</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Trigger Pill */}
                <button
                    id="church-chatbot-toggle"
                    onClick={() => {
                        setIsOpen(prev => !prev);
                        setShowGreetingBubble(false);
                    }}
                    className={`group relative transition-all duration-300 active:scale-95 shadow-lg hover:shadow-xl ${
                        isOpen
                            ? 'w-12 h-12 rounded-full bg-secondary-700 hover:bg-secondary-800 text-white flex items-center justify-center'
                            : 'h-13 px-4 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center gap-3 border border-white/20'
                    }`}
                    aria-label={isOpen ? 'Close parish assistant' : 'Open parish assistant'}
                    title={isOpen ? 'Close' : `Ask ${churchName} Parish Assistant`}
                >
                    {isOpen ? (
                        <ChevronDown className="w-5 h-5 text-white" />
                    ) : (
                        <>
                            <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/40 shadow-xs bg-white/10 flex items-center justify-center">
                                    <img src={chatbotIcon} alt="Parish AI" className="w-full h-full object-cover rounded-full" />
                                </div>
                                {/* Pulsing online green dot */}
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-primary" />
                            </div>
                            <div className="text-left pr-1">
                                <p className="text-xs font-bold tracking-tight text-white flex items-center gap-1">
                                    <span>Ask Parish AI</span>
                                    <Sparkles className="w-3 h-3 text-amber-300" />
                                </p>
                                <p className="text-[10px] text-white/80 leading-none">Instant answers</p>
                            </div>
                        </>
                    )}
                </button>
            </div>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    id="church-chatbot-panel"
                    className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                    style={{
                        width: 'min(380px, calc(100vw - 48px))',
                        height: 'min(560px, calc(100vh - 120px))',
                        background: '#f8fafc',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white shrink-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 shadow-xs bg-white/15 flex items-center justify-center shrink-0">
                            <img src={chatbotIcon} alt="Parish Assistant" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">Parish Assistant</p>
                            <p className="text-xs text-white/70 truncate">{churchName}</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.map((msg, i) => (
                            <div key={i}>
                                <ChatMessage role={msg.role} content={msg.content} />

                                {/* Feedback buttons - only on assistant messages (not the welcome msg) */}
                                {msg.role === 'assistant' && i > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1 ml-10">
                                        <button
                                            onClick={() => handleFeedback(i, 'up')}
                                            className={`p-1 rounded-md transition-colors ${
                                                msg.feedback === 'up'
                                                    ? 'text-green-600 bg-green-50'
                                                    : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
                                            }`}
                                            title="Helpful"
                                        >
                                            <ThumbsUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleFeedback(i, 'down')}
                                            className={`p-1 rounded-md transition-colors ${
                                                msg.feedback === 'down'
                                                    ? 'text-red-500 bg-red-50'
                                                    : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
                                            }`}
                                            title="Not helpful"
                                        >
                                            <ThumbsDown className="w-3 h-3" />
                                        </button>
                                        {msg.feedback && (
                                            <span className="text-xs text-gray-400">
                                                {msg.feedback === 'up' ? 'Thanks for the feedback!' : 'Sorry about that!'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Conversation Starter Chips */}
                        {showStarters && (
                            <div className="flex flex-col gap-1.5 mt-2">
                                {STARTER_CHIPS.map((chip) => (
                                    <button
                                        key={chip}
                                        onClick={() => handleSend(chip)}
                                        className="text-left text-xs px-3 py-2 bg-white border border-primary/20 text-primary rounded-xl hover:bg-primary hover:text-white hover:border-primary transition-all duration-150 shadow-sm"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Typing Indicator */}
                        {isLoading && (
                            <div className="flex gap-2">
                                <div className="w-7 h-7 rounded-full overflow-hidden border border-amber-200/80 shadow-xs bg-amber-50 flex items-center justify-center flex-shrink-0">
                                    <img src={chatbotIcon} alt="Parish AI" className="w-full h-full object-cover rounded-full" />
                                </div>
                                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                    <div className="flex gap-1 items-center h-4">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && !isLoading && (
                            <p className="text-xs text-red-500 text-center px-2">{error}</p>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Disclaimer */}
                    <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100 shrink-0">
                        <p className="text-xs text-amber-700 text-center">
                            🤖 AI answers are based on church data. Always verify with the parish office.
                        </p>
                    </div>

                    {/* Input */}
                    <ChatInput onSend={handleSend} disabled={isLoading} />
                </div>
            )}
        </>,
        document.body
    );
}
