export type TTradeResult = 'win' | 'loss';

export const getCycleOrder = (cycles: readonly number[], completed_cycle: number): number | null => {
    const index = cycles.indexOf(completed_cycle);
    return index < 0 || !cycles.length ? null : cycles[(index + 1) % cycles.length];
};

export const hasParityRecoverySignal = (latest_digit: number, expected_parity: 'even' | 'odd') =>
    expected_parity === 'even' ? latest_digit % 2 === 0 : latest_digit % 2 !== 0;

/** A qualifying Over 2 digit is the digit after the low-digit confirmation. */
export const isOver2EntryDigit = (latest_digit: number) => latest_digit > 2;

export const hasOver2Confirmation = (digits: readonly number[], confirmation: number) =>
    digits.length > confirmation &&
    isOver2EntryDigit(digits[digits.length - 1]) &&
    digits.slice(-confirmation - 1, -1).every(digit => digit < 3);

export type TVolatilityHunterState = { simulated_losses: number };

/**
 * VH deliberately does not touch a real stake until its simulated-loss target
 * has been observed. The following qualifying signal is the real entry.
 */
export const advanceVolatilityHunter = (
    state: TVolatilityHunterState,
    target: number,
    qualifying_signal: boolean,
    enabled = true
): { enter_real_trade: boolean; state: TVolatilityHunterState } => {
    if (!qualifying_signal) return { enter_real_trade: false, state };
    if (!enabled || state.simulated_losses >= target) return { enter_real_trade: true, state: { simulated_losses: 0 } };
    return { enter_real_trade: false, state: { simulated_losses: state.simulated_losses + 1 } };
};

export const nextMartingaleStake = (stake: number, initial_stake: number, multiplier: number, result: TTradeResult) =>
    result === 'loss' ? stake * multiplier : initial_stake;

export const shouldStopForLimits = (profit: number, take_profit: number, stop_loss: number) =>
    profit >= take_profit || profit <= -Math.abs(stop_loss);

export type TStrategySettings = { stake: number; multiplier: number; take_profit: number; stop_loss: number };

export const validateCycleSettings = (settings: Pick<TStrategySettings, 'stake' | 'multiplier'>): string | null => {
    if (!Number.isFinite(settings.stake) || settings.stake <= 0) return 'Stake must be greater than zero.';
    if (!Number.isFinite(settings.multiplier) || settings.multiplier < 1) return 'Multiplier must be at least 1.';
    return null;
};

export const validateStrategySettings = (settings: TStrategySettings): string | null => {
    const cycle_error = validateCycleSettings(settings);
    if (cycle_error) return cycle_error;
    if (!Number.isFinite(settings.take_profit) || settings.take_profit <= 0) return 'Take profit must be greater than zero.';
    if (!Number.isFinite(settings.stop_loss) || settings.stop_loss <= 0) return 'Stop loss must be greater than zero.';
    return null;
};

export const validateKillerSettings = (settings: TStrategySettings & { confirmation: number; vh_target: number }): string | null =>
    validateStrategySettings(settings) ||
    (![2, 3].includes(settings.confirmation)
        ? 'Confirmation must be 2 or 3 digits.'
        : !Number.isInteger(settings.vh_target) || settings.vh_target < 1
            ? 'VH target must be a whole number of at least 1.'
            : null);