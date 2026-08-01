import { useEffect, useRef, useState } from 'react';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import { CandleSocket, TCandle } from '@/services/analysis/candle-socket';
import { TSocketStatus } from '@/services/analysis/public-tick-socket';

/* ── Types ───────────────────────────────────────────────────────────────── */
export type TIndicatorSignal = 'rise' | 'fall' | 'neutral';
export type TScanPhase = 'loading' | 'analyzing' | 'countdown' | 'active';

export type TMarketIndicators = {
    rsi: TIndicatorSignal;        // repurposed: overall TREND (EMA slope)
    rsi_val: number | null;       // unused (null)
    ema_cross: TIndicatorSignal;  // EMA 9 vs EMA 21 position
    macd: TIndicatorSignal;       // MACD line cross direction
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
    strength: number;          // 0–4: how many of the 4 condition groups pass
    indicators: TMarketIndicators;
    phase: TScanPhase;
    countdown: number;         // 10 → 0
    time_remaining_s: number;  // seconds left in active window
};

/* ── Maths helpers ───────────────────────────────────────────────────────── */

/**
 * Returns the full EMA series (one value per input from index `period-1` onward).
 * result[k] = EMA at closes[period - 1 + k]
 */
function emaSeries(closes: number[], period: number): number[] {
    if (closes.length < period) return [];
    const k    = 2 / (period + 1);
    const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const out  = new Array<number>(closes.length - period + 1);
    out[0]     = seed;
    for (let i = period; i < closes.length; i++) {
        out[i - period + 1] = closes[i] * k + out[i - period] * (1 - k);
    }
    return out;
}

/**
 * True if `series` has been consistently sloping in `dir` over the last
 * `window` bars. MIN_SLOPE prevents flat EMAs from triggering.
 */
function isSloping(series: number[], dir: 'up' | 'down', window = 3): boolean {
    if (series.length < window + 1) return false;
    const recent = series[series.length - 1];
    const past   = series[series.length - 1 - window];
    if (Math.abs(past) < 1e-10) return false;
    const change   = (recent - past) / Math.abs(past);
    const MIN_SLOPE = 0.00015; // ~0.015 % min slope to filter flat EMAs
    return dir === 'up' ? change > MIN_SLOPE : change < -MIN_SLOPE;
}

/**
 * Full MACD history: MACD line (EMA12 − EMA26) + Signal (EMA9 of MACD) + Histogram.
 * Needs ≥ 35 closes (26 + 9) to produce at least one entry.
 */
function macdSeries(closes: number[]): Array<{ macd: number; signal: number; hist: number }> {
    const e12 = emaSeries(closes, 12); // length = N - 11, aligns to closes[11..]
    const e26 = emaSeries(closes, 26); // length = N - 25, aligns to closes[25..]
    if (e12.length < 1 || e26.length < 1) return [];

    // At closes[25 + i]: EMA12 index = (25 + i) - 11 = 14 + i
    const n          = e26.length;
    const macd_line  = new Array<number>(n);
    for (let i = 0; i < n; i++) macd_line[i] = e12[14 + i] - e26[i];

    const sig_line = emaSeries(macd_line, 9); // length = n - 8
    if (sig_line.length < 1) return [];

    return sig_line.map((sig, i) => ({
        macd:   macd_line[8 + i],
        signal: sig,
        hist:   macd_line[8 + i] - sig,
    }));
}

/* ── Candlestick pattern detection ──────────────────────────────────────── */

/**
 * Detects named high-quality patterns only.
 * Hammer / Shooting Star require the NEXT candle to confirm — so c is the
 * confirmation candle and p is the pattern candle.
 * Plain momentum bars return 'neutral' (not a named pattern).
 */
