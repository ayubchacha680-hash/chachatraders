import { getPublicSocketURL } from '@/components/shared';

export type TActiveSymbol = {
    symbol: string;
    display_name: string;
    market: string;
    market_display_name: string;
    submarket: string;
    submarket_display_name: string;
    is_trading_suspended: boolean;
    pip: number;
};

let cached_symbols: TActiveSymbol[] | null = null;
let fetch_promise: Promise<TActiveSymbol[]> | null = null;

/** Fetches all active symbols from Deriv's public API, caching the result. */
export const getActiveSymbols = (): Promise<TActiveSymbol[]> => {
    if (cached_symbols) return Promise.resolve(cached_symbols);
    if (fetch_promise) return fetch_promise;

    fetch_promise = new Promise<TActiveSymbol[]>((resolve, reject) => {
        let ws: WebSocket | null = null;
        const timeout = setTimeout(() => {
            ws?.close();
            fetch_promise = null;
            reject(new Error('Timed out fetching active symbols'));
        }, 5000);

        try {
            ws = new WebSocket(getPublicSocketURL());
        } catch {
            clearTimeout(timeout);
            fetch_promise = null;
            reject(new Error('Failed to open WebSocket'));
            return;
        }

        ws.onopen = () => {
            ws!.send(JSON.stringify({ active_symbols: 'brief', req_id: 1 }));
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                if (data.active_symbols) {
                    clearTimeout(timeout);
                    cached_symbols = (data.active_symbols as Record<string, unknown>[]).map(s => ({
                        symbol: s.symbol as string,
                        display_name: s.display_name as string,
                        market: s.market as string,
                        market_display_name: s.market_display_name as string,
                        submarket: s.submarket as string,
                        submarket_display_name: s.submarket_display_name as string,
                        is_trading_suspended: Boolean(s.is_trading_suspended),
                        pip: Number(s.pip ?? 0),
                    }));
                    resolve(cached_symbols!);
                    ws!.close();
                }
            } catch {
                // ignore parse errors
            }
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            fetch_promise = null;
            reject(new Error('WebSocket error fetching active symbols'));
        };

        ws.onclose = () => {
            clearTimeout(timeout);
        };
    });

    return fetch_promise;
};

/** Groups symbols by market for use in a grouped dropdown. */
export const groupSymbolsByMarket = (
    symbols: TActiveSymbol[]
): Record<string, { display_name: string; symbols: TActiveSymbol[] }> => {
    const groups: Record<string, { display_name: string; symbols: TActiveSymbol[] }> = {};
    for (const sym of symbols) {
        if (sym.is_trading_suspended) continue;
        if (!groups[sym.market]) {
            groups[sym.market] = { display_name: sym.market_display_name, symbols: [] };
        }
        groups[sym.market].symbols.push(sym);
    }
    return groups;
};
