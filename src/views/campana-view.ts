import { ItemView, WorkspaceLeaf, Setting } from "obsidian";
import type { MiAgrupacionSettings, Visita } from "../types";
import { VIEW_TYPE_CAMPANA } from "../types";
import { DataManager } from "../data/manager";
import type { ScanResult } from "../data/manager-scan";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";
import {
    renderCicloSelector, renderSearchInput, matchesSearch, sortByDateDesc
} from "./report-utils";
import {
    cleanupCharts, renderBarChart, renderChartToggle,
} from "./chart-utils";
import { computeCampanaChartData } from "./chart-data";

export class CampanaView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private goToDashboard: () => void;
    private currentCiclo: CicloInfo;
    private expanded = false;
    private chartExpanded = false;
    private searchQuery = "";
    private searchCleanup: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, settings: MiAgrupacionSettings, dataManager: DataManager, goToDashboard: () => void) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.goToDashboard = goToDashboard;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_CAMPANA; }
    getDisplayText(): string { return "Campaña"; }
    getIcon(): string { return "target"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        cleanupCharts(contentEl);
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        const backBtn = contentEl.createEl("button", { text: "← Dashboard", cls: "mi-agrupacion-dash-btn" });
        backBtn.addEventListener("click", () => this.goToDashboard());
        new Setting(contentEl).setName("Campaña de Enseñanza").setHeading();
        renderCicloSelector(contentEl, this.currentCiclo, (c) => { this.currentCiclo = c; this.expanded = true; void this.render(); });
        this.searchCleanup = renderSearchInput(contentEl, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const toggleBtn = contentEl.createEl("button", { text: this.expanded ? "Ocultar" : "Mostrar indicadores", cls: "mod-cta" });
        toggleBtn.addEventListener("click", () => { this.expanded = !this.expanded; void this.render(); });
        if (!this.expanded) return;
        let s: { visitas: ScanResult<Visita>[] };
        try {
            s = { visitas: (await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo)).visitas };
        } catch (e) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", e);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        let { visitas } = s;
        if (this.searchQuery) visitas = visitas.filter(v => matchesSearch(v, this.searchQuery));
        visitas = sortByDateDesc(visitas);
        const enCamp = visitas.filter((v: ScanResult<Visita>) => v.data.campana_expansion === true);
        const visitadosFlat: string[] = enCamp.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados);
        const alcanzadas = new Set(visitadosFlat).size;
        const nuevos = enCamp.filter((v: ScanResult<Visita>) => v.data.hogar_nuevo === true).length;
        const bahais = visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Bahá'í").length;
        const simp = visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Simpatizante").length;
        const mFlat: string[] = visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros);
        const mSet = new Set(mFlat);
        const totalV = visitas.length;
        const hog = totalV > 0 ? estimarHogares(visitas) : 0;
        const g = contentEl.createDiv({ cls: "mi-agrupacion-section" });
        if (enCamp.length > 0) {
            g.createEl("p", { text: `Personas alcanzadas: ${alcanzadas}`, cls: "mi-agrupacion-stat" });
        }
        for (const l of [
            `Maestros únicos: ${mSet.size}`,
            `Hogares nuevos: ${nuevos}`, `Bahá'ís: ${bahais}`,
            `Simpatizantes: ${simp}`, `Total de visitas: ${totalV}`,
            `~Hogares visitados: ${hog}`,
        ]) g.createEl("p", { text: l, cls: "mi-agrupacion-stat" });

        renderChartToggle(contentEl, "gráficos", this.chartExpanded, () => { this.chartExpanded = !this.chartExpanded; void this.render(); });
        if (!this.chartExpanded) return;

        const metas = this.settings.metasCiclo[this.currentCiclo.ciclo];
        const chartSection = contentEl.createDiv({ cls: "mi-agrupacion-chart-section" });
        const group = computeCampanaChartData(visitas, metas);
        renderBarChart(chartSection, group.bars, group.title, contentEl);
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { cleanupCharts(this.contentEl); this.contentEl.empty(); }
}
