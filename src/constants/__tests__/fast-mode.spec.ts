import {
    FAST_MODE_SESSION_KEY,
    getTradeOptionsPollingDelay,
    isFastModeEnabled,
    setFastModeEnabled,
} from '../fast-mode';

describe('fast mode', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('defaults to normal mode with the existing one-second polling delay', () => {
        expect(isFastModeEnabled()).toBe(false);
        expect(getTradeOptionsPollingDelay()).toBe(1);
    });

    it('persists fast mode for the browser session and removes the polling delay', () => {
        setFastModeEnabled(true);

        expect(window.sessionStorage.getItem(FAST_MODE_SESSION_KEY)).toBe('true');
        expect(isFastModeEnabled()).toBe(true);
        expect(getTradeOptionsPollingDelay()).toBe(0);
    });

    it('restores the normal delay when fast mode is turned off', () => {
        setFastModeEnabled(true);
        setFastModeEnabled(false);

        expect(isFastModeEnabled()).toBe(false);
        expect(getTradeOptionsPollingDelay()).toBe(1);
    });
});