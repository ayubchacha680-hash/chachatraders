import { getPublicSocketURL } from '@/components/shared';
import { DIGIT_SYMBOLS } from '@/constants/analysis';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { getLastDigit } from '@/services/analysis/digit-analysis';

export type TMatchesScalperSettings = {
    stake: number;
    martingale: number;
    take_profit: number;
    stop_loss: number;
    currency: string;
};

export type TMatchesScalperSignal = {
    symbol: string;
    prediction_digit: number | null;
    hottest_25: number | null;
    hottest_50: number | null;
    aligned: boolean;
    window_size: number;
    last_digit: number | null;
};

export type TMatchesScalperStatus = 'idle' | 'connecting' | 'scanning' | 'running' | 'stopped' | 'error';

type TAnalysisHandler = (signal: TMatchesScalperSignal) => void;
type TStatusHandler = (status: TMatchesScalperStatus, message?: string) => void;
type TTransactionHandler = (contract: Record<string, unknown>) => void;

const ALL_1S_SYMBOLS = DIGIT_SYMBOLS.filter(item => item.symbol.startsWith('1HZ')).map(item => item.symbol);

class DigitWindows {
    private readonly long: number[] = [];
    private readonly recent: number[] = [];
    private pip_size = 0;

    seed(prices: number[], pip_size: number) {
        this.pip_size = pip_size;
        this.long.length = 0;
        this.recent.length = 0;
        prices.slice(-1000).forEach(price => this.push(price));
    }

    push(price: number) {
        const digit = getLastDigit(price, this.pip_size);
        this.long.push(digit);
        if (this.long.length > 1000) this.long.shift();
        this.recent.push(digit);
        if (this.recent.length > 50) this.recent.shift();
    }

    signal(symbol: string, last_digit: number | null): TMatchesScalperSignal {
        const prediction_digit = this.mostCommon(this.long, 1);
        const hottest_25 = this.mostCommon(this.recent.slice(-25), 0);
        const hottest_50 = this.mostCommon(this.recent, 0);
        return {
            symbol,
            prediction_digit,
            hottest_25,
            hottest_50,
            aligned:
                prediction_digit !== null &&
                prediction_digit === hottest_25 &&
                prediction_digit === hottest_50 &&
                this.long.length >= 1000 &&
                this.recent.length >= 50,
            window_size: this.long.length,
            last_digit,
        };
    }

    private mostCommon(values: number[], rank: number) {
        if (!values.length) return null;
        const counts = new Array(10).fill(0);
        values.forEach(value => {
            counts[value] += 1;
        });
        return counts
            .map((count, digit) => ({ count, digit }))
            .sort((a, b) => b.count - a.count || a.digit - b.digit)[rank]?.digit ?? null;
    }
}

type TActiveContract = {
    contract_id: number;
    buy_transaction_id: number;
    stake: number;
};

/**
 * Matches Scalper deliberately lives outside Blockly. It consumes public ticks for
 * analysis and uses the already authenticated bot API for digit-match purchases.
 * The analysis socket is kept separate because scanning several symbols at once
 * cannot use the single-symbol chart subscription.
 */
export default class MatchesScalperEngine {
    private socket: WebSocket | null = null;
    private api_subscription: { unsubscribe: () => void } | null = null;
    private readonly windows = new Map<string, DigitWindows>();
    private readonly active_contracts = new Map<number, TActiveContract>();
    private readonly completed_contracts = new Set<number>();
    private purchase_in_flight = false;
    private symbols: string[] = [];
    private settings: TMatchesScalperSettings = {
        stake: 1,
        martingale: 1,
        take_profit: 0,
        stop_loss: 0,
        currency: 'USD',
    };
    private current_stake = 1;
    private realized_profit = 0;
    private status: TMatchesScalperStatus = 'idle';
    private on_analysis?: TAnalysisHandler;
    private on_status?: TStatusHandler;
    private on_transaction?: TTransactionHandler;

    configure(settings: TMatchesScalperSettings) {
        this.settings = { ...settings };
        this.current_stake = settings.stake;
    }

    setHandlers(on_analysis: TAnalysisHandler, on_status: TStatusHandler) {
        this.on_analysis = on_analysis;
        this.on_status = on_status;
    }

    setTransactionHandler(on_transaction: TTransactionHandler) {
        this.on_transaction = on_transaction;
    }

    get profit() {
        return this.realized_profit;
    }

    getStatus() {
        return this.status;
    }

    startScanning(symbols: string[]) {
        this.stopScanning(false);
        this.symbols = symbols;
        this.symbols.forEach(symbol => this.windows.set(symbol, new DigitWindows()));
        this.setStatus('connecting');
        this.socket = new WebSocket(getPublicSocketURL());
        this.socket.addEventListener('open', () => {
            this.symbols.forEach((symbol, index) => {
                this.socket?.send(
                    JSON.stringify({
                        ticks_history: symbol,
                        adjust_start_time: 1,
                        count: 1000,
                        end: 'latest',
                        style: 'ticks',
                        subscribe: 1,
                        req_id: index + 1,
                    })
                );
            });
            this.setStatus(this.api_subscription ? 'running' : 'scanning');
        });
        this.socket.addEventListener('message', event => this.handleMarketMessage(event));
        this.socket.addEventListener('error', () => this.setStatus('error', 'The public market-data connection failed.'));
        this.socket.addEventListener('close', () => {
            if (this.socket) this.setStatus('stopped');
        });
    }

    stopScanning(mark_stopped = true) {
        this.socket?.close();
        this.socket = null;
        if (mark_stopped) this.setStatus('stopped');
    }

