import React, { useEffect, useRef, useState } from 'react';
import useMultiScanner, { TIndicatorSignal, TMarketSignal, TScanPhase } from '@/hooks/useMultiScanner';
import './multiscanner.scss';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const signalColor = (s: TIndicatorSignal) =>
    s === 'rise' ? '#00c087' : s === 'fall' ? '#e84040' : '#6b7a99';

const signalLabel = (s: TIndicatorSignal) =>
    s === 'rise' ? '▲ RISE' : s === 'fall' ? '▼ FALL' : '— WAIT';

const strengthLabel = (n: number) => {
    if (n >= 4) return 'Max';
    if (n === 3) return 'Strong';
    if (n === 2) return 'Moderate';
    return 'Weak';
};

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ── Countdown ring ──────────────────────────────────────────────────────── */
const CountdownRing = ({ value }: { value: number }) => {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - value / 10);
    return (
        <svg className='msc-ring' viewBox='0 0 64 64' width={64} height={64}>
            <circle cx={32} cy={32} r={r} className='msc-ring__bg' />
            <circle
                cx={32}
                cy={32}
                r={r}
                className='msc-ring__fill'
                strokeDasharray={circ}
                strokeDashoffset={offset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
            <text x={32} y={37} textAnchor='middle' className='msc-ring__text'>
                {value}
            </text>
        </svg>
    );
};

/* ── Indicator dot ───────────────────────────────────────────────────────── */
const IndDot = ({ label, signal }: { label: string; signal: TIndicatorSignal }) => (
    <div className={`msc-dot msc-dot--${signal}`} title={label}>
        <span className='msc-dot__dot' />
        <span className='msc-dot__label'>{label}</span>
    </div>
);

