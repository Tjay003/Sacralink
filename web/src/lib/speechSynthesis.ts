/**
 * Web Speech Synthesis utility for Sacralink AI Parish Assistant.
 * Provides accessible text-to-speech for elderly parishioners,
 * cleans Markdown syntax before speaking, and selects Filipino
 * voices for Tagalog/Taglish replies when available.
 */

export function isSpeechSynthesisSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Strips markdown and special formatting syntax so speech synthesis
 * produces natural, clean speech without reading symbols aloud.
 */
export function stripMarkdownForSpeech(markdown: string): string {
    if (!markdown) return '';

    let text = markdown;

    // 1. Remove fenced code blocks
    text = text.replace(/```[\s\S]*?```/g, '');

    // 2. Remove inline code `code`
    text = text.replace(/`([^`]+)`/g, '$1');

    // 3. Remove image tags ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

    // 4. Remove links [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Remove headers (# Header, ## Subheader, etc.)
    text = text.replace(/^#{1,6}\s+/gm, '');

    // 6. Remove bold and italic markers
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/___([^_]+)___/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/(^|\s)_([^_]+)_(\s|$|[.,!?;])/g, '$1$2$3');

    // 7. Remove list bullets (-, *, +, •, ◦) and numbers (1., 2.) at line starts
    text = text.replace(/^[ \t]*[-*+•◦]\s+/gm, '');
    text = text.replace(/^[ \t]*\d+\.\s+/gm, '');

    // 8. Remove blockquotes (> Quote)
    text = text.replace(/^[ \t]*>[ \t]?/gm, '');

    // 9. Remove horizontal rules (---, ***, ___)
    text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');

    // 10. Normalize whitespace and newlines to a smooth stream of text
    text = text.replace(/[\r\n]+/g, ' ');
    text = text.replace(/\s+/g, ' ');

    return text.trim();
}

const COMMON_TAGALOG_WORDS = [
    'ang', 'mga', 'sa', 'ng', 'para', 'kay', 'kina', 'ni', 'nina',
    'ito', 'iyan', 'iyon', 'dito', 'diyan', 'doon',
    'po', 'opo', 'ho', 'oho',
    'salamat', 'mabuhay', 'magandang', 'araw', 'umaga', 'hapon', 'gabi',
    'simbahan', 'parokya', 'misa', 'binyag', 'kasal', 'kumpil', 'sakramento',
    'pari', 'padre', 'kailan', 'saan', 'paano', 'sino', 'bakit', 'ano',
    'maaari', 'pwede', 'puwede', 'huwag', 'bawal', 'meron', 'mayroon', 'wala',
    'natin', 'namin', 'ninyo', 'nila', 'inyo', 'kanila', 'mamili', 'ibaba',
    'petsa', 'oras', 'sige', 'muli', 'magulang', 'pagdiriwang', 'ikinagagalak',
    'kayong', 'tutulungan', 'pakipili', 'opsyon', 'options', 'linggo', 'sabado'
];

/**
 * Detects whether the provided text is primarily Tagalog/Filipino or Taglish.
 */
export function isTagalogText(text: string): boolean {
    if (!text) return false;
    let matches = 0;
    const tokens = text.toLowerCase().split(/\s+/);
    for (const token of tokens) {
        const clean = token.replace(/[^a-zñ-]/g, '');
        if (clean && COMMON_TAGALOG_WORDS.includes(clean)) {
            matches++;
            if (matches >= 2) return true;
        }
    }
    return false;
}

/**
 * Searches available browser voices for a Filipino/Tagalog voice (tl-PH, fil-PH, fil, tl).
 */
export function findFilipinoVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) return null;

    const normalizedMatch = voices.find((v) => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        return lang === 'fil-ph' || lang === 'tl-ph' || lang === 'fil' || lang === 'tl';
    });
    if (normalizedMatch) return normalizedMatch;

    return voices.find((v) => {
        const lang = v.lang.toLowerCase();
        return lang.startsWith('fil') || lang.startsWith('tl') || lang.includes('philippines');
    }) || null;
}

/**
 * Chooses the best voice based on language and available system voices.
 */
export function selectVoice(voices: SpeechSynthesisVoice[], isTagalog: boolean): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) return null;

    if (isTagalog) {
        const filipinoVoice = findFilipinoVoice(voices);
        if (filipinoVoice) return filipinoVoice;
    }

    // Default system voice or first available
    return voices.find((v) => v.default) || voices[0] || null;
}

/**
 * Speaks an assistant reply using speech synthesis.
 */
export function speakReply(
    text: string,
    callbacks?: {
        onStart?: () => void;
        onEnd?: () => void;
        onError?: (err: unknown) => void;
    }
): SpeechSynthesisUtterance | null {
    if (!isSpeechSynthesisSupported()) return null;

    try {
        window.speechSynthesis.cancel();

        const stripped = stripMarkdownForSpeech(text);
        if (!stripped) {
            callbacks?.onEnd?.();
            return null;
        }

        const utterance = new SpeechSynthesisUtterance(stripped);
        const isTagalog = isTagalogText(stripped);

        const voices = window.speechSynthesis.getVoices();
        const voice = selectVoice(voices, isTagalog);

        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else if (isTagalog) {
            utterance.lang = 'tl-PH';
        } else {
            utterance.lang = 'en-US';
        }

        utterance.onstart = () => {
            callbacks?.onStart?.();
        };

        utterance.onend = () => {
            callbacks?.onEnd?.();
        };

        utterance.onerror = (e) => {
            callbacks?.onError?.(e);
        };

        window.speechSynthesis.speak(utterance);
        return utterance;
    } catch (err) {
        console.warn('Speech synthesis error:', err);
        callbacks?.onError?.(err);
        return null;
    }
}

/**
 * Cancels any in-progress speech synthesis playback.
 */
export function stopSpeaking(): void {
    if (!isSpeechSynthesisSupported()) return;
    try {
        window.speechSynthesis.cancel();
    } catch {
        // ignore
    }
}
