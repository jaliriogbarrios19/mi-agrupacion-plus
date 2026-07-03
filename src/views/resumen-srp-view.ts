import { ItemView, WorkspaceLeaf, Setting } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo, Declaracion } from "../types";
import { VIEW_TYPE_RESUMEN_SRP } from "../types";
import { DataManager } from "../data/manager";
import type { ScanResult } from "../data/manager-scan";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import { estimarHogares } from "../utils/hogares";
import { parseDate } from "../utils/date";
import { renderCicloSelector, renderSearchInput, matchesSearch, sortByDateDesc } from "./report-utils";
import {
    cleanupCharts,
    renderAllCharts,
    renderChartToggle,
} from "./chart-utils";
import { computeCycleChartData } from "./chart-data";

export class ResumenSRPView extends ItemView {
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

    getViewType(): string { return VIEW_TYPE_RESUMEN_SRP; }
    getDisplayText(): string { return "Resumen SRP"; }
    getIcon(): string { return "clipboard-list"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        cleanupCharts(contentEl);
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        const backBtn = contentEl.createEl("button", { text: "← Dashboard", cls: "mi-agrupacion-dash-btn" });
        backBtn.addEventListener("click", () => this.goToDashboard());
        new Setting(contentEl).setName("Resumen SRP").setHeading();
        renderCicloSelector(contentEl, this.currentCiclo, (c) => { this.currentCiclo = c; this.expanded = true; void this.render(); });
        this.searchCleanup = renderSearchInput(contentEl, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        const toggleBtn = contentEl.createEl("button", { text: this.expanded ? "Ocultar resumen" : "Mostrar resumen", cls: "mod-cta" });
        toggleBtn.addEventListener("click", () => { this.expanded = !this.expanded; void this.render(); });
        if (!this.expanded) return;
        let scanResult: { visitas: ScanResult<Visita>[]; vidaComunitaria: ScanResult<VidaComunitaria>[]; procesoEducativo: ScanResult<ProcesoEducativo>[]; declaraciones: ScanResult<Declaracion>[] };
        try {
            const raw = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
            scanResult = { visitas: raw.visitas, vidaComunitaria: raw.vidaComunitaria, procesoEducativo: raw.procesoEducativo, declaraciones: raw.declaraciones };
        } catch (err) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", err);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        let { visitas, vidaComunitaria, procesoEducativo, declaraciones } = scanResult;
        if (this.searchQuery) {
            const q = this.searchQuery;
            visitas = visitas.filter(rec => matchesSearch(rec, q));
            vidaComunitaria = vidaComunitaria.filter(rec => matchesSearch(rec, q));
            procesoEducativo = procesoEducativo.filter(rec => matchesSearch(rec, q));
            declaraciones = declaraciones.filter(rec => matchesSearch(rec, q));
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        this.renderVisitas(contentEl, visitas);
        this.renderVC(contentEl, vidaComunitaria);
        this.renderIngresos(contentEl, declaraciones);

        renderChartToggle(contentEl, "gráficos", this.chartExpanded, () => { this.chartExpanded = !this.chartExpanded; void this.render(); });
        if (!this.chartExpanded) return;

        const metas = this.settings.metasCiclo[this.currentCiclo.ciclo];
        const chartSection = contentEl.createDiv({ cls: "mi-agrupacion-chart-section" });
        const chartData = computeCycleChartData(visitas, vidaComunitaria, procesoEducativo, metas);
        renderAllCharts(chartSection, chartData, contentEl);
    }

    private renderVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
        const section = container.createDiv({ cls: "mi-agrupacion-section" });
        new Setting(section).setName("Visitas").setHeading();
        const total = visitas.length;
        const per = new Set(visitas.flatMap(v => v.data.nombres_visitados)).size;
        const hog = total > 0 ? estimarHogares(visitas) : 0;
        const simp = visitas.filter(v => v.data.condicion === "Simpatizante").length;
        const nuevos = visitas.filter(v => v.data.hogar_nuevo === true).length;
        const dev = visitas.filter(v => v.data.hubo_oracion === true).length;
        const camp = visitas.filter(v => v.data.campana_expansion === true).length;
        const mSet = new Set(visitas.flatMap(v => v.data.maestros));
        for (const l of [
            `Total de visitas: ${total}`, `Personas visitadas: ${per}`,
            `~Hogares visitados: ${hog}`, `Visitas a simpatizantes: ${simp}`,
            `Hogares nuevos: ${nuevos}`, `RD durante las visitas: ${dev}`,
            `Maestros visitantes: ${mSet.size}`, `Visitas en campaña: ${camp}`,
        ]) section.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    private renderVC(container: HTMLElement, vida: ScanResult<VidaComunitaria>[]): void {
        const section = container.createDiv({ cls: "mi-agrupacion-section" });
        new Setting(section).setName("Vida Comunitaria").setHeading();
        const f19 = vida.filter(v => v.data.tipo_actividad === "Fiesta de 19 días");
        const ds = vida.filter(v => v.data.tipo_actividad === "Día Sagrado");
        const ot = vida.filter(v => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
        const af = f19.reduce((acc, v) => acc + (v.data.numero_participantes || 0), 0);
        const ad = ds.reduce((acc, v) => acc + (v.data.numero_participantes || 0), 0);
        const uf19 = new Set(f19.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        const uds = new Set(ds.flatMap(v => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        for (const l of [
            `Fiestas de 19 días: ${f19.length} (Asistencia: ${af})`,
            `  Participantes únicos: ${uf19.size}`,
            `Días Sagrados: ${ds.length} (Asistencia: ${ad})`,
            `  Participantes únicos: ${uds.size}`,
            `Otras actividades: ${ot.length}`,
        ]) section.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { cleanupCharts(this.contentEl); this.contentEl.empty(); }

    private renderIngresos(container: HTMLElement, declaraciones: ScanResult<Declaracion>[]): void {
        if (declaraciones.length === 0) return;
        const section = container.createDiv({ cls: "mi-agrupacion-section" });
        new Setting(section).setName("Ingresos").setHeading();
        const sorted = [...declaraciones].sort((a, b) =>
            parseDate(b.data.fecha_declaracion || "").getTime() - parseDate(a.data.fecha_declaracion || "").getTime());
        for (const entry of sorted) {
            section.createEl("p", {
                text: `${entry.data.nombre} ${entry.data.apellido} — ${entry.data.fecha_declaracion || "—"}`,
                cls: "mi-agrupacion-stat",
            });
        }
    }
}
