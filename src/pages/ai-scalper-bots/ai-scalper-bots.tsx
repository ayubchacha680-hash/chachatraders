import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import MatchesScalperEngine, {
    ALL_1S_SYMBOLS,
    TMatchesScalperSignal,
    TMatchesScalperStatus,
} from '@/services/ai-scalper/matches-scalper-engine';
import './ai-scalper-bots.scss';

const SCALPER_BOTS = [
    ['Over 1 / Under 8 Scalper', '◒', 'mint'],
    ['Over 2 / Under 7 Scalper', '◓', 'blue'],
    ['Over 3 / Under 6 Scalper', '◑', 'violet'],
    ['Over 4 / Under 5 Scalper', '◐', 'gold'],
    ['Even / Odd Scalper', '⊕', 'coral'],
] as const;

const MatchesScalper = observer(() => {
    const { client, transactions } = useStore();
    const engine_ref = useRef<MatchesScalperEngine | null>(null);
    const [is_selected, setIsSelected] = useState(false);
    const matches_scalper_ref = useRef<HTMLElement | null>(null);
    const [market, setMarket] = useState(DIGIT_SYMBOLS[0].symbol);
    const [stake, setStake] = useState('1');
    const [martingale, setMartingale] = useState('2');
    const [take_profit, setTakeProfit] = useState('0');
    const [stop_loss, setStopLoss] = useState('0');
    const [status, setStatus] = useState<TMatchesScalperStatus>('idle');
    const [message, setMessage] = useState('');
    const [signals, setSignals] = useState<Record<string, TMatchesScalperSignal>>({});
    const [profit, setProfit] = useState(0);

    const is_scanning = ['connecting', 'scanning', 'running'].includes(status);
    const is_running = status === 'running';
    const selected_symbols = useMemo(
        () => (market === 'ALL_1S' ? ALL_1S_SYMBOLS : [market]),
        [market]
    );

    useEffect(() => {
        const engine = new MatchesScalperEngine();
        engine_ref.current = engine;
        engine.setHandlers(
            signal => {
                setSignals(previous => ({ ...previous, [signal.symbol]: signal }));
                setProfit(engine.profit);
            },
            (next_status, next_message) => {
                setStatus(next_status);
                if (next_message) setMessage(next_message);
            }
        );
        engine.setTransactionHandler(contract => transactions.onBotContractEvent(contract as any));
        return () => {
            engine.stop();
            engine_ref.current = null;
        };
    }, [transactions]);

    const toggleScanning = () => {
        if (is_scanning) {
            engine_ref.current?.stop();
            setMessage('Scanning is off.');
            return;
        }
        const parsed = {
            stake: Number(stake),
            martingale: Number(martingale),
            take_profit: Number(take_profit),
            stop_loss: Number(stop_loss),
            currency: client.currency,
        };
        if (!parsed.stake || parsed.stake <= 0 || parsed.martingale < 1) {
            setMessage('Enter a stake above 0 and a martingale of at least 1.');
            return;
        }
        setMessage('');
        engine_ref.current?.configure(parsed);
        engine_ref.current?.startScanning(selected_symbols);
    };

    const toggleTrading = () => {
        if (is_running) {
            engine_ref.current?.stop();
            setMessage('Bot stopped.');
            return;
        }
        if (!client.is_logged_in) {
            setMessage('Log in to a Deriv account before running the bot.');
            return;
        }
        engine_ref.current?.configure({
            stake: Number(stake),
            martingale: Number(martingale),
            take_profit: Number(take_profit),
            stop_loss: Number(stop_loss),
            currency: client.currency,
        });
        engine_ref.current?.startTrading();
    };

    const active_signals = Object.values(signals).filter(signal => selected_symbols.includes(signal.symbol));
    const ready_count = active_signals.filter(signal => signal.window_size >= 1000).length;
    const aligned_count = active_signals.filter(signal => signal.aligned).length;

    useEffect(() => {
        if (is_selected) {
            matches_scalper_ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [is_selected]);

    return (
        <main className='ai-scalper-bots'>
            <header className='ai-scalper-bots__header'>
                <div>
                    <span className='ai-scalper-bots__eyebrow'>AI trading suite</span>
                    <h1 className='ai-scalper-bots__title'>AI Scalper Bots</h1>
                    <p className='ai-scalper-bots__subtitle'>
                        Select a strategy. Matches Scalper uses the second-most frequent digit from 1,000 ticks and
                        enters only when the 25- and 50-tick hottest digits confirm it.
                    </p>
                </div>
                <div className='ai-scalper-bots__badge'>
                    <strong>{SCALPER_BOTS.length + 1}</strong>
                    <span>strategies</span>
                </div>
            </header>

            <section className='ai-scalper-bots__grid' aria-label='AI scalper bot strategies'>
                {SCALPER_BOTS.map(([name, icon, accent], index) => (
                    <article className={`ai-scalper-bots__card ai-scalper-bots__card--${accent}`} key={name}>
                        <div className='ai-scalper-bots__card-top'>
                            <span className='ai-scalper-bots__icon' aria-hidden='true'>{icon}</span>
                            <span className='ai-scalper-bots__number'>{String(index + 1).padStart(2, '0')}</span>
                        </div>
                        <h2>{name}</h2>
                        <p>Digit contracts targeting fast tick-by-tick entries.</p>
                        <span className='ai-scalper-bots__status'>Available in Bot Builder</span>
                    </article>
                ))}
                <article
                    className={`ai-scalper-bots__card ai-scalper-bots__card--teal ai-scalper-bots__card--active ${
                        is_selected ? 'is-selected' : ''
                    }`}
                    onClick={() => setIsSelected(true)}
                >
                    <div className='ai-scalper-bots__card-top'>
                        <span className='ai-scalper-bots__icon' aria-hidden='true'>◎</span>
                        <span className='ai-scalper-bots__number'>06</span>
                    </div>
                    <h2>Matches Scalper</h2>
                    <p>Match the AI prediction digit on a one-tick contract.</p>
                    <button
                        className='ai-scalper-bots__configure'
                        type='button'
                        onClick={() => setIsSelected(true)}
                        aria-expanded={is_selected}
                        aria-controls='matches-scalper-config'
                    >
                        Configure now
                    </button>
                </article>
            </section>

            {is_selected && (
                <section
                    className='matches-scalper'
                    id='matches-scalper-config'
                    ref={matches_scalper_ref}
                    aria-label='Matches Scalper controls'
                >
                    <div className='matches-scalper__heading'>
                        <div>
                            <span className='matches-scalper__eyebrow'>No blocks · tickwise execution</span>
                            <h2>Matches Scalper</h2>
                        </div>
                        <span className={`matches-scalper__status matches-scalper__status--${status}`}>
                            <i /> {status === 'running' ? 'Trading' : status === 'scanning' ? 'Scanning' : status}
                        </span>
                    </div>

                    <div className='matches-scalper__controls'>
                        <label>
                            <span>Stake ({client.currency})</span>
                            <input type='number' min='0.01' step='0.01' value={stake} onChange={event => setStake(event.target.value)} />
                        </label>
                        <label>
                            <span>Martingale</span>
                            <input type='number' min='1' step='0.1' value={martingale} onChange={event => setMartingale(event.target.value)} />
                        </label>
                        <label>
                            <span>Take profit</span>
                            <input type='number' min='0' step='0.01' value={take_profit} onChange={event => setTakeProfit(event.target.value)} />
                        </label>
                        <label>
                            <span>Stop loss</span>
                            <input type='number' min='0' step='0.01' value={stop_loss} onChange={event => setStopLoss(event.target.value)} />
                        </label>
                        <label className='matches-scalper__market'>
                            <span>Market</span>
                            <select value={market} onChange={event => setMarket(event.target.value)} disabled={is_scanning}>
                                <option value='ALL_1S'>All 1s markets</option>
                                {DIGIT_SYMBOLS.map(item => (
                                    <option value={item.symbol} key={item.symbol}>{item.display_name}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className='matches-scalper__actions'>
                        <button className={`matches-scalper__button matches-scalper__button--scan ${is_scanning ? 'is-on' : ''}`} onClick={toggleScanning}>
                            <i /> {is_scanning ? 'Scanning ON' : 'Scan markets'}
                        </button>
                        <button className={`matches-scalper__button matches-scalper__button--run ${is_running ? 'is-stop' : ''}`} onClick={toggleTrading}>
                            {is_running ? 'Stop bot' : 'Run bot'}
                        </button>
                    </div>

                    <div className='matches-scalper__metrics'>
                        <div><span>Markets ready</span><strong>{ready_count}/{selected_symbols.length}</strong></div>
                        <div><span>Aligned now</span><strong>{aligned_count}</strong></div>
                        <div><span>Session P/L</span><strong className={profit >= 0 ? 'is-positive' : 'is-negative'}>{profit.toFixed(2)} {client.currency}</strong></div>
                    </div>

                    {message && <p className='matches-scalper__message'>{message}</p>}

                    <div className='matches-scalper__signals'>
                        {active_signals.length === 0 ? (
                            <div className='matches-scalper__empty'>Turn scanning on to load 1,000 ticks and calculate predictions.</div>
                        ) : (
                            active_signals.map(signal => (
                                <div className={`matches-scalper__signal ${signal.aligned ? 'is-aligned' : ''}`} key={signal.symbol}>
                                    <strong>{DIGIT_SYMBOLS.find(item => item.symbol === signal.symbol)?.display_name ?? signal.symbol}</strong>
                                    <span>Prediction <b>{signal.prediction_digit ?? '—'}</b></span>
                                    <span>25 hot <b>{signal.hottest_25 ?? '—'}</b></span>
                                    <span>50 hot <b>{signal.hottest_50 ?? '—'}</b></span>
                                    <em>{signal.window_size}/1000 ticks</em>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            )}
        </main>
    );
});

export default MatchesScalper;