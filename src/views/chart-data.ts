import type { ScanResult } from "../data/manager-scan";
import type {
    Visita,
    VidaComunitaria,
    ProcesoEducativo,
    CicloMetas,
} from "../types";
import { estimarHogares } from "../utils/hogares";
import { parseDate } from "../utils/date";

const MONTHS = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export interface BarGroup {
    title: string;
    bars: { label: string; actual: number; goal: number }[];
}

export interface DoughnutData {
    title: string;
    labels: string[];
    data: number[];
}

export interface TrendData {
    title: string;
    labels: string[];
    series: { label: string; data: number[] }[];
}

export interface AllChartData {
    barGroups: BarGroup[];
    doughnuts: DoughnutData[];
    trends: TrendData[];
}

function buildCampanaBars(
    visitas: ScanResult<Visita>[],
    metas?: CicloMetas,
): BarGroup {
    const enCamp = visitas.filter((v: ScanResult<Visita>) => v.data.campana_expansion === true);
    const maestros = new Set(visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros));
    const hog = visitas.length > 0 ? estimarHogares(visitas) : 0;

    return {
        title: "Campaña de Expansión",
        bars: [
            { label: "Maestros participantes", actual: maestros.size, goal: metas?.campana?.maestrosParticipantes ?? 0 },
            { label: "Número de visitas", actual: visitas.length, goal: metas?.campana?.numeroVisitas ?? 0 },
            { label: "Número de hogares", actual: hog, goal: metas?.campana?.numeroHogares ?? 0 },
            { label: "Bahá'ís", actual: visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Bahá'í").length, goal: metas?.campana?.bahais ?? 0 },
            { label: "Hogares nuevos", actual: enCamp.filter((v: ScanResult<Visita>) => v.data.hogar_nuevo === true).length, goal: metas?.campana?.hogaresNuevos ?? 0 },
            { label: "Simpatizantes", actual: visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Simpatizante").length, goal: metas?.campana?.simpatizantes ?? 0 },
        ],
    };
}

function groupByMonth(
    records: { fecha?: string }[],
    title: string,
    seriesLabel: string,
): TrendData | null {
    const monthMap = new Map<number, number>();
    for (const record of records) {
        if (!record.fecha) continue;
        try {
            const date = parseDate(record.fecha);
            if (!isNaN(date.getTime())) {
                const monthIdx = date.getMonth();
                monthMap.set(monthIdx, (monthMap.get(monthIdx) || 0) + 1);
            }
        } catch {
            console.warn("chart-data: skipping record with invalid date", record.fecha);
        }
    }
    if (monthMap.size === 0) return null;
    const sortedMonths = [...monthMap.entries()].sort((a, b) => a[0] - b[0]);
    return {
        title,
        labels: sortedMonths.map(([m]) => MONTHS[m]),
        series: [{ label: seriesLabel, data: sortedMonths.map(([, count]) => count) }],
    };
}

export function computeCycleChartData(
    visitas: ScanResult<Visita>[],
    vidaComunitaria: ScanResult<VidaComunitaria>[],
    procesoEducativo: ScanResult<ProcesoEducativo>[],
    metas?: CicloMetas,
): AllChartData {
    const barGroups: BarGroup[] = [];
    const doughnuts: DoughnutData[] = [];
    const trends: TrendData[] = [];

    // --- Bar groups ---

    const hasCampanaData = visitas.some((v: ScanResult<Visita>) => v.data.campana_expansion === true);
    if (hasCampanaData || visitas.length > 0) {
        barGroups.push(buildCampanaBars(visitas, metas));
    }

    const hasPEData = procesoEducativo.length > 0;
    if (hasPEData) {
        const clases = procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Clase de Niños");
        barGroups.push({
            title: "Proceso Educativo",
            bars: [
                { label: "Clases de niños", actual: clases.length, goal: metas?.procesoEducativo?.clasesNinos ?? 0 },
                { label: "GPJ", actual: procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "GPJ").length, goal: metas?.procesoEducativo?.gpj ?? 0 },
                { label: "Círculos de estudio", actual: procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Círculo de Estudio").length, goal: metas?.procesoEducativo?.circulosEstudio ?? 0 },
            ],
        });
    }

    const ds = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Día Sagrado");
    if (ds.length > 0) {
        const dsAsist = ds.reduce((acc: number, v: ScanResult<VidaComunitaria>) => acc + (v.data.numero_participantes || 0), 0);
        const dsUnicos = new Set(ds.flatMap((v: ScanResult<VidaComunitaria>) => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        barGroups.push({
            title: "Días Sagrados",
            bars: [
                { label: "Participación total (DS)", actual: dsAsist, goal: metas?.diasSagrados?.participacionTotal ?? 0 },
                { label: "Participantes únicos (DS)", actual: dsUnicos.size, goal: metas?.diasSagrados?.participantesUnicos ?? 0 },
                { label: "Cantidad de DS", actual: ds.length, goal: metas?.diasSagrados?.cantidadActividades ?? 0 },
            ],
        });
    }

    const f19 = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Fiesta de 19 días");
    if (f19.length > 0) {
        const fAsist = f19.reduce((acc: number, v: ScanResult<VidaComunitaria>) => acc + (v.data.numero_participantes || 0), 0);
        const uf19 = new Set(f19.flatMap((v: ScanResult<VidaComunitaria>) => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        barGroups.push({
            title: "Fiesta de 19 Días",
            bars: [
                { label: "Participación total (F19)", actual: fAsist, goal: metas?.fiesta19Dias?.participacionTotal ?? 0 },
                { label: "Participantes únicos (F19)", actual: uf19.size, goal: metas?.fiesta19Dias?.participantesUnicos ?? 0 },
                { label: "Cantidad de F19", actual: f19.length, goal: metas?.fiesta19Dias?.cantidadActividades ?? 0 },
            ],
        });
    }

    // --- Doughnut: Distribución de condición de visitas ---
    const condCount = new Map<string, number>();
    for (const v of visitas) {
        const c = v.data.condicion || "Sin especificar";
        condCount.set(c, (condCount.get(c) || 0) + 1);
    }
    if (condCount.size > 0) {
        doughnuts.push({
            title: "Visitas por condición",
            labels: [...condCount.keys()],
            data: [...condCount.values()],
        });
    }

    // --- Doughnut: Distribución de tipos de actividad comunitaria ---
    const tipoCount = new Map<string, number>();
    for (const v of vidaComunitaria) {
        const t = v.data.tipo_actividad || "Sin especificar";
        tipoCount.set(t, (tipoCount.get(t) || 0) + 1);
    }
    if (tipoCount.size > 0) {
        doughnuts.push({
            title: "Actividades por tipo",
            labels: [...tipoCount.keys()],
            data: [...tipoCount.values()],
        });
    }

    // --- Trend: Visitas por mes ---
    const visitasTrend = groupByMonth(
        visitas.map(v => v.data),
        "Visitas por mes",
        "Visitas",
    );
    if (visitasTrend) trends.push(visitasTrend);

    // --- Trend: F19 por mes ---
    const f19Trend = groupByMonth(
        f19.map(v => v.data),
        "Fiestas de 19 Días por mes",
        "F19",
    );
    if (f19Trend) trends.push(f19Trend);

    return { barGroups, doughnuts, trends };
}

export function computeCampanaChartData(
    visitas: ScanResult<Visita>[],
    metas?: CicloMetas,
): BarGroup {
    return buildCampanaBars(visitas, metas);
}
