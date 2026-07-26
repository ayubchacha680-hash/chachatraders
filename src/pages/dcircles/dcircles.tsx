import { useEffect, useRef, useState } from 'react';
import { groupSymbolsByMarket, getActiveSymbols, TActiveSymbol } from '@/services/active-symbols';
import { getPublicTickSocket } from '@/services/analysis/public-tick-socket';
import { RollingDigitWindow, getLastDigit, TDigitStats } from '@/services/analysis/digit-analysis';
import './dcircles.scss';

const WINDOW_SIZE = 1000;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ── Color assignment ─────────────────────────────────────────────────────── */
function assignColors(digits: TDigitStats[]): Record<number, string> {
    // Round to 2dp so truly equal percentages get the same colour
    const rounded = digits.map(d => ({ digit: d.digit, pct: Math.round(d.percentage * 100) / 100 }));
    const unique_pcts = [...new Set(rounded.map(d => d.pct))].sort((a, b) => b - a);
    const n = unique_pcts.length;

    const rank_of = new Map<number, number>();
    unique_pcts.forEach((pct, i) => rank_of.set(pct, i));

    const colors: Record<number, string> = {};
    for (const { digit, pct } of rounded) {
        const rank = rank_of.get(pct) ?? 0;
        if (rank === 0) colors[digit] = '#16c784';        // green  – highest
        else if (rank === 1) colors[digit] = '#2196f3';   // blue   – 2nd highest
        else if (rank === n - 1) colors[digit] = '#e53935'; // red  – lowest
        else if (rank === n - 2) colors[digit] = '#ffb300'; // yellow – 2nd lowest
        else colors[digit] = '#ffffff';                     // white  – normal
    }
    return colors;
}

