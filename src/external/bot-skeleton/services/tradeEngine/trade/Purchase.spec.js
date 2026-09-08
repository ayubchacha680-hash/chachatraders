import { api_base } from '../../api/api-base';
import Purchase from './Purchase';
import { BEFORE_PURCHASE } from './state/constants';

jest.mock('../../api/api-base', () => ({
    api_base: {
        api: {
            send: jest.fn(),
        },
    },
}));

jest.mock('../utils/broadcast', () => ({
    contractStatus: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
}));

jest.mock('./state/actions', () => ({
    purchaseSuccessful: () => ({ type: 'PURCHASE_SUCCESSFUL' }),
}));

jest.mock('../utils/helpers', () => ({
    doUntilDone: action => action(),
    getUUID: jest.fn(),
    recoverFromError: jest.fn(),
    tradeOptionToBuy: (contract_type, trade_options) => {
        const parameters = {
            amount: trade_options.amount,
            contract_type,
        };
        if (trade_options.prediction !== undefined) parameters.barrier = trade_options.prediction;
        return { buy: '1', parameters };
    },
}));

const createEngine = () => {
    class Engine {
        constructor() {
            this.tradeOptions = { amount: 1, prediction: 5 };
            this.store = {
                getState: () => ({ scope: BEFORE_PURCHASE }),
                dispatch: jest.fn(),
            };
            this.options = { timeMachineEnabled: false };
            this.accountInfo = { loginid: 'VRTC1' };
            this.is_proposal_subscription_required = true;
            this.selectProposal = jest.fn(() => {
                throw new Error('Cycle purchases must not reuse subscribed proposals');
            });
            this.renewProposalsOnPurchase = jest.fn();
            this.updateAndReturnTotalRuns = jest.fn(() => 1);
        }
    }

    return new (Purchase(Engine))();
};

describe('free bot purchase', () => {
    beforeEach(() => {
        api_base.api.send.mockResolvedValue({
            buy: { transaction_id: 10, contract_id: 20, buy_price: 1 },
        });
    });

    it('uses a direct dynamic contract request with the selected barrier', async () => {
        const engine = createEngine();

        await engine.purchaseFreeBot('DIGITOVER', 2);

        expect(engine.selectProposal).not.toHaveBeenCalled();
        expect(api_base.api.send).toHaveBeenCalledWith({
            buy: '1',
            parameters: { amount: 1, contract_type: 'DIGITOVER', barrier: 2 },
        });
        expect(engine.tradeOptions).toEqual({ amount: 1, prediction: 5 });
    });

    it('does not send a barrier for parity contracts', async () => {
        const engine = createEngine();

        await engine.purchaseFreeBot('DIGITEVEN', 0);

        expect(api_base.api.send).toHaveBeenCalledWith({
            buy: '1',
            parameters: { amount: 1, contract_type: 'DIGITEVEN' },
        });
    });
});