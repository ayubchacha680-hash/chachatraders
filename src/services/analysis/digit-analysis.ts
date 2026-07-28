import { OVER_UNDER_PAIRS, ROLLING_WINDOW_SIZE, TOverUnderPair } from '@/constants/analysis';

export type TEvenOddStats = {
    even_count: number;
    odd_count: number;
    even_percentage: number;
    odd_percentage: number;
    bias: 'even' | 'odd' | null;
    bias_edge: number;
};

export type TOverUnderStats = TOverUnderPair & {
    over_count: number;
    under_count: number;
    over_percentage: number;
    under_percentage: number;
    best_side: 'over' | 'under' | null;
    edge: number;
};

export type TDigitStats = {
    digit: number;
    count: number;
    percentage: number;
};

/** Rise/Fall stats computed from actual tick-by-tick price direction across
 *  three rolling windows (short=20, mid=100, long=capacity). */
export type TRiseFallStats = {
    // Long window (full capacity, e.g. 1000)
    rise_count: number;
    fall_count: number;
    flat_count: number;
    rise_percentage: number;
    fall_percentage: number;
    bias: 'rise' | 'fall' | null;
    bias_edge: number;

    // Short window (last 20 movements)
    short_rise_pct: number;
    short_fall_pct: number;
    short_bias: 'rise' | 'fall' | null;
    short_edge: number;
    short_filled: number;

    // Mid window (last 100 movements)
    mid_rise_pct: number;
    mid_fall_pct: number;
    mid_bias: 'rise' | 'fall' | null;
    mid_edge: number;
    mid_filled: number;

    // Momentum streak: positive = consecutive rises, negative = consecutive falls
    streak: number;

    // Derived composite signal
    confluence: number;          // 0-3: how many windows agree on overall bias direction
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    signal: string;              // human-readable: "Strong Rise", "Moderate Fall", "Neutral"
};

export type TAnalysisSnapshot = {
    sample_size: number;
    total_ticks: number;
    last_digit: number | null;
    last_quote: number | null;
    digits: TDigitStats[];
    even_odd: TEvenOddStats;
    over_under: TOverUnderStats[];
    best_pair: TOverUnderStats | null;
    rise_fall: TRiseFallStats;
};

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const SHORT_RF_SIZE = 20;
const MID_RF_SIZE   = 100;

export const toPercentage = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);

export const getLastDigit = (quote: number, pip_size: number): number =>
    Number(Number(quote).toFixed(pip_size).slice(-1));

export class RollingDigitWindow {
    private readonly buffer: Int8Array;
    private readonly counts = new Array<number>(10).fill(0);
    private write_index = 0;
    private filled = 0;
    private ingested = 0;
    private last_digit: number | null = null;
    private last_quote: number | null = null;

    /* Long RF: ring buffer of movements (+1=rise, -1=fall, 0=flat) */
    private readonly rf_buffer: Int8Array;
    private rf_write = 0;
    private rf_filled = 0;
    private rf_rise = 0;
    private rf_fall = 0;
    private rf_flat = 0;
    private prev_quote: number | null = null;

    /* Short RF window (last 20 movements) */
    private readonly rf_short_buf: Int8Array;
    private rf_short_w = 0;
    private rf_short_filled = 0;
    private rf_short_rise = 0;
    private rf_short_fall = 0;

    /* Mid RF window (last 100 movements) */
    private readonly rf_mid_buf: Int8Array;
    private rf_mid_w = 0;
    private rf_mid_filled = 0;
    private rf_mid_rise = 0;
    private rf_mid_fall = 0;

    /* Streak: + = consecutive rises, - = consecutive falls */
    private streak = 0;
    private last_rf_mv: -1 | 0 | 1 | null = null;

    constructor(readonly capacity: number = ROLLING_WINDOW_SIZE) {
        this.buffer       = new Int8Array(capacity);
        this.rf_buffer    = new Int8Array(capacity);
        this.rf_short_buf = new Int8Array(SHORT_RF_SIZE);
        this.rf_mid_buf   = new Int8Array(MID_RF_SIZE);
    }

    get size()        { return this.filled; }
    get total_ticks() { return this.ingested; }
    get is_full()     { return this.filled === this.capacity; }

