import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useCountdown - a cancellable whole-second countdown. `start()` begins at `seconds`; when it reaches zero `onElapsed`
 * runs once. `remaining` is null while idle. Unmounting cancels it, so a closed modal never fires the action.
 */
export function useCountdown(seconds: number, onElapsed: () => void) {
    const [remaining, setRemaining] = useState<number | null>(null);
    const timer = useRef<number | null>(null);
    const callback = useRef(onElapsed);

    useEffect(() => {
        callback.current = onElapsed;
    }, [onElapsed]);

    const clear = useCallback(() => {
        if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
        }
    }, []);

    const cancel = useCallback(() => {
        clear();
        setRemaining(null);
    }, [clear]);

    const start = useCallback(() => {
        clear();
        let left = seconds;
        setRemaining(left);
        timer.current = window.setInterval(() => {
            left -= 1;
            if (left <= 0) {
                clear();
                setRemaining(null);
                callback.current();
            } else {
                setRemaining(left);
            }
        }, 1000);
    }, [clear, seconds]);

    useEffect(() => clear, [clear]);

    return { remaining, counting: remaining !== null, start, cancel };
}
