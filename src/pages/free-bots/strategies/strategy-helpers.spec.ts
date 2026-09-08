import {
    advanceVolatilityHunter, getCycleOrder, hasOver2Confirmation, hasParityRecoverySignal, isOver2EntryDigit,
    nextMartingaleStake, shouldStopForLimits, validateKillerSettings, validateStrategySettings,
} from './strategy-helpers';
import { chachaOverCycleXml, marketCycleBotXml, over2KillerXml } from './cycle-bots';
import { getMissingRequiredBlockTypes } from '@/external/bot-skeleton/utils/required-blocks';

describe('free bot strategy helpers', () => {
    it('cycles six steps in order and wraps', () => {
        expect(getCycleOrder([0, 1, 2, 3, 4, 5], 0)).toBe(1);
        expect(getCycleOrder([0, 1, 2, 3, 4, 5], 5)).toBe(0);
    });
    it('selects latest-digit parity for recovery', () => {
        expect(hasParityRecoverySignal(8, 'even')).toBe(true);
        expect(hasParityRecoverySignal(8, 'odd')).toBe(false);
    });
    it('requires 2/3 below-3 confirmations followed by a digit over 2', () => {
        expect(isOver2EntryDigit(3)).toBe(true);
        expect(isOver2EntryDigit(2)).toBe(false);
        expect(hasOver2Confirmation([1, 2, 5], 2)).toBe(true);
        expect(hasOver2Confirmation([1, 2, 2, 7], 3)).toBe(true);
        expect(hasOver2Confirmation([1, 3, 5], 2)).toBe(false);
    });
    it('simulates exactly VH target losses then enters on the next qualifying signal and resets', () => {
        let state = { simulated_losses: 0 };
        [1, 2, 3].forEach(() => { state = advanceVolatilityHunter(state, 3, true).state; });
        expect(state).toEqual({ simulated_losses: 3 });
        expect(advanceVolatilityHunter(state, 3, true)).toEqual({ enter_real_trade: true, state: { simulated_losses: 0 } });
    });
    it('applies martingale to real settled losses only', () => {
        expect(nextMartingaleStake(1, 1, 2, 'loss')).toBe(2);
        expect(nextMartingaleStake(2, 1, 2, 'win')).toBe(1);
    });
    it('honours take-profit and stop-loss limits and validates settings', () => {
        expect(shouldStopForLimits(5, 5, 3)).toBe(true);
        expect(shouldStopForLimits(-3, 5, 3)).toBe(true);
        expect(validateStrategySettings({ stake: 0, multiplier: 2, take_profit: 5, stop_loss: 5 })).toMatch(/Stake/);
    });
    it('generates the exact contract cycles and runnable Blockly XML', () => {
        const cycle = { symbol: 'R_100', stake: 1, multiplier: 2 };
        const killer = { ...cycle, take_profit: 10, stop_loss: 5, confirmation: 2, vh_enabled: true, vh_target: 3 };
        [chachaOverCycleXml(cycle), marketCycleBotXml(cycle), over2KillerXml(killer)].forEach(xml => {
            const document = new DOMParser().parseFromString(xml, 'text/xml');
            expect(document.querySelector('parsererror')).toBeNull();
            expect(document.querySelector('block[type="before_purchase"] block[type="free_bot_purchase"]')).not.toBeNull();
            expect(document.querySelector('block[type="after_purchase"] block[type="trade_again"]')).not.toBeNull();
        });
        const contractSequence = (xml: string) =>
            Array.from(new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('block[type="free_bot_purchase"] > field[name="PURCHASE_LIST"]'))
                .map(field => field.textContent);
        expect(contractSequence(chachaOverCycleXml(cycle)).slice(-6)).toEqual([
            'DIGITDIFF', 'DIGITOVER', 'DIGITOVER', 'DIGITDIFF', 'DIGITUNDER', 'DIGITUNDER',
        ]);
        expect(contractSequence(marketCycleBotXml(cycle)).slice(-6)).toEqual([
            'DIGITDIFF', 'DIGITUNDER', 'DIGITUNDER', 'DIGITDIFF', 'DIGITOVER', 'DIGITOVER',
        ]);
        expect(validateKillerSettings({ ...killer, confirmation: 1 })).toMatch(/Confirmation/);
    });
    it('satisfies the Run validator purchase requirement without weakening other requirements', () => {
        const generated_types = ['trade_definition', 'trade_definition_tradeoptions', 'before_purchase', 'free_bot_purchase'];
        expect(
            getMissingRequiredBlockTypes(generated_types, [
                'trade_definition',
                'trade_definition_tradeoptions',
                'before_purchase',
                'purchase',
            ])
        ).toEqual([]);
        expect(getMissingRequiredBlockTypes(['free_bot_purchase'], ['trade_definition', 'purchase'])).toEqual([
            'trade_definition',
        ]);
    });
});