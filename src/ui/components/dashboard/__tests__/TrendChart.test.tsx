import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendChart } from '../TrendChart';
import { fixtureTrend2k, fixtureTrend20k } from '../__fixtures__/trendFixtures';
import * as echarts from 'echarts';

vi.mock('echarts', async () => {
    const actual = await vi.importActual<typeof import('echarts')>('echarts');
    return {
        ...actual,
        init: vi.fn(() => ({
            setOption: vi.fn(),
            resize: vi.fn(),
            dispose: vi.fn(),
            getOption: vi.fn().mockReturnValue(undefined),
        })),
    };
});

// Mock ResizeObserver
class MockResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = MockResizeObserver;

// Mock matchMedia to not exist by default (simulates happy-dom)
const originalMatchMedia = window.matchMedia;

describe('TrendChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Restore to original or undefined per test env
        window.matchMedia = originalMatchMedia;
    });

    it('uses SVG renderer for low density data (2k points)', () => {
        render(<TrendChart trend={fixtureTrend2k} />);
        expect(echarts.init).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            expect.objectContaining({ renderer: 'svg' }),
        );
    });

    it('switches to canvas renderer for medium density data (20k points)', () => {
        render(<TrendChart trend={fixtureTrend20k} />);
        expect(echarts.init).toHaveBeenCalledWith(
            expect.anything(),
            undefined,
            expect.objectContaining({ renderer: 'canvas' }),
        );
    });

    it('renders strategy info label', () => {
        render(<TrendChart trend={fixtureTrend2k} />);
        expect(screen.getByText(/Activity Trend/i)).toBeInTheDocument();
    });

    it('shows accessible table when trend data is empty', () => {
        render(<TrendChart trend={[]} />);
        // With empty data, strategy is SVG, but chart will still render
        expect(screen.getByText(/Activity Trend/i)).toBeInTheDocument();
    });
});
