import { useEffect, useRef, useState } from 'react';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import { CandleSocket, TCandle } from '@/services/analysis/candle-socket';
import { TSocketStatus } from '@/services/analysis/public-tick-socket';

/* ── Types ───────────────────────────────────────────────────────────────── */
export type TIndicatorSignal = 'rise' | 'fall' | 'neutral';
export type TScanPhase = 'loading' | 'analyzing' | 'countdown' | 'active';

export type TMarketIndicators = {
    rsi: TIndicatorSignal;
    rsi_val: number | null;          // numeric RSI value for display
    ema_cross: TIndicatorSignal;     // EMA5 vs EMA20
    macd: TIndicatorSignal;          // EMA8 vs EMA21
    candle_pattern: TIndicatorSignal;
    pattern_name: string;
};

export type TMarketSignal = {
    symbol: string;
    display_name: string;
    status: TSocketStatus;
    last_price: number | null;
    candle_count: number;
    signal: TIndicatorSignal;
    strength: number;          // 0–4: how many indicators agree
    indicators: TMarketIndicators;
    phase: TScanPhase;
    countdown: number;         // 10 → 0
    time_remaining_s: number;  // seconds left in 3-min active window
};

/* ── Indicator math ──────────────────────────────────────────────────────── */

/** Wilder RSI on last `period+1` closes. Returns null if not enough data. */
function rsi(closes: number[], period = 14): number | null {
    if (closes.length < period + 1) return null;
    const slice = closes.slice(-(period + 1));
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
        const diff = slice[i] - slice[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avg_gain = gains / period;
    const avg_loss = losses / period;
    if (avg_loss === 0) return 100;
    return 100 - 100 / (1 + avg_gain / avg_loss);
}

/** Exponential moving average across all closes. Returns null if not enough data. */
function ema(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let val = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) val = closes[i] * k + val * (1 - k);
    return val;
}

/** Detect a candlestick pattern from up to the last 3 closed candles. */
function detectPattern(candles: TCandle[]): { name: string; signal: TIndicatorSignal } {
    if (candles.length < 2) return { name: '—', signal: 'neutral' };

    const c  = candles[candles.length - 1]; // last closed candle
    const p  = candles[candles.length - 2]; // previous candle
    const pp = candles.length >= 3 ? candles[candles.length - 3] : null;

    const cBody  = Math.abs(c.close  - c.open);
    const pBody  = Math.abs(p.close  - p.open);
    const cRange = c.high - c.low;
    const cUpper = c.high - Math.max(c.open, c.close);
    const cLower = Math.min(c.open, c.close) - c.low;
    const cBull  = c.close > c.open;
    const pBull  = p.close > p.open;

    // Three White Soldiers (3 consecutive bullish candles, each closing higher)
    if (pp && c.close > p.close && p.close > pp.close && cBull && pBull && pp.close > pp.open)
        return { name: '3 White Soldiers', signal: 'rise' };

    // Three Black Crows
    if (pp && c.close < p.close && p.close < pp.close && !cBull && !pBull && pp.close < pp.open)
        return { name: '3 Black Crows', signal: 'fall' };

    // Bullish Engulfing
    if (!pBull && cBull && c.open <= p.close && c.close >= p.open && cBody > pBody)
        return { name: 'Bullish Engulf', signal: 'rise' };

    // Bearish Engulfing
    if (pBull && !cBull && c.open >= p.close && c.close <= p.open && cBody > pBody)
        return { name: 'Bearish Engulf', signal: 'fall' };

    // Hammer (bullish reversal: long lower wick, small body, small upper wick)
    if (!pBull && cLower >= 2 * cBody && cUpper <= 0.5 * cBody && cRange > 0)
        return { name: 'Hammer 🔨', signal: 'rise' };

    // Shooting Star (bearish reversal: long upper wick, small body)
    if (pBull && cUpper >= 2 * cBody && cLower <= 0.5 * cBody && cRange > 0)
        return { name: 'Shooting Star ⭐', signal: 'fall' };

    // Morning Star (3-candle: bearish, small doji-like, bullish)
    if (pp && !pp.open && pp.close < pp.open && cBull && c.close > (pp.open + pp.close) / 2)
        return { name: 'Morning Star', signal: 'rise' };

    // Doji (body < 5 % of range)
    if (cRange > 0 && cBody / cRange < 0.05)
        return { name: 'Doji ✝', signal: 'neutral' };

    // Plain momentum bar
    return {
        name: cBull ? 'Bullish Bar' : 'Bearish Bar',
        signal: cBull ? 'rise' : 'fall',
    };
}

