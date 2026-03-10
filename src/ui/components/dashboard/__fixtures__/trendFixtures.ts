import type { TrendPoint } from '../../../../core/types';

/**
 * Helper to generate a specified number of trend data points.
 */
function generateTrendData(
    pointsCount: number,
    _seriesCount: number,
    baseDate: Date = new Date('2026-03-01T00:00:00Z'),
): TrendPoint[] {
    const data: TrendPoint[] = [];
    let currentDateMs = baseDate.getTime();

    for (let i = 0; i < pointsCount; i++) {
        data.push({
            date: new Date(currentDateMs).toISOString(),
            aiPercentage: Math.random() * 100,
            commitCount: Math.floor(Math.random() * 20),
            granularity: 'day',
        });
        // Advance by 1 minute per data point for simplicity
        currentDateMs += 60 * 1000;
    }
    return data;
}

// Canonical fixture: 2k points, 1 series variant (approx using simple category split as proxy)
export const fixtureTrend2k = generateTrendData(2000, 1);

// Canonical fixture: 20k points
export const fixtureTrend20k = generateTrendData(20000, 4);

// Canonical fixture: 100k points
export const fixtureTrend100k = generateTrendData(100000, 12);
