import {
    Chart,
    BarController,
    DoughnutController,
    LineController,
    CategoryScale,
    LinearScale,
    ArcElement,
    BarElement,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import type { AllChartData } from "./chart-data";

Chart.register(
    BarController,
    DoughnutController,
    LineController,
    CategoryScale,
    LinearScale,
    ArcElement,
    BarElement,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
);

export interface MetaBar {
    label: string;
    actual: number;
    goal: number;
}

export interface TrendSeries {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
}

const chartCleanups = new WeakMap<HTMLElement, Map<string, () => void>>();

function getThemeColors(): Record<string, string> {
    const s = getComputedStyle(activeDocument.body);
    return {
        accent: s.getPropertyValue("--text-accent").trim() || "#6c8ccf",
        muted: s.getPropertyValue("--text-muted").trim() || "#87939d",
        normal: s.getPropertyValue("--text-normal").trim() || "#e0e0e0",
        faint: s.getPropertyValue("--text-faint").trim() || "#7f8c8d",
        cardBg: s.getPropertyValue("--background-primary-alt").trim() || "#1e2530",
        grid: s.getPropertyValue("--background-modifier-border").trim() || "#3e4a5a",
        success: s.getPropertyValue("--text-success").trim() || "#2ecc71",
    };
}

function defaultColors(count: number): string[] {
    const palette = [
        "#6c8ccf", "#e74c3c", "#2ecc71", "#f39c12",
        "#9b59b6", "#1abc9c", "#e67e22", "#3498db",
        "#2c3e50", "#d35400",
    ];
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

function destroyExistingChart(container: HTMLElement, id: string): void {
    const map = chartCleanups.get(container);
    if (map?.has(id)) {
        map.get(id)!();
        map.delete(id);
    }
}

function registerCleanup(container: HTMLElement, id: string, cleanup: () => void): void {
    let map = chartCleanups.get(container);
    if (!map) {
        map = new Map();
        chartCleanups.set(container, map);
    }
    destroyExistingChart(container, id);
    map.set(id, cleanup);
}

export function cleanupCharts(container: HTMLElement): void {
    const map = chartCleanups.get(container);
    if (map) {
        for (const cleanup of map.values()) cleanup();
        map.clear();
    }
}

function makeCanvas(container: HTMLElement, id: string, height = 200): HTMLCanvasElement {
    const wrapper = container.createDiv({ cls: "mi-agrupacion-chart-wrapper" });
    const canvas = wrapper.createEl("canvas");
    canvas.id = id;
    canvas.height = height;
    return canvas;
}

export function renderChartToggle(
    container: HTMLElement,
    label: string,
    expanded: boolean,
    onToggle: () => void,
): HTMLButtonElement {
    const btn = container.createEl("button", {
        text: expanded ? `Ocultar ${label}` : `Ver ${label}`,
        cls: "mod-cta",
    });
    btn.addEventListener("click", () => { onToggle(); });
    return btn;
}

export function renderBarChart(
    container: HTMLElement,
    bars: MetaBar[],
    title?: string,
    rootEl?: HTMLElement,
): () => void {
    const id = `chart-bar-${Math.random().toString(36).slice(2, 8)}`;
    const colors = getThemeColors();
    const goalColor = colors.accent;
    const actualColor = colors.success;

    const labels = bars.map(b => b.label);
    const actualData = bars.map(b => b.actual);
    const goalData = bars.map(b => b.goal);

    const canvas = makeCanvas(container, id, Math.max(150, bars.length * 40));

    if (title) {
        canvas.parentElement!.createEl("div", {
            text: title,
            cls: "mi-agrupacion-chart-title",
        });
    }

    const chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Actual",
                    data: actualData,
                    backgroundColor: actualColor,
                    borderRadius: 3,
                },
                {
                    label: "Meta",
                    data: goalData,
                    backgroundColor: goalColor,
                    borderRadius: 3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: colors.normal },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.parsed.y;
                            const lbl = ctx.dataset.label || "";
                            if (ctx.datasetIndex === 0 && ctx.dataIndex !== undefined && bars[ctx.dataIndex]?.goal > 0) {
                                const pct = Math.round((bars[ctx.dataIndex].actual / bars[ctx.dataIndex].goal) * 100);
                                return `${lbl}: ${v} (${pct}%)`;
                            }
                            return `${lbl}: ${v}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: colors.muted },
                    grid: { color: colors.grid },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: colors.muted },
                    grid: { color: colors.grid },
                },
            },
        },
    });

    const cleanup = () => { chart.destroy(); };
    registerCleanup(rootEl ?? container, id, cleanup);
    return cleanup;
}

export function renderDoughnutChart(
    container: HTMLElement,
    labels: string[],
    data: number[],
    title?: string,
    rootEl?: HTMLElement,
): () => void {
    const id = `chart-doughnut-${Math.random().toString(36).slice(2, 8)}`;
    const colors = getThemeColors();
    const backgroundColors = defaultColors(labels.length);

    const canvas = makeCanvas(container, id, 220);

    if (title) {
        canvas.parentElement!.createEl("div", {
            text: title,
            cls: "mi-agrupacion-chart-title",
        });
    }

    const chart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: colors.cardBg,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: colors.normal },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const v = ctx.parsed;
                            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                            return `${ctx.label}: ${v} (${pct}%)`;
                        },
                    },
                },
            },
        },
    });

    const cleanup = () => { chart.destroy(); };
    registerCleanup(rootEl ?? container, id, cleanup);
    return cleanup;
}

export function renderTrendChart(
    container: HTMLElement,
    labels: string[],
    series: TrendSeries[],
    title?: string,
    rootEl?: HTMLElement,
): () => void {
    const id = `chart-trend-${Math.random().toString(36).slice(2, 8)}`;
    const colors = getThemeColors();
    const palette = defaultColors(series.length);

    const canvas = makeCanvas(container, id, 220);

    if (title) {
        canvas.parentElement!.createEl("div", {
            text: title,
            cls: "mi-agrupacion-chart-title",
        });
    }

    const datasets = series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: s.borderColor || palette[i],
        backgroundColor: s.backgroundColor || (palette[i] + "33"),
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
    }));

    const chart = new Chart(canvas, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: colors.normal },
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                },
            },
            scales: {
                x: {
                    ticks: { color: colors.muted },
                    grid: { color: colors.grid },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: colors.muted },
                    grid: { color: colors.grid },
                },
            },
            interaction: {
                mode: "index",
                intersect: false,
            },
        },
    });

    const cleanup = () => { chart.destroy(); };
    registerCleanup(rootEl ?? container, id, cleanup);
    return cleanup;
}

export function renderAllCharts(
    container: HTMLElement,
    chartData: AllChartData,
    rootEl?: HTMLElement,
): void {
    for (const group of chartData.barGroups) {
        renderBarChart(container, group.bars, group.title, rootEl);
    }
    for (const doughnut of chartData.doughnuts) {
        renderDoughnutChart(container, doughnut.labels, doughnut.data, doughnut.title, rootEl);
    }
    for (const trend of chartData.trends) {
        renderTrendChart(container, trend.labels, trend.series, trend.title, rootEl);
    }
}