/** Full signal computation from closed 3-min candles. */
function computeSignal(candles: TCandle[]): {
    signal: TIndicatorSignal;
    strength: number;
    indicators: TMarketIndicators;
} {
    // Use only closed candles (drop the live/last one which is still forming)
    const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
    const closes = closed.map(c => c.close);

    // RSI(14)
    const rsi_val = rsi(closes, 14);
    const rsi_sig: TIndicatorSignal =
        rsi_val === null ? 'neutral' : rsi_val > 60 ? 'rise' : rsi_val < 40 ? 'fall' : 'neutral';

    // EMA 5 vs EMA 20 crossover
    const ema5  = ema(closes, 5);
    const ema20 = ema(closes, 20);
    const ema_cross: TIndicatorSignal =
        ema5 !== null && ema20 !== null
            ? ema5 > ema20 * 1.00005 ? 'rise'
            : ema5 < ema20 * 0.99995 ? 'fall'
            : 'neutral'
            : 'neutral';

    // MACD-like: EMA8 vs EMA21
    const ema8  = ema(closes, 8);
    const ema21 = ema(closes, 21);
    const macd: TIndicatorSignal =
        ema8 !== null && ema21 !== null
            ? ema8 > ema21 * 1.00003 ? 'rise'
            : ema8 < ema21 * 0.99997 ? 'fall'
            : 'neutral'
            : 'neutral';

    // Candlestick pattern (last 3 closed)
    const { name: pattern_name, signal: candle_pattern } = detectPattern(closed.slice(-3));

    // Majority vote across 4 indicators
    const votes = [rsi_sig, ema_cross, macd, candle_pattern];
    const rise_v = votes.filter(v => v === 'rise').length;
    const fall_v = votes.filter(v => v === 'fall').length;

    let signal: TIndicatorSignal = 'neutral';
    let strength = 0;
    if (rise_v > fall_v) {
        strength = rise_v;
        signal   = rise_v >= 2 ? 'rise' : 'neutral';
    } else if (fall_v > rise_v) {
        strength = fall_v;
        signal   = fall_v >= 2 ? 'fall' : 'neutral';
    }

    return {
        signal,
        strength,
        indicators: { rsi: rsi_sig, rsi_val, ema_cross, macd, candle_pattern, pattern_name },
    };
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const GRANULARITY      = 180; // 3-minute candles
const HISTORY_COUNT    = 60;  // 60 × 3 min = 3 hours of history
const COUNTDOWN_START  = 10;
const ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

/* ── Per-market mutable meta (not in React state) ────────────────────────── */
type TMeta = {
    candles: TCandle[];        // ring of closed + 1 live candle
    phase: TScanPhase;
    countdown: number;
    active_until: number;
    prev_signal: TIndicatorSignal;
    prev_strength: number;
};

/* ── Hook ─────────────────────────────────────────────────────────────────── */
const useMultiScanner = () => {
    const [markets, setMarkets] = useState<TMarketSignal[]>(() =>
        DIGIT_SYMBOLS.map(s => ({
            symbol:        s.symbol,
            display_name:  s.display_name,
            status:        'idle' as TSocketStatus,
            last_price:    null,
            candle_count:  0,
            signal:        'neutral' as TIndicatorSignal,
            strength:      0,
            indicators: {
                rsi:           'neutral' as TIndicatorSignal,
                rsi_val:       null,
                ema_cross:     'neutral' as TIndicatorSignal,
                macd:          'neutral' as TIndicatorSignal,
                candle_pattern:'neutral' as TIndicatorSignal,
                pattern_name:  '—',
            },
            phase:           'loading' as TScanPhase,
            countdown:       0,
            time_remaining_s:0,
        }))
    );

    const sockets_ref = useRef<CandleSocket[]>([]);
    const meta_ref    = useRef<TMeta[]>(
        DIGIT_SYMBOLS.map(() => ({
            candles:       [],
            phase:         'loading' as TScanPhase,
            countdown:     0,
            active_until:  0,
            prev_signal:   'neutral' as TIndicatorSignal,
            prev_strength: 0,
        }))
    );

    /* 1-second ticker for countdown / active-window display */
    useEffect(() => {
        const timer = setInterval(() => {
            const metas = meta_ref.current;
            setMarkets(prev =>
                prev.map((m, i) => {
                    const meta = metas[i];
                    if (meta.phase === 'countdown') {
                        if (meta.countdown > 1) {
                            meta.countdown--;
                            return { ...m, phase: 'countdown', countdown: meta.countdown };
                        }
                        // countdown done → open 3-min active window
                        meta.countdown    = 0;
                        meta.phase        = 'active';
                        meta.active_until = Date.now() + ACTIVE_WINDOW_MS;
                        return { ...m, phase: 'active', countdown: 0, time_remaining_s: Math.round(ACTIVE_WINDOW_MS / 1000) };
                    }
                    if (meta.phase === 'active') {
                        const rem = Math.max(0, Math.round((meta.active_until - Date.now()) / 1000));
                        if (rem === 0) {
                            meta.phase = 'analyzing';
                            return { ...m, phase: 'analyzing', time_remaining_s: 0 };
                        }
                        return { ...m, time_remaining_s: rem };
                    }
                    return m;
                })
            );
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    /* WebSocket subscriptions */
    useEffect(() => {
        const sockets = DIGIT_SYMBOLS.map(() => new CandleSocket());
        sockets_ref.current = sockets;

        const updateMarket = (idx: number, status: TSocketStatus) => {
            const meta = meta_ref.current[idx];
            if (meta.candles.length < 2) {
                setMarkets(prev => {
                    const next = [...prev];
                    next[idx] = { ...prev[idx], status, candle_count: meta.candles.length };
                    return next;
                });
                return;
            }

            const { signal, strength, indicators } = computeSignal(meta.candles);
            const last_price = meta.candles[meta.candles.length - 1]?.close ?? null;

            // Trigger 10-s countdown when signal fires strong (≥3) and we're idle
            if (
                meta.phase === 'analyzing' &&
                strength >= 3 &&
                signal !== 'neutral' &&
                (meta.prev_strength < 3 || signal !== meta.prev_signal)
            ) {
                meta.phase     = 'countdown';
                meta.countdown = COUNTDOWN_START;
            }

            // Direction flip during active window → reset
            if (
                meta.phase === 'active' &&
                signal !== 'neutral' &&
                meta.prev_signal !== 'neutral' &&
                signal !== meta.prev_signal
            ) {
                meta.phase = 'analyzing';
            }

            meta.prev_signal   = signal;
            meta.prev_strength = strength;

            setMarkets(prev => {
                const next = [...prev];
                next[idx] = {
                    ...prev[idx],
                    status,
                    last_price,
                    candle_count:  meta.candles.length,
                    signal,
                    strength,
                    indicators,
                    phase:         meta.phase,
                    countdown:     meta.countdown,
                    time_remaining_s: meta.phase === 'active'
                        ? Math.max(0, Math.round((meta.active_until - Date.now()) / 1000))
                        : 0,
                };
                return next;
            });
        };

        DIGIT_SYMBOLS.forEach((sym, i) => {
            sockets[i].subscribe(sym.symbol, HISTORY_COUNT, GRANULARITY, {
                onHistory: candles => {
                    meta_ref.current[i].candles = candles;
                    if (meta_ref.current[i].phase === 'loading') meta_ref.current[i].phase = 'analyzing';
                    updateMarket(i, 'open');
                },
                onUpdate: live_candle => {
                    const arr = meta_ref.current[i].candles;
                    if (arr.length === 0) {
                        arr.push(live_candle);
                    } else if (arr[arr.length - 1].epoch === live_candle.epoch) {
                        // update existing live candle in place
                        arr[arr.length - 1] = live_candle;
                    } else {
                        // new candle opened → previous one is now closed
                        arr.push(live_candle);
                    }
                    updateMarket(i, 'open');
                },
                onStatusChange: status => updateMarket(i, status),
                onError: () => updateMarket(i, 'closed'),
            });
        });

        return () => {
            for (const s of sockets) s.dispose();
            sockets_ref.current = [];
        };
    }, []);

    return { markets };
};

export default useMultiScanner;
