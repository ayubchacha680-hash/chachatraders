import { useEffect, useRef, useState } from 'react';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import { getPublicTickSocket } from '@/services/analysis/public-tick-socket';
import { RollingDigitWindow, getLastDigit, TDigitStats } from '@/services/analysis/digit-analysis';
import './dcircles.scss';

const WINDOW_SIZE = 1000;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ── Slot/circle dimensions ─────────────────────────────────────────────── */
const SLOT_W      = 66;  // px – total slot width (10 × 66 + 9 × 6 gap = 714px total)
const CIRCLE_SIZE = 56;  // px – circle diameter

/* ── Gradient colours per rank ─────────────────────────────────────────── */
const COLOR_MAP: Record<string, { grad: string; glow: string }> = {
    highest: { grad: 'radial-gradient(circle at 38% 32%, #4fe8a8 0%, #16c784 55%, #0b7a4f 100%)', glow: '#16c784' },
    second:  { grad: 'radial-gradient(circle at 38% 32%, #64b9f9 0%, #2196f3 55%, #1050a0 100%)', glow: '#2196f3' },
    lowest:  { grad: 'radial-gradient(circle at 38% 32%, #f07a77 0%, #e53935 55%, #8b1010 100%)', glow: '#e53935' },
    second_l:{ grad: 'radial-gradient(circle at 38% 32%, #ffd063 0%, #ffb300 55%, #8a5c00 100%)', glow: '#ffb300' },
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

/* ── Bias helpers ───────────────────────────────────────────────────────── */
function strengthLabel(edge: number): string {
    if (edge >= 4) return 'Strong';
    if (edge >= 2) return 'Moderate';
    if (edge >= 0.5) return 'Weak';
    return '';
}

/* ── Main component ─────────────────────────────────────────────────────── */
const DCircles = () => {
    const [symbol, setSymbol]               = useState('R_100');
    const [digits, setDigits]               = useState<TDigitStats[]>(DIGITS.map(d => ({ digit: d, count: 0, percentage: 0 })));
    const [current_digit, setCurrentDigit]  = useState<number | null>(null);
    const [current_price, setCurrentPrice]  = useState<number | null>(null);
    const [sample_size, setSampleSize]      = useState(0);
    const [total_ticks, setTotalTicks]      = useState(0);
    const [status, setStatus]               = useState<string>('idle');
    const [pip_size, setPipSize]            = useState(2);

    const window_ref = useRef(new RollingDigitWindow(WINDOW_SIZE));
    const frame_ref  = useRef<number | null>(null);

    /* subscribe to tick stream */
    useEffect(() => {
        const win = window_ref.current;
        win.reset();
        setDigits(DIGITS.map(d => ({ digit: d, count: 0, percentage: 0 })));
        setCurrentDigit(null);
        setCurrentPrice(null);
        setSampleSize(0);
        setTotalTicks(0);
        setStatus('connecting');

        const socket = getPublicTickSocket();
        socket.subscribe(symbol, WINDOW_SIZE, {
            onHistory: ({ prices, pip_size: ps }) => {
                setPipSize(ps);
                win.seed(prices.map(p => getLastDigit(p, ps)), prices);
                const snap = win.snapshot();
                setDigits(snap.digits);
                setSampleSize(snap.sample_size);
                setTotalTicks(snap.total_ticks);
                setCurrentDigit(snap.last_digit);
                setCurrentPrice(snap.last_quote);
            },
            onTick: tick => {
                setPipSize(tick.pip_size);
                const d = getLastDigit(tick.quote, tick.pip_size);
                win.push(d, tick.quote);
                setCurrentDigit(d);
                setCurrentPrice(tick.quote);
                if (frame_ref.current) return;
                frame_ref.current = requestAnimationFrame(() => {
                    frame_ref.current = null;
                    const snap = win.snapshot();
                    setDigits(snap.digits);
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
    const tri_x       = current_digit !== null ? current_digit * SLOT_W + SLOT_W / 2 : -999;

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
    const eo_edge      = Math.abs(even_pct - odd_pct);
    const eo_bias      = even_count === odd_count || total_count === 0 ? null : even_count > odd_count ? 'even' : 'odd';

    // Over 4 = digits 5–9, Under 5 = digits 0–4 (complementary, symmetric barriers)
    const over4_count  = digits.filter(d => d.digit > 4).reduce((s, d) => s + d.count, 0);
    const under5_count = digits.filter(d => d.digit < 5).reduce((s, d) => s + d.count, 0);
    const over_pct     = total_count > 0 ? (over4_count / total_count) * 100 : 0;
    const under_pct    = total_count > 0 ? (under5_count / total_count) * 100 : 0;
    const ou_edge      = Math.abs(over_pct - under_pct);
    const ou_bias      = over4_count === under5_count || total_count === 0 ? null : over4_count > under5_count ? 'over' : 'under';

    const sorted       = [...digits].sort((a, b) => b.percentage - a.percentage);
    const hot_digit    = sorted[0];
    const cold_digit   = sorted[sorted.length - 1];
    const hot_dev      = hot_digit.percentage - 10;   // deviation from expected 10%
    const cold_dev     = 10 - cold_digit.percentage;

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
                    style={{ '--slot-w': `${SLOT_W}px`, '--circle-size': `${CIRCLE_SIZE}px` } as React.CSSProperties}
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
                                            ? `0 0 0 3px #FFD700, 0 0 20px #FFD70088, 0 0 8px ${glow}99`
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

            {/* ── Bias signals panel ── */}
            <div className='dcircles__bias-panel'>

                {/* Even / Odd */}
                <div className={`dcircles__bias-card ${eo_bias === 'even' ? 'dcircles__bias-card--green' : eo_bias === 'odd' ? 'dcircles__bias-card--blue' : 'dcircles__bias-card--neutral'}`}>
                    <div className='dcircles__bias-icon'>⚖️</div>
                    <div className='dcircles__bias-body'>
                        <div className='dcircles__bias-title'>Even / Odd</div>
                        <div className='dcircles__bias-signal'>
                            {eo_bias ? `${strengthLabel(eo_edge)} ${eo_bias.toUpperCase()}` : 'Balanced'}
                        </div>
                        <div className='dcircles__bias-sub'>
                            E {even_pct.toFixed(1)}% · O {odd_pct.toFixed(1)}%
                            {eo_edge > 0.5 && <span className='dcircles__bias-edge'> +{eo_edge.toFixed(1)}%</span>}
                        </div>
                    </div>
                </div>

                {/* Over / Under */}
                <div className={`dcircles__bias-card ${ou_bias === 'over' ? 'dcircles__bias-card--green' : ou_bias === 'under' ? 'dcircles__bias-card--red' : 'dcircles__bias-card--neutral'}`}>
                    <div className='dcircles__bias-icon'>📊</div>
                    <div className='dcircles__bias-body'>
                        <div className='dcircles__bias-title'>Over 4 / Under 5</div>
                        <div className='dcircles__bias-signal'>
                            {ou_bias ? `${strengthLabel(ou_edge)} ${ou_bias.toUpperCase()}` : 'Balanced'}
                        </div>
                        <div className='dcircles__bias-sub'>
                            Ov {over_pct.toFixed(1)}% · Un {under_pct.toFixed(1)}%
                            {ou_edge > 0.5 && <span className='dcircles__bias-edge'> +{ou_edge.toFixed(1)}%</span>}
                        </div>
                    </div>
                </div>

                {/* Hot digit */}
                <div className='dcircles__bias-card dcircles__bias-card--hot'>
                    <div className='dcircles__bias-icon'>🔥</div>
                    <div className='dcircles__bias-body'>
                        <div className='dcircles__bias-title'>Hottest Digit</div>
                        <div className='dcircles__bias-signal' style={{ color: '#16c784' }}>
                            Digit {hot_digit?.digit ?? '—'}
                        </div>
                        <div className='dcircles__bias-sub'>
                            {hot_digit?.percentage.toFixed(2)}%
                            {hot_dev > 0 && <span className='dcircles__bias-edge' style={{ color: '#16c784' }}> +{hot_dev.toFixed(1)}%</span>}
                        </div>
                    </div>
                </div>

                {/* Cold digit */}
                <div className='dcircles__bias-card dcircles__bias-card--cold'>
                    <div className='dcircles__bias-icon'>❄️</div>
                    <div className='dcircles__bias-body'>
                        <div className='dcircles__bias-title'>Coldest Digit</div>
                        <div className='dcircles__bias-signal' style={{ color: '#e53935' }}>
                            Digit {cold_digit?.digit ?? '—'}
                        </div>
                        <div className='dcircles__bias-sub'>
                            {cold_digit?.percentage.toFixed(2)}%
                            {cold_dev > 0 && <span className='dcircles__bias-edge' style={{ color: '#e53935' }}> -{cold_dev.toFixed(1)}%</span>}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DCircles;
