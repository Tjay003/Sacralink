import { useState, useRef, useEffect } from 'react';
import { Bot, X, MessageCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChurchChatbotProps {
    churchId: string;
    churchName: string;
}

export default function ChurchChatbot({ churchId, churchName }: ChurchChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasInitialized = useRef(false);

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
            const conversationHistory = newMessages.slice(0, -1);

            const { data, error: fnError } = await supabase.functions.invoke('church-ai-chat', {
                body: {
                    churchId,
                    message,
                    conversationHistory,
                },
            });

            if (fnError) {
                // Extract actual error message from the response body
                let errMsg = fnError.message;
                try {
                    const body = await (fnError as any).context?.json?.();
                    if (body?.error) errMsg = body.error;
                } catch { /* use original */ }
                throw new Error(errMsg);
            }

            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (err: any) {
            const errMsg = err.message || 'Something went wrong.';
            console.error('Chatbot error:', errMsg);
            setError(errMsg);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errMsg.startsWith('Gemini') || errMsg.startsWith('DB')
                    ? 'The assistant is temporarily unavailable. Please contact the parish office directly.'
                    : errMsg,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Chat Button */}
            <button
                id="church-chatbot-toggle"
                onClick={() => setIsOpen(prev => !prev)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 active:scale-95 ${
                    isOpen
                        ? 'bg-gray-700 hover:bg-gray-800'
                        : 'bg-primary hover:bg-primary/90'
                }`}
                aria-label={isOpen ? 'Close parish assistant' : 'Open parish assistant'}
                title={isOpen ? 'Close' : `Ask ${churchName} Parish Assistant`}
            >
                {isOpen ? (
                    <ChevronDown className="w-6 h-6 text-white" />
                ) : (
                    <MessageCircle className="w-6 h-6 text-white" />
                )}

                {/* Pulse ring when closed */}
                {!isOpen && (
                    <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-ping pointer-events-none" />
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    id="church-chatbot-panel"
                    className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                    style={{
                        width: 'min(360px, calc(100vw - 48px))',
                        height: 'min(520px, calc(100vh - 120px))',
                        background: '#f8fafc',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white shrink-0">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <Bot className="w-4 h-4" />
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
                            <ChatMessage key={i} role={msg.role} content={msg.content} />
                        ))}

                        {/* Typing Indicator */}
                        {isLoading && (
                            <div className="flex gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-amber-600" />
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
        </>
    );
}
