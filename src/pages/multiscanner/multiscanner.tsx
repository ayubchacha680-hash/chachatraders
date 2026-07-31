import React, { useEffect, useRef, useState } from 'react';
import useMultiScanner, { TIndicatorSignal, TMarketSignal, TScanPhase } from '@/hooks/useMultiScanner';
import './multiscanner.scss';

/* ── Small helpers ───────────────────────────────────────────────────────── */
const SIG_COLOR = { rise: '#00c087', fall: '#e84040', neutral: '#6b7a99' } as const;

const sigColor = (s: TIndicatorSignal) => SIG_COLOR[s];

const IndArrow = ({ sig }: { sig: TIndicatorSignal }) => (
    <span className={`msc-arrow msc-arrow--${sig}`}>
        {sig === 'rise' ? '▲' : sig === 'fall' ? '▼' : '—'}
    </span>
);

/* ── Countdown ring (SVG) ────────────────────────────────────────────────── */
const Ring = ({ value }: { value: number }) => {
    const r    = 18;
    const circ = 2 * Math.PI * r;
    return (
        <svg className='msc-ring' viewBox='0 0 40 40' width={40} height={40}>
            <circle cx={20} cy={20} r={r} className='msc-ring__bg' />
            <circle
                cx={20} cy={20} r={r}
                className='msc-ring__fill'
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - value / 10)}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
            <text x={20} y={25} textAnchor='middle' className='msc-ring__num'>{value}</text>
        </svg>
    );
};

/* ── Strength pips ───────────────────────────────────────────────────────── */
const StrengthPips = ({ n, sig }: { n: number; sig: TIndicatorSignal }) => (
    <div className='msc-pips'>
        {[0, 1, 2, 3].map(i => (
            <span
                key={i}
                className='msc-pips__pip'
                style={{ background: i < n ? sigColor(sig) : undefined, opacity: i < n ? 1 : 0.2 }}
            />
        ))}
    </div>
);

/* ── Entry status cell ───────────────────────────────────────────────────── */
const EntryCell = ({ m }: { m: TMarketSignal }) => {
    const [flash, setFlash] = useState(false);
    const prev_phase = useRef<TScanPhase>(m.phase);

    useEffect(() => {
        if (prev_phase.current === 'countdown' && m.phase === 'active') {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 2600);
            return () => clearTimeout(t);
        }
        prev_phase.current = m.phase;
    }, [m.phase]);

    if (m.phase === 'loading') {
        return <span className='msc-status msc-status--loading'>Loading 3-min candles…</span>;
    }
    if (m.phase === 'countdown') {
        return (
            <div className='msc-status msc-status--countdown'>
                <Ring value={m.countdown} />
                <span className='msc-status__cd-label'>
                    {m.signal === 'rise' ? '▲ RISE' : '▼ FALL'} in {m.countdown}s
                </span>
            </div>
        );
    }
    if (m.phase === 'active' || flash) {
        const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        return (
            <div className={`msc-status msc-status--active msc-status--${m.signal} ${flash ? 'msc-status--flash' : ''}`}>
                <span className='msc-status__now'>⚡ ENTER {m.signal === 'rise' ? 'RISE ▲' : 'FALL ▼'}</span>
                {m.time_remaining_s > 0 && (
                    <span className='msc-status__timer'>{fmt(m.time_remaining_s)} left</span>
                )}
            </div>
        );
    }
    if (m.strength >= 2 && m.signal !== 'neutral') {
        return <span className='msc-status msc-status--building'>📊 Signal building…</span>;
    }
    return <span className='msc-status msc-status--wait'>⏳ Waiting…</span>;
};

/* ── Market row ──────────────────────────────────────────────────────────── */
const MarketRow = ({ m, rank }: { m: TMarketSignal; rank: number }) => {
    const is_active   = m.phase === 'active' || m.phase === 'countdown';
    const short_name  = m.display_name
        .replace(' Index', '')
        .replace('Volatility ', 'V');

    return (
        <tr
            className={[
                'msc-row',
                `msc-row--${m.signal}`,
                is_active      ? 'msc-row--highlight' : '',
                m.strength >= 3 ? 'msc-row--strong'    : '',
            ].filter(Boolean).join(' ')}
        >
            {/* Rank */}
            <td className='msc-cell msc-cell--rank'>{rank}</td>

            {/* Market name + price */}
            <td className='msc-cell msc-cell--market'>
                <div className='msc-market__name'>{short_name}</div>
                <div className='msc-market__price'>
                    {m.last_price != null
                        ? m.last_price.toFixed(3)
                        : m.status === 'connecting' ? 'Connecting…' : '—'}
                </div>
            </td>

            {/* Signal */}
            <td className='msc-cell msc-cell--signal'>
                <span
                    className='msc-signal-badge'
                    style={{ background: m.signal !== 'neutral' ? sigColor(m.signal) : undefined }}
                >
                    {m.signal === 'rise' ? '▲ RISE' : m.signal === 'fall' ? '▼ FALL' : '— WAIT'}
                </span>
            </td>

            {/* Strength */}
            <td className='msc-cell msc-cell--strength'>
                <StrengthPips n={m.strength} sig={m.signal} />
                <span className='msc-strength-num'>{m.strength}/4</span>
            </td>

            {/* RSI */}
            <td className='msc-cell msc-cell--ind'>
                <IndArrow sig={m.indicators.rsi} />
                {m.indicators.rsi_val !== null && (
                    <span className='msc-ind-val'>{m.indicators.rsi_val.toFixed(1)}</span>
                )}
            </td>

            {/* EMA Cross */}
            <td className='msc-cell msc-cell--ind'>
                <IndArrow sig={m.indicators.ema_cross} />
                <span className='msc-ind-label'>EMA</span>
            </td>

            {/* MACD */}
            <td className='msc-cell msc-cell--ind'>
                <IndArrow sig={m.indicators.macd} />
                <span className='msc-ind-label'>MACD</span>
            </td>

            {/* Candle pattern */}
            <td className='msc-cell msc-cell--pattern'>
                <IndArrow sig={m.indicators.candle_pattern} />
                <span className='msc-pattern-name'>{m.indicators.pattern_name}</span>
            </td>

            {/* Entry countdown */}
            <td className='msc-cell msc-cell--entry'>
                <EntryCell m={m} />
            </td>
        </tr>
    );
};

