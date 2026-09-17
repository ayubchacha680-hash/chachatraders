import { useEffect, useRef, useState } from 'react';
import { DIGIT_SYMBOLS, OVER_UNDER_PAIRS } from '@/constants/analysis';
import { getPublicTickSocket } from '@/services/analysis/public-tick-socket';
import { RollingDigitWindow, getLastDigit, TDigitStats } from '@/services/analysis/digit-analysis';
import './dcircles.scss';

const WINDOW_SIZE = 1000;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ── Slot/circle dimensions ─────────────────────────────────────────────── */
const SLOT_W      = 66;
const SLOT_GAP    = 16;
const CIRCLE_SIZE = 56;  // px – circle diameter

const emptyDigitStats = (): TDigitStats[] =>
    DIGITS.map(digit => ({ digit, count: 0, percentage: 0 }));

const getHottestDigit = (stats: TDigitStats[]): TDigitStats | null => {
    if (!stats.some(digit => digit.count > 0)) return null;
    return stats.reduce((hottest, digit) => digit.percentage > hottest.percentage ? digit : hottest);
};

/* ── Gradient colours per rank ─────────────────────────────────────────── */
const COLOR_MAP: Record<string, { grad: string; glow: string }> = {
    highest: { grad: 'radial-gradient(circle at 38% 32%, #66ff99 0%, #00cc00 55%, #005500 100%)', glow: '#00cc00' },
    second:  { grad: 'radial-gradient(circle at 38% 32%, #66aaff 0%, #0066ff 55%, #003388 100%)', glow: '#0066ff' },
    lowest:  { grad: 'radial-gradient(circle at 38% 32%, #ff6666 0%, #ff0000 55%, #880000 100%)', glow: '#ff0000' },
    second_l:{ grad: 'radial-gradient(circle at 38% 32%, #ffee66 0%, #FFD700 55%, #886600 100%)', glow: '#FFD700' },
    normal:  { grad: 'radial-gradient(circle at 38% 32%, #b0b0b0 0%, #787878 55%, #3a3a3a 100%)', glow: '#888888' },
};

function assignColors(digits: TDigitStats[]): Record<number, { grad: string; glow: string }> {
    const rounded     = digits.map(d => ({ digit: d.digit, pct: Math.round(d.percentage * 100) / 100 }));
    const unique_pcts = [...new Set(rounded.map(d => d.pct))].sort((a, b) => b - a);
    const n           = unique_pcts.length;
    const rank_of     = new Map<number, number>();
    unique_pcts.forEach((pct, i) => rank_of.set(pct, i));

    const result: Record<number, { grad: string; glow: string }> = {};
    for (const { digit, pct } of rounded) {
        const rank = rank_of.get(pct) ?? 0;
        if      (rank === 0)     result[digit] = COLOR_MAP.highest;
        else if (rank === 1)     result[digit] = COLOR_MAP.second;
        else if (rank === n - 1) result[digit] = COLOR_MAP.lowest;
        else if (rank === n - 2) result[digit] = COLOR_MAP.second_l;
        else                     result[digit] = COLOR_MAP.normal;
    }
    return result;
}

