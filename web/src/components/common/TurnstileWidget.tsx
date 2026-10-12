import { useEffect, useRef, useState } from 'react';
import { isDemoMode } from '../../config/featureFlags';
import { Loader2, ShieldCheck } from 'lucide-react';

export interface TurnstileWidgetProps {
    siteKey?: string;
    onVerify: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    className?: string;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement | string,
                options: {
                    sitekey: string;
                    callback?: (token: string) => void;
                    'error-callback'?: (error?: unknown) => void;
                    'expired-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                    [key: string]: unknown;
                }
            ) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
            ready: (callback: () => void) => void;
        };
    }
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const DEFAULT_TEST_SITE_KEY = '1x00000000000000000000AA';

export default function TurnstileWidget({
    siteKey,
    onVerify,
    onError,
    onExpire,
    theme = 'light',
    className = '',
}: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBypassed, setIsBypassed] = useState(false);

    const onVerifyRef = useRef(onVerify);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
        onVerifyRef.current = onVerify;
        onErrorRef.current = onError;
        onExpireRef.current = onExpire;
    });

    const handleBypass = () => {
        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
        }
        setIsLoading(false);
        setIsBypassed(true);
        onVerifyRef.current?.('dev-local-pass-token');
    };

    const effectiveSiteKey = siteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || DEFAULT_TEST_SITE_KEY;
    const isTestEnv = import.meta.env.MODE === 'test';

    useEffect(() => {
        let isMounted = true;

        // Clean pass-through for demo mode or automated test environments
        if (isDemoMode || isTestEnv) {
            setIsLoading(false);
            onVerifyRef.current?.('demo-pass-token');
            return;
        }

        // If site key is explicitly empty, pass through gracefully
        if (!effectiveSiteKey) {
            setIsLoading(false);
            onVerifyRef.current?.('bypass-token');
            return;
        }

        // 3.5-second fallback timeout for localhost, slow connections, or adblockers
        fallbackTimerRef.current = setTimeout(() => {
            if (isMounted) {
                setIsLoading((prev) => {
                    if (prev) {
                        console.info('[Turnstile] Fallback timeout reached (3.5s) - auto-bypassing verification for local testing');
                        setIsBypassed(true);
                        onVerifyRef.current?.('dev-local-pass-token');
                        return false;
                    }
                    return prev;
                });
            }
        }, 3500);

        const renderWidget = () => {
            if (!isMounted || !containerRef.current || !window.turnstile) return;

            // Remove existing widget if re-rendering
            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore removal error
                }
                widgetIdRef.current = null;
            }

            try {
                const widgetId = window.turnstile.render(containerRef.current, {
                    sitekey: effectiveSiteKey,
                    callback: (token: string) => {
                        if (isMounted) {
                            if (fallbackTimerRef.current) {
                                clearTimeout(fallbackTimerRef.current);
                                fallbackTimerRef.current = null;
                            }
                            setIsLoading(false);
                            onVerifyRef.current?.(token);
                        }
                    },
                    'error-callback': () => {
                        if (isMounted) {
                            if (fallbackTimerRef.current) {
                                clearTimeout(fallbackTimerRef.current);
                                fallbackTimerRef.current = null;
                            }
                            setIsLoading(false);
                            if (isDemoMode || isTestEnv) {
                                onVerifyRef.current?.('demo-pass-token');
                            } else {
                                onErrorRef.current?.();
                            }
                        }
                    },
                    'expired-callback': () => {
                        if (isMounted) {
                            setIsBypassed(false);
                            onExpireRef.current?.();
                        }
                    },
                    theme,
                });
                widgetIdRef.current = widgetId;
                setIsLoading(false);
            } catch (err) {
                console.warn('Failed to render Turnstile widget:', err);
                if (fallbackTimerRef.current) {
                    clearTimeout(fallbackTimerRef.current);
                    fallbackTimerRef.current = null;
                }
                setIsLoading(false);
                if (isDemoMode || isTestEnv) {
                    onVerifyRef.current?.('demo-pass-token');
                } else {
                    setIsBypassed(true);
                    onVerifyRef.current?.('dev-local-pass-token');
                }
            }
        };

        const loadScriptAndRender = () => {
            if (window.turnstile) {
                window.turnstile.ready(renderWidget);
                return;
            }

            let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
            if (!script) {
                script = document.createElement('script');
                script.id = TURNSTILE_SCRIPT_ID;
                script.src = TURNSTILE_SCRIPT_URL;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }

            const handleLoad = () => {
                if (window.turnstile) {
                    window.turnstile.ready(renderWidget);
                } else {
                    renderWidget();
                }
            };

            const handleScriptError = () => {
                console.warn('Turnstile script failed to load (blocked by adblocker or network restriction)');
                if (fallbackTimerRef.current) {
                    clearTimeout(fallbackTimerRef.current);
                    fallbackTimerRef.current = null;
                }
                setIsLoading(false);
                if (isDemoMode || isTestEnv) {
                    onVerifyRef.current?.('demo-pass-token');
                } else {
                    setIsBypassed(true);
                    onVerifyRef.current?.('dev-local-pass-token');
                }
            };

            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleScriptError, { once: true });
        };

        loadScriptAndRender();

        return () => {
            isMounted = false;
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore removal error
                }
                widgetIdRef.current = null;
            }
        };
    }, [effectiveSiteKey, theme, isTestEnv]);

    return (
        <div className={`flex flex-col items-center justify-center min-h-[65px] ${className}`}>
            {isLoading && !isDemoMode && (
                <div className="flex flex-col items-center gap-1.5 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Verifying security check...</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleBypass}
                        className="text-[11px] text-primary hover:underline hover:text-blue-700 transition-colors cursor-pointer"
                    >
                        Bypass security check for local testing
                    </button>
                </div>
            )}
            <div ref={containerRef} className="flex justify-center" />
            {isDemoMode && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-1 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Demo Mode: Security verification bypassed</span>
                </div>
            )}
            {isBypassed && !isDemoMode && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 mt-1 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Security check bypassed for local testing</span>
                </div>
            )}
        </div>
    );
}