/* ── Main component ───────────────────────────────────────────────────────── */
const DCircles = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [symbol_groups, setSymbolGroups] = useState<ReturnType<typeof groupSymbolsByMarket>>({});
    const [all_symbols, setAllSymbols] = useState<TActiveSymbol[]>([]);
    const [digits, setDigits] = useState<TDigitStats[]>(DIGITS.map(d => ({ digit: d, count: 0, percentage: 0 })));
    const [current_digit, setCurrentDigit] = useState<number | null>(null);
    const [sample_size, setSampleSize] = useState(0);
    const [total_ticks, setTotalTicks] = useState(0);
    const [status, setStatus] = useState<string>('idle');
    const [pip_size, setPipSize] = useState(2);

    const window_ref = useRef(new RollingDigitWindow(WINDOW_SIZE));
    const frame_ref = useRef<number | null>(null);

    /* load symbol list once */
    useEffect(() => {
        getActiveSymbols()
            .then(syms => {
                setAllSymbols(syms);
                setSymbolGroups(groupSymbolsByMarket(syms));
            })
            .catch(() => {});
    }, []);

    /* subscribe to tick stream */
    useEffect(() => {
        const win = window_ref.current;
        win.reset();
        setDigits(DIGITS.map(d => ({ digit: d, count: 0, percentage: 0 })));
        setCurrentDigit(null);
        setSampleSize(0);
        setTotalTicks(0);
        setStatus('connecting');

        const socket = getPublicTickSocket();

        socket.subscribe(symbol, WINDOW_SIZE, {
            onHistory: ({ prices, pip_size: ps }) => {
                setPipSize(ps);
                win.seed(
                    prices.map(p => getLastDigit(p, ps)),
                    prices
                );
                const snap = win.snapshot();
                setDigits(snap.digits);
                setSampleSize(snap.sample_size);
                setTotalTicks(snap.total_ticks);
                setCurrentDigit(snap.last_digit);
            },
            onTick: tick => {
                setPipSize(tick.pip_size);
                const d = getLastDigit(tick.quote, tick.pip_size);
                win.push(d, tick.quote);
                setCurrentDigit(d);
                // throttle paint
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

    const colors = assignColors(digits);

    /* triangle x-position: each circle slot is 88px wide */
    const SLOT_W = 88;
    const tri_x = current_digit !== null ? current_digit * SLOT_W + SLOT_W / 2 : -999;

    const status_label: Record<string, string> = {
        idle: 'Idle', connecting: 'Connecting', open: 'Live',
        reconnecting: 'Reconnecting', closed: 'Disconnected',
    };

    return (
        <div className='dcircles'>
            {/* ── toolbar ── */}
            <div className='dcircles__toolbar'>
                <div className='dcircles__control'>
                    <label className='dcircles__label'>Market</label>
                    <select
                        className='dcircles__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                    >
                        {Object.entries(symbol_groups).map(([market_key, group]) => (
                            <optgroup key={market_key} label={group.display_name}>
                                {group.symbols.map(s => (
                                    <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                                ))}
                            </optgroup>
                        ))}
                        {all_symbols.length === 0 && (
                            /* fallback while loading */
                            <>
                                <option value='R_10'>Volatility 10 Index</option>
                                <option value='1HZ10V'>Volatility 10 (1s) Index</option>
                                <option value='R_25'>Volatility 25 Index</option>
                                <option value='1HZ25V'>Volatility 25 (1s) Index</option>
                                <option value='R_50'>Volatility 50 Index</option>
                                <option value='1HZ50V'>Volatility 50 (1s) Index</option>
                                <option value='R_75'>Volatility 75 Index</option>
                                <option value='1HZ75V'>Volatility 75 (1s) Index</option>
                                <option value='R_100'>Volatility 100 Index</option>
                                <option value='1HZ100V'>Volatility 100 (1s) Index</option>
                            </>
                        )}
                    </select>
                </div>

                <div className='dcircles__meta'>
                    <span className={`dcircles__status dcircles__status--${status}`}>
                        {status_label[status] ?? status}
                    </span>
                    <span className='dcircles__meta-text'>
                        {sample_size.toLocaleString()} / {WINDOW_SIZE} ticks · {total_ticks.toLocaleString()} total
                    </span>
                </div>
            </div>

            {/* ── legend ── */}
            <div className='dcircles__legend'>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#16c784' } as React.CSSProperties}>Highest %</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#2196f3' } as React.CSSProperties}>2nd Highest</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#ffb300' } as React.CSSProperties}>2nd Lowest</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#e53935' } as React.CSSProperties}>Lowest %</span>
                <span className='dcircles__legend-item' style={{ '--dot-color': '#ffffff' } as React.CSSProperties}>Equal</span>
                <span className='dcircles__legend-item dcircles__legend-item--tick'>✓ &gt; 10%</span>
            </div>

            {/* ── circle row + triangle ── */}
            <div className='dcircles__stage'>
                {/* sky-blue moving triangle */}
                <div
                    className='dcircles__triangle-wrap'
                    style={{ transform: `translateX(${tri_x - SLOT_W / 2}px)` }}
                >
                    <div className='dcircles__triangle' />
                </div>

                {/* digit circles */}
                <div className='dcircles__row'>
                    {digits.map(({ digit, percentage }) => {
                        const color = colors[digit] ?? '#ffffff';
                        const above10 = percentage > 10;
                        const text_color = color === '#ffffff' ? 'var(--text-prominent)' : '#fff';
                        return (
                            <div
                                key={digit}
                                className={`dcircles__slot ${current_digit === digit ? 'dcircles__slot--active' : ''}`}
                            >
                                <div
                                    className='dcircles__circle'
                                    style={{
                                        background: color,
                                        boxShadow: current_digit === digit
                                            ? `0 0 0 3px #87ceeb, 0 0 16px ${color}88`
                                            : `0 0 8px ${color}44`,
                                        color: text_color,
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

            {/* ── stats table ── */}
            <div className='dcircles__table-wrap'>
                <table className='dcircles__table'>
                    <thead>
                        <tr>
                            <th>Digit</th>
                            <th>Count</th>
                            <th>Frequency</th>
                            <th>Bar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...digits].sort((a, b) => b.percentage - a.percentage).map(({ digit, count, percentage }) => {
                            const color = colors[digit] ?? '#ffffff';
                            return (
                                <tr key={digit} className={current_digit === digit ? 'dcircles__table-row--active' : ''}>
                                    <td>
                                        <span className='dcircles__table-badge' style={{ background: color, color: color === '#ffffff' ? '#333' : '#fff' }}>
                                            {digit}
                                        </span>
                                    </td>
                                    <td>{count.toLocaleString()}</td>
                                    <td>
                                        <strong>{percentage.toFixed(2)}%</strong>
                                        {percentage > 10 && <span className='dcircles__table-tick'>✓</span>}
                                    </td>
                                    <td className='dcircles__bar-cell'>
                                        <div className='dcircles__bar-bg'>
                                            <div
                                                className='dcircles__bar-fill'
                                                style={{ width: `${Math.min(percentage * 5, 100)}%`, background: color === '#ffffff' ? '#ccc' : color }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DCircles;