    stop() {
        this.stopScanning();
        this.api_subscription?.unsubscribe();
        this.api_subscription = null;
        this.active_contracts.clear();
        this.setStatus('stopped');
    }

    startTrading() {
        if (!this.socket || this.status === 'idle' || this.status === 'stopped') {
            this.setStatus('error', 'Start market scanning before running the bot.');
            return false;
        }
        if (!api_base.api) {
            this.setStatus('error', 'Log in to a Deriv account before running the bot.');
            return false;
        }
        this.api_subscription?.unsubscribe();
        this.api_subscription = api_base.api.onMessage().subscribe(({ data }) => this.handleTradingMessage(data));
        this.setStatus('running');
        return true;
    }

    private handleMarketMessage(event: MessageEvent) {
        let data: any;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }
        if (data.error) {
            this.setStatus('error', data.error.message ?? 'Market data request failed.');
            return;
        }
        if (data.msg_type === 'history' && data.history) {
            const symbol = data.echo_req?.ticks_history;
            const window = this.windows.get(symbol);
            if (window) {
                window.seed(data.history.prices ?? [], Number(data.pip_size ?? 0));
                this.publishSignal(symbol, window, null);
            }
        }
        if (data.msg_type === 'tick' && data.tick?.symbol) {
            const symbol = data.tick.symbol;
            const window = this.windows.get(symbol);
            if (!window) return;
            window.push(Number(data.tick.quote));
            this.publishSignal(symbol, window, getLastDigit(Number(data.tick.quote), Number(data.tick.pip_size ?? 0)));
        }
    }

    private publishSignal(symbol: string, window: DigitWindows, last_digit: number | null) {
        const signal = window.signal(symbol, last_digit);
        this.on_analysis?.(signal);
        if (this.status === 'running' && signal.aligned) {
            void this.purchase(signal);
        }
    }

    private async purchase(signal: TMatchesScalperSignal) {
        const api: any = api_base.api;
        if (!api || this.active_contracts.size >= 1 || this.purchase_in_flight) return;
        const stake = Number(this.current_stake.toFixed(2));
        if (!Number.isFinite(stake) || stake <= 0) return;
        this.purchase_in_flight = true;
        try {
            const response = await api.send({
                buy: '1',
                price: stake,
                parameters: {
                    amount: stake,
                    basis: 'stake',
                    contract_type: 'DIGITMATCH',
                    currency: this.settings.currency,
                    duration: 1,
                    duration_unit: 't',
                    underlying_symbol: signal.symbol,
                    barrier: signal.prediction_digit,
                    selected_tick: signal.prediction_digit,
                },
            });
            if (response?.error) throw new Error(response.error.message);
            const buy = response?.buy;
            if (!buy?.contract_id || !buy?.transaction_id) throw new Error('The purchase response was incomplete.');
            const contract_id = Number(buy.contract_id);
            this.active_contracts.set(contract_id, {
                contract_id,
                buy_transaction_id: Number(buy.transaction_id),
                stake: Number(buy.buy_price ?? stake),
            });
            this.emitContract({
                ...buy,
                contract_id,
                contract_type: 'DIGITMATCH',
                underlying: signal.symbol,
                underlying_symbol: signal.symbol,
                currency: this.settings.currency,
                barrier: signal.prediction_digit,
                buy_price: Number(buy.buy_price ?? stake),
                transaction_ids: { buy: Number(buy.transaction_id) },
                is_sold: 0,
                is_completed: false,
            });
            api.send({ proposal_open_contract: 1, contract_id, subscribe: 1 });
        } catch (error: any) {
            this.setStatus('error', error?.message ?? 'The bot could not place the trade.');
        } finally {
            this.purchase_in_flight = false;
        }
    }

    private handleTradingMessage(data: any) {
        if (data?.error) {
            this.setStatus('error', data.error.message ?? 'Trading request failed.');
            return;
        }
        if (data?.msg_type !== 'proposal_open_contract') return;
        const contract = data.proposal_open_contract;
        const contract_id = Number(contract?.contract_id);
        if (!contract || !this.active_contracts.has(contract_id)) return;
        this.emitContract({
            ...contract,
            underlying_symbol: contract.underlying_symbol,
            is_completed: Boolean(contract.is_sold || contract.is_expired),
        });
        if (!contract.is_sold && !contract.is_expired) return;
        if (this.completed_contracts.has(contract_id)) return;
        this.completed_contracts.add(contract_id);
        this.active_contracts.delete(contract_id);
        const result = Number(contract.profit ?? Number(contract.sell_price) - Number(contract.buy_price));
        this.realized_profit += Number.isFinite(result) ? result : 0;
        this.current_stake = result < 0 ? this.current_stake * this.settings.martingale : this.settings.stake;
        if (
            (this.settings.take_profit > 0 && this.realized_profit >= this.settings.take_profit) ||
            (this.settings.stop_loss > 0 && this.realized_profit <= -this.settings.stop_loss)
        ) {
            this.setStatus('stopped', this.realized_profit >= 0 ? 'Take profit reached.' : 'Stop loss reached.');
            this.stopScanning(false);
        }
    }

    private emitContract(contract: any) {
        this.on_transaction?.({
            ...contract,
            accountID: (api_base.account_info as { loginid?: string })?.loginid,
            date_start: contract.date_start ?? Date.now(),
            entry_spot: contract.entry_spot,
            exit_spot: contract.exit_spot,
        });
    }

    private setStatus(status: TMatchesScalperStatus, message?: string) {
        this.status = status;
        this.on_status?.(status, message);
    }
}

export { ALL_1S_SYMBOLS };