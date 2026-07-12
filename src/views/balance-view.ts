import { ItemView, WorkspaceLeaf, Setting, TFile } from "obsidian";
import type { MiAgrupacionSettings, Visita, VidaComunitaria, ProcesoEducativo, Reunion, Declaracion } from "../types";
import { VIEW_TYPE_BALANCE } from "../types";
import { DataManager } from "../data/manager";
import type { ScanResult } from "../data/manager-scan";
import { detectarCiclo, type CicloInfo } from "../utils/ciclo";
import { parseDate, formatDate, getWeekStart, getWeekEnd, getWeekId, getMonthLabel } from "../utils/date";
import { estimarHogares } from "../utils/hogares";
import { kpi, renderCicloSelector } from "./report-utils";
import { RecordListModal } from "../modals/record-list-modal";

type PeriodMode = "semanal" | "quincenal" | "mensual" | "personalizado";

interface PeriodData {
    label: string;
    startDate: Date;
    endDate: Date;
    visitas: ScanResult<Visita>[];
}

export class BalanceView extends ItemView {
    private settings: MiAgrupacionSettings;
    private dataManager: DataManager;
    private goToDashboard: () => void;
    private currentCiclo: CicloInfo;
    private periodMode: PeriodMode = "semanal";
    private desdeStr = "";
    private hastaStr = "";

    constructor(leaf: WorkspaceLeaf, settings: MiAgrupacionSettings, dataManager: DataManager, goToDashboard: () => void) {
        super(leaf);
        this.settings = settings;
        this.dataManager = dataManager;
        this.goToDashboard = goToDashboard;
        this.currentCiclo = detectarCiclo(new Date());
    }

    getViewType(): string { return VIEW_TYPE_BALANCE; }
    getDisplayText(): string { return "Balance por período"; }
    getIcon(): string { return "pie-chart"; }

    async onOpen(): Promise<void> { await this.render(); }

