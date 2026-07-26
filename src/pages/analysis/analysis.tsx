import { useEffect, useState } from 'react';
import { getActiveSymbols, groupSymbolsByMarket, TActiveSymbol } from '@/services/active-symbols';
import {
    DEFAULT_ANALYSIS_SYMBOL,
    ROLLING_WINDOW_SIZE,
    SPEED_MODE_CONFIG,
    SPEED_MODES,
    TSpeedMode,
} from '@/constants/analysis';
import useDigitAnalysis from '@/hooks/useDigitAnalysis';
import { Localize, localize } from '@deriv-com/translations';
import EvenOddCard from './even-odd-card';
import OverUnderCard from './over-under-card';
import './analysis.scss';

const STATUS_LABEL: Record<string, string> = {
    idle: 'Idle', connecting: 'Connecting', open: 'Live',
    reconnecting: 'Reconnecting', closed: 'Disconnected',
};

type TContractTab = 'digits' | 'rise_fall' | 'even_odd' | 'over_under';

const CONTRACT_TABS: { id: TContractTab; label: string; emoji: string }[] = [
    { id: 'digits',     label: 'Digit Stats',  emoji: '🔢' },
    { id: 'even_odd',   label: 'Even / Odd',   emoji: '⚖️' },
    { id: 'over_under', label: 'Over / Under',  emoji: '📊' },
    { id: 'rise_fall',  label: 'Rise / Fall',   emoji: '📈' },
];