/* ── Market card ─────────────────────────────────────────────────────────── */
const MarketCard = ({ m }: { m: TMarketSignal }) => {
    const [flash, setFlash] = useState(false);
    const prev_phase = useRef<TScanPhase>(m.phase);

    // Flash "ENTER NOW" when countdown hits 0 and phase transitions to active
    useEffect(() => {
        if (prev_phase.current === 'countdown' && m.phase === 'active') {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 2500);
            return () => clearTimeout(t);
        }
        prev_phase.current = m.phase;
    }, [m.phase]);

    const is_strong = m.strength >= 3 && m.signal !== 'neutral';
    const clazz = [
        'msc-card',
        `msc-card--${m.signal}`,
        is_strong ? 'msc-card--strong' : '',
        m.phase === 'active' ? 'msc-card--active' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const short_name = m.display_name.replace(' Index', '').replace('Volatility ', 'V');

    return (
        <div className={clazz}>
            {/* Header */}
            <div className='msc-card__header'>
                <div className='msc-card__name'>{short_name}</div>
                <div
                    className='msc-card__signal-badge'
                    style={{ background: m.signal !== 'neutral' ? signalColor(m.signal) : undefined }}
                >
                    {signalLabel(m.signal)}
                </div>
            </div>

            {/* Price */}
            <div className='msc-card__price'>
                {m.last_price != null ? (
                    <>
                        <span className='msc-card__price-val'>{m.last_price.toFixed(5)}</span>
                        {m.price_change_pct != null && (
                            <span
                                className='msc-card__price-chg'
                                style={{ color: m.price_change_pct >= 0 ? '#00c087' : '#e84040' }}
                            >
                                {m.price_change_pct >= 0 ? '+' : ''}
                                {m.price_change_pct.toFixed(4)}%
                            </span>
                        )}
                    </>
                ) : (
                    <span className='msc-card__price-val msc-card__price-val--loading'>
                        {m.status === 'connecting' ? 'Connecting…' : 'Loading…'}
                    </span>
                )}
            </div>

            {/* Strength bar */}
            <div className='msc-card__strength'>
                {[0, 1, 2, 3].map(n => (
                    <div
                        key={n}
                        className='msc-card__strength-seg'
                        style={{
                            background: n < m.strength ? signalColor(m.signal) : undefined,
                            opacity: n < m.strength ? 1 : 0.2,
                        }}
                    />
                ))}
                <span className='msc-card__strength-lbl'>{strengthLabel(m.strength)}</span>
            </div>

            {/* Indicator dots */}
            <div className='msc-card__indicators'>
                <IndDot label='Short' signal={m.indicators.short_momentum} />
                <IndDot label='Mid' signal={m.indicators.mid_momentum} />
                <IndDot label='MA' signal={m.indicators.ma_crossover} />
                <IndDot label='Pattern' signal={m.indicators.candle_pattern} />
            </div>

            {/* Pattern name */}
            <div className='msc-card__pattern'>{m.indicators.pattern_name}</div>

            {/* Phase area */}
            {m.phase === 'countdown' ? (
                <div className='msc-card__countdown'>
                    <CountdownRing value={m.countdown} />
                    <span className='msc-card__countdown-label'>
                        Enter {m.signal === 'rise' ? '▲ RISE' : '▼ FALL'} in…
                    </span>
                </div>
            ) : m.phase === 'active' || flash ? (
                <div className={`msc-card__enter ${flash ? 'msc-card__enter--flash' : ''}`}>
                    <div className='msc-card__enter-now'>⚡ ENTER NOW!</div>
                    {m.time_remaining_s > 0 && (
                        <div className='msc-card__enter-timer'>
                            Signal valid: {formatTime(m.time_remaining_s)}
                        </div>
                    )}
                </div>
            ) : (
                <div className='msc-card__waiting'>
                    {m.tick_count < 22 ? (
                        <span className='msc-card__waiting-ticks'>Collecting ticks ({m.tick_count}/22)…</span>
                    ) : m.signal === 'neutral' || m.strength < 2 ? (
                        <span>⏳ Waiting for confluence…</span>
                    ) : (
                        <span>📊 Signal building…</span>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Scanner summary bar ─────────────────────────────────────────────────── */
const SummaryBar = ({ markets }: { markets: TMarketSignal[] }) => {
    const rise = markets.filter(m => m.signal === 'rise' && m.strength >= 2).length;
    const fall = markets.filter(m => m.signal === 'fall' && m.strength >= 2).length;
    const strong = markets.filter(m => m.strength >= 3 && m.signal !== 'neutral').length;
    const active = markets.filter(m => m.phase === 'active').length;
    const countdown = markets.filter(m => m.phase === 'countdown').length;

    return (
        <div className='msc-summary'>
            <div className='msc-summary__item msc-summary__item--rise'>
                <span className='msc-summary__val'>{rise}</span>
                <span className='msc-summary__lbl'>▲ Rise signals</span>
            </div>
            <div className='msc-summary__item msc-summary__item--fall'>
                <span className='msc-summary__val'>{fall}</span>
                <span className='msc-summary__lbl'>▼ Fall signals</span>
            </div>
            <div className='msc-summary__item msc-summary__item--strong'>
                <span className='msc-summary__val'>{strong}</span>
                <span className='msc-summary__lbl'>⚡ Strong (3+)</span>
            </div>
            <div className='msc-summary__item msc-summary__item--active'>
                <span className='msc-summary__val'>{active + countdown}</span>
                <span className='msc-summary__lbl'>🎯 Entry ready</span>
            </div>
        </div>
    );
};

/* ── Filter/sort bar ─────────────────────────────────────────────────────── */
type TFilter = 'all' | 'rise' | 'fall' | 'strong';
type TSort = 'default' | 'strength' | 'signal';

/* ── Main component ──────────────────────────────────────────────────────── */
const MultiScanner = () => {
    const { markets } = useMultiScanner();
    const [filter, setFilter] = useState<TFilter>('all');
    const [sort, setSort] = useState<TSort>('strength');

    const displayed = [...markets]
        .filter(m => {
            if (filter === 'rise') return m.signal === 'rise';
            if (filter === 'fall') return m.signal === 'fall';
            if (filter === 'strong') return m.strength >= 3 && m.signal !== 'neutral';
            return true;
        })
        .sort((a, b) => {
            if (sort === 'strength') return b.strength - a.strength;
            if (sort === 'signal')
                return (b.signal === 'neutral' ? -1 : 0) - (a.signal === 'neutral' ? -1 : 0);
            return 0;
        });

    return (
        <div className='msc'>
            {/* ── Header ── */}
            <div className='msc__header'>
                <div className='msc__header-left'>
                    <h2 className='msc__title'>📡 MultiScanner</h2>
                    <p className='msc__subtitle'>
                        Live Rise/Fall signals across all 12 Deriv volatility markets · 3-min signal window · 10s entry
                        countdown
                    </p>
                </div>
                <div className='msc__legend'>
                    <span className='msc__legend-item msc__legend-item--rise'>▲ Rise</span>
                    <span className='msc__legend-item msc__legend-item--fall'>▼ Fall</span>
                    <span className='msc__legend-item msc__legend-item--neutral'>— Neutral</span>
                </div>
            </div>

            {/* ── Summary bar ── */}
            <SummaryBar markets={markets} />

            {/* ── Indicators legend ── */}
            <div className='msc__ind-legend'>
                <span className='msc__ind-legend-title'>Indicators:</span>
                <span className='msc__ind-legend-item'>
                    <span className='msc__ind-dot msc__ind-dot--rise' />
                    Short Momentum (20 ticks)
                </span>
                <span className='msc__ind-legend-item'>
                    <span className='msc__ind-dot msc__ind-dot--rise' />
                    Mid Trend (50 ticks)
                </span>
                <span className='msc__ind-legend-item'>
                    <span className='msc__ind-dot msc__ind-dot--rise' />
                    MA Crossover (10/30)
                </span>
                <span className='msc__ind-legend-item'>
                    <span className='msc__ind-dot msc__ind-dot--rise' />
                    Candlestick Pattern
                </span>
            </div>

            {/* ── Controls ── */}
            <div className='msc__controls'>
                <div className='msc__filter'>
                    {(['all', 'rise', 'fall', 'strong'] as TFilter[]).map(f => (
                        <button
                            key={f}
                            className={`msc__filter-btn ${filter === f ? 'msc__filter-btn--active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'All' : f === 'rise' ? '▲ Rise' : f === 'fall' ? '▼ Fall' : '⚡ Strong'}
                        </button>
                    ))}
                </div>
                <div className='msc__sort'>
                    <span className='msc__sort-label'>Sort:</span>
                    <button
                        className={`msc__sort-btn ${sort === 'strength' ? 'msc__sort-btn--active' : ''}`}
                        onClick={() => setSort('strength')}
                    >
                        Strength
                    </button>
                    <button
                        className={`msc__sort-btn ${sort === 'default' ? 'msc__sort-btn--active' : ''}`}
                        onClick={() => setSort('default')}
                    >
                        Default
                    </button>
                </div>
            </div>

            {/* ── Market grid ── */}
            <div className='msc__grid'>
                {displayed.map(m => (
                    <MarketCard key={m.symbol} m={m} />
                ))}
            </div>

            {/* ── Disclaimer ── */}
            <p className='msc__disclaimer'>
                ⚠️ Signals are statistical — not financial advice. Always apply your own risk management.
            </p>
        </div>
    );
};

export default MultiScanner;
