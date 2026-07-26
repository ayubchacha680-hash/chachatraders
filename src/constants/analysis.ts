/**
 * Digit-analysis constants: rolling window size, the over/under pairs shown on
 * the Analysis tab, and the tick-pipeline speed modes.
 */

/** Number of ticks kept in the rolling window. Seeded from history so the
 * window is full from the first render (no growing phase). */
export const ROLLING_WINDOW_SIZE = 1000;

export type TOverUnderPair = {
    /** Digits strictly greater than this barrier win the Over side. */
    over_barrier: number;
    /** Digits strictly lower than this barrier win the Under side. */
    under_barrier: number;
};

/** Complementary Deriv digit barriers: Over N pairs with Under (9 - N). */
export const OVER_UNDER_PAIRS: TOverUnderPair[] = [
    { over_barrier: 1, under_barrier: 8 },
    { over_barrier: 2, under_barrier: 7 },
    { over_barrier: 3, under_barrier: 6 },
    { over_barrier: 4, under_barrier: 5 },
];

export const SPEED_MODES = ['ultra_fast', 'fast', 'balanced', 'power_saver'] as const;

export type TSpeedMode = (typeof SPEED_MODES)[number];

export type TSpeedModeConfig = {
    label: string;
    description: string;
    /**
     * Ticks that must be ingested before a render is published. Every tick still
     * updates the rolling window; this only coalesces paints.
     */
    min_ticks_per_render: number;
    /**
     * Minimum gap between renders, in ms. 0 means paint on the next animation
     * frame (~16 ms at 60 FPS).
     */
    min_render_interval_ms: number;
};

export const SPEED_MODE_CONFIG: Record<TSpeedMode, TSpeedModeConfig> = {
    ultra_fast: {
        label: 'Ultra fast',
        description: 'Evaluate every tick, render on the next frame. No debounce, no delay.',
        min_ticks_per_render: 1,
        min_render_interval_ms: 0,
    },
    fast: {
        label: 'Fast',
        description: 'Evaluate every tick, coalesce renders into one frame (~16 ms).',
        min_ticks_per_render: 1,
        min_render_interval_ms: 16,
    },
    balanced: {
        label: 'Balanced',
        description: 'Evaluate every tick, render every 2 ticks and at most every 50 ms.',
        min_ticks_per_render: 2,
        min_render_interval_ms: 50,
    },
    power_saver: {
        label: 'Power saver',
        description: 'Evaluate every tick, render at most every 250 ms. Lowest CPU and GPU use.',
        min_ticks_per_render: 1,
        min_render_interval_ms: 250,
    },
};

export const DEFAULT_SPEED_MODE: TSpeedMode = 'ultra_fast';

export type TAnalysisSymbol = {
    symbol: string;
    display_name: string;
};

/** Volatility indices — the markets Deriv offers digit contracts on. */
export const DIGIT_SYMBOLS: TAnalysisSymbol[] = [
    { symbol: 'R_10', display_name: 'Volatility 10 Index' },
    { symbol: '1HZ10V', display_name: 'Volatility 10 (1s) Index' },
    { symbol: '1HZ15V', display_name: 'Volatility 15 (1s) Index' },
    { symbol: 'R_25', display_name: 'Volatility 25 Index' },
    { symbol: '1HZ25V', display_name: 'Volatility 25 (1s) Index' },
    { symbol: '1HZ30V', display_name: 'Volatility 30 (1s) Index' },
    { symbol: 'R_50', display_name: 'Volatility 50 Index' },
    { symbol: '1HZ50V', display_name: 'Volatility 50 (1s) Index' },
    { symbol: 'R_75', display_name: 'Volatility 75 Index' },
    { symbol: '1HZ75V', display_name: 'Volatility 75 (1s) Index' },
    { symbol: 'R_100', display_name: 'Volatility 100 Index' },
    { symbol: '1HZ100V', display_name: 'Volatility 100 (1s) Index' },
];

export const DEFAULT_ANALYSIS_SYMBOL = 'R_100';
