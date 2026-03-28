import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUser ? 'bg-primary text-white' : 'bg-amber-100 text-amber-600'
                }`}
            >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    isUser
                        ? 'bg-primary text-white rounded-tr-sm'
                        : 'bg-white text-foreground border border-gray-100 rounded-tl-sm shadow-sm'
                }`}
                style={{ wordBreak: 'break-word' }}
            >
                {content}
            </div>
        </div>
    );
}
