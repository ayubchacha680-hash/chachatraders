import MatchesScalperEngine, { TMatchesScalperSignal } from '../matches-scalper-engine';

const makeSignal = (symbol: string, aligned: boolean): TMatchesScalperSignal => ({
    symbol,
    prediction_digit: 4,
    hottest_25: aligned ? 4 : 7,
    hottest_50: aligned ? 4 : 2,
    aligned,
    window_size: 1000,
    last_digit: 4,
});

describe('MatchesScalperEngine market selection', () => {
    let engine: MatchesScalperEngine;
    let internals: any;

    beforeEach(() => {
        engine = new MatchesScalperEngine();
        internals = engine as any;
        internals.status = 'running';
        internals.on_analysis = jest.fn();
        internals.purchase = jest.fn();
    });

    it('locks the first aligned market and ignores aligned signals from other markets', () => {
        const first_market_signal = makeSignal('R_10', true);
        const other_market_signal = makeSignal('1HZ10V', true);

        internals.publishSignal('R_10', { signal: () => first_market_signal }, null);
        internals.publishSignal('1HZ10V', { signal: () => other_market_signal }, null);

        expect(engine.lockedSymbol).toBe('R_10');
        expect(internals.purchase).toHaveBeenCalledTimes(1);
        expect(internals.purchase).toHaveBeenCalledWith(first_market_signal);
    });

    it('continues trading the locked market when later signals are no longer aligned', () => {
        const aligned_signal = makeSignal('R_10', true);
        const later_unaligned_signal = makeSignal('R_10', false);

        internals.publishSignal('R_10', { signal: () => aligned_signal }, null);
        internals.publishSignal('R_10', { signal: () => later_unaligned_signal }, null);

        expect(engine.lockedSymbol).toBe('R_10');
        expect(internals.purchase).toHaveBeenNthCalledWith(2, later_unaligned_signal);
    });

    it('does not purchase after a manual stop', () => {
        const signal = makeSignal('R_10', true);
        internals.status = 'stopped';

        internals.publishSignal('R_10', { signal: () => signal }, null);

        expect(engine.lockedSymbol).toBeNull();
        expect(internals.purchase).not.toHaveBeenCalled();
    });
});