import React, { useState } from 'react';
import { User, Volume2, VolumeX, Cpu, ChevronDown, ChevronUp, Database } from 'lucide-react';
import chatbotIcon from '../../assets/chatbotIcon.png';
import type { AssistantDebugInfo } from '../../lib/supabase/parishAssistant';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    isLargeText?: boolean;
    onReadAloud?: () => void;
    isSpeaking?: boolean;
    debug?: AssistantDebugInfo | null;
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
export function FormattedMessageContent({
    content,
    isUser,
    isLargeText = false,
}: {
    content: string;
    isUser: boolean;
    isLargeText?: boolean;
}) {
    const blocks = parseBlocks(content);

    return (
        <div className="space-y-2">
            {blocks.map((block, bIdx) => {
                switch (block.type) {
                    case 'paragraph':
                        return (
                            <p
                                key={bIdx}
                                className={`leading-relaxed ${isLargeText ? 'text-base sm:text-lg' : 'text-sm'}`}
                            >
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
                                ? `${isLargeText ? 'font-bold text-lg sm:text-xl' : 'font-bold text-base'} mt-2.5 mb-1 first:mt-0 ${
                                      isUser ? 'text-white' : 'text-foreground'
                                  }`
                                : `${isLargeText ? 'font-semibold text-base sm:text-lg' : 'font-semibold text-sm'} mt-2 mb-1 first:mt-0 ${
                                      isUser ? 'text-white' : 'text-foreground'
                                  }`;
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
                                        className={`flex items-start gap-2.5 ${item.indented ? 'ml-4' : ''} ${
                                            isLargeText ? 'text-base sm:text-lg' : 'text-sm'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block rounded-full shrink-0 ${
                                                isLargeText ? 'w-2 h-2 mt-2.5' : 'w-1.5 h-1.5 mt-2'
                                            } ${isUser ? 'bg-white/80' : 'bg-amber-500'}`}
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
                                        className={`flex items-start gap-2.5 ${item.indented ? 'ml-4' : ''} ${
                                            isLargeText ? 'text-base sm:text-lg' : 'text-sm'
                                        }`}
                                    >
                                        <span
                                            className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 mt-0.5 ${
                                                isLargeText
                                                    ? 'min-w-[1.5rem] h-6 px-1.5 text-xs sm:text-sm'
                                                    : 'min-w-[1.25rem] h-5 px-1 text-xs'
                                            } ${
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
                                    isLargeText ? 'text-base sm:text-lg' : 'text-sm'
                                } ${
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

export default function ChatMessage({
    role,
    content,
    isLargeText = false,
    onReadAloud,
    isSpeaking = false,
    debug,
}: ChatMessageProps) {
    const isUser = role === 'user';
    const [showTrace, setShowTrace] = useState(false);

    return (
        <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            {isUser ? (
                <div
                    className={`${
                        isLargeText ? 'w-8 h-8' : 'w-7 h-7'
                    } rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-xs`}
                >
                    <User className={isLargeText ? 'w-4.5 h-4.5' : 'w-4 h-4'} />
                </div>
            ) : (
                <div
                    className={`${
                        isLargeText ? 'w-8 h-8' : 'w-7 h-7'
                    } rounded-full overflow-hidden border border-amber-200/80 shadow-xs bg-amber-50 flex items-center justify-center flex-shrink-0`}
                >
                    <img src={chatbotIcon} alt="Parish AI" className="w-full h-full object-cover rounded-full" />
                </div>
            )}

            {/* Bubble, Tool Inspector & Read Aloud Action */}
            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1.5 max-w-[88%]`}>
                <div
                    className={`px-3.5 py-2.5 rounded-2xl leading-relaxed break-words ${
                        isUser
                            ? 'bg-primary text-white rounded-tr-sm shadow-sm'
                            : 'card bg-white border border-border text-foreground rounded-tl-sm shadow-sm'
                    } ${isLargeText ? 'text-base sm:text-lg' : 'text-sm'}`}
                    style={{ wordBreak: 'break-word' }}
                >
                    <FormattedMessageContent content={content} isUser={isUser} isLargeText={isLargeText} />
                </div>

                {/* AI Tool Inspector Pill & Dropdown */}
                {!isUser && debug && (
                    <div className="w-full">
                        <button
                            type="button"
                            onClick={() => setShowTrace((v) => !v)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-muted hover:text-foreground bg-secondary-50 hover:bg-secondary-100 border border-border rounded-lg transition-all"
                            title="Inspect AI model and database tool calls"
                        >
                            <Cpu className="w-3.5 h-3.5 text-primary" />
                            <span>AI Trace:</span>
                            <span className="font-semibold text-foreground">{debug.model}</span>
                            {debug.isMock ? (
                                <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-sans font-medium">
                                    Mock
                                </span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-sans font-medium">
                                    Live
                                </span>
                            )}
                            {debug.tools && debug.tools.length > 0 ? (
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-medium">
                                    {debug.tools.length} tool{debug.tools.length > 1 ? 's' : ''} called
                                </span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.2 bg-secondary-200 text-secondary-700 rounded font-medium">
                                    0 tools
                                </span>
                            )}
                            {showTrace ? (
                                <ChevronUp className="w-3 h-3 text-muted ml-0.5" />
                            ) : (
                                <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
                            )}
                        </button>

                        {showTrace && (
                            <div className="mt-2 p-3 bg-secondary-900 text-secondary-100 rounded-xl text-xs font-mono border border-secondary-700 shadow-md space-y-2.5 overflow-hidden max-w-full">
                                <div className="flex items-center justify-between pb-1.5 border-b border-secondary-800 text-[11px]">
                                    <span className="text-secondary-400">Model Engine:</span>
                                    <span className="font-bold text-amber-400">
                                        {debug.model} {debug.isMock ? '(Local Fake Gemini)' : '(Google Gemini API)'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pb-1.5 border-b border-secondary-800 text-[11px]">
                                    <span className="text-secondary-400">Function Turns:</span>
                                    <span className="text-secondary-300 font-semibold">{debug.turns} turn(s)</span>
                                </div>

                                {debug.tools && debug.tools.length > 0 ? (
                                    <div className="space-y-2 pt-1">
                                        <div className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5" />
                                            <span>Database Tools Invoked ({debug.tools.length}):</span>
                                        </div>
                                        {debug.tools.map((t, idx) => (
                                            <div key={idx} className="bg-secondary-950 p-2.5 rounded-lg border border-secondary-800 space-y-1.5">
                                                <div className="text-emerald-400 font-bold flex items-center justify-between">
                                                    <span>⚙️ {t.name}</span>
                                                    <span className="text-[10px] text-secondary-500 font-normal">Step #{idx + 1}</span>
                                                </div>
                                                <div>
                                                    <span className="text-secondary-400 text-[10px] uppercase tracking-wider font-semibold">Parameters Sent:</span>
                                                    <pre className="text-[10px] text-secondary-300 overflow-x-auto p-1.5 bg-black/50 rounded mt-0.5 border border-secondary-850">
                                                        {JSON.stringify(t.args, null, 2)}
                                                    </pre>
                                                </div>
                                                <div>
                                                    <span className="text-secondary-400 text-[10px] uppercase tracking-wider font-semibold">Database Response Data:</span>
                                                    <pre className="text-[10px] text-emerald-300/90 overflow-x-auto p-1.5 bg-black/50 rounded mt-0.5 max-h-36 overflow-y-auto border border-secondary-850">
                                                        {JSON.stringify(t.result, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-secondary-400 italic pt-1">
                                        No database tools required for this turn (direct conversational reply).
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!isUser && onReadAloud && (
                    <button
                        type="button"
                        data-testid="read-aloud-button"
                        onClick={onReadAloud}
                        aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
                        title={isSpeaking ? 'Stop reading' : 'Read aloud'}
                        className={`inline-flex items-center gap-1.5 font-medium rounded-xl transition-all border shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-95 ${
                            isSpeaking
                                ? 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse'
                                : 'bg-white border-border text-muted hover:text-foreground hover:bg-secondary-50'
                        } ${
                            isLargeText
                                ? 'min-h-[56px] text-base px-4 py-2.5'
                                : 'text-xs px-2.5 py-1.5'
                        }`}
                    >
                        {isSpeaking ? (
                            <>
                                <VolumeX className={isLargeText ? 'w-5 h-5 text-amber-700' : 'w-3.5 h-3.5 text-amber-700'} />
                                <span>Stop reading</span>
                            </>
                        ) : (
                            <>
                                <Volume2 className={isLargeText ? 'w-5 h-5 text-primary' : 'w-3.5 h-3.5 text-primary'} />
                                <span>Read aloud</span>
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
