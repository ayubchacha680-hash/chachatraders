import React from 'react';
import classNames from 'classnames';
import { Localize, localize } from '@deriv-com/translations';

type TFastModeToggle = {
    is_enabled: boolean;
    onToggle: () => void;
};

const FastModeToggle = ({ is_enabled, onToggle }: TFastModeToggle) => {
    const state = is_enabled ? 'ON' : 'OFF';
    const tooltip = localize(
        'Fast Mode removes the optional delay before the next eligible tick-wise purchase. Actual speed still depends on tick arrival, contract settlement, your strategy, network latency, and Deriv limits.'
    );

    return (
        <button
            aria-label={`Fast Mode: ${state}`}
            aria-pressed={is_enabled}
            className={classNames('animation__fast-mode-button', {
                'animation__fast-mode-button--active': is_enabled,
            })}
            id='db-animation__fast-mode-button'
            onClick={onToggle}
            title={tooltip}
            type='button'
        >
            <span className='animation__fast-mode-label'>
                <Localize i18n_default_text='Fast Mode' />
            </span>
            <span className='animation__fast-mode-state'>{state}</span>
        </button>
    );
};

export default FastModeToggle;