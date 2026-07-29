import { useEffect, useRef, useState } from 'react';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import { PublicTickSocket, TSocketStatus } from '@/services/analysis/public-tick-socket';

export type TIndicatorSignal = 'rise' | 'fall' | 'neutral';
export type TScanPhase = 'analyzing' | 'countdown' | 'active';

export type TMarketIndicators = {
    short_momentum: TIndicatorSignal;   // last 20 moves
    mid_momentum: TIndicatorSignal;     // last 50 moves
    ma_crossover: TIndicatorSignal;     // 10-MA vs 30-MA
    candle_pattern: TIndicatorSignal;   // candlestick pattern
    pattern_name: string;
};

export type TMarketSignal = {
    symbol: string;
    display_name: string;
    status: TSocketStatus;
    last_price: number | null;
    price_change_pct: number | null;
    signal: TIndicatorSignal;
    strength: number; // 0-4: how many indicators agree
    indicators: TMarketIndicators;
    tick_count: number;
    phase: TScanPhase;
    countdown: number;        // 10 → 0 during countdown
    time_remaining_s: number; // seconds left in 3-min active window
};

/* ── Price ring buffer ───────────────────────────────────────────────────── */
class PriceBuffer {
    private buf: Float64Array;
    private w = 0;
    private filled = 0;

    constructor(private cap: number) {
        this.buf = new Float64Array(cap);
    }

    push(price: number) {
        this.buf[this.w] = price;
        this.w = (this.w + 1) % this.cap;
        if (this.filled < this.cap) this.filled++;
    }

    /** Returns last `n` prices, oldest first. */
    last(n: number): number[] {
        const count = Math.min(n, this.filled);
        const result = new Array<number>(count);
        for (let i = 0; i < count; i++) {
            result[i] = this.buf[(this.w - count + i + this.cap) % this.cap];
        }
        return result;
    }

    get size() {
        return this.filled;
    }
}

/* ── Signal helpers ─────────────────────────────────────────────────────── */
function risePct(prices: number[]): number {
    let rises = 0, moves = 0;
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] !== prices[i - 1]) {
            moves++;
            if (prices[i] > prices[i - 1]) rises++;
        }
    }
    return moves > 0 ? (rises / moves) * 100 : 50;
}

function ma(prices: number[], n: number): number | null {
    if (prices.length < n) return null;
    const slice = prices.slice(prices.length - n);
    return slice.reduce((a, b) => a + b, 0) / n;
}

function detectPattern(prices: number[]): { name: string; signal: TIndicatorSignal } {
    if (prices.length < 10) return { name: '—', signal: 'neutral' };

    // Group last 10 ticks into two 5-tick mini-candles
    const p1 = prices.slice(-10, -5);
    const p2 = prices.slice(-5);

    const c1o = p1[0], c1c = p1[4];
    const c2o = p2[0], c2c = p2[4];
    const c1body = Math.abs(c1c - c1o);
    const c2body = Math.abs(c2c - c2o);
    const c2high = Math.max(...p2);
    const c2low = Math.min(...p2);
    const c2upper = c2high - Math.max(c2o, c2c);
    const c2lower = Math.min(c2o, c2c) - c2low;

    // Bullish engulfing
    if (c1c < c1o && c2c > c2o && c2body > c1body * 1.05)
        return { name: 'Bullish Engulf', signal: 'rise' };
    // Bearish engulfing
    if (c1c > c1o && c2c < c2o && c2body > c1body * 1.05)
        return { name: 'Bearish Engulf', signal: 'fall' };
    // Hammer (long lower shadow, bullish close)
    if (c2body > 0 && c2lower >= 1.5 * c2body && c2upper <= 0.5 * c2body && c2c > c2o)
        return { name: 'Hammer 🔨', signal: 'rise' };
    // Shooting star (long upper shadow, bearish close)
    if (c2body > 0 && c2upper >= 1.5 * c2body && c2lower <= 0.5 * c2body && c2c < c2o)
        return { name: 'Shooting Star ⭐', signal: 'fall' };
    // Three consecutive rising ticks
    const t3 = prices.slice(-3);
    if (t3[2] > t3[1] && t3[1] > t3[0]) return { name: 'Rising 3', signal: 'rise' };
    if (t3[2] < t3[1] && t3[1] < t3[0]) return { name: 'Falling 3', signal: 'fall' };
    // Doji (tiny body vs range)
    const c2range = c2high - c2low;
    if (c2range > 0 && c2body / c2range < 0.08) return { name: 'Doji ✝', signal: 'neutral' };
    // Plain bar
    return {
        name: c2c > c2o ? 'Bullish Bar' : c2c < c2o ? 'Bearish Bar' : 'Flat Bar',
        signal: c2c > c2o ? 'rise' : c2c < c2o ? 'fall' : 'neutral',
    };
}

