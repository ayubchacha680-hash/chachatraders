import { useState } from 'react';
import Text from '@/components/shared_ui/text';
import {
    DEFAULT_ANALYSIS_SYMBOL,
    DIGIT_SYMBOLS,
    ROLLING_WINDOW_SIZE,
    SPEED_MODE_CONFIG,
    SPEED_MODES,
    TSpeedMode,
} from '@/constants/analysis';
import useDigitAnalysis from '@/hooks/useDigitAnalysis';
import { Localize, localize } from '@deriv-com/translations';
import EvenOddCard from './even-odd-card';
import OverUnderCard from './over-under-card';

const STATUS_LABEL: Record<string, string> = {
    idle: 'Idle',
    connecting: 'Connecting',
    open: 'Live',
    reconnecting: 'Reconnecting',
    closed: 'Disconnected',
};

const Analysis = () => {
    const [symbol, setSymbol] = useState(DEFAULT_ANALYSIS_SYMBOL);
    const { snapshot, status, error, speed_mode, setSpeedMode, ticks_per_second } = useDigitAnalysis(symbol);
    const { even_odd, over_under, best_pair, sample_size, last_digit, total_ticks } = snapshot;

    return (
        <div className='analysis'>
            <div className='analysis__toolbar'>
                <label className='analysis__control'>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Market' />
                    </Text>
                    <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                        {DIGIT_SYMBOLS.map(option => (
                            <option key={option.symbol} value={option.symbol}>
                                {option.display_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className='analysis__control'>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize i18n_default_text='Speed mode' />
                    </Text>
                    <select value={speed_mode} onChange={event => setSpeedMode(event.target.value as TSpeedMode)}>
                        {SPEED_MODES.map(mode => (
                            <option key={mode} value={mode}>
                                {SPEED_MODE_CONFIG[mode].label}
                            </option>
                        ))}
                    </select>
                </label>

                <div className='analysis__meta'>
                    <span className={`analysis__status analysis__status--${status}`}>
                        {localize(STATUS_LABEL[status] ?? status)}
                    </span>
                    <Text as='span' size='xxs' color='less-prominent'>
                        <Localize
                            i18n_default_text='Window {{sample_size}}/{{window_size}} · {{rate}} ticks/s · {{total}} ticks seen'
                            values={{
                                sample_size: sample_size.toLocaleString(),
                                window_size: ROLLING_WINDOW_SIZE.toLocaleString(),
                                rate: ticks_per_second.toFixed(1),
                                total: total_ticks.toLocaleString(),
                            }}
                        />
                    </Text>
                    <span className='analysis__last-digit' key={total_ticks}>
                        {last_digit ?? '–'}
                    </span>
                </div>
            </div>

            <Text as='p' size='xxs' color='less-prominent' className='analysis__hint'>
                {SPEED_MODE_CONFIG[speed_mode].description}
            </Text>

            {error && (
                <Text as='p' size='xs' color='loss-danger' className='analysis__error'>
                    {error}
                </Text>
            )}

            <div className='analysis__grid'>
                <EvenOddCard stats={even_odd} sample_size={sample_size} />
                {over_under.map(pair => (
                    <OverUnderCard
                        key={`${pair.over_barrier}-${pair.under_barrier}`}
                        stats={pair}
                        is_best_overall={best_pair?.over_barrier === pair.over_barrier && best_pair?.edge > 0}
                    />
                ))}
            </div>
        </div>
    );
};

export default Analysis;
