const STORAGE_KEY = 'deriv_app_id';

/** Fired when the stored app id changes so the header can re-enable auth buttons. */
export const APP_ID_CHANGE_EVENT = 'deriv_app_id_change';

/**
 * Deriv app id used as the OAuth `client_id` and the `Deriv-App-ID` REST header.
 *
 * `NEXT_PUBLIC_DERIV_APP_ID` is baked in at build time, so a deployed build that
 * shipped without it could never authenticate. A value saved from the API
 * connection dialog takes precedence, which lets an operator connect their own
 * registered app without a rebuild.
 */
export const getDerivAppId = (): string => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)?.trim();
        if (stored) return stored;
    } catch {
        // localStorage can throw in private-mode browsers; fall back to the env value.
    }
    return (process.env.NEXT_PUBLIC_DERIV_APP_ID ?? '').trim();
};

export const isDerivAppIdConfigured = (): boolean => Boolean(getDerivAppId());

/** App ids are numeric identifiers issued by the Deriv dashboard. */
export const isValidDerivAppId = (app_id: string): boolean => /^\d+$/.test(app_id.trim());

export const setDerivAppId = (app_id: string): void => {
    localStorage.setItem(STORAGE_KEY, app_id.trim());
    window.dispatchEvent(new Event(APP_ID_CHANGE_EVENT));
};

export const clearDerivAppId = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(APP_ID_CHANGE_EVENT));
};
