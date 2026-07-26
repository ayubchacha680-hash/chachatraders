import { getPublicSocketURL } from '@/components/shared';

export type TTickMessage = {
    epoch: number;
    quote: number;
    pip_size: number;
    symbol: string;
};

export type THistoryMessage = {
    prices: number[];
    times: number[];
    pip_size: number;
    symbol: string;
};

export type TTickStreamHandlers = {
    onHistory: (history: THistoryMessage) => void;
    onTick: (tick: TTickMessage) => void;
    onError?: (message: string) => void;
    onStatusChange?: (status: TSocketStatus) => void;
};

export type TSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

const PING_INTERVAL_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;

type TRequest = Record<string, unknown>;

/**
 * One long-lived WebSocket to Deriv's public market-data gateway, shared by every
 * analysis consumer. The socket is never torn down between symbol switches: a
 * switch forgets the old subscription and sends a new `ticks_history` request on
 * the same connection. Reconnects use exponential backoff and replay the active
 * request, so a dropped connection re-seeds the rolling window automatically.
 */
export class PublicTickSocket {
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
    private handlers: TTickStreamHandlers | null = null;

    /**
     * Subscribes to a symbol's tick stream, requesting `history_count` past ticks
     * in the same call so the consumer receives a full window immediately.
     */
    subscribe(symbol: string, history_count: number, handlers: TTickStreamHandlers) {
        this.handlers = handlers;
        this.forgetActiveSubscription();

        this.active_symbol = symbol;
        this.active_request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: history_count,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        };

        if (this.socket?.readyState === WebSocket.OPEN) {
            this.send(this.active_request);
        } else {
            this.connect();
        }
    }

    /** Stops the current stream but keeps the connection warm for the next subscribe. */
    unsubscribe() {
        this.forgetActiveSubscription();
        this.active_request = null;
        this.active_symbol = null;
        this.handlers = null;
    }

    /** Closes the connection for good. Only call this when tearing the app down. */
    dispose() {
        this.is_disposed = true;
        this.unsubscribe();
        this.clearTimers();
        this.socket?.close();
        this.socket = null;
        this.setStatus('closed');
    }

    getStatus() {
        return this.status;
    }

    private setStatus(status: TSocketStatus) {
        if (this.status === status) return;
        this.status = status;
        this.handlers?.onStatusChange?.(status);
    }

    private send(request: TRequest) {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        this.req_id += 1;
        this.socket.send(JSON.stringify({ ...request, req_id: this.req_id }));
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
            this.handlers?.onError?.('Connection to the market data feed failed.');
        });
    }

    private handleMessage(event: MessageEvent) {
        let data: Record<string, any>;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        if (data.error) {
            this.handlers?.onError?.(data.error.message ?? 'Unexpected market data error.');
            return;
        }

        if (data.subscription?.id) this.subscription_id = data.subscription.id;

        if (data.msg_type === 'history' && data.history) {
            const symbol = data.echo_req?.ticks_history ?? this.active_symbol ?? '';
            if (symbol !== this.active_symbol) return;
            this.handlers?.onHistory({
                prices: data.history.prices ?? [],
                times: data.history.times ?? [],
                pip_size: data.pip_size ?? 0,
                symbol,
            });
            return;
        }

        if (data.msg_type === 'tick' && data.tick) {
            const { symbol, quote, epoch, pip_size } = data.tick;
            if (symbol !== this.active_symbol) return;
            this.handlers?.onTick({ symbol, quote: Number(quote), epoch: Number(epoch), pip_size: pip_size ?? 0 });
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
        this.reconnect_attempts += 1;
        this.reconnect_timer = setTimeout(() => this.connect(), delay);
    }
}

let shared_socket: PublicTickSocket | null = null;

/** Shared instance so multiple analysis widgets reuse a single connection. */
export const getPublicTickSocket = () => {
    if (!shared_socket) shared_socket = new PublicTickSocket();
    return shared_socket;
};