    async render(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-view");

        const backBtn = contentEl.createEl("button", { text: "← Dashboard", cls: "mi-agrupacion-dash-btn" });
        backBtn.addEventListener("click", () => this.goToDashboard());
        new Setting(contentEl).setName("Balance por período").setHeading();

        const sel = contentEl.createDiv({ cls: "mi-agrupacion-selectors" });
        renderCicloSelector(sel, this.currentCiclo, (c) => { this.currentCiclo = c; void this.render(); });

        sel.createSpan({ text: "Agrupar: " });
        const periodSelect = sel.createEl("select");
        const modes: { value: PeriodMode; label: string }[] = [
            { value: "semanal", label: "Semanal" },
            { value: "quincenal", label: "Quincenal" },
            { value: "mensual", label: "Mensual" },
            { value: "personalizado", label: "Personalizado" },
        ];
        for (const m of modes) {
            const opt = periodSelect.createEl("option", { text: m.label });
            opt.value = m.value;
            if (m.value === this.periodMode) opt.selected = true;
        }
        periodSelect.addEventListener("change", () => {
            this.periodMode = periodSelect.value as PeriodMode;
            void this.render();
        });

        let data: { visitas: ScanResult<Visita>[]; vidaComunitaria: ScanResult<VidaComunitaria>[]; procesoEducativo: ScanResult<ProcesoEducativo>[]; reuniones: ScanResult<Reunion>[]; declaraciones: ScanResult<Declaracion>[] };
        try {
            data = await this.dataManager.scanAllRecordsInCycle(this.currentCiclo.anioEtiqueta, this.currentCiclo.ciclo);
        } catch (e) {
            console.error("Mi Agrupacion — scanAllRecordsInCycle:", e);
            contentEl.createEl("p", { text: "Error al cargar datos.", cls: "mi-agrupacion-stat" }); return;
        }
        const visitas = data.visitas;

        let periods: PeriodData[];
        if (this.periodMode === "personalizado") {
            periods = this.buildCustomPeriods(sel, visitas);
        } else {
            periods = this.buildGroupedPeriods(visitas);
        }

        if (periods.length === 0) {
            contentEl.createEl("p", { text: "No hay visitas en el período seleccionado.", cls: "mi-agrupacion-stat" });
            return;
        }

        let totalVisitas = 0;
        let totalPersonas = 0;
        let totalHogares = 0;
        const allMaestros = new Set<string>();

        for (const p of periods) {
            const countV = p.visitas.length;
            const flatNames: string[] = [];
            for (const r of p.visitas) {
                for (const n of r.data.nombres_visitados) { flatNames.push(n); }
            }
            const countP = new Set(flatNames).size;
            const countH = countV > 0 ? estimarHogares(p.visitas) : 0;
            const mFlat: string[] = [];
            for (const r of p.visitas) {
                for (const m of r.data.maestros) { mFlat.push(m); }
            }
            for (const m of mFlat) { allMaestros.add(m); }

            totalVisitas += countV;
            totalPersonas += countP;
            totalHogares += countH;

            const section = contentEl.createDiv({ cls: "mi-agrupacion-section" });
            const periodLabel = this.periodMode === "semanal"
                ? `Semana del ${formatDate(p.startDate)} al ${formatDate(p.endDate)}`
                : p.label;
            new Setting(section).setName(periodLabel).setHeading();

            const grid = section.createDiv({ cls: "mi-agrupacion-kpi-grid" });
            kpi(grid, "Visitas", String(countV));
            kpi(grid, "Personas", String(countP));
            kpi(grid, "~Hogares", String(countH));
            kpi(grid, "Maestros", String(new Set(mFlat).size));

            const visitasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
            for (const r of p.visitas) { visitasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
            const listBtn = section.createEl("button", { text: "Ver registros →", cls: "mi-agrupacion-dash-btn" });
            listBtn.addEventListener("click", () => {
                new RecordListModal(this.app, periodLabel, visitasEntries, undefined, undefined, undefined).open();
            });
        }

        const totalDiv = contentEl.createDiv({ cls: "mi-agrupacion-section" });
        new Setting(totalDiv).setName("Totales").setHeading();
        const totalGrid = totalDiv.createDiv({ cls: "mi-agrupacion-kpi-grid" });
        kpi(totalGrid, "Visitas", String(totalVisitas));
        kpi(totalGrid, "~Hogares", String(totalHogares));
        kpi(totalGrid, "Maestros únicos", String(allMaestros.size));
    }

    private buildGroupedPeriods(visitas: ScanResult<Visita>[]): PeriodData[] {
        const groups = new Map<string, ScanResult<Visita>[]>();
        const dateMap = new Map<string, { start: Date; end: Date; label: string }>();

        for (const v of visitas) {
            const fecha = parseDate(String(v.data.fecha || ""));
            if (isNaN(fecha.getTime())) continue;

            let key: string;
            let start: Date;
            let end: Date;
            let label: string;

            if (this.periodMode === "semanal") {
                const wk = getWeekId(fecha);
                key = wk;
                start = getWeekStart(fecha);
                end = getWeekEnd(fecha);
                label = `Semana del ${formatDate(start)} al ${formatDate(end)}`;
            } else if (this.periodMode === "quincenal") {
                const m = fecha.getMonth();
                const p = fecha.getDate() <= 15 ? "1" : "2";
                key = `${fecha.getFullYear()}-${m}-${p}`;
                if (p === "1") {
                    start = new Date(fecha.getFullYear(), m, 1);
                    end = new Date(fecha.getFullYear(), m, 15);
                } else {
                    start = new Date(fecha.getFullYear(), m, 16);
                    end = new Date(fecha.getFullYear(), m + 1, 0);
                }
                const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                label = p === "1"
                    ? `1-15 de ${months[m]} ${fecha.getFullYear()}`
                    : `16-${end.getDate()} de ${months[m]} ${fecha.getFullYear()}`;
            } else {
                key = `${fecha.getFullYear()}-${fecha.getMonth()}`;
                start = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
                end = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
                label = getMonthLabel(fecha);
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(v);
            dateMap.set(key, { start, end, label });
        }

        const sortedKeys = Array.from(groups.keys()).sort().reverse();
        const result: PeriodData[] = [];
        for (const key of sortedKeys) {
            const dm = dateMap.get(key)!;
            result.push({
                label: dm.label,
                startDate: dm.start,
                endDate: dm.end,
                visitas: groups.get(key)!,
            });
        }
        return result;
    }

    private buildCustomPeriods(selContainer: HTMLElement, visitas: ScanResult<Visita>[]): PeriodData[] {
        selContainer.createSpan({ text: "  Desde: " });
        const desdeInput = selContainer.createEl("input", {
            type: "text", placeholder: "DD/MM/AAAA",
            value: this.desdeStr,
        });
        desdeInput.addClass("mi-agrupacion-input-sm");
        desdeInput.addEventListener("change", () => { this.desdeStr = desdeInput.value; void this.render(); });

        selContainer.createSpan({ text: " Hasta: " });
        const hastaInput = selContainer.createEl("input", {
            type: "text", placeholder: "DD/MM/AAAA",
            value: this.hastaStr,
        });
        hastaInput.addClass("mi-agrupacion-input-sm");
        hastaInput.addEventListener("change", () => { this.hastaStr = hastaInput.value; void this.render(); });

        if (!this.desdeStr || !this.hastaStr) return [];

        const desde = parseDate(this.desdeStr);
        const hasta = parseDate(this.hastaStr);
        if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
            selContainer.createEl("span", { text: " (fecha inválida)", cls: "mi-agrupacion-stat" });
            return [];
        }

        const filtered: ScanResult<Visita>[] = [];
        for (const v of visitas) {
            const f = parseDate(String(v.data.fecha || ""));
            if (isNaN(f.getTime())) continue;
            if (f >= desde && f <= hasta) filtered.push(v);
        }

        // Single period = the custom range
        return [{
            label: `Del ${formatDate(desde)} al ${formatDate(hasta)}`,
            startDate: desde,
            endDate: hasta,
            visitas: filtered,
        }];
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { this.contentEl.empty(); }
}