    push(digit: number, quote: number | null = null) {
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;

        // ── digit window ──────────────────────────────────────────────────
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

        // ── rise/fall tracking ────────────────────────────────────────────
        if (quote !== null && this.prev_quote !== null) {
            const mv: -1 | 0 | 1 = quote > this.prev_quote ? 1 : quote < this.prev_quote ? -1 : 0;

            // Long window
            if (this.rf_filled === this.capacity) {
                const evicted = this.rf_buffer[this.rf_write];
                if (evicted === 1)       this.rf_rise -= 1;
                else if (evicted === -1) this.rf_fall -= 1;
                else                     this.rf_flat -= 1;
            } else {
                this.rf_filled += 1;
            }
            this.rf_buffer[this.rf_write] = mv;
            if (mv === 1)       this.rf_rise += 1;
            else if (mv === -1) this.rf_fall += 1;
            else                this.rf_flat += 1;
            this.rf_write = (this.rf_write + 1) % this.capacity;

            // Short window (20)
            if (this.rf_short_filled === SHORT_RF_SIZE) {
                const ev = this.rf_short_buf[this.rf_short_w];
                if (ev === 1)       this.rf_short_rise--;
                else if (ev === -1) this.rf_short_fall--;
            } else {
                this.rf_short_filled++;
            }
            this.rf_short_buf[this.rf_short_w] = mv;
            if (mv === 1)       this.rf_short_rise++;
            else if (mv === -1) this.rf_short_fall++;
            this.rf_short_w = (this.rf_short_w + 1) % SHORT_RF_SIZE;

            // Mid window (100)
            if (this.rf_mid_filled === MID_RF_SIZE) {
                const ev = this.rf_mid_buf[this.rf_mid_w];
                if (ev === 1)       this.rf_mid_rise--;
                else if (ev === -1) this.rf_mid_fall--;
            } else {
                this.rf_mid_filled++;
            }
            this.rf_mid_buf[this.rf_mid_w] = mv;
            if (mv === 1)       this.rf_mid_rise++;
            else if (mv === -1) this.rf_mid_fall++;
            this.rf_mid_w = (this.rf_mid_w + 1) % MID_RF_SIZE;

            // Streak
            if (mv !== 0) {
                if (this.last_rf_mv !== null && this.last_rf_mv === mv) {
                    this.streak += mv;
                } else {
                    this.streak = mv;
                }
                this.last_rf_mv = mv;
            }
        }
        if (quote !== null) this.prev_quote = quote;
    }

    seed(digits: number[], quotes: number[] = []) {
        this.reset();
        const start = Math.max(0, digits.length - this.capacity);
        for (let i = start; i < digits.length; i++) {
            this.push(digits[i], quotes[i] ?? null);
        }
    }

    reset() {
        this.buffer.fill(0);
        this.rf_buffer.fill(0);
        this.rf_short_buf.fill(0);
        this.rf_mid_buf.fill(0);
        this.counts.fill(0);
        this.write_index   = 0;
        this.filled        = 0;
        this.ingested      = 0;
        this.last_digit    = null;
        this.last_quote    = null;
        this.rf_write      = 0;
        this.rf_filled     = 0;
        this.rf_rise       = 0;
        this.rf_fall       = 0;
        this.rf_flat       = 0;
        this.rf_short_w    = 0;
        this.rf_short_filled = 0;
        this.rf_short_rise = 0;
        this.rf_short_fall = 0;
        this.rf_mid_w      = 0;
        this.rf_mid_filled = 0;
        this.rf_mid_rise   = 0;
        this.rf_mid_fall   = 0;
        this.prev_quote    = null;
        this.streak        = 0;
        this.last_rf_mv    = null;
    }

