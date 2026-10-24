import { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    isLargeText?: boolean;
}

export default function ChatInput({ onSend, disabled, isLargeText = false }: ChatInputProps) {
    const [value, setValue] = useState('');

    const handleSend = () => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`flex items-end gap-2.5 bg-white/95 backdrop-blur-md border-t border-border/80 ${isLargeText ? 'p-4' : 'p-3.5'}`}>
            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder="Ask about masses, sacraments, or parish services..."
                rows={1}
                className={`flex-1 resize-none rounded-2xl border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary disabled:opacity-50 bg-secondary-50/60 hover:bg-white focus:bg-white placeholder:text-muted transition-all leading-relaxed shadow-inner/5 ${
                    isLargeText ? 'text-base sm:text-lg' : 'text-sm'
                }`}
                style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                }}
                onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
            />
            <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className={`rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-xs ${
                    isLargeText ? 'w-12 h-12 min-h-[48px] min-w-[48px]' : 'w-10 h-10'
                }`}
                aria-label="Send message"
            >
                <Send className={isLargeText ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>
        </div>
    );
}
