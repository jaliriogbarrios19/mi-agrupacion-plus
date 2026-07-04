import { ItemView, WorkspaceLeaf, TFile, Setting } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo, Reunion, Declaracion } from "../types";
import { VIEW_TYPE_GENERAL } from "../types";
import { DataManager } from "../data/manager";
import type { ScanResult } from "../data/manager-scan";
import { RecordListModal } from "../modals/record-list-modal";
import { PersonListModal } from "../modals/person-list-modal";
import { ExportModal } from "../modals/export-modal";
import { VisitaModal } from "../modals/visita-modal";
import { VidaComunitariaModal } from "../modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "../modals/proceso-educativo-modal";
import { ReunionModal } from "../modals/reunion-modal";
import { DeclaracionModal } from "../modals/declaracion-modal";
import { estimarHogares } from "../utils/hogares";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import {
    renderCicloSelector, renderSectorSelector, renderSearchInput,
    matchesSearch, sortByDateDesc, kpi,
} from "./report-utils";
import {
    cleanupCharts,
    renderAllCharts,
    renderChartToggle,
} from "./chart-utils";
import { computeCycleChartData } from "./chart-data";

export class GeneralView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private goToDashboard: () => void;
    private currentCiclo: CicloInfo;
    private selectedSector = "Todos los sectores";
    private searchQuery = "";
    private searchCleanup: (() => void) | null = null;
    private chartExpanded = false;

    constructor(leaf: WorkspaceLeaf, settings: MiAgrupacionSettings, dataManager: DataManager, goToDashboard: () => void) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.goToDashboard = goToDashboard;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_GENERAL; }
    getDisplayText(): string { return "General"; }
    getIcon(): string { return "bar-chart-2"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        if (this.searchCleanup) { this.searchCleanup(); this.searchCleanup = null; }
        const { contentEl } = this;
        cleanupCharts(contentEl);
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");
        const backBtn = contentEl.createEl("button", { text: "← Dashboard", cls: "mi-agrupacion-dash-btn" });
        backBtn.addEventListener("click", () => this.goToDashboard());
        new Setting(contentEl).setName("Vista General").setHeading();
        const exportBtn = contentEl.createEl("button", { text: "📤 Exportar", cls: "mi-agrupacion-dash-btn" });
        exportBtn.addEventListener("click", () => {
            new ExportModal(this.app, this.dataManager, this.currentCiclo, this.selectedSector).open();
        });
        const sel = contentEl.createDiv({ cls: "mi-agrupacion-selectors" });
        renderCicloSelector(sel, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });
        renderSectorSelector(sel, this.dataManager.getSectores(), this.selectedSector,
            (s) => { this.selectedSector = s; void this.render(); });
        this.searchCleanup = renderSearchInput(sel, this.searchQuery, (q) => { this.searchQuery = q; void this.render(); });
        let data: { visitas: ScanResult<Visita>[]; vidaComunitaria: ScanResult<VidaComunitaria>[]; procesoEducativo: ScanResult<ProcesoEducativo>[]; reuniones: ScanResult<Reunion>[]; declaraciones: ScanResult<Declaracion>[] };
        try {
            data = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
        } catch (e) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", e);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        const { visitas: v, vidaComunitaria: vc, procesoEducativo: pe, reuniones: r, declaraciones: d } = data;
        let visitas = v, vidaComunitaria = vc, procesoEducativo = pe, reuniones = r, declaraciones = d;
        if (this.selectedSector !== "Todos los sectores") {
            visitas = visitas.filter((rec: ScanResult<Visita>) => rec.data.sector === this.selectedSector);
            vidaComunitaria = vidaComunitaria.filter((rec: ScanResult<VidaComunitaria>) => rec.data.sector === this.selectedSector);
            procesoEducativo = procesoEducativo.filter((rec: ScanResult<ProcesoEducativo>) => rec.data.sector === this.selectedSector);
            reuniones = reuniones.filter((rec: ScanResult<Reunion>) => rec.data.sector === this.selectedSector);
        }
        if (this.searchQuery) {
            const q = this.searchQuery;
            visitas = visitas.filter((rec: ScanResult<Visita>) => matchesSearch(rec, q));
            vidaComunitaria = vidaComunitaria.filter((rec: ScanResult<VidaComunitaria>) => matchesSearch(rec, q));
            procesoEducativo = procesoEducativo.filter((rec: ScanResult<ProcesoEducativo>) => matchesSearch(rec, q));
            reuniones = reuniones.filter((rec: ScanResult<Reunion>) => matchesSearch(rec, q));
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        procesoEducativo = sortByDateDesc(procesoEducativo);
        reuniones = sortByDateDesc(reuniones);
        const tc = (d: ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>[]) =>
            d.map((r: ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>) => ({ file: r.file, data: r.data as unknown as Record<string, unknown> }));
        const totalV = visitas.length;
        const personas = new Set(visitas.flatMap((r: ScanResult<Visita>) => r.data.nombres_visitados)).size;
        const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
        const mSet = new Set(visitas.flatMap((r: ScanResult<Visita>) => r.data.maestros));
        const fiestas = vidaComunitaria.filter((r: ScanResult<VidaComunitaria>) => r.data.tipo_actividad === "Fiesta de 19 días");
        const sagrados = vidaComunitaria.filter((r: ScanResult<VidaComunitaria>) => r.data.tipo_actividad === "Día Sagrado");
        const otras = vidaComunitaria.filter((r: ScanResult<VidaComunitaria>) => r.data.tipo_actividad !== "Fiesta de 19 días" && r.data.tipo_actividad !== "Día Sagrado");
        const participantesUnicos = new Set(fiestas.flatMap((v: ScanResult<VidaComunitaria>) => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });
        const onDeleted = () => { void this.render(); };
        kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(this.app, "Visitas", tc(visitas), (f) => this.openEditModal(f, "visita"), this.dataManager, onDeleted).open());
        kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(this.app, "Personas", tc(visitas), (f) => this.openEditModal(f, "visita"), this.dataManager, onDeleted).open());
        kpi(grid, "~Hogares visitados", String(hogares));
        kpi(grid, "Maestros participantes", String(mSet.size), () => new PersonListModal(this.app, "Maestros participantes", [...mSet].sort()).open());
        kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(this.app, "Fiestas", tc(fiestas), (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());
        kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(this.app, "Días Sagrados", tc(sagrados), (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());
        kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(this.app, "Otras", tc(otras), (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());
        kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () => new PersonListModal(this.app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());
        const peCount = procesoEducativo.length;
        kpi(grid, "Programa Educativo", String(peCount), () => new RecordListModal(this.app, "Programa Educativo", tc(procesoEducativo), (f) => this.openEditModal(f, "pe"), this.dataManager, onDeleted).open());
        const asistentesReuniones = new Set(reuniones.flatMap((r: ScanResult<Reunion>) => r.data.asist_bahais));
        kpi(grid, "Reuniones", String(reuniones.length), () => new RecordListModal(this.app, "Reuniones", tc(reuniones), (f) => this.openEditModal(f, "reunion"), this.dataManager, onDeleted).open());
        kpi(grid, "Asistentes a reuniones", String(asistentesReuniones.size), () => new PersonListModal(this.app, "Asistentes a reuniones", [...asistentesReuniones].sort()).open());
        kpi(grid, "Ingresos", String(declaraciones.length), () =>             new RecordListModal(this.app, "Ingresos", declaraciones.map((r: ScanResult<Declaracion>) => ({ file: r.file, data: r.data as unknown as Record<string, unknown> })), (f) => this.openEditModal(f, "declaracion"), this.dataManager, onDeleted).open());

        renderChartToggle(contentEl, "gráficos", this.chartExpanded, () => { this.chartExpanded = !this.chartExpanded; void this.render(); });
        if (!this.chartExpanded) return;

        const metas = this.settings.metasCiclo[this.currentCiclo.ciclo];
        const section = contentEl.createDiv({ cls: "mi-agrupacion-chart-section" });

        const chartData = computeCycleChartData(visitas, vidaComunitaria, procesoEducativo, metas);
        renderAllCharts(section, chartData, contentEl);
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { cleanupCharts(this.contentEl); this.contentEl.empty(); }

    private openEditModal(file: TFile, kind: "visita" | "vc" | "pe" | "reunion" | "declaracion"): void {
        const onSaved = () => { void this.render(); };
        if (kind === "visita") new VisitaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "vc") new VidaComunitariaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "pe") new ProcesoEducativoModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "reunion") new ReunionModal(this.app, this.dataManager, onSaved, file).open();
        else new DeclaracionModal(this.app, this.dataManager, onSaved, file).open();
    }
}