function computeSignal(buf: PriceBuffer): {
    signal: TIndicatorSignal;
    strength: number;
    indicators: TMarketIndicators;
} {
    const p100 = buf.last(100);
    const p50 = p100.slice(-50);
    const p20 = p100.slice(-20);

    const short_pct = risePct(p20);
    const short_momentum: TIndicatorSignal = short_pct > 60 ? 'rise' : short_pct < 40 ? 'fall' : 'neutral';

    const mid_pct = risePct(p50);
    const mid_momentum: TIndicatorSignal = mid_pct > 55 ? 'rise' : mid_pct < 45 ? 'fall' : 'neutral';

    const ma10 = ma(p100, 10);
    const ma30 = ma(p100, 30);
    const ma_crossover: TIndicatorSignal =
        ma10 !== null && ma30 !== null
            ? ma10 > ma30 * 1.000015
                ? 'rise'
                : ma10 < ma30 * 0.999985
                ? 'fall'
                : 'neutral'
            : 'neutral';

    const { name: pattern_name, signal: candle_pattern } = detectPattern(p100);

    const votes = [short_momentum, mid_momentum, ma_crossover, candle_pattern];
    const rise_v = votes.filter(v => v === 'rise').length;
    const fall_v = votes.filter(v => v === 'fall').length;

    let signal: TIndicatorSignal = 'neutral';
    let strength = 0;
    if (rise_v > fall_v) {
        strength = rise_v;
        signal = rise_v >= 2 ? 'rise' : 'neutral';
    } else if (fall_v > rise_v) {
        strength = fall_v;
        signal = fall_v >= 2 ? 'fall' : 'neutral';
    }

    return {
        signal,
        strength,
        indicators: { short_momentum, mid_momentum, ma_crossover, candle_pattern, pattern_name },
    };
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

const COUNTDOWN_START = 10;
const ACTIVE_DURATION_MS = 3 * 60 * 1000; // 3 minutes

type TMeta = {
    phase: TScanPhase;
    countdown: number;
    active_until: number;
    prev_signal: TIndicatorSignal;
    prev_strength: number;
};

const useMultiScanner = () => {
    const init = (): TMarketSignal[] =>
        DIGIT_SYMBOLS.map(s => ({
            symbol: s.symbol,
            display_name: s.display_name,
            status: 'idle' as TSocketStatus,
            last_price: null,
            price_change_pct: null,
            signal: 'neutral' as TIndicatorSignal,
            strength: 0,
            indicators: {
                short_momentum: 'neutral' as TIndicatorSignal,
                mid_momentum: 'neutral' as TIndicatorSignal,
                ma_crossover: 'neutral' as TIndicatorSignal,
                candle_pattern: 'neutral' as TIndicatorSignal,
                pattern_name: '—',
            },
            tick_count: 0,
            phase: 'analyzing' as TScanPhase,
            countdown: 0,
            time_remaining_s: 0,
        }));

    const [markets, setMarkets] = useState<TMarketSignal[]>(init);

    const sockets_ref = useRef<PublicTickSocket[]>([]);
    const buffers_ref = useRef<PriceBuffer[]>([]);
    const meta_ref = useRef<TMeta[]>(
        DIGIT_SYMBOLS.map(() => ({
            phase: 'analyzing' as TScanPhase,
            countdown: 0,
            active_until: 0,
            prev_signal: 'neutral' as TIndicatorSignal,
            prev_strength: 0,
        }))
    );

    // 1-second interval for countdown / active-window ticking
    useEffect(() => {
        const timer = setInterval(() => {
            const metas = meta_ref.current;
            setMarkets(prev =>
                prev.map((m, i) => {
                    const meta = metas[i];
                    if (meta.phase === 'countdown') {
                        if (meta.countdown > 1) {
                            meta.countdown--;
                            return { ...m, phase: 'countdown', countdown: meta.countdown, time_remaining_s: 0 };
                        } else {
                            // countdown done → activate 3-min window
                            meta.countdown = 0;
                            meta.phase = 'active';
                            meta.active_until = Date.now() + ACTIVE_DURATION_MS;
                            return { ...m, phase: 'active', countdown: 0, time_remaining_s: Math.round(ACTIVE_DURATION_MS / 1000) };
                        }
                    } else if (meta.phase === 'active') {
                        const remaining = Math.max(0, Math.round((meta.active_until - Date.now()) / 1000));
                        if (remaining === 0) {
                            meta.phase = 'analyzing';
                            return { ...m, phase: 'analyzing', time_remaining_s: 0 };
                        }
                        return { ...m, time_remaining_s: remaining };
                    }
                    return m;
                })
            );
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // WebSocket subscriptions for all 12 markets
    useEffect(() => {
        const sockets = DIGIT_SYMBOLS.map(() => new PublicTickSocket());
        const buffers = DIGIT_SYMBOLS.map(() => new PriceBuffer(200));
        sockets_ref.current = sockets;
        buffers_ref.current = buffers;

        const updateMarket = (idx: number, new_price: number | null, status: TSocketStatus) => {
            const buf = buffers[idx];
            const meta = meta_ref.current[idx];

            setMarkets(prev => {
                const prev_m = prev[idx];
                let { signal, strength, indicators } = prev_m;

                if (buf.size >= 22) {
                    ({ signal, strength, indicators } = computeSignal(buf));
                }

                // Compute price change %
                let price_change_pct = prev_m.price_change_pct;
                if (new_price !== null && prev_m.last_price !== null && prev_m.last_price !== 0) {
                    price_change_pct = ((new_price - prev_m.last_price) / prev_m.last_price) * 100;
                }

                // Trigger countdown when signal becomes strong (≥3) and wasn't before
                if (
                    meta.phase === 'analyzing' &&
                    strength >= 3 &&
                    signal !== 'neutral' &&
                    (meta.prev_strength < 3 || signal !== meta.prev_signal)
                ) {
                    meta.phase = 'countdown';
                    meta.countdown = COUNTDOWN_START;
                }

                // If signal flips direction during active window → reset
                if (meta.phase === 'active' && signal !== 'neutral' && signal !== meta.prev_signal && meta.prev_signal !== 'neutral') {
                    meta.phase = 'analyzing';
                }

                meta.prev_signal = signal;
                meta.prev_strength = strength;

                const next: TMarketSignal = {
                    ...prev_m,
                    status,
                    last_price: new_price ?? prev_m.last_price,
                    price_change_pct,
                    signal,
                    strength,
                    indicators,
                    tick_count: prev_m.tick_count + (new_price !== null ? 1 : 0),
                    phase: meta.phase,
                    countdown: meta.countdown,
                };

                const next_arr = [...prev];
                next_arr[idx] = next;
                return next_arr;
            });
        };

        DIGIT_SYMBOLS.forEach((sym, i) => {
            sockets[i].subscribe(sym.symbol, 100, {
                onHistory: ({ prices }) => {
                    for (const p of prices) buffers[i].push(p);
                    updateMarket(i, prices[prices.length - 1] ?? null, 'open');
                },
                onTick: tick => {
                    buffers[i].push(tick.quote);
                    updateMarket(i, tick.quote, 'open');
                },
                onStatusChange: status => updateMarket(i, null, status),
            });
        });

        return () => {
            for (const s of sockets) s.dispose();
            sockets_ref.current = [];
            buffers_ref.current = [];
        };
    }, []);

    return { markets };
};

export default useMultiScanner;
