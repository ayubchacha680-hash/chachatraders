export const FAST_MODE_SESSION_KEY = 'dbot_fast_mode';

export const isFastModeEnabled = (): boolean => {
    try {
        return window.sessionStorage.getItem(FAST_MODE_SESSION_KEY) === 'true';
    } catch {
        return false;
    }
};

export const setFastModeEnabled = (is_enabled: boolean): void => {
    try {
        window.sessionStorage.setItem(FAST_MODE_SESSION_KEY, String(is_enabled));
    } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
    }
};

export const getTradeOptionsPollingDelay = (): number => (isFastModeEnabled() ? 0 : 1);