    getCount(digit: number) { return this.counts[digit] ?? 0; }

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
            rise_fall: this.riseFallStats(),
        };
    }

    private riseFallStats(): TRiseFallStats {
        // Long window
        const long_total  = this.rf_rise + this.rf_fall + this.rf_flat;
        const rise_pct    = toPercentage(this.rf_rise, long_total);
        const fall_pct    = toPercentage(this.rf_fall, long_total);
        const long_bias: 'rise' | 'fall' | null =
            this.rf_rise === this.rf_fall ? null : this.rf_rise > this.rf_fall ? 'rise' : 'fall';
        const bias_edge   = Math.abs(rise_pct - fall_pct);

        // Short window (20)
        const short_mv    = this.rf_short_rise + this.rf_short_fall;
        const s_r_pct     = toPercentage(this.rf_short_rise, short_mv || 1);
        const s_f_pct     = toPercentage(this.rf_short_fall, short_mv || 1);
        const short_bias: 'rise' | 'fall' | null =
            this.rf_short_rise === this.rf_short_fall || this.rf_short_filled < 5 ? null
            : this.rf_short_rise > this.rf_short_fall ? 'rise' : 'fall';
        const short_edge  = Math.abs(s_r_pct - s_f_pct);

        // Mid window (100)
        const mid_mv      = this.rf_mid_rise + this.rf_mid_fall;
        const m_r_pct     = toPercentage(this.rf_mid_rise, mid_mv || 1);
        const m_f_pct     = toPercentage(this.rf_mid_fall, mid_mv || 1);
        const mid_bias: 'rise' | 'fall' | null =
            this.rf_mid_rise === this.rf_mid_fall || this.rf_mid_filled < 20 ? null
            : this.rf_mid_rise > this.rf_mid_fall ? 'rise' : 'fall';
        const mid_edge    = Math.abs(m_r_pct - m_f_pct);

        // Confluence: count windows that agree with long_bias
        const windows = [short_bias, mid_bias, long_bias];
        const confluence = long_bias === null ? 0
            : windows.filter(b => b === long_bias).length;

        // Strength
        let strength: 'strong' | 'moderate' | 'weak' | 'none';
        if (long_bias === null || (bias_edge < 1 && confluence === 0)) {
            strength = 'none';
        } else if (confluence >= 3 && bias_edge >= 3) {
            strength = 'strong';
        } else if (confluence >= 2 && bias_edge >= 1) {
            strength = 'moderate';
        } else {
            strength = 'weak';
        }

        const dir = long_bias === 'rise' ? 'Rise' : long_bias === 'fall' ? 'Fall' : '';
        const signal =
            long_bias === null ? 'Neutral'
            : strength === 'strong'   ? `Strong ${dir}`
            : strength === 'moderate' ? `Moderate ${dir}`
            : `Weak ${dir}`;

        return {
            rise_count: this.rf_rise,
            fall_count: this.rf_fall,
            flat_count: this.rf_flat,
            rise_percentage: rise_pct,
            fall_percentage: fall_pct,
            bias: long_bias,
            bias_edge,
            short_rise_pct: s_r_pct,
            short_fall_pct: s_f_pct,
            short_bias,
            short_edge,
            short_filled: this.rf_short_filled,
            mid_rise_pct: m_r_pct,
            mid_fall_pct: m_f_pct,
            mid_bias,
            mid_edge,
            mid_filled: this.rf_mid_filled,
            streak: this.streak,
            confluence,
            strength,
            signal,
        };
    }

    private evenOddStats(total: number): TEvenOddStats {
        let even_count = 0;
        for (const digit of DIGITS) {
            if (digit % 2 === 0) even_count += this.counts[digit];
        }
        const odd_count       = total - even_count;
        const even_percentage = toPercentage(even_count, total);
        const odd_percentage  = toPercentage(odd_count, total);
        return {
            even_count, odd_count, even_percentage, odd_percentage,
            bias: even_count === odd_count ? null : even_count > odd_count ? 'even' : 'odd',
            bias_edge: Math.abs(even_percentage - odd_percentage),
        };
    }

    private overUnderStats(pair: TOverUnderPair, total: number): TOverUnderStats {
        let over_count = 0;
        let under_count = 0;
        for (const digit of DIGITS) {
            if (digit > pair.over_barrier)  over_count  += this.counts[digit];
            if (digit < pair.under_barrier) under_count += this.counts[digit];
        }
        const over_percentage  = toPercentage(over_count, total);
        const under_percentage = toPercentage(under_count, total);
        return {
            ...pair, over_count, under_count, over_percentage, under_percentage,
            best_side: over_count === under_count ? null : over_count > under_count ? 'over' : 'under',
            edge: Math.abs(over_percentage - under_percentage),
        };
    }
}

export const pickBestPair = (pairs: TOverUnderStats[]): TOverUnderStats | null =>
    pairs.reduce<TOverUnderStats | null>((best, pair) => (best && best.edge >= pair.edge ? best : pair), null);

export const EMPTY_SNAPSHOT: TAnalysisSnapshot = new RollingDigitWindow().snapshot();
