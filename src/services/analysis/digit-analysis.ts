import { OVER_UNDER_PAIRS, ROLLING_WINDOW_SIZE, TOverUnderPair } from '@/constants/analysis';

export type TEvenOddStats = {
    even_count: number;
    odd_count: number;
    even_percentage: number;
    odd_percentage: number;
    /** The side with the higher share of the window, or null when they are level. */
    bias: 'even' | 'odd' | null;
    /** Percentage-point gap between the two sides. */
    bias_edge: number;
};

export type TOverUnderStats = TOverUnderPair & {
    over_count: number;
    under_count: number;
    over_percentage: number;
    under_percentage: number;
    /** The side of this pair with the higher share of the window, or null when level. */
    best_side: 'over' | 'under' | null;
    /** Percentage-point gap between the two sides of this pair. */
    edge: number;
};

export type TDigitStats = {
    digit: number;
    count: number;
    percentage: number;
};

export type TAnalysisSnapshot = {
    /** Ticks currently held in the rolling window (capped at ROLLING_WINDOW_SIZE). */
    sample_size: number;
    /** Total ticks ingested since the window was created, including evicted ones. */
    total_ticks: number;
    last_digit: number | null;
    last_quote: number | null;
    digits: TDigitStats[];
    even_odd: TEvenOddStats;
    over_under: TOverUnderStats[];
    /** Pair with the largest edge across all pairs — the strongest single-market read. */
    best_pair: TOverUnderStats | null;
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const toPercentage = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);

/**
 * Last decimal digit of a quote, respecting the symbol's pip size — `12.3` on a
 * 2-decimal symbol is digit 0, not 3.
 */
export const getLastDigit = (quote: number, pip_size: number): number =>
    Number(Number(quote).toFixed(pip_size).slice(-1));

/**
 * Fixed-capacity ring buffer of last digits with per-digit counters, so every
 * push and every stats read is O(1) regardless of window size.
 */
export class RollingDigitWindow {
    private readonly buffer: Int8Array;
    private readonly counts = new Array<number>(10).fill(0);
    private write_index = 0;
    private filled = 0;
    private ingested = 0;
    private last_digit: number | null = null;
    private last_quote: number | null = null;

    constructor(readonly capacity: number = ROLLING_WINDOW_SIZE) {
        this.buffer = new Int8Array(capacity);
    }

    get size() {
        return this.filled;
    }

    get total_ticks() {
        return this.ingested;
    }

    get is_full() {
        return this.filled === this.capacity;
    }

    push(digit: number, quote: number | null = null) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;

        if (this.filled === this.capacity) {
            this.counts[this.buffer[this.write_index]] -= 1;
        } else {
            this.filled += 1;
        }

        this.buffer[this.write_index] = digit;
        this.counts[digit] += 1;
        this.write_index = (this.write_index + 1) % this.capacity;
        this.ingested += 1;
        this.last_digit = digit;
        this.last_quote = quote;
    }

    /** Seeds the window from a history batch, keeping only the newest `capacity` digits. */
    seed(digits: number[], quotes: number[] = []) {
        this.reset();
        const start = Math.max(0, digits.length - this.capacity);
        for (let i = start; i < digits.length; i++) {
            this.push(digits[i], quotes[i] ?? null);
        }
    }

    reset() {
        this.buffer.fill(0);
        this.counts.fill(0);
        this.write_index = 0;
        this.filled = 0;
        this.ingested = 0;
        this.last_digit = null;
        this.last_quote = null;
    }

    getCount(digit: number) {
        return this.counts[digit] ?? 0;
    }

    snapshot(): TAnalysisSnapshot {
        const total = this.filled;

        const digits = DIGITS.map(digit => ({
            digit,
            count: this.counts[digit],
            percentage: toPercentage(this.counts[digit], total),
        }));

        const over_under = OVER_UNDER_PAIRS.map(pair => this.overUnderStats(pair, total));

        return {
            sample_size: total,
            total_ticks: this.ingested,
            last_digit: this.last_digit,
            last_quote: this.last_quote,
            digits,
            even_odd: this.evenOddStats(total),
            over_under,
            best_pair: pickBestPair(over_under),
        };
    }

    private evenOddStats(total: number): TEvenOddStats {
        let even_count = 0;
        for (const digit of DIGITS) {
            if (digit % 2 === 0) even_count += this.counts[digit];
        }
        const odd_count = total - even_count;
        const even_percentage = toPercentage(even_count, total);
        const odd_percentage = toPercentage(odd_count, total);

        return {
            even_count,
            odd_count,
            even_percentage,
            odd_percentage,
            bias: even_count === odd_count ? null : even_count > odd_count ? 'even' : 'odd',
            bias_edge: Math.abs(even_percentage - odd_percentage),
        };
    }

    private overUnderStats(pair: TOverUnderPair, total: number): TOverUnderStats {
        let over_count = 0;
        let under_count = 0;
        for (const digit of DIGITS) {
            if (digit > pair.over_barrier) over_count += this.counts[digit];
            if (digit < pair.under_barrier) under_count += this.counts[digit];
        }
        const over_percentage = toPercentage(over_count, total);
        const under_percentage = toPercentage(under_count, total);

        return {
            ...pair,
            over_count,
            under_count,
            over_percentage,
            under_percentage,
            best_side: over_count === under_count ? null : over_count > under_count ? 'over' : 'under',
            edge: Math.abs(over_percentage - under_percentage),
        };
    }
}

/** Highest-edge pair; ties resolve to the lower barrier (the wider, safer contract). */
export const pickBestPair = (pairs: TOverUnderStats[]): TOverUnderStats | null =>
    pairs.reduce<TOverUnderStats | null>((best, pair) => (best && best.edge >= pair.edge ? best : pair), null);

export const EMPTY_SNAPSHOT: TAnalysisSnapshot = new RollingDigitWindow().snapshot();
