import { DerivWSAccountsService } from '@/services/derivws-accounts.service';

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

/**
 * Validates a PAT through Deriv's authenticated REST API.
 *
 * The v1 API does not accept PATs in an `authorize` message on the public
 * WebSocket. REST validates the Bearer token and the bot later gets an
 * authenticated, short-lived OTP WebSocket URL for the selected account.
 */
export const authorizePAT = async (token: string): Promise<TPATAuthResult> => {
    try {
        const accounts = await DerivWSAccountsService.fetchAccountsList(token);
        const account = accounts?.[0];

        if (!account?.account_id) {
            return { ok: false, error: 'This token is valid, but it has no trading account access.' };
        }

        return {
            ok: true,
            account: {
                loginid: account.account_id,
                token,
                currency: account.currency ?? 'USD',
                balance: Number(account.balance) || 0,
                is_virtual: account.account_type === 'demo',
            },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : '';

        if (/401|unauthori[sz]ed|invalid token|invalid.*bearer/i.test(message)) {
            return {
                ok: false,
                error: 'Deriv rejected this token. Check that it is a Personal Access Token with trading access and has not been revoked.',
            };
        }

        if (/403|app[- ]id|forbidden/i.test(message)) {
            return {
                ok: false,
                error: 'Deriv rejected the app configuration. Please try again or contact the app owner.',
            };
        }

        return {
            ok: false,
            error: 'Could not validate the token with Deriv. Check your connection and try again.',
        };
    }
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