/* ── Main component ─────────────────────────────────────────────────────── */
const DCircles = () => {
    const [symbol, setSymbol]               = useState('R_100');
    const [digits, setDigits]               = useState<TDigitStats[]>(emptyDigitStats());
    const [digits_25, setDigits25]          = useState<TDigitStats[]>(emptyDigitStats());
    const [digits_50, setDigits50]          = useState<TDigitStats[]>(emptyDigitStats());
    const [current_digit, setCurrentDigit]  = useState<number | null>(null);
    const [current_price, setCurrentPrice]  = useState<number | null>(null);
    const [sample_size, setSampleSize]      = useState(0);
    const [total_ticks, setTotalTicks]      = useState(0);
    const [status, setStatus]               = useState<string>('idle');
    const [pip_size, setPipSize]            = useState(2);

    const window_ref = useRef(new RollingDigitWindow(WINDOW_SIZE));
    const window_25_ref = useRef(new RollingDigitWindow(25));
    const window_50_ref = useRef(new RollingDigitWindow(50));
    const frame_ref  = useRef<number | null>(null);

    /* subscribe to tick stream */
    useEffect(() => {
        const win = window_ref.current;
        const win_25 = window_25_ref.current;
        const win_50 = window_50_ref.current;
        win.reset();
        win_25.reset();
        win_50.reset();
        setDigits(emptyDigitStats());
        setDigits25(emptyDigitStats());
        setDigits50(emptyDigitStats());
        setCurrentDigit(null);
        setCurrentPrice(null);
        setSampleSize(0);
        setTotalTicks(0);
        setStatus('connecting');

        const socket = getPublicTickSocket();
        socket.subscribe(symbol, WINDOW_SIZE, {
            onHistory: ({ prices, pip_size: ps }) => {
                setPipSize(ps);
                const history_digits = prices.map(p => getLastDigit(p, ps));
                win.seed(history_digits, prices);
                win_25.seed(history_digits, prices);
                win_50.seed(history_digits, prices);
                const snap = win.snapshot();
                const snap_25 = win_25.snapshot();
                const snap_50 = win_50.snapshot();
                setDigits(snap.digits);
                setDigits25(snap_25.digits);
                setDigits50(snap_50.digits);
                setSampleSize(snap.sample_size);
                setTotalTicks(snap.total_ticks);
                setCurrentDigit(snap.last_digit);
                setCurrentPrice(snap.last_quote);
            },
            onTick: tick => {
                setPipSize(tick.pip_size);
                const d = getLastDigit(tick.quote, tick.pip_size);
                win.push(d, tick.quote);
                win_25.push(d, tick.quote);
                win_50.push(d, tick.quote);
                setCurrentDigit(d);
                setCurrentPrice(tick.quote);
                if (frame_ref.current) return;
                frame_ref.current = requestAnimationFrame(() => {
                    frame_ref.current = null;
                    const snap = win.snapshot();
                    const snap_25 = win_25.snapshot();
                    const snap_50 = win_50.snapshot();
                    setDigits(snap.digits);
                    setDigits25(snap_25.digits);
                    setDigits50(snap_50.digits);
                    setSampleSize(snap.sample_size);
                    setTotalTicks(snap.total_ticks);
                });
            },
            onError: msg => setStatus(`error: ${msg}`),
            onStatusChange: s => setStatus(s),
        });

        return () => {
            socket.unsubscribe();
            if (frame_ref.current) cancelAnimationFrame(frame_ref.current);
            frame_ref.current = null;
        };
    }, [symbol]);

    const color_map   = assignColors(digits);
    const price_str   = current_price !== null ? current_price.toFixed(pip_size) : '—';
    const tri_x       = current_digit !== null ? current_digit * (SLOT_W + SLOT_GAP) + SLOT_W / 2 : -999;

    const STATUS_LABEL: Record<string, string> = {
        idle: 'Idle', connecting: 'Connecting', open: 'Live',
        reconnecting: 'Reconnecting', closed: 'Disconnected',
    };

    /* ── Derived bias signals ───────────────────────────────────────────── */
    const total_count  = digits.reduce((s, d) => s + d.count, 0);
    const even_count   = digits.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.count, 0);
    const odd_count    = total_count - even_count;
    const even_pct     = total_count > 0 ? (even_count / total_count) * 100 : 0;
    const odd_pct      = total_count > 0 ? (odd_count / total_count) * 100 : 0;

    // Over 4 = digits 5–9, Under 5 = digits 0–4 (complementary, symmetric barriers)
    const over4_count  = digits.filter(d => d.digit > 4).reduce((s, d) => s + d.count, 0);
    const under5_count = digits.filter(d => d.digit < 5).reduce((s, d) => s + d.count, 0);
    const over_pct     = total_count > 0 ? (over4_count / total_count) * 100 : 0;
    const under_pct    = total_count > 0 ? (under5_count / total_count) * 100 : 0;

    const hottest_25   = getHottestDigit(digits_25);
    const hottest_50   = getHottestDigit(digits_50);
    const over_under_pairs = OVER_UNDER_PAIRS.slice(0, 3).map(pair => {
        const over_count = digits
            .filter(digit => digit.digit > pair.over_barrier)
            .reduce((sum, digit) => sum + digit.count, 0);
        const under_count = digits
            .filter(digit => digit.digit < pair.under_barrier)
            .reduce((sum, digit) => sum + digit.count, 0);

        return {
            ...pair,
            over_percentage: total_count > 0 ? (over_count / total_count) * 100 : 0,
            under_percentage: total_count > 0 ? (under_count / total_count) * 100 : 0,
        };
    });

    return (
        <div className='dcircles'>
            {/* ── Toolbar ── */}
            <div className='dcircles__toolbar'>
                <div className='dcircles__control'>
                    <label className='dcircles__label'>Market</label>
                    <select
                        className='dcircles__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                    >
                        {DIGIT_SYMBOLS.map(s => (
                            <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                        ))}
                    </select>
                </div>

                <div className='dcircles__live'>
                    <div className='dcircles__live-box dcircles__live-box--price'>
                        <span className='dcircles__live-label'>Price</span>
                        <span className='dcircles__live-val'>{price_str}</span>
                    </div>
                    <div className='dcircles__live-box dcircles__live-box--digit'>
                        <span className='dcircles__live-label'>Last Digit</span>
                        <span className='dcircles__live-val' key={total_ticks}>{current_digit ?? '–'}</span>
                    </div>
                </div>

                <div className='dcircles__meta'>
                    <span className={`dcircles__status dcircles__status--${status}`}>
                        {STATUS_LABEL[status] ?? status}
                    </span>
                    <span className='dcircles__meta-text'>
                        {sample_size.toLocaleString()} / {WINDOW_SIZE} ticks
                    </span>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className='dcircles__legend'>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#16c784' } as React.CSSProperties}>Highest %</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#2196f3' } as React.CSSProperties}>2nd Highest</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#ffb300' } as React.CSSProperties}>2nd Lowest</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#e53935' } as React.CSSProperties}>Lowest %</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#787878' } as React.CSSProperties}>Normal</span>
                <span className='dcircles__legend-item dcircles__legend-item--tri'>▼ Current digit</span>
            </div>

            {/* ── Circle row + triangle cursor ── */}
            <div className='dcircles__stage'>
                {/* Golden triangle cursor */}
                <div
                    className='dcircles__triangle-wrap'
                    style={{
                        width: `${SLOT_W}px`,
                        transform: `translateX(${tri_x - SLOT_W / 2}px)`,
                    }}
                >
                    <div className='dcircles__triangle' />
                </div>

                <div
                    className='dcircles__row'
                    style={{
                        '--slot-w': `${SLOT_W}px`,
                        '--slot-gap': `${SLOT_GAP}px`,
                        '--circle-size': `${CIRCLE_SIZE}px`,
                    } as React.CSSProperties}
                >
                    {digits.map(({ digit, percentage }) => {
                        const { grad, glow } = color_map[digit] ?? COLOR_MAP.normal;
                        const above10        = percentage > 10;
                        const is_current     = current_digit === digit;
                        return (
                            <div
                                key={digit}
                                className={`dcircles__slot ${is_current ? 'dcircles__slot--active' : ''}`}
                            >
                                <div
                                    className='dcircles__circle'
                                    style={{
                                        background: grad,
                                        boxShadow: is_current
                                            ? `0 0 20px ${glow}cc, 0 0 8px ${glow}`
                                            : `0 4px 14px ${glow}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
                                    }}
                                >
                                    <span className='dcircles__digit'>{digit}</span>
                                    <span className='dcircles__pct'>{percentage.toFixed(1)}%</span>
                                    {above10 && <span className='dcircles__tick'>✓</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Over / under probability pairs ── */}
            <section className='dcircles__pairs-panel' aria-label='Over and under percentages'>
                {over_under_pairs.map(({ over_barrier, under_barrier, over_percentage, under_percentage }) => (
                    <div className='dcircles__pair-card' key={`${over_barrier}-${under_barrier}`}>
                        <div className='dcircles__pair-header'>
                            <span>Over {over_barrier} vs Under {under_barrier}</span>
                            <span className='dcircles__pair-sample'>
                                {sample_size.toLocaleString()} ticks
                            </span>
                        </div>
                        <div className='dcircles__pair-values'>
                            <div className='dcircles__pair-side dcircles__pair-side--over'>
                                <span className='dcircles__pair-label'>Over {over_barrier}</span>
                                <strong>{over_percentage.toFixed(1)}%</strong>
                                <span className='dcircles__pair-bar'>
                                    <span style={{ width: `${over_percentage}%` }} />
                                </span>
                            </div>
                            <div className='dcircles__pair-side dcircles__pair-side--under'>
                                <span className='dcircles__pair-label'>Under {under_barrier}</span>
                                <strong>{under_percentage.toFixed(1)}%</strong>
                                <span className='dcircles__pair-bar'>
                                    <span style={{ width: `${under_percentage}%` }} />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── Summary percentage cards ── */}
            <section className='dcircles__pairs-panel dcircles__summary-panel' aria-label='Digit summary percentages'>
                <div className='dcircles__pair-card'>
                    <div className='dcircles__pair-header'>
                        <span>Over 4 vs Under 5</span>
                        <span className='dcircles__pair-sample'>{sample_size.toLocaleString()} ticks</span>
                    </div>
                    <div className='dcircles__pair-values'>
                        <div className='dcircles__pair-side dcircles__pair-side--over'>
                            <span className='dcircles__pair-label'>Over 4</span>
                            <strong>{over_pct.toFixed(1)}%</strong>
                            <span className='dcircles__pair-bar'><span style={{ width: `${over_pct}%` }} /></span>
                        </div>
                        <div className='dcircles__pair-side dcircles__pair-side--under'>
                            <span className='dcircles__pair-label'>Under 5</span>
                            <strong>{under_pct.toFixed(1)}%</strong>
                            <span className='dcircles__pair-bar'><span style={{ width: `${under_pct}%` }} /></span>
                        </div>
                    </div>
                </div>

                <div className='dcircles__pair-card'>
                    <div className='dcircles__pair-header'>
                        <span>Even vs Odd</span>
                        <span className='dcircles__pair-sample'>{sample_size.toLocaleString()} ticks</span>
                    </div>
                    <div className='dcircles__pair-values'>
                        <div className='dcircles__pair-side dcircles__pair-side--over'>
                            <span className='dcircles__pair-label'>Even</span>
                            <strong>{even_pct.toFixed(1)}%</strong>
                            <span className='dcircles__pair-bar'><span style={{ width: `${even_pct}%` }} /></span>
                        </div>
                        <div className='dcircles__pair-side dcircles__pair-side--under'>
                            <span className='dcircles__pair-label'>Odd</span>
                            <strong>{odd_pct.toFixed(1)}%</strong>
                            <span className='dcircles__pair-bar'><span style={{ width: `${odd_pct}%` }} /></span>
                        </div>
                    </div>
                </div>

                <div className='dcircles__pair-card'>
                    <div className='dcircles__pair-header'>
                        <span>Hottest digit</span>
                        <span className='dcircles__pair-sample'>Independent windows</span>
                    </div>
                    <div className='dcircles__pair-values'>
                        <div className='dcircles__pair-side dcircles__pair-side--hot'>
                            <span className='dcircles__pair-label'>25 ticks</span>
                            <strong>Digit {hottest_25?.digit ?? '—'}</strong>
                            <span className='dcircles__pair-window-pct'>{hottest_25 ? `${hottest_25.percentage.toFixed(1)}%` : '—'}</span>
                        </div>
                        <div className='dcircles__pair-side dcircles__pair-side--hot'>
                            <span className='dcircles__pair-label'>50 ticks</span>
                            <strong>Digit {hottest_50?.digit ?? '—'}</strong>
                            <span className='dcircles__pair-window-pct'>{hottest_50 ? `${hottest_50.percentage.toFixed(1)}%` : '—'}</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DCircles;
