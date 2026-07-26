import { getLastDigit, pickBestPair, RollingDigitWindow, TOverUnderStats } from '../digit-analysis';

const pushAll = (window: RollingDigitWindow, digits: number[]) => digits.forEach(digit => window.push(digit));

describe('getLastDigit', () => {
    it('respects the pip size when the quote has fewer decimals than the symbol', () => {
        expect(getLastDigit(12.3, 2)).toBe(0);
        expect(getLastDigit(12.34, 2)).toBe(4);
        expect(getLastDigit(540, 2)).toBe(0);
        expect(getLastDigit(1234.5678, 4)).toBe(8);
        expect(getLastDigit(7, 0)).toBe(7);
    });
});

describe('RollingDigitWindow', () => {
    it('evicts the oldest digit once the capacity is reached', () => {
        const window = new RollingDigitWindow(3);
        pushAll(window, [1, 1, 1, 2]);

        expect(window.size).toBe(3);
        expect(window.total_ticks).toBe(4);
        expect(window.getCount(1)).toBe(2);
        expect(window.getCount(2)).toBe(1);
    });

    it('seeds from history keeping only the newest capacity digits', () => {
        const window = new RollingDigitWindow(3);
        window.seed([9, 9, 9, 1, 2, 3], [1, 2, 3, 4, 5, 6]);

        const snapshot = window.snapshot();
        expect(snapshot.sample_size).toBe(3);
        expect(window.is_full).toBe(true);
        expect(window.getCount(9)).toBe(0);
        expect(snapshot.last_digit).toBe(3);
        expect(snapshot.last_quote).toBe(6);
    });

    it('reports the full window on the first snapshot after seeding — no growing phase', () => {
        const window = new RollingDigitWindow(1000);
        window.seed(Array.from({ length: 1500 }, (_, index) => index % 10));

        expect(window.snapshot().sample_size).toBe(1000);
    });

    it('ignores values that are not single digits', () => {
        const window = new RollingDigitWindow(5);
        pushAll(window, [10, -1, 4.5, NaN, 7]);

        expect(window.size).toBe(1);
        expect(window.getCount(7)).toBe(1);
    });

    it('computes even/odd percentages and the bias side', () => {
        const window = new RollingDigitWindow(4);
        pushAll(window, [2, 4, 6, 3]);

        const { even_odd } = window.snapshot();
        expect(even_odd).toMatchObject({
            even_count: 3,
            odd_count: 1,
            even_percentage: 75,
            odd_percentage: 25,
            bias: 'even',
            bias_edge: 50,
        });
    });

    it('reports no bias when the two sides are level', () => {
        const window = new RollingDigitWindow(2);
        pushAll(window, [1, 2]);

        expect(window.snapshot().even_odd.bias).toBeNull();
    });

    it('counts each over/under pair with strict barriers', () => {
        const window = new RollingDigitWindow(10);
        pushAll(window, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        const { over_under } = window.snapshot();
        const by_barrier = Object.fromEntries(over_under.map(pair => [pair.over_barrier, pair]));

        // Over 1 wins on 2-9, Under 8 wins on 0-7 — both 80% of a uniform window.
        expect(by_barrier[1]).toMatchObject({ over_count: 8, under_count: 8, best_side: null, edge: 0 });
        expect(by_barrier[2]).toMatchObject({ over_count: 7, under_count: 7 });
        expect(by_barrier[3]).toMatchObject({ over_count: 6, under_count: 6 });
        expect(by_barrier[4]).toMatchObject({ over_count: 5, under_count: 5, over_percentage: 50 });
    });

    it('picks the side of each pair with the higher share', () => {
        const window = new RollingDigitWindow(4);
        pushAll(window, [8, 9, 9, 0]);

        const { over_under, best_pair } = window.snapshot();
        expect(over_under.every(pair => pair.best_side === 'over')).toBe(true);
        // Every pair splits 75/25 here, so the tie resolves to the lowest barrier.
        expect(best_pair?.over_barrier).toBe(1);
        expect(best_pair?.edge).toBe(50);
    });

    it('resets to an empty window', () => {
        const window = new RollingDigitWindow(3);
        pushAll(window, [1, 2, 3]);
        window.reset();

        const snapshot = window.snapshot();
        expect(snapshot.sample_size).toBe(0);
        expect(snapshot.total_ticks).toBe(0);
        expect(snapshot.last_digit).toBeNull();
        expect(snapshot.even_odd.even_percentage).toBe(0);
    });
});

describe('pickBestPair', () => {
    const pair = (over_barrier: number, edge: number) => ({ over_barrier, edge }) as TOverUnderStats;

    it('returns the highest-edge pair', () => {
        expect(pickBestPair([pair(1, 2), pair(2, 9), pair(3, 4)])?.over_barrier).toBe(2);
    });

    it('breaks ties towards the lower barrier', () => {
        expect(pickBestPair([pair(1, 5), pair(2, 5)])?.over_barrier).toBe(1);
    });

    it('returns null for an empty list', () => {
        expect(pickBestPair([])).toBeNull();
    });
});
