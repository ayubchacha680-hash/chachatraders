import { useEffect, useState } from 'react';
import { getActiveSymbols, TActiveSymbol } from '@/services/active-symbols';
import { DEFAULT_ANALYSIS_SYMBOL, DIGIT_SYMBOLS, ROLLING_WINDOW_SIZE } from '@/constants/analysis';
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

/* ── Bias pill helper ──────────────────────────────────────────────────────── */
const BiasPill = ({
    label, color, edge, recommendation,
}: {
    label: string;
    color: string;
    edge: number;
    recommendation: string;
}) => (
    <div className='analysis-v2__bias-result' style={{ borderColor: color }}>
        <div className='analysis-v2__bias-arrow' style={{ background: color }}>
            {label === 'RISE' || label === 'EVEN' || label === 'OVER' ? '↑' : '↓'}
        </div>
        <div className='analysis-v2__bias-body'>
            <span className='analysis-v2__bias-label' style={{ color }}>{label}</span>
            <span className='analysis-v2__bias-edge'>edge: {edge.toFixed(2)}%</span>
        </div>
        <div className='analysis-v2__bias-rec'>{recommendation}</div>
    </div>
);

const NoBias = () => (
    <div className='analysis-v2__no-bias'>⚖️ No significant bias — market is balanced</div>
);

/* ── Overall trading signal card ───────────────────────────────────────────── */
const TradingSignal = ({ even_odd, over_under, rise_fall, best_pair, active_tab }: {
    even_odd: any;
    over_under: any[];
    rise_fall: any;
    best_pair: any;
    active_tab: TContractTab;
}) => {
    const signals: { tab: TContractTab; label: string; bias: string | null; edge: number; color: string; good: string }[] = [
        {
            tab: 'even_odd',
            label: 'Even/Odd',
            bias: even_odd.bias ? even_odd.bias.toUpperCase() : null,
            edge: even_odd.bias_edge,
            color: even_odd.bias === 'even' ? '#16c784' : '#2196f3',
            good: even_odd.bias === 'even' ? 'Trade EVEN digits' : even_odd.bias === 'odd' ? 'Trade ODD digits' : '',
        },
        {
            tab: 'over_under',
            label: 'Over/Under',
            bias: best_pair?.best_side ? `${best_pair.best_side.toUpperCase()} ${best_pair.best_side === 'over' ? best_pair.over_barrier : best_pair.under_barrier}` : null,
            edge: best_pair?.edge ?? 0,
            color: best_pair?.best_side === 'over' ? '#16c784' : '#e53935',
            good: best_pair?.best_side ? `Trade ${best_pair.best_side.toUpperCase()} ${best_pair.best_side === 'over' ? best_pair.over_barrier : best_pair.under_barrier}` : '',
        },
        {
            tab: 'rise_fall',
            label: 'Rise/Fall',
            bias: rise_fall.bias ? rise_fall.bias.toUpperCase() : null,
            edge: rise_fall.bias_edge,
            color: rise_fall.bias === 'rise' ? '#16c784' : '#e53935',
            good: rise_fall.bias === 'rise' ? 'Trade RISE contracts' : rise_fall.bias === 'fall' ? 'Trade FALL contracts' : '',
        },
    ];

    const filtered = signals.filter(s => s.tab === active_tab || active_tab === 'digits');
    const show = active_tab === 'digits' ? signals : signals.filter(s => s.tab === active_tab);

    return (
        <div className='analysis-v2__signal-card'>
            <div className='analysis-v2__signal-title'>🎯 Trading Signals</div>
            {show.map(s => (
                <div key={s.tab} className='analysis-v2__signal-row'>
                    <span className='analysis-v2__signal-type'>{s.label}</span>
                    {s.bias ? (
                        <>
                            <span className='analysis-v2__signal-bias' style={{ color: s.color }}>{s.bias}</span>
                            <span className='analysis-v2__signal-edge'>{s.edge.toFixed(2)}% edge</span>
                            <span className='analysis-v2__signal-rec' style={{ color: s.color }}>✓ {s.good}</span>
                        </>
                    ) : (
                        <span className='analysis-v2__signal-neutral'>Balanced — no clear edge</span>
                    )}
                </div>
            ))}
        </div>
    );
};

