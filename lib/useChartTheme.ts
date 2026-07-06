import { useEffect, useState } from 'react';

export type ChartTheme = {
    isDark: boolean;
    tick: string;
    categoryTick: string;
    valueLabel: string;
    grid: string;
    tooltip: {
        background: string;
        border: string;
        labelColor: string;
        shadow: string;
    };
    legend: string;
};

const LIGHT: Omit<ChartTheme, 'isDark'> = {
    tick: '#64748b',
    categoryTick: '#1e293b',
    valueLabel: '#475569',
    grid: '#f1f5f9',
    tooltip: {
        background: '#ffffff',
        border: '#e2e8f0',
        labelColor: '#1e293b',
        shadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
    },
    legend: '#64748b',
};

const DARK: Omit<ChartTheme, 'isDark'> = {
    tick: '#94a3b8',
    categoryTick: '#e2e8f0',
    valueLabel: '#cbd5e1',
    grid: 'rgba(148, 163, 184, 0.15)',
    tooltip: {
        background: '#1e293b',
        border: '#334155',
        labelColor: '#f1f5f9',
        shadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
    },
    legend: '#94a3b8',
};

function detectDark(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
}

export function useChartTheme(): ChartTheme {
    const [isDark, setIsDark] = useState(detectDark);

    useEffect(() => {
        const root = document.documentElement;
        const observer = new MutationObserver(() => setIsDark(detectDark()));
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const colors = isDark ? DARK : LIGHT;
    return { isDark, ...colors };
}