function detectPattern(candles: TCandle[]): { name: string; signal: TIndicatorSignal } {
    if (candles.length < 2) return { name: '—', signal: 'neutral' };

    const c  = candles[candles.length - 1]; // most recent closed
    const p  = candles[candles.length - 2];
    const pp = candles.length >= 3 ? candles[candles.length - 3] : null;

    const cBody  = Math.abs(c.close  - c.open);
    const pBody  = Math.abs(p.close  - p.open);
    const ppBody = pp ? Math.abs(pp.close - pp.open) : 0;
    const cRange = c.high - c.low;
    const pRange = p.high - p.low;

    const cBull  = c.close > c.open;
    const pBull  = p.close > p.open;

    const cUpper = c.high - Math.max(c.open, c.close);
    const cLower = Math.min(c.open, c.close) - c.low;
    const pUpper = p.high - Math.max(p.open, p.close);
    const pLower = Math.min(p.open, p.close) - p.low;

    // Tiny-candle guard: body must be at least 5 % of range to count as pattern
    const MIN_RATIO = 0.05;
    if (cRange > 0 && cBody / cRange < MIN_RATIO) return { name: 'Doji (skip)', signal: 'neutral' };

    /* ── BULLISH ── */

    // Bullish Engulfing
    if (!pBull && cBull && c.open <= p.close && c.close >= p.open && cBody > pBody)
        return { name: 'Bullish Engulf', signal: 'rise' };

    // Hammer + confirmation (p = hammer, c = bullish confirm)
    if (
        pRange > 0 && pBody / pRange >= MIN_RATIO &&
        pLower >= 2 * pBody && pUpper <= 0.5 * pBody && !pBull &&
        cBull
    ) return { name: 'Hammer+Confirm', signal: 'rise' };

    // Morning Star (pp bearish, p small indecision body < 40 % of pp, c bullish above pp midpoint)
    if (pp) {
        const ppBull = pp.close > pp.open;
        const ppMid  = (pp.open + pp.close) / 2;
        if (!ppBull && ppBody > 0 && pBody < 0.4 * ppBody && cBull && c.close > ppMid)
            return { name: 'Morning Star', signal: 'rise' };
    }

    /* ── BEARISH ── */

    // Bearish Engulfing
    if (pBull && !cBull && c.open >= p.close && c.close <= p.open && cBody > pBody)
        return { name: 'Bearish Engulf', signal: 'fall' };

    // Shooting Star + confirmation (p = shooting star, c = bearish confirm)
    if (
        pRange > 0 && pBody / pRange >= MIN_RATIO &&
        pUpper >= 2 * pBody && pLower <= 0.5 * pBody && pBull &&
        !cBull
    ) return { name: 'ShootingStar+Confirm', signal: 'fall' };

    // Evening Star (pp bullish, p small body, c bearish below pp midpoint)
    if (pp) {
        const ppBull = pp.close > pp.open;
        const ppMid  = (pp.open + pp.close) / 2;
        if (ppBull && ppBody > 0 && pBody < 0.4 * ppBody && !cBull && c.close < ppMid)
            return { name: 'Evening Star', signal: 'fall' };
    }

    // Three White Soldiers
    if (pp && cBull && pBull && pp.close > pp.open &&
        c.close > p.close && p.close > pp.close)
        return { name: '3 White Soldiers', signal: 'rise' };

    // Three Black Crows
    if (pp && !cBull && !pBull && pp.close < pp.open &&
        c.close < p.close && p.close < pp.close)
        return { name: '3 Black Crows', signal: 'fall' };

    // All other candles → neutral (plain bars don't count)
    return { name: '—', signal: 'neutral' };
}

/* ── Full signal computation ─────────────────────────────────────────────── */

/**
 * Strict ALL-conditions-must-pass signal on 1-min closed candles.
 *
 * BUY requires ALL of:
 *   Trend:     EMA9 > EMA21 AND both sloping up
 *   Momentum:  MACD line crosses above signal AND histogram increasing
 *   Pattern:   named bullish candlestick pattern (no plain bars)
 *   Price:     close above EMA9 AND recent pullback below EMA9 (support touch)
 *
 * SELL is the mirror image.
 *
 * AI filters:
 *   - Sideways market (EMA9/21 cross ≥ 3 times in last 20 bars) → no signal
 *   - Tiny candle body (< 30 % of 10-bar average) → no pattern
 */