const Analysis = () => {
    const [symbol, setSymbol]             = useState(DEFAULT_ANALYSIS_SYMBOL);
    const [symbol_groups, setSymbolGroups] = useState<ReturnType<typeof groupSymbolsByMarket>>({});
    const [all_symbols, setAllSymbols]     = useState<TActiveSymbol[]>([]);
    const [active_tab, setActiveTab]       = useState<TContractTab>('digits');

    const { snapshot, status, error, speed_mode, setSpeedMode, ticks_per_second } = useDigitAnalysis(symbol);
    const { even_odd, over_under, best_pair, sample_size, digits, last_digit, total_ticks } = snapshot;

    /* load all active symbols for the dropdown */
    useEffect(() => {
        getActiveSymbols()
            .then(syms => {
                setAllSymbols(syms);
                setSymbolGroups(groupSymbolsByMarket(syms));
            })
            .catch(() => {});
    }, []);

    /* ── Digit frequency bar display ── */
    const max_pct = Math.max(...digits.map(d => d.percentage), 0.01);

    /* ── Rise/Fall proxy: count of price increases vs decreases ── */
    const above_five = over_under.find(p => p.over_barrier === 4);
    const rise_pct = above_five ? above_five.over_percentage : 50;
    const fall_pct = above_five ? above_five.under_percentage : 50;

    return (
        <div className='analysis-v2'>
            {/* ── Header banner ── */}
            <div className='analysis-v2__banner'>
                <div className='analysis-v2__banner-content'>
                    <div>
                        <h2 className='analysis-v2__banner-title'>Market Analysis</h2>
                        <p className='analysis-v2__banner-subtitle'>Real-time digit &amp; contract statistics from Deriv</p>
                    </div>
                    <div className='analysis-v2__banner-meta'>
                        <span className={`analysis-v2__status analysis-v2__status--${status}`}>
                            {localize(STATUS_LABEL[status] ?? status)}
                        </span>
                        <span className='analysis-v2__rate'>
                            {ticks_per_second.toFixed(1)} ticks/s
                        </span>
                        <span className='analysis-v2__last-digit' key={total_ticks}>
                            {last_digit ?? '–'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className='analysis-v2__controls'>
                {/* Market dropdown — full active_symbols list */}
                <div className='analysis-v2__control'>
                    <label className='analysis-v2__control-label'>
                        <Localize i18n_default_text='Market' />
                    </label>
                    <select
                        className='analysis-v2__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                    >
                        {Object.keys(symbol_groups).length > 0
                            ? Object.entries(symbol_groups).map(([key, group]) => (
                                <optgroup key={key} label={group.display_name}>
                                    {group.symbols.map(s => (
                                        <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                                    ))}
                                </optgroup>
                              ))
                            : /* fallback while symbols load */
                              [
                                  { symbol: 'R_10',    display_name: 'Volatility 10 Index' },
                                  { symbol: '1HZ10V',  display_name: 'Volatility 10 (1s) Index' },
                                  { symbol: '1HZ15V',  display_name: 'Volatility 15 (1s) Index' },
                                  { symbol: 'R_25',    display_name: 'Volatility 25 Index' },
                                  { symbol: '1HZ25V',  display_name: 'Volatility 25 (1s) Index' },
                                  { symbol: '1HZ30V',  display_name: 'Volatility 30 (1s) Index' },
                                  { symbol: 'R_50',    display_name: 'Volatility 50 Index' },
                                  { symbol: '1HZ50V',  display_name: 'Volatility 50 (1s) Index' },
                                  { symbol: 'R_75',    display_name: 'Volatility 75 Index' },
                                  { symbol: '1HZ75V',  display_name: 'Volatility 75 (1s) Index' },
                                  { symbol: 'R_100',   display_name: 'Volatility 100 Index' },
                                  { symbol: '1HZ100V', display_name: 'Volatility 100 (1s) Index' },
                              ].map(s => (
                                  <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                              ))
                        }
                    </select>
                </div>

                {/* Speed mode */}
                <div className='analysis-v2__control'>
                    <label className='analysis-v2__control-label'>
                        <Localize i18n_default_text='Speed' />
                    </label>
                    <select
                        className='analysis-v2__select'
                        value={speed_mode}
                        onChange={e => setSpeedMode(e.target.value as TSpeedMode)}
                    >
                        {SPEED_MODES.map(mode => (
                            <option key={mode} value={mode}>{SPEED_MODE_CONFIG[mode].label}</option>
                        ))}
                    </select>
                </div>

                <div className='analysis-v2__window-info'>
                    <span className='analysis-v2__window-label'>Window</span>
                    <span className='analysis-v2__window-val'>{sample_size.toLocaleString()}</span>
                    <span className='analysis-v2__window-sep'>/</span>
                    <span className='analysis-v2__window-total'>{ROLLING_WINDOW_SIZE.toLocaleString()}</span>
                </div>
            </div>

            {error && <div className='analysis-v2__error'>⚠️ {error}</div>}

            {/* ── Contract type tabs ── */}
            <div className='analysis-v2__tabs'>
                {CONTRACT_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`analysis-v2__tab ${active_tab === tab.id ? 'analysis-v2__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className='analysis-v2__tab-emoji'>{tab.emoji}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab content ── */}
            <div className='analysis-v2__content'>

                {/* DIGIT STATS */}
                {active_tab === 'digits' && (
                    <div className='analysis-v2__digits'>
                        <div className='analysis-v2__digits-header'>
                            <span>Digit</span>
                            <span>Count</span>
                            <span>Frequency</span>
                            <span>Distribution</span>
                        </div>
                        {digits.map(({ digit, count, percentage }) => (
                            <div
                                key={digit}
                                className={`analysis-v2__digit-row ${last_digit === digit ? 'analysis-v2__digit-row--current' : ''}`}
                            >
                                <div className='analysis-v2__digit-badge'>{digit}</div>
                                <span className='analysis-v2__digit-count'>{count.toLocaleString()}</span>
                                <span className='analysis-v2__digit-pct'>
                                    <strong>{percentage.toFixed(2)}%</strong>
                                </span>
                                <div className='analysis-v2__digit-bar-wrap'>
                                    <div
                                        className='analysis-v2__digit-bar'
                                        style={{ width: `${(percentage / max_pct) * 100}%` }}
                                    />
                                    <span className='analysis-v2__digit-bar-label'>{percentage.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* EVEN / ODD */}
                {active_tab === 'even_odd' && (
                    <div className='analysis-v2__grid'>
                        <EvenOddCard stats={even_odd} sample_size={sample_size} />
                        <div className='analysis-v2__info-card'>
                            <h3>How Even/Odd works</h3>
                            <p>Predicts whether the last digit of the close price is even (0, 2, 4, 6, 8) or odd (1, 3, 5, 7, 9). Theoretically 50/50 — any sustained bias is exploitable.</p>
                            <div className='analysis-v2__bias-pill' style={{ background: even_odd.bias === 'even' ? '#16c78422' : even_odd.bias === 'odd' ? '#2196f322' : '#88888822' }}>
                                {even_odd.bias
                                    ? `Current bias: ${even_odd.bias.toUpperCase()} by ${even_odd.bias_edge.toFixed(2)} pts`
                                    : 'No bias — perfectly balanced'}
                            </div>
                        </div>
                    </div>
                )}

                {/* OVER / UNDER */}
                {active_tab === 'over_under' && (
                    <div className='analysis-v2__grid'>
                        {over_under.map(pair => (
                            <OverUnderCard
                                key={`${pair.over_barrier}-${pair.under_barrier}`}
                                stats={pair}
                                is_best_overall={best_pair?.over_barrier === pair.over_barrier && (best_pair?.edge ?? 0) > 0}
                            />
                        ))}
                    </div>
                )}

                {/* RISE / FALL proxy */}
                {active_tab === 'rise_fall' && (
                    <div className='analysis-v2__grid'>
                        <div className='analysis-v2__rf-card'>
                            <div className='analysis-v2__rf-header'>
                                <h3>📈 Rise / Fall Statistics</h3>
                                <span className='analysis-v2__rf-subtitle'>Based on digit distribution over {ROLLING_WINDOW_SIZE.toLocaleString()} ticks</span>
                            </div>
                            <div className='analysis-v2__rf-row'>
                                <div className='analysis-v2__rf-side analysis-v2__rf-side--rise'>
                                    <span className='analysis-v2__rf-icon'>↑</span>
                                    <span className='analysis-v2__rf-label'>Rise (Over 4)</span>
                                    <span className='analysis-v2__rf-val'>{rise_pct.toFixed(2)}%</span>
                                    <span className='analysis-v2__rf-count'>
                                        {(above_five?.over_count ?? 0).toLocaleString()} ticks
                                    </span>
                                </div>
                                <div className='analysis-v2__rf-divider' />
                                <div className='analysis-v2__rf-side analysis-v2__rf-side--fall'>
                                    <span className='analysis-v2__rf-icon'>↓</span>
                                    <span className='analysis-v2__rf-label'>Fall (Under 5)</span>
                                    <span className='analysis-v2__rf-val'>{fall_pct.toFixed(2)}%</span>
                                    <span className='analysis-v2__rf-count'>
                                        {(above_five?.under_count ?? 0).toLocaleString()} ticks
                                    </span>
                                </div>
                            </div>
                            <div className='analysis-v2__rf-bar'>
                                <div className='analysis-v2__rf-bar-fill rise' style={{ flexGrow: rise_pct }} />
                                <div className='analysis-v2__rf-bar-fill fall' style={{ flexGrow: fall_pct }} />
                            </div>
                            <p className='analysis-v2__rf-note'>
                                ℹ️ Rise/Fall is based on over/under barrier 4/5 as a proxy for upward vs downward price movement in the digit stream.
                                For actual Rise/Fall contracts, the full tick-by-tick price direction determines the outcome.
                            </p>
                        </div>

                        {/* Extra over/under pairs for context */}
                        {over_under.slice(0, 2).map(pair => (
                            <OverUnderCard
                                key={`${pair.over_barrier}-${pair.under_barrier}`}
                                stats={pair}
                                is_best_overall={best_pair?.over_barrier === pair.over_barrier && (best_pair?.edge ?? 0) > 0}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analysis;
