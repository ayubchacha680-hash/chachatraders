import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SPEED_MODE, ROLLING_WINDOW_SIZE, SPEED_MODE_CONFIG, TSpeedMode } from '@/constants/analysis';
import {
    EMPTY_SNAPSHOT,
    getLastDigit,
    RollingDigitWindow,
    TAnalysisSnapshot,
} from '@/services/analysis/digit-analysis';
import { getPublicTickSocket, TSocketStatus, TTickMessage } from '@/services/analysis/public-tick-socket';

export type TUseDigitAnalysis = {
    snapshot: TAnalysisSnapshot;
    status: TSocketStatus;
    error: string | null;
    speed_mode: TSpeedMode;
    setSpeedMode: (mode: TSpeedMode) => void;
    /** Feed rate measured over the last 10 ticks. */
    ticks_per_second: number;
};

/**
 * Streams a symbol's ticks into a fixed 1000-tick rolling window and publishes
 * snapshots to React.
 *
 * The pipeline is split so a burst of ticks can never block the UI:
 * socket → queue → rolling window (every tick, synchronously) →
 * requestAnimationFrame → a single setState. Digit extraction and the counters run
 * on every tick with no debounce; only the paint is coalesced, at the cadence set
 * by the speed mode.
 */
const useDigitAnalysis = (symbol: string): TUseDigitAnalysis => {
    const [snapshot, setSnapshot] = useState<TAnalysisSnapshot>(EMPTY_SNAPSHOT);
    const [status, setStatus] = useState<TSocketStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [speed_mode, setSpeedMode] = useState<TSpeedMode>(DEFAULT_SPEED_MODE);
    const [ticks_per_second, setTicksPerSecond] = useState(0);

    const window_ref = useRef(new RollingDigitWindow(ROLLING_WINDOW_SIZE));
    const queue_ref = useRef<TTickMessage[]>([]);
    const frame_id_ref = useRef<number | null>(null);
    const timer_id_ref = useRef<ReturnType<typeof setTimeout> | null>(null);
    const last_publish_ref = useRef(0);
    const pending_ticks_ref = useRef(0);
    const tick_times_ref = useRef<number[]>([]);
    const speed_mode_ref = useRef(speed_mode);
    speed_mode_ref.current = speed_mode;

    const publish = useCallback(() => {
        frame_id_ref.current = null;
        timer_id_ref.current = null;
        pending_ticks_ref.current = 0;
        last_publish_ref.current = performance.now();
        setSnapshot(window_ref.current.snapshot());

        const times = tick_times_ref.current;
        if (times.length > 1) {
            const span_ms = times[times.length - 1] - times[0];
            setTicksPerSecond(span_ms > 0 ? ((times.length - 1) / span_ms) * 1000 : 0);
        }
    }, []);

    /**
     * Requests a paint. Throttling skips frames rather than ticks — the rolling
     * window is already current whichever mode is active.
     */
    const scheduleRender = useCallback(() => {
        if (frame_id_ref.current !== null || timer_id_ref.current !== null) return;

        const { min_ticks_per_render, min_render_interval_ms } = SPEED_MODE_CONFIG[speed_mode_ref.current];
        if (pending_ticks_ref.current < min_ticks_per_render) return;

        const elapsed = performance.now() - last_publish_ref.current;
        if (min_render_interval_ms > 0 && elapsed < min_render_interval_ms) {
            timer_id_ref.current = setTimeout(publish, min_render_interval_ms - elapsed);
            return;
        }

        frame_id_ref.current = requestAnimationFrame(publish);
    }, [publish]);

    const drainQueue = useCallback(() => {
        const queue = queue_ref.current;
        if (!queue.length) return;

        for (const tick of queue) {
            window_ref.current.push(getLastDigit(tick.quote, tick.pip_size), tick.quote);
        }
        pending_ticks_ref.current += queue.length;
        queue.length = 0;
        scheduleRender();
    }, [scheduleRender]);

    useEffect(() => {
        const socket = getPublicTickSocket();
        const analysis_window = window_ref.current;

        setError(null);
        analysis_window.reset();
        queue_ref.current.length = 0;
        tick_times_ref.current.length = 0;
        setSnapshot(EMPTY_SNAPSHOT);

        socket.subscribe(symbol, ROLLING_WINDOW_SIZE, {
            // History arrives as one message, so the window is full on the first
            // paint — the percentages never go through a growing phase.
            onHistory: ({ prices, pip_size }) => {
                analysis_window.seed(
                    prices.map(price => getLastDigit(price, pip_size)),
                    prices
                );
                publish();
            },
            onTick: tick => {
                queue_ref.current.push(tick);
                const times = tick_times_ref.current;
                times.push(performance.now());
                if (times.length > 10) times.shift();
                drainQueue();
            },
            onError: setError,
            onStatusChange: setStatus,
        });

        return () => {
            socket.unsubscribe();
            if (frame_id_ref.current !== null) cancelAnimationFrame(frame_id_ref.current);
            if (timer_id_ref.current !== null) clearTimeout(timer_id_ref.current);
            frame_id_ref.current = null;
            timer_id_ref.current = null;
        };
    }, [symbol, drainQueue, publish]);

    return { snapshot, status, error, speed_mode, setSpeedMode, ticks_per_second };
};

export default useDigitAnalysis;
