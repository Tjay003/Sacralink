import React from 'react';
import { User } from 'lucide-react';
import chatbotIcon from '../../assets/chatbotIcon.png';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
}

interface BulletItem {
    text: string;
    indented: boolean;
}

interface NumberedItem {
    number: string;
    text: string;
    indented: boolean;
}

type Block =
    | { type: 'paragraph'; lines: string[] }
    | { type: 'heading'; level: number; text: string }
    | { type: 'bullet-list'; items: BulletItem[] }
    | { type: 'numbered-list'; items: NumberedItem[] }
    | { type: 'quote'; lines: string[] }
    | { type: 'hr' };

/**
 * Parses inline formatting:
 * - Code: `code`
 * - Bold + Italic: ***text***
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 */
function parseInline(text: string, isUser: boolean): React.ReactNode[] {
    if (!text) return [];

    // Regex matching inline formatting tokens
    const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|(?<=\s|^)_[^_]+_(?=\s|$|[.,!?;]))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const token = match[0];
        const key = `${match.index}-${token}`;

        if (token.startsWith('`') && token.endsWith('`')) {
            const code = token.slice(1, -1);
            parts.push(
                <code
                    key={key}
                    className={`px-1.5 py-0.5 rounded font-mono text-xs ${
                        isUser
                            ? 'bg-white/20 text-white'
                            : 'bg-secondary-100 text-secondary-900 border border-secondary-200'
                    }`}
                >
                    {code}
                </code>
            );
        } else if (token.startsWith('***') && token.endsWith('***')) {
            const inner = token.slice(3, -3);
            parts.push(
                <strong key={key} className={`font-semibold ${isUser ? 'text-white' : 'text-foreground'}`}>
                    <em className={isUser ? 'italic text-white/90' : 'italic text-secondary-600'}>
                        {parseInline(inner, isUser)}
                    </em>
                </strong>
            );
        } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
            const inner = token.slice(2, -2);
            parts.push(
                <strong key={key} className={`font-semibold ${isUser ? 'text-white' : 'text-foreground'}`}>
                    {parseInline(inner, isUser)}
                </strong>
            );
        } else if (token.startsWith('*') && token.endsWith('*')) {
            const inner = token.slice(1, -1);
            parts.push(
                <em key={key} className={isUser ? 'italic text-white/90' : 'italic text-secondary-600'}>
                    {inner}
                </em>
            );
        } else if (token.trim().startsWith('_') && token.trim().endsWith('_')) {
            const trimmed = token.trim();
            const inner = trimmed.slice(1, -1);
            parts.push(
                <em key={key} className={isUser ? 'italic text-white/90' : 'italic text-secondary-600'}>
                    {inner}
                </em>
            );
        } else {
            parts.push(token);
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts;
}

/**
 * Splits plain text response into structured blocks (paragraphs, lists, headings, quotes).
 */
function parseBlocks(content: string): Block[] {
    const rawLines = content.split(/\r?\n/);
    const blocks: Block[] = [];

    let currentParagraph: string[] = [];
    let currentBulletList: BulletItem[] = [];
    let currentNumberedList: NumberedItem[] = [];
    let currentQuote: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            blocks.push({ type: 'paragraph', lines: [...currentParagraph] });
            currentParagraph = [];
        }
    };

    const flushBulletList = () => {
        if (currentBulletList.length > 0) {
            blocks.push({ type: 'bullet-list', items: [...currentBulletList] });
            currentBulletList = [];
        }
    };

    const flushNumberedList = () => {
        if (currentNumberedList.length > 0) {
            blocks.push({ type: 'numbered-list', items: [...currentNumberedList] });
            currentNumberedList = [];
        }
    };

    const flushQuote = () => {
        if (currentQuote.length > 0) {
            blocks.push({ type: 'quote', lines: [...currentQuote] });
            currentQuote = [];
        }
    };

    const flushAll = () => {
        flushParagraph();
        flushBulletList();
        flushNumberedList();
        flushQuote();
    };

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const trimmed = line.trim();

        // 1. Empty line -> block break
        if (!trimmed) {
            flushAll();
            continue;
        }

        // 2. Horizontal divider: --- or *** or ___
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
            flushAll();
            blocks.push({ type: 'hr' });
            continue;
        }

        // 3. Heading: #, ##, ###
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushAll();
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length,
                text: headingMatch[2],
            });
            continue;
        }

        // 4. Blockquote: > text
        const quoteMatch = trimmed.match(/^>\s*(.*)$/);
        if (quoteMatch) {
            flushParagraph();
            flushBulletList();
            flushNumberedList();
            currentQuote.push(quoteMatch[1]);
            continue;
        } else {
            flushQuote();
        }

        // 5. Bullet list item: * text, - text, • text, + text
        const bulletMatch = line.match(/^(\s*)([-*•+])\s+(.+)$/);
        if (bulletMatch) {
            flushParagraph();
            flushNumberedList();
            currentBulletList.push({
                indented: bulletMatch[1].length >= 2,
                text: bulletMatch[3],
            });
            continue;
        }

        // 6. Numbered list item: 1. text, 1) text
        const numberMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)$/);
        if (numberMatch) {
            flushParagraph();
            flushBulletList();
            currentNumberedList.push({
                indented: numberMatch[1].length >= 2,
                number: numberMatch[2],
                text: numberMatch[3],
            });
            continue;
        }

        // 7. Indented list continuations
        if (currentBulletList.length > 0 && /^\s{2,}\S/.test(line)) {
            currentBulletList[currentBulletList.length - 1].text += ' ' + trimmed;
            continue;
        }
        if (currentNumberedList.length > 0 && /^\s{2,}\S/.test(line)) {
            currentNumberedList[currentNumberedList.length - 1].text += ' ' + trimmed;
            continue;
        }

        // 8. Regular paragraph line
        flushBulletList();
        flushNumberedList();
        currentParagraph.push(line);
    }

    flushAll();
    return blocks;
}

