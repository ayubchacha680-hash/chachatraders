import { getPublicSocketURL } from '@/components/shared';

export type TCandle = {
    open: number;
    high: number;
    low: number;
    close: number;
    epoch: number;
};

export type TSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export type TCandleHandlers = {
    onHistory: (candles: TCandle[]) => void;
    /** Called each tick with the current (possibly incomplete) candle updated live. */
    onUpdate: (candle: TCandle) => void;
    onError?: (msg: string) => void;
    onStatusChange?: (status: TSocketStatus) => void;
};

const PING_INTERVAL_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

type TRequest = Record<string, unknown>;

/**
 * One long-lived WebSocket per symbol, streaming OHLC candles at a given
 * granularity. On subscribe it requests `count` historical candles then
 * streams live `ohlc` updates. Reconnects replay the active request
 * automatically.
 */
export class CandleSocket {
    private socket: WebSocket | null = null;
    private ping_timer: ReturnType<typeof setInterval> | null = null;
    private reconnect_timer: ReturnType<typeof setTimeout> | null = null;
    private reconnect_attempts = 0;
    private req_id = 0;
    private status: TSocketStatus = 'idle';
    private is_disposed = false;

    private active_request: TRequest | null = null;
    private active_symbol: string | null = null;
    private subscription_id: string | null = null;
    private handlers: TCandleHandlers | null = null;

    subscribe(symbol: string, count: number, granularity: number, handlers: TCandleHandlers) {
        this.handlers = handlers;
        this.forgetActiveSubscription();

        this.active_symbol = symbol;
        this.active_request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count,
            end: 'latest',
            style: 'candles',
            granularity,
            subscribe: 1,
        };

        if (this.socket?.readyState === WebSocket.OPEN) {
            this.send(this.active_request);
        } else {
            this.connect();
        }
    }

    unsubscribe() {
        this.forgetActiveSubscription();
        this.active_request = null;
        this.active_symbol = null;
        this.handlers = null;
    }

    dispose() {
        this.is_disposed = true;
        this.unsubscribe();
        this.clearTimers();
        this.socket?.close();
        this.socket = null;
        this.setStatus('closed');
    }

    private setStatus(status: TSocketStatus) {
        if (this.status === status) return;
        this.status = status;
        this.handlers?.onStatusChange?.(status);
    }

    private send(req: TRequest) {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        this.req_id++;
        this.socket.send(JSON.stringify({ ...req, req_id: this.req_id }));
    }

    private forgetActiveSubscription() {
        if (this.subscription_id && this.socket?.readyState === WebSocket.OPEN) {
            this.send({ forget: this.subscription_id });
        }
        this.subscription_id = null;
    }

    private connect() {
        if (this.is_disposed) return;
        if (this.socket?.readyState === WebSocket.CONNECTING || this.socket?.readyState === WebSocket.OPEN) return;

        this.setStatus(this.reconnect_attempts > 0 ? 'reconnecting' : 'connecting');

        const socket = new WebSocket(getPublicSocketURL());
        this.socket = socket;

        socket.addEventListener('open', () => {
            this.reconnect_attempts = 0;
            this.setStatus('open');
            this.startPing();
            if (this.active_request) this.send(this.active_request);
        });

        socket.addEventListener('message', event => this.handleMessage(event));

        socket.addEventListener('close', () => {
            this.clearTimers();
            this.subscription_id = null;
            if (this.socket === socket) this.socket = null;
            this.scheduleReconnect();
        });

        socket.addEventListener('error', () => {
            this.handlers?.onError?.('Candle feed connection failed.');
        });
    }

    private handleMessage(event: MessageEvent) {
        let data: Record<string, any>;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.error) {
            this.handlers?.onError?.(data.error.message ?? 'Unexpected candle feed error.');
            return;
        }

        if (data.subscription?.id) this.subscription_id = data.subscription.id;

        // Historical candles batch
        if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
            const symbol = data.echo_req?.ticks_history ?? this.active_symbol ?? '';
            if (symbol !== this.active_symbol) return;
            this.handlers?.onHistory(
                data.candles.map((c: any) => ({
                    open:  Number(c.open),
                    high:  Number(c.high),
                    low:   Number(c.low),
                    close: Number(c.close),
                    epoch: Number(c.epoch),
                }))
            );
            return;
        }

        // Live OHLC update (current open candle)
        if (data.msg_type === 'ohlc' && data.ohlc) {
            const { symbol, open, high, low, close, epoch } = data.ohlc;
            if (symbol !== this.active_symbol) return;
            this.handlers?.onUpdate({
                open:  Number(open),
                high:  Number(high),
                low:   Number(low),
                close: Number(close),
                epoch: Number(epoch),
            });
        }
    }

    private startPing() {
        this.stopPing();
        this.ping_timer = setInterval(() => this.send({ ping: 1 }), PING_INTERVAL_MS);
    }

    private stopPing() {
        if (this.ping_timer) clearInterval(this.ping_timer);
        this.ping_timer = null;
    }

    private clearTimers() {
        this.stopPing();
        if (this.reconnect_timer) clearTimeout(this.reconnect_timer);
        this.reconnect_timer = null;
    }

    private scheduleReconnect() {
        if (this.is_disposed || !this.active_request) {
            this.setStatus('closed');
            return;
        }
        this.setStatus('reconnecting');
        const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** this.reconnect_attempts, MAX_RECONNECT_DELAY_MS);
        this.reconnect_attempts++;
        this.reconnect_timer = setTimeout(() => this.connect(), delay);
    }
}
