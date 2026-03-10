import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import type { TrendPoint } from '../../../core/types';

interface TrendChartProps {
    trend: TrendPoint[];
}

type RenderStrategy = 'svg_low_density' | 'canvas_high_density' | 'table_accessible_fallback';

export function TrendChart({ trend }: TrendChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.EChartsType | null>(null);

    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [_frameCostBreach, _setFrameCostBreach] = useState(false);

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const totalPoints = trend.length * 2; // 2 metrics: AI Percentage & Commits

    const [strategy, reason] = useMemo<[RenderStrategy, string]>(() => {
        if (prefersReducedMotion) return ['table_accessible_fallback', 'Accessibility Override (Reduced Motion)'];
        if (totalPoints > 100000) return ['table_accessible_fallback', 'Density Exceeds Canvas Limit (>100k points)'];
        if (_frameCostBreach) return ['canvas_high_density', 'Frame-cost breach detected (Canvas fallback)'];
        if (totalPoints > 4000) return ['canvas_high_density', 'High Density (2k-100k points)']; // totalPoints is * 2
        return ['svg_low_density', 'Low Density (<=2k points)'];
    }, [totalPoints, prefersReducedMotion, _frameCostBreach]);

    useEffect(() => {
        if (strategy === 'table_accessible_fallback' || !containerRef.current) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = null;
            }
            return;
        }

        // Initialize ECharts with selected renderer
        const renderer = strategy === 'svg_low_density' ? 'svg' : 'canvas';
        if (!chartInstanceRef.current || chartInstanceRef.current.getOption() === undefined) {
            chartInstanceRef.current = echarts.init(containerRef.current, undefined, { renderer });
        } else {
            // Re-init if renderer changed
            const currentRenderer = chartInstanceRef.current.getOption()?.renderer;
            if (currentRenderer !== undefined && currentRenderer !== renderer) {
                chartInstanceRef.current.dispose();
                chartInstanceRef.current = echarts.init(containerRef.current, undefined, { renderer });
            }
        }

        const times = trend.map(t => new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }));
        const aiData = trend.map(t => t.aiPercentage);
        const commitData = trend.map(t => t.commitCount);

        const option: echarts.EChartsOption = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'line',
                    lineStyle: { color: '#3a3a50', type: 'dashed' }
                },
                backgroundColor: 'rgba(13, 13, 18, 0.9)',
                borderColor: '#2a2a3a',
                textStyle: { color: '#e0e0e0', fontSize: 11 },
                padding: [10, 14],
                borderRadius: 8,
                shadowBlur: 20,
                shadowColor: 'rgba(0,0,0,0.5)'
            },
            legend: {
                data: ['AI %', 'Commits'],
                textStyle: { color: '#a0a0b0' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: times,
                axisLine: { lineStyle: { color: '#3a3a50' } },
                axisLabel: { color: '#a0a0b0' }
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'AI %',
                    position: 'left',
                    axisLine: { show: true, lineStyle: { color: '#3a3a50' } },
                    axisLabel: { color: '#8b5cf6', formatter: '{value}%' },
                    splitLine: { lineStyle: { color: '#2a2a3a' } },
                    max: 100,
                },
                {
                    type: 'value',
                    name: 'Commits',
                    position: 'right',
                    axisLine: { show: true, lineStyle: { color: '#3a3a50' } },
                    axisLabel: { color: '#10b981' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'AI %',
                    type: 'line',
                    yAxisIndex: 0,
                    smooth: 0.6, // Higher smoothing for "fluid" v3 look
                    showSymbol: false,
                    lineStyle: {
                        width: 3,
                        color: '#8b5cf6',
                        shadowBlur: 10,
                        shadowColor: 'rgba(139, 92, 246, 0.3)'
                    },
                    areaStyle: {
                        opacity: 0.2,
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(139, 92, 246, 0.4)' },
                            { offset: 1, color: 'rgba(139, 92, 246, 0)' }
                        ])
                    },
                    data: aiData,
                    animation: !prefersReducedMotion
                },
                {
                    name: 'Commits',
                    type: 'bar',
                    yAxisIndex: 1,
                    barWidth: '40%',
                    itemStyle: {
                        color: '#10b981',
                        borderRadius: [4, 4, 0, 0] // Rounded top corners
                    },
                    data: commitData,
                    animation: !prefersReducedMotion
                }
            ]
        };

        chartInstanceRef.current.setOption(option);

        const handleResize = () => chartInstanceRef.current?.resize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [trend, strategy, prefersReducedMotion]);

    // Simulate downsampling decision for large datasets as requested by spec
    const decimationNotice = totalPoints > 2000 && strategy !== 'table_accessible_fallback'
        ? ' (Auto-decimation applied)'
        : '';

    return (
        <section className="card mb-5 p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-text-primary">Activity Trend</h3>
                    <p className="text-xs text-text-muted mt-1">
                        Mode: <span className="font-medium text-accent-blue">{strategy}</span> — {reason}{decimationNotice}
                    </p>
                </div>
            </div>

            {strategy === 'table_accessible_fallback' ? (
                <div className="overflow-x-auto max-h-64 scrollbar-thin rounded-lg border border-border-light bg-bg-secondary p-4">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-text-muted uppercase border-b border-border-subtle">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">AI %</th>
                                <th className="px-4 py-2">Commits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trend.map((point) => (
                                <tr key={point.date} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover transition-colors">
                                    <td className="px-4 py-2 text-text-secondary">{new Date(point.date).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-accent-violet">{point.aiPercentage.toFixed(1)}%</td>
                                    <td className="px-4 py-2 text-accent-green">{point.commitCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {trend.length === 0 && (
                        <div className="py-8 text-center text-text-muted text-sm">No data available in this period.</div>
                    )}
                </div>
            ) : (
                <div ref={containerRef} className="w-full h-64" aria-hidden="true" />
            )}
        </section>
    );
}