/**
 * Rich message formatter supporting paragraphs, lists, bold, italics, and liturgical Sacred Gold styling.
 */
export function FormattedMessageContent({ content, isUser }: { content: string; isUser: boolean }) {
    const blocks = parseBlocks(content);

    return (
        <div className="space-y-2">
            {blocks.map((block, bIdx) => {
                switch (block.type) {
                    case 'paragraph':
                        return (
                            <p key={bIdx} className="leading-relaxed">
                                {block.lines.map((line, lIdx) => (
                                    <React.Fragment key={lIdx}>
                                        {lIdx > 0 && <br />}
                                        {parseInline(line, isUser)}
                                    </React.Fragment>
                                ))}
                            </p>
                        );

                    case 'heading': {
                        const headingClass =
                            block.level <= 2
                                ? `font-bold text-base mt-2.5 mb-1 first:mt-0 ${isUser ? 'text-white' : 'text-foreground'}`
                                : `font-semibold text-sm mt-2 mb-1 first:mt-0 ${isUser ? 'text-white' : 'text-foreground'}`;
                        return (
                            <div key={bIdx} className={headingClass}>
                                {parseInline(block.text, isUser)}
                            </div>
                        );
                    }

                    case 'bullet-list':
                        return (
                            <ul key={bIdx} className="space-y-1.5 my-1.5 pl-0.5">
                                {block.items.map((item, iIdx) => (
                                    <li
                                        key={iIdx}
                                        className={`flex items-start gap-2.5 ${item.indented ? 'ml-4' : ''}`}
                                    >
                                        <span
                                            className={`inline-block w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                                                isUser ? 'bg-white/80' : 'bg-amber-500'
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <span className="flex-1 leading-relaxed">
                                            {parseInline(item.text, isUser)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        );

                    case 'numbered-list':
                        return (
                            <ol key={bIdx} className="space-y-1.5 my-1.5 pl-0.5">
                                {block.items.map((item, iIdx) => (
                                    <li
                                        key={iIdx}
                                        className={`flex items-start gap-2.5 ${item.indented ? 'ml-4' : ''}`}
                                    >
                                        <span
                                            className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${
                                                isUser
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-amber-100 text-amber-800 border border-amber-200/60'
                                            }`}
                                            aria-hidden="true"
                                        >
                                            {item.number}
                                        </span>
                                        <span className="flex-1 leading-relaxed">
                                            {parseInline(item.text, isUser)}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        );

                    case 'quote':
                        return (
                            <blockquote
                                key={bIdx}
                                className={`pl-3 border-l-2 my-2 italic ${
                                    isUser
                                        ? 'border-white/50 text-white/90'
                                        : 'border-amber-400 text-secondary-700 bg-amber-50/40 py-1 rounded-r'
                                }`}
                            >
                                {block.lines.map((line, lIdx) => (
                                    <React.Fragment key={lIdx}>
                                        {lIdx > 0 && <br />}
                                        {parseInline(line, isUser)}
                                    </React.Fragment>
                                ))}
                            </blockquote>
                        );

                    case 'hr':
                        return (
                            <hr
                                key={bIdx}
                                className={`my-2 border-t ${
                                    isUser ? 'border-white/20' : 'border-border'
                                }`}
                            />
                        );

                    default:
                        return null;
                }
            })}
        </div>
    );
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
    const isUser = role === 'user';

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            {isUser ? (
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <User className="w-4 h-4" />
                </div>
            ) : (
                <div className="w-7 h-7 rounded-full overflow-hidden border border-amber-200/80 shadow-xs bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <img src={chatbotIcon} alt="Parish AI" className="w-full h-full object-cover rounded-full" />
                </div>
            )}

            {/* Bubble */}
            <div
                className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                    isUser
                        ? 'bg-primary text-white rounded-tr-sm shadow-sm'
                        : 'card bg-white border border-border text-foreground rounded-tl-sm shadow-sm'
                }`}
                style={{ wordBreak: 'break-word' }}
            >
                <FormattedMessageContent content={content} isUser={isUser} />
            </div>
        </div>
    );
}