/* ── Summary strip ───────────────────────────────────────────────────────── */
const Summary = ({ markets }: { markets: TMarketSignal[] }) => {
    const rise    = markets.filter(m => m.signal === 'rise' && m.strength >= 2).length;
    const fall    = markets.filter(m => m.signal === 'fall' && m.strength >= 2).length;
    const strong  = markets.filter(m => m.strength >= 3 && m.signal !== 'neutral').length;
    const entries = markets.filter(m => m.phase === 'active' || m.phase === 'countdown').length;

    return (
        <div className='msc-summary'>
            <div className='msc-summary__item msc-summary__item--rise'>
                <b>{rise}</b> <span>▲ Rise</span>
            </div>
            <div className='msc-summary__item msc-summary__item--fall'>
                <b>{fall}</b> <span>▼ Fall</span>
            </div>
            <div className='msc-summary__item msc-summary__item--strong'>
                <b>{strong}</b> <span>⚡ Strong</span>
            </div>
            <div className='msc-summary__item msc-summary__item--entry'>
                <b>{entries}</b> <span>🎯 Entry ready</span>
            </div>
        </div>
    );
};

/* ── Main ────────────────────────────────────────────────────────────────── */
type TFilter = 'all' | 'rise' | 'fall' | 'strong';

const MultiScanner = () => {
    const { markets } = useMultiScanner();
    const [filter, setFilter] = useState<TFilter>('all');

    const displayed = [...markets]
        .filter(m => {
            if (filter === 'rise')   return m.signal === 'rise';
            if (filter === 'fall')   return m.signal === 'fall';
            if (filter === 'strong') return m.strength >= 3 && m.signal !== 'neutral';
            return true;
        })
        .sort((a, b) => {
            // Entry-ready first, then by strength
            const aScore = (a.phase === 'active' ? 30 : a.phase === 'countdown' ? 20 : 0) + a.strength;
            const bScore = (b.phase === 'active' ? 30 : b.phase === 'countdown' ? 20 : 0) + b.strength;
            return bScore - aScore;
        });

    return (
        <div className='msc'>
            {/* Header */}
            <div className='msc__header'>
                <div className='msc__header-left'>
                    <h2 className='msc__title'>📡 MultiScanner — 3-Min Signals</h2>
                    <p className='msc__subtitle'>
                        All 12 Deriv volatility markets · 3-min OHLC candles · RSI · EMA Cross · MACD · Candlestick patterns
                        · 10s entry countdown
                    </p>
                </div>
            </div>

            {/* Summary */}
            <Summary markets={markets} />

            {/* Filter buttons */}
            <div className='msc__controls'>
                {(['all', 'rise', 'fall', 'strong'] as TFilter[]).map(f => (
                    <button
                        key={f}
                        className={`msc__filter-btn ${filter === f ? 'msc__filter-btn--active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All Markets' : f === 'rise' ? '▲ Rise Only' : f === 'fall' ? '▼ Fall Only' : '⚡ Strong Only'}
                    </button>
                ))}
                <span className='msc__candle-note'>3-min candles · auto-refresh live</span>
            </div>

            {/* Table */}
            <div className='msc__table-wrap'>
                <table className='msc-table'>
                    <thead>
                        <tr className='msc-thead'>
                            <th className='msc-th msc-th--rank'>#</th>
                            <th className='msc-th msc-th--market'>Market</th>
                            <th className='msc-th msc-th--signal'>3M Signal</th>
                            <th className='msc-th msc-th--strength'>Strength</th>
                            <th className='msc-th msc-th--ind'>RSI(14)</th>
                            <th className='msc-th msc-th--ind'>EMA 5/20</th>
                            <th className='msc-th msc-th--ind'>MACD</th>
                            <th className='msc-th msc-th--pattern'>Pattern</th>
                            <th className='msc-th msc-th--entry'>Entry Countdown</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((m, idx) => (
                            <MarketRow key={m.symbol} m={m} rank={idx + 1} />
                        ))}
                    </tbody>
                </table>
            </div>

            <p className='msc__disclaimer'>
                ⚠️ Statistical signals only — not financial advice. Apply your own risk management.
            </p>
        </div>
    );
};

export default MultiScanner;
