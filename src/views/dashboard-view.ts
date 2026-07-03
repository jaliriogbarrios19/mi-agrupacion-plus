import { ItemView, WorkspaceLeaf, TFile, Notice, normalizePath, Platform, Setting } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo, Reunion, Declaracion } from "../types";
import { VIEW_TYPE_DASHBOARD, VIEW_TYPE_GENERAL, VIEW_TYPE_RESUMEN_SRP, VIEW_TYPE_CAMPANA } from "../types";
import { DataManager, type ScanResult } from "../data/manager";
import { ExportModal } from "../modals/export-modal";
import { generateInforme } from "../utils/informe";
import { VisitaModal } from "../modals/visita-modal";
import { VidaComunitariaModal } from "../modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "../modals/proceso-educativo-modal";
import { ReunionModal } from "../modals/reunion-modal";
import { DeclaracionModal } from "../modals/declaracion-modal";
import { parseDate } from "../utils/date";
import { type CicloInfo, detectarCiclo } from "../utils/ciclo";
import { withContextMenu } from "./report-utils";
import {
    cleanupCharts,
    renderAllCharts,
    renderChartToggle,
} from "./chart-utils";
import { computeCycleChartData } from "./chart-data";

export class DashboardView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private openVisita: () => void;
    private openVidaComunitaria: () => void;
    private openProcesoEducativo: () => void;
    private openMaestro: () => void;
    private openReunion: () => void;
    private openStandalone: (type: string) => void;
    private currentCiclo: CicloInfo;
    private chartExpanded = false;

    constructor(
        leaf: WorkspaceLeaf,
        settings: MiAgrupacionSettings,
        dataManager: DataManager,
        callbacks: {
            openVisita: () => void;
            openVidaComunitaria: () => void;
            openProcesoEducativo: () => void;
            openMaestro: () => void;
            openReunion: () => void;
            openStandalone: (type: string) => void;
        },
    ) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.openVisita = callbacks.openVisita;
        this.openVidaComunitaria = callbacks.openVidaComunitaria;
        this.openProcesoEducativo = callbacks.openProcesoEducativo;
        this.openMaestro = callbacks.openMaestro;
        this.openReunion = callbacks.openReunion;
        this.openStandalone = callbacks.openStandalone;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_DASHBOARD; }
    getDisplayText(): string { return this.settings.nombreAgrupacion; }
    getIcon(): string { return "home"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        const { contentEl } = this;
        cleanupCharts(contentEl);
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-dashboard");
        this.renderHome(contentEl);
    }

    private renderHome(container: HTMLElement): void {
        const header = container.createDiv({ cls: "mi-agrupacion-dash-header" });
        new Setting(header).setName(this.settings.nombreAgrupacion).setHeading();
        const actions = container.createDiv({ cls: "mi-agrupacion-dash-actions" });
        this.actionBtn(actions, "Nueva Visita", () => this.openVisita());
        this.actionBtn(actions, "Nueva Actividad", () => this.openVidaComunitaria());
        this.actionBtn(actions, "Nuevo Proceso Educativo", () => this.openProcesoEducativo());
        this.actionBtn(actions, "Nuevo Maestro", () => this.openMaestro());
        this.actionBtn(actions, "📋 Nueva Reunión", () => this.openReunion());
        this.actionBtn(actions, "Registrar ingreso", () => this.openDeclaracion());
        new Setting(container).setName("Reportes").setHeading();
        const reportes = container.createDiv({ cls: "mi-agrupacion-dash-actions" });
        this.reportBtn(reportes, "Vista General", VIEW_TYPE_GENERAL);
        this.reportBtn(reportes, "Resumen SRP", VIEW_TYPE_RESUMEN_SRP);
        this.reportBtn(reportes, "Campaña de Enseñanza", VIEW_TYPE_CAMPANA);
        const exportBtn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        exportBtn.createSpan({ text: "Exportar" });
        exportBtn.addEventListener("click", () => {
            new ExportModal(this.app, this.dataManager, this.currentCiclo, "Todos los sectores").open();
        });
        const informeBtn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        informeBtn.createSpan({ text: "📄 Informe" });
        informeBtn.addEventListener("click", () => { void this.generarInforme(); });

        void this.renderIngresosHome(container);

        renderChartToggle(container, "gráficos", this.chartExpanded, () => { this.chartExpanded = !this.chartExpanded; void this.render(); });
        if (this.chartExpanded) {
            void this.renderChartsHome(container);
        }
    }

    private reportBtn(container: HTMLElement, text: string, viewType: string): void {
        const btn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        btn.createSpan({ text });
        btn.addEventListener("click", () => { void this.openStandalone(viewType); });
        withContextMenu(btn, () => this.openStandalone(viewType));
    }

    private actionBtn(container: HTMLElement, text: string, onClick: () => void): void {
        const btn = container.createEl("button", { cls: "mi-agrupacion-dash-btn" });
        btn.createSpan({ text });
        btn.addEventListener("click", onClick);
    }

    private async renderChartsHome(container: HTMLElement): Promise<void> {
        try {
            const data = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
            const { visitas, vidaComunitaria, procesoEducativo } = data;
            const metas = this.settings.metasCiclo[this.currentCiclo.ciclo];
            const section = container.createDiv({ cls: "mi-agrupacion-chart-section" });

            const chartData = computeCycleChartData(visitas, vidaComunitaria, procesoEducativo, metas);
            renderAllCharts(section, chartData, container);
        } catch {
            container.createEl("p", { text: "Error al cargar datos para gráficos.", cls: "mi-agrupacion-stat" });
        }
    }

    private openDeclaracion(): void {
        new DeclaracionModal(this.app, this.dataManager, () => { void this.render(); }).open();
    }

    private async renderIngresosHome(container: HTMLElement): Promise<void> {
        try {
            const { declaraciones } = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
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
        } catch {
            // skip on load error
        }
    }

    private async generarInforme(): Promise<void> {
        try {
            const { visitas, vidaComunitaria, procesoEducativo } = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
            const cicloLabel = `${this.currentCiclo.ciclo} · ${this.currentCiclo.anioEtiqueta}`;
            const markdown = generateInforme(this.settings, cicloLabel, visitas, vidaComunitaria, procesoEducativo);

            const folderPath = normalizePath(`${this.settings.carpetaBase}/Informes`);
            const filename = `Informe-${this.currentCiclo.ciclo}-${this.currentCiclo.anioEtiqueta.replace("/", "-")}.md`;
            const filePath = normalizePath(`${folderPath}/${filename}`);

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing instanceof TFile) {
                await this.app.vault.modify(existing, markdown);
            } else {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (!folder) await this.app.vault.createFolder(folderPath);
                await this.app.vault.create(filePath, markdown);
            }
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
            }
            new Notice(Platform.isMobile ? "Informe generado. ... → Export to PDF" : "Informe generado. Ctrl+P → Export to PDF");
        } catch (e) {
            console.error("Mi Agrupacion — generarInforme:", e);
            new Notice("Error al guardar el informe");
        }
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { cleanupCharts(this.contentEl); this.contentEl.empty(); }
}