const Analysis = () => {
    const [symbol, setSymbol]         = useState(DEFAULT_ANALYSIS_SYMBOL);
    const [all_symbols, setAllSymbols] = useState<TActiveSymbol[]>([]);
    const [active_tab, setActiveTab]  = useState<TContractTab>('digits');

    /* No speed_mode exposed — market is analysed at its own natural speed */
    const { snapshot, status, error, ticks_per_second } = useDigitAnalysis(symbol);
    const { even_odd, over_under, best_pair, sample_size, digits, last_digit, last_quote, total_ticks, rise_fall } = snapshot;

    /* load symbols for pip-size lookup only (market list is hardcoded) */
    useEffect(() => {
        getActiveSymbols().then(syms => setAllSymbols(syms)).catch(() => {});
    }, []);

    const max_pct = Math.max(...digits.map(d => d.percentage), 0.01);

    /* current market price formatted */
    const price_str = last_quote !== null ? last_quote.toFixed(
        all_symbols.find(s => s.symbol === symbol)?.pip ?? 2
    ) : '—';

    return (
        <div className='analysis-v2'>
            {/* ── Header banner ── */}
            <div className='analysis-v2__banner'>
                <div className='analysis-v2__banner-content'>
                    <div>
                        <h2 className='analysis-v2__banner-title'>Market Analysis</h2>
                        <p className='analysis-v2__banner-subtitle'>Real-time tick statistics · {ROLLING_WINDOW_SIZE.toLocaleString()} tick window</p>
                    </div>
                    <div className='analysis-v2__banner-meta'>
                        <span className={`analysis-v2__status analysis-v2__status--${status}`}>
                            {localize(STATUS_LABEL[status] ?? status)}
                        </span>
                        <span className='analysis-v2__rate'>{ticks_per_second.toFixed(1)} ticks/s</span>
                        <span className='analysis-v2__price-badge' title='Current price'>
                            <span className='analysis-v2__price-label'>Price</span>
                            <span className='analysis-v2__price-val'>{price_str}</span>
                        </span>
                        <span className='analysis-v2__last-digit-badge' title='Last digit' key={total_ticks}>
                            <span className='analysis-v2__ld-label'>Last</span>
                            <span className='analysis-v2__ld-val'>{last_digit ?? '–'}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Controls — market only, no speed selector ── */}
            <div className='analysis-v2__controls'>
                <div className='analysis-v2__control'>
                    <label className='analysis-v2__control-label'>
                        <Localize i18n_default_text='Market' />
                    </label>
                    <select
                        className='analysis-v2__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                    >
                        {DIGIT_SYMBOLS.map(s => (
                            <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
                        ))}
                    </select>
                </div>

                {/* Live price + last digit inline info */}
                <div className='analysis-v2__live-info'>
                    <div className='analysis-v2__live-box'>
                        <span className='analysis-v2__live-box-label'>Current Price</span>
                        <span className='analysis-v2__live-box-val analysis-v2__live-box-val--price'>{price_str}</span>
                    </div>
                    <div className='analysis-v2__live-box'>
                        <span className='analysis-v2__live-box-label'>Last Digit</span>
                        <span className='analysis-v2__live-box-val analysis-v2__live-box-val--digit' key={total_ticks}>{last_digit ?? '–'}</span>
                    </div>
                    <div className='analysis-v2__live-box'>
                        <span className='analysis-v2__live-box-label'>Window</span>
                        <span className='analysis-v2__live-box-val'>{sample_size.toLocaleString()} / {ROLLING_WINDOW_SIZE.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {error && <div className='analysis-v2__error'>⚠️ {error}</div>}

            {/* ── Trading signal panel (always visible) ── */}
            <TradingSignal
                even_odd={even_odd}
                over_under={over_under}
                rise_fall={rise_fall}
                best_pair={best_pair}
                active_tab={active_tab}
            />

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
                            <h3>Even / Odd Bias</h3>
                            <p>Tracks whether the last digit of the close price is even (0, 2, 4, 6, 8) or odd (1, 3, 5, 7, 9). Theoretically 50/50 — any sustained bias indicates edge.</p>
                            {even_odd.bias
                                ? <BiasPill
                                    label={even_odd.bias.toUpperCase()}
                                    color={even_odd.bias === 'even' ? '#16c784' : '#2196f3'}
                                    edge={even_odd.bias_edge}
                                    recommendation={`Trade ${even_odd.bias.toUpperCase()} digits · ${(even_odd.bias === 'even' ? even_odd.even_percentage : even_odd.odd_percentage).toFixed(2)}% frequency`}
                                  />
                                : <NoBias />
                            }
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

                {/* RISE / FALL — Multi-timeframe analysis */}
                {active_tab === 'rise_fall' && (
                    <div className='analysis-v2__rf-wrap'>

                        {/* ── Signal banner ── */}
                        <div className={`analysis-v2__rf-banner analysis-v2__rf-banner--${rise_fall.strength}`}>
                            <div className='analysis-v2__rf-banner-icon'>
                                {rise_fall.bias === 'rise' ? '📈' : rise_fall.bias === 'fall' ? '📉' : '⚖️'}
                            </div>
                            <div className='analysis-v2__rf-banner-body'>
                                <div className='analysis-v2__rf-banner-signal'>{rise_fall.signal}</div>
                                <div className='analysis-v2__rf-banner-meta'>
                                    {rise_fall.confluence}/3 windows confirm
                                    {rise_fall.streak !== 0 && (
                                        <span className={`analysis-v2__rf-streak analysis-v2__rf-streak--${rise_fall.streak > 0 ? 'rise' : 'fall'}`}>
                                            &nbsp;·&nbsp;{rise_fall.streak > 0 ? `↑` : `↓`}{Math.abs(rise_fall.streak)}-tick streak
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Rise / Fall percentages — always visible in banner */}
                            <div className='analysis-v2__rf-banner-pcts'>
                                <div className='analysis-v2__rf-banner-pct analysis-v2__rf-banner-pct--rise'>
                                    <span className='analysis-v2__rf-banner-pct-arrow'>↑</span>
                                    <span className='analysis-v2__rf-banner-pct-val'>{rise_fall.rise_percentage.toFixed(1)}%</span>
                                    <span className='analysis-v2__rf-banner-pct-label'>Rise</span>
                                </div>
                                <div className='analysis-v2__rf-banner-pct analysis-v2__rf-banner-pct--fall'>
                                    <span className='analysis-v2__rf-banner-pct-arrow'>↓</span>
                                    <span className='analysis-v2__rf-banner-pct-val'>{rise_fall.fall_percentage.toFixed(1)}%</span>
                                    <span className='analysis-v2__rf-banner-pct-label'>Fall</span>
                                </div>
                            </div>
                            <div className='analysis-v2__rf-banner-strength'>
                                {['none','weak','moderate','strong'].map((s, i) => (
                                    <div
                                        key={s}
                                        className={`analysis-v2__rf-strength-dot ${['none','weak','moderate','strong'].indexOf(rise_fall.strength) >= i && rise_fall.strength !== 'none' ? 'analysis-v2__rf-strength-dot--lit' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ── Three timeframe windows ── */}
                        <div className='analysis-v2__rf-timeframes'>
                            {/* Short — 20 ticks */}
                            <div className={`analysis-v2__rf-tf analysis-v2__rf-tf--${rise_fall.short_bias ?? 'neutral'}`}>
                                <div className='analysis-v2__rf-tf-label'>
                                    <span className='analysis-v2__rf-tf-period'>⚡ Short</span>
                                    <span className='analysis-v2__rf-tf-ticks'>20 ticks</span>
                                </div>
                                <div className='analysis-v2__rf-tf-dir'>
                                    {rise_fall.short_filled < 5 ? '—' : rise_fall.short_bias ? rise_fall.short_bias.toUpperCase() : 'NEUTRAL'}
                                </div>
                                <div className='analysis-v2__rf-tf-bar'>
                                    <div className='rise' style={{ flexGrow: rise_fall.short_rise_pct || 0.1 }} />
                                    <div className='fall' style={{ flexGrow: rise_fall.short_fall_pct || 0.1 }} />
                                </div>
                                <div className='analysis-v2__rf-tf-nums'>
                                    <span className='r'>↑ {rise_fall.short_rise_pct.toFixed(0)}%</span>
                                    <span className='f'>↓ {rise_fall.short_fall_pct.toFixed(0)}%</span>
                                </div>
                                {rise_fall.short_edge > 0.5 && (
                                    <div className='analysis-v2__rf-tf-edge'>{rise_fall.short_edge.toFixed(1)}% edge</div>
                                )}
                            </div>

                            {/* Mid — 100 ticks */}
                            <div className={`analysis-v2__rf-tf analysis-v2__rf-tf--${rise_fall.mid_bias ?? 'neutral'}`}>
                                <div className='analysis-v2__rf-tf-label'>
                                    <span className='analysis-v2__rf-tf-period'>📊 Medium</span>
                                    <span className='analysis-v2__rf-tf-ticks'>100 ticks</span>
                                </div>
                                <div className='analysis-v2__rf-tf-dir'>
                                    {rise_fall.mid_filled < 20 ? '—' : rise_fall.mid_bias ? rise_fall.mid_bias.toUpperCase() : 'NEUTRAL'}
                                </div>
                                <div className='analysis-v2__rf-tf-bar'>
                                    <div className='rise' style={{ flexGrow: rise_fall.mid_rise_pct || 0.1 }} />
                                    <div className='fall' style={{ flexGrow: rise_fall.mid_fall_pct || 0.1 }} />
                                </div>
                                <div className='analysis-v2__rf-tf-nums'>
                                    <span className='r'>↑ {rise_fall.mid_rise_pct.toFixed(0)}%</span>
                                    <span className='f'>↓ {rise_fall.mid_fall_pct.toFixed(0)}%</span>
                                </div>
                                {rise_fall.mid_edge > 0.5 && (
                                    <div className='analysis-v2__rf-tf-edge'>{rise_fall.mid_edge.toFixed(1)}% edge</div>
                                )}
                            </div>

                            {/* Long — full window */}
                            <div className={`analysis-v2__rf-tf analysis-v2__rf-tf--${rise_fall.bias ?? 'neutral'}`}>
                                <div className='analysis-v2__rf-tf-label'>
                                    <span className='analysis-v2__rf-tf-period'>🔭 Long</span>
                                    <span className='analysis-v2__rf-tf-ticks'>{ROLLING_WINDOW_SIZE} ticks</span>
                                </div>
                                <div className='analysis-v2__rf-tf-dir'>
                                    {rise_fall.rise_count + rise_fall.fall_count < 50 ? '—' : rise_fall.bias ? rise_fall.bias.toUpperCase() : 'NEUTRAL'}
                                </div>
                                <div className='analysis-v2__rf-tf-bar'>
                                    <div className='rise' style={{ flexGrow: rise_fall.rise_percentage || 0.1 }} />
                                    <div className='fall' style={{ flexGrow: rise_fall.fall_percentage || 0.1 }} />
                                </div>
                                <div className='analysis-v2__rf-tf-nums'>
                                    <span className='r'>↑ {rise_fall.rise_percentage.toFixed(0)}%</span>
                                    <span className='f'>↓ {rise_fall.fall_percentage.toFixed(0)}%</span>
                                </div>
                                {rise_fall.bias_edge > 0.5 && (
                                    <div className='analysis-v2__rf-tf-edge'>{rise_fall.bias_edge.toFixed(1)}% edge</div>
                                )}
                            </div>
                        </div>

                        {/* ── Trading recommendation ── */}
                        <div className='analysis-v2__rf-verdict'>
                            <div className='analysis-v2__rf-verdict-title'>Trading Recommendation</div>
                            {rise_fall.strength !== 'none' && rise_fall.bias ? (
                                <div className={`analysis-v2__rf-verdict-body analysis-v2__rf-verdict-body--${rise_fall.bias}`}>
                                    <div className='analysis-v2__rf-verdict-icon'>
                                        {rise_fall.bias === 'rise' ? '📈' : '📉'}
                                    </div>
                                    <div className='analysis-v2__rf-verdict-text'>
                                        <strong>Trade {rise_fall.bias.toUpperCase()}</strong>
                                        <span>{rise_fall.bias_edge.toFixed(2)}% long-term edge · {rise_fall.confluence}/3 windows aligned</span>
                                        <span className='analysis-v2__rf-verdict-pct'>
                                            {rise_fall.streak !== 0
                                                ? `Current streak: ${Math.abs(rise_fall.streak)} consecutive ${rise_fall.streak > 0 ? 'rises' : 'falls'}`
                                                : `${(rise_fall.bias === 'rise' ? rise_fall.rise_percentage : rise_fall.fall_percentage).toFixed(1)}% of long-window ticks moved ${rise_fall.bias}`
                                            }
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className='analysis-v2__rf-verdict-neutral'>
                                    ⚖️ Market is balanced across timeframes — no confirmed Rise or Fall bias. Wait for confluence before trading.
                                </div>
                            )}
                        </div>

                        {/* ── Flat ticks note ── */}
                        {rise_fall.flat_count > 0 && (
                            <div className='analysis-v2__rf-flat'>
                                {rise_fall.flat_count.toLocaleString()} flat ticks (price unchanged)
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Analysis;
