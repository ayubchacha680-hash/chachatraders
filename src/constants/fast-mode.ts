export const FAST_MODE_SESSION_KEY = 'dbot_fast_mode';

let cached_fast_mode: boolean | undefined;

export const isFastModeEnabled = (): boolean => {
    if (cached_fast_mode !== undefined) return cached_fast_mode;
    try {
        cached_fast_mode = window.sessionStorage.getItem(FAST_MODE_SESSION_KEY) === 'true';
    } catch {
        cached_fast_mode = false;
    }
    return cached_fast_mode;
};

export const setFastModeEnabled = (is_enabled: boolean): void => {
    cached_fast_mode = is_enabled;
    try {
        window.sessionStorage.setItem(FAST_MODE_SESSION_KEY, String(is_enabled));
    } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
    }
};

export const getTradeOptionsPollingDelay = (): number => (isFastModeEnabled() ? 0 : 1);