function computeSignal(candles: TCandle[]): {
    signal: TIndicatorSignal;
    strength: number;
    indicators: TMarketIndicators;
    last_closed_epoch: number;
} {
    // Only analyse CLOSED candles (drop the still-forming last one)
    const closed = candles.length > 1 ? candles.slice(0, -1) : candles;
    const closes = closed.map(c => c.close);
    const last_closed_epoch = closed.length > 0 ? closed[closed.length - 1].epoch : 0;

    const neutral_result = {
        signal:    'neutral' as TIndicatorSignal,
        strength:  0,
        indicators: {
            rsi:           'neutral' as TIndicatorSignal,
            rsi_val:       null,
            ema_cross:     'neutral' as TIndicatorSignal,
            macd:          'neutral' as TIndicatorSignal,
            candle_pattern:'neutral' as TIndicatorSignal,
            pattern_name:  '—',
        },
        last_closed_epoch,
    };

    // Need enough candles: 26 (EMA26) + 9 (MACD signal) + a few buffer = 40 minimum
    if (closes.length < 40) return neutral_result;

    /* ── EMA 9 & 21 series ───────────────────────────────────────────── */
    const ema9s  = emaSeries(closes, 9);
    const ema21s = emaSeries(closes, 21);
    if (ema9s.length < 5 || ema21s.length < 5) return neutral_result;

    const ema9  = ema9s[ema9s.length - 1];
    const ema21 = ema21s[ema21s.length - 1];

    /* Sideways filter: count EMA9/21 crossings in last 20 candle slots */
    const sw_len = Math.min(20, ema9s.length - 1, ema21s.length - 1);
    let cross_count = 0;
    for (let k = 0; k < sw_len; k++) {
        // ema9s aligns to closes[8..], ema21s aligns to closes[20..]
        // Offset between series: ema9s starts 12 bars earlier than ema21s
        const i9 = ema9s.length  - 1 - k;
        const i21= ema21s.length - 1 - k;
        if (i9 < 1 || i21 < 1) break;
        const was_above = ema9s[i9 - 1]  > ema21s[i21 - 1];
        const now_above = ema9s[i9]       > ema21s[i21];
        if (was_above !== now_above) cross_count++;
    }
    if (cross_count >= 3) return neutral_result; // sideways — skip

    /* ── EMA slope ───────────────────────────────────────────────────── */
    const ema9_up    = isSloping(ema9s,  'up',   3);
    const ema9_down  = isSloping(ema9s,  'down', 3);
    const ema21_up   = isSloping(ema21s, 'up',   3);
    const ema21_down = isSloping(ema21s, 'down', 3);

    /* ── MACD ────────────────────────────────────────────────────────── */
    const macd_arr = macdSeries(closes);
    if (macd_arr.length < 2) return neutral_result;

    const cur = macd_arr[macd_arr.length - 1];
    const prv = macd_arr[macd_arr.length - 2];

    const macd_bull_cross = cur.macd > cur.signal && prv.macd <= prv.signal;
    const macd_bear_cross = cur.macd < cur.signal && prv.macd >= prv.signal;
    const hist_rising     = cur.hist > prv.hist;
    const hist_falling    = cur.hist < prv.hist;

    /* ── Candlestick pattern ─────────────────────────────────────────── */
    const { name: pattern_name, signal: candle_signal } = detectPattern(closed.slice(-4));

    /* ── Price-action checks ─────────────────────────────────────────── */
    const current_close = closes[closes.length - 1];
    const above_ema9    = current_close > ema9;
    const below_ema9    = current_close < ema9;

    // Pullback: at least one of the prior 3 closed candles touched the other side of EMA9
    // (indicates a support/resistance test before the breakout)
    const recent_closes = closes.slice(-4, -1); // 3 bars before current
    const recent_ema9   = ema9s.slice(-4, -1);
    const had_pullback_below = recent_closes.some((cl, i) => cl < (recent_ema9[i] ?? ema9));
    const had_pullback_above = recent_closes.some((cl, i) => cl > (recent_ema9[i] ?? ema9));

    /* ── Condition groups (4 groups = max strength) ──────────────────── */
    const trend_bull    = ema9 > ema21 && ema9_up  && ema21_up;
    const momentum_bull = macd_bull_cross && hist_rising;
    const pattern_bull  = candle_signal === 'rise';
    const price_bull    = above_ema9 && had_pullback_below;

    const trend_bear    = ema9 < ema21 && ema9_down && ema21_down;
    const momentum_bear = macd_bear_cross && hist_falling;
    const pattern_bear  = candle_signal === 'fall';
    const price_bear    = below_ema9 && had_pullback_above;

    /* ── Final decision: ALL groups must pass ────────────────────────── */
    let signal: TIndicatorSignal = 'neutral';
    let strength = 0;

    if (trend_bull && momentum_bull && pattern_bull && price_bull) {
        signal   = 'rise';
        strength = 4;
    } else if (trend_bear && momentum_bear && pattern_bear && price_bear) {
        signal   = 'fall';
        strength = 4;
    } else {
        // Partial score for display (signal stays neutral — no alert fires)
        const bull_score = [trend_bull, momentum_bull, pattern_bull, price_bull].filter(Boolean).length;
        const bear_score = [trend_bear, momentum_bear, pattern_bear, price_bear].filter(Boolean).length;
        strength = Math.max(bull_score, bear_score);
    }

    /* ── Indicator breakdown for UI columns ─────────────────────────── */
    const ema_cross_sig: TIndicatorSignal = ema9 > ema21 ? 'rise' : ema9 < ema21 ? 'fall' : 'neutral';
    const trend_sig: TIndicatorSignal     = trend_bull ? 'rise' : trend_bear ? 'fall' : 'neutral';
    const macd_sig: TIndicatorSignal      = macd_bull_cross ? 'rise' : macd_bear_cross ? 'fall' : 'neutral';

    return {
        signal,
        strength,
        indicators: {
            rsi:           trend_sig,      // column shows TREND (slope) status
            rsi_val:       null,
            ema_cross:     ema_cross_sig,  // EMA9 above/below EMA21
            macd:          macd_sig,       // MACD cross direction
            candle_pattern: candle_signal,
            pattern_name,
        },
        last_closed_epoch,
    };
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const GRANULARITY      = 60;   // 1-minute candles
const HISTORY_COUNT    = 120;  // 2 hours of 1-min history
const COUNTDOWN_START  = 10;
const ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 3-minute entry window

/* ── Per-market mutable meta (not in React state) ────────────────────────── */
type TMeta = {
    candles: TCandle[];
    phase: TScanPhase;
    countdown: number;
    active_until: number;
    prev_signal: TIndicatorSignal;
    prev_strength: number;
    last_trigger_epoch: number; // epoch of closed candle that last fired a signal
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
            phase:            'loading' as TScanPhase,
            countdown:        0,
            time_remaining_s: 0,
        }))
    );

    const sockets_ref = useRef<CandleSocket[]>([]);
    const meta_ref    = useRef<TMeta[]>(
        DIGIT_SYMBOLS.map(() => ({
            candles:            [],
            phase:              'loading' as TScanPhase,
            countdown:          0,
            active_until:       0,
            prev_signal:        'neutral' as TIndicatorSignal,
            prev_strength:      0,
            last_trigger_epoch: 0,
        }))
    );

    /* 1-second ticker: drives countdown and active-window timer */
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
                        // Countdown complete → open active entry window
                        meta.countdown    = 0;
                        meta.phase        = 'active';
                        meta.active_until = Date.now() + ACTIVE_WINDOW_MS;
                        return {
                            ...m,
                            phase:            'active',
                            countdown:        0,
                            time_remaining_s: Math.round(ACTIVE_WINDOW_MS / 1000),
                        };
                    }
                    if (meta.phase === 'active') {
                        const rem = Math.max(0, Math.round((meta.active_until - Date.now()) / 1000));
                        if (rem === 0) {
                            // Active window expired → back to analysing
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
                    next[idx]  = { ...prev[idx], status, candle_count: meta.candles.length };
                    return next;
                });
                return;
            }

            const { signal, strength, indicators, last_closed_epoch } = computeSignal(meta.candles);
            const last_price = meta.candles[meta.candles.length - 1]?.close ?? null;

            // ── Signal trigger ──────────────────────────────────────────────
            // Fire only when:
            //   • we are in analysing phase (not mid-countdown or mid-active-window)
            //   • ALL 4 condition groups pass (signal is non-neutral, strength = 4)
            //   • a NEW 1-min candle has closed since the last trigger
            //     → prevents the same closed-candle dataset from re-firing the
            //       instant the active window expires
            if (
                meta.phase === 'analyzing' &&
                signal !== 'neutral' &&
                strength >= 4 &&
                last_closed_epoch > meta.last_trigger_epoch
            ) {
                meta.last_trigger_epoch = last_closed_epoch;
                meta.phase              = 'countdown';
                meta.countdown          = COUNTDOWN_START;
            }

            // NOTE: no direction-flip reset — active window always runs to completion.

            meta.prev_signal   = signal;
            meta.prev_strength = strength;

            setMarkets(prev => {
                const next = [...prev];
                next[idx]  = {
                    ...prev[idx],
                    status,
                    last_price,
                    candle_count:     meta.candles.length,
                    signal,
                    strength,
                    indicators,
                    phase:            meta.phase,
                    countdown:        meta.countdown,
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
                        arr[arr.length - 1] = live_candle; // update live candle in place
                    } else {
                        arr.push(live_candle); // new candle opened; previous is now closed
                    }
                    updateMarket(i, 'open');
                },
                onStatusChange: status => updateMarket(i, status),
                onError: ()     => updateMarket(i, 'closed'),
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
