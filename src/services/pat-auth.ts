import { getPublicSocketURL } from '@/components/shared';

export type TPATAccount = {
    loginid: string;
    token: string;
    currency: string;
    balance: number;
    is_virtual: boolean;
    email?: string;
    fullname?: string;
};

export type TPATAuthResult =
    | { ok: true; account: TPATAccount }
    | { ok: false; error: string };

const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

/** Authorizes a single PAT token via Deriv's WebSocket API and returns account info. */
export const authorizePAT = (token: string): Promise<TPATAuthResult> => {
    return new Promise(resolve => {
        let ws: WebSocket | null = null;
        const timeout = setTimeout(() => {
            ws?.close();
            resolve({ ok: false, error: 'Connection timed out. Check your token and try again.' });
        }, 12000);

        try {
            // Use the standard Deriv WS endpoint with a public app_id for authorization
            ws = new WebSocket(WS_URL);
        } catch {
            clearTimeout(timeout);
            resolve({ ok: false, error: 'Failed to open WebSocket connection.' });
            return;
        }

        ws.onopen = () => {
            ws!.send(JSON.stringify({ authorize: token, req_id: 1 }));
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data as string);
                clearTimeout(timeout);
                ws!.close();

                if (data.error) {
                    resolve({ ok: false, error: data.error.message ?? 'Authorization failed.' });
                    return;
                }

                if (data.msg_type === 'authorize' && data.authorize) {
                    const auth = data.authorize;
                    resolve({
                        ok: true,
                        account: {
                            loginid: auth.loginid,
                            token,
                            currency: auth.currency ?? 'USD',
                            balance: auth.balance ?? 0,
                            is_virtual: auth.is_virtual === 1,
                            email: auth.email,
                            fullname: auth.fullname,
                        },
                    });
                }
            } catch {
                clearTimeout(timeout);
                resolve({ ok: false, error: 'Unexpected response from server.' });
            }
        };

        ws.onerror = () => {
            clearTimeout(timeout);
            resolve({ ok: false, error: 'WebSocket connection error.' });
        };
    });
};

const STORAGE_KEY = 'pat_accounts';

export const loadStoredAccounts = (): TPATAccount[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as TPATAccount[]) : [];
    } catch {
        return [];
    }
};

export const saveAccount = (account: TPATAccount): void => {
    const existing = loadStoredAccounts().filter(a => a.loginid !== account.loginid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, account]));

    // Also write into the format api_base expects (accountsList)
    const accountsList: Record<string, unknown> = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
    accountsList[account.loginid] = {
        token: account.token,
        currency: account.currency,
        is_virtual: account.is_virtual ? 1 : 0,
        balance: account.balance,
    };
    localStorage.setItem('accountsList', JSON.stringify(accountsList));

    // Set as active account
    localStorage.setItem('active_loginid', account.loginid);
    localStorage.setItem('account_type', account.is_virtual ? 'demo' : 'real');
};

export const removeAccount = (loginid: string): void => {
    const remaining = loadStoredAccounts().filter(a => a.loginid !== loginid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));

    const accountsList: Record<string, unknown> = JSON.parse(localStorage.getItem('accountsList') ?? '{}');
    delete accountsList[loginid];
    localStorage.setItem('accountsList', JSON.stringify(accountsList));

    // If removed account was active, switch to first remaining
    if (localStorage.getItem('active_loginid') === loginid) {
        const first = remaining[0];
        if (first) {
            localStorage.setItem('active_loginid', first.loginid);
            localStorage.setItem('account_type', first.is_virtual ? 'demo' : 'real');
        } else {
            localStorage.removeItem('active_loginid');
        }
    }
};
