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
            const filteredVisitas: ScanResult<Visita>[] = [];
            for (const rec of visitas) { if (rec.data.sector === this.selectedSector) filteredVisitas.push(rec); }
            visitas = filteredVisitas;
            const filteredVc: ScanResult<VidaComunitaria>[] = [];
            for (const rec of vidaComunitaria) { if (rec.data.sector === this.selectedSector) filteredVc.push(rec); }
            vidaComunitaria = filteredVc;
            const filteredPe: ScanResult<ProcesoEducativo>[] = [];
            for (const rec of procesoEducativo) { if (rec.data.sector === this.selectedSector) filteredPe.push(rec); }
            procesoEducativo = filteredPe;
            const filteredR: ScanResult<Reunion>[] = [];
            for (const rec of reuniones) { if (rec.data.sector === this.selectedSector) filteredR.push(rec); }
            reuniones = filteredR;
        }
        if (this.searchQuery) {
            const q = this.searchQuery;
            const sv: ScanResult<Visita>[] = [];
            for (const rec of visitas) { if (matchesSearch(rec, q)) sv.push(rec); }
            visitas = sv;
            const svc: ScanResult<VidaComunitaria>[] = [];
            for (const rec of vidaComunitaria) { if (matchesSearch(rec, q)) svc.push(rec); }
            vidaComunitaria = svc;
            const spe: ScanResult<ProcesoEducativo>[] = [];
            for (const rec of procesoEducativo) { if (matchesSearch(rec, q)) spe.push(rec); }
            procesoEducativo = spe;
            const sr: ScanResult<Reunion>[] = [];
            for (const rec of reuniones) { if (matchesSearch(rec, q)) sr.push(rec); }
            reuniones = sr;
        }
        visitas = sortByDateDesc(visitas);
        vidaComunitaria = sortByDateDesc(vidaComunitaria);
        procesoEducativo = sortByDateDesc(procesoEducativo);
        reuniones = sortByDateDesc(reuniones);
        const totalV = visitas.length;
        const visitadosFlat: string[] = [];
        for (const r of visitas) {
            for (const n of r.data.nombres_visitados) { visitadosFlat.push(n); }
        }
        const personas = new Set(visitadosFlat).size;
        const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
        const mFlat: string[] = [];
        for (const r of visitas) {
            for (const m of r.data.maestros) { mFlat.push(m); }
        }
        const mSet = new Set(mFlat);
        const fiestas: ScanResult<VidaComunitaria>[] = [];
        for (const r of vidaComunitaria) {
            if (r.data.tipo_actividad === "Fiesta de 19 días") fiestas.push(r);
        }
        const sagrados: ScanResult<VidaComunitaria>[] = [];
        for (const r of vidaComunitaria) {
            if (r.data.tipo_actividad === "Día Sagrado") sagrados.push(r);
        }
        const otras: ScanResult<VidaComunitaria>[] = [];
        for (const r of vidaComunitaria) {
            if (r.data.tipo_actividad !== "Fiesta de 19 días" && r.data.tipo_actividad !== "Día Sagrado") otras.push(r);
        }
        const f19PartFlat: string[] = [];
        for (const v of fiestas) {
            const asist_bahais = v.data.asist_bahais || [];
            const asist_simpatizantes = v.data.asist_simpatizantes || [];
            for (const p of asist_bahais) { f19PartFlat.push(p); }
            for (const p of asist_simpatizantes) { f19PartFlat.push(p); }
        }
        const participantesUnicos = new Set(f19PartFlat);
        const grid = contentEl.createDiv({ cls: "mi-agrupacion-kpi-grid" });
        const onDeleted = () => { void this.render(); };

        const visitasEntries1: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of visitas) { visitasEntries1.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(this.app, "Visitas", visitasEntries1, (f) => this.openEditModal(f, "visita"), this.dataManager, onDeleted).open());

        const visitasEntries2: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of visitas) { visitasEntries2.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(this.app, "Personas", visitasEntries2, (f) => this.openEditModal(f, "visita"), this.dataManager, onDeleted).open());

        kpi(grid, "~Hogares visitados", String(hogares));
        kpi(grid, "Maestros participantes", String(mSet.size), () => new PersonListModal(this.app, "Maestros participantes", [...mSet].sort()).open());

        const fiestasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of fiestas) { fiestasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(this.app, "Fiestas", fiestasEntries, (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());

        const sagradosEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of sagrados) { sagradosEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(this.app, "Días Sagrados", sagradosEntries, (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());

        const otrasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of otras) { otrasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(this.app, "Otras", otrasEntries, (f) => this.openEditModal(f, "vc"), this.dataManager, onDeleted).open());

        kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () => new PersonListModal(this.app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());

        const peCount = procesoEducativo.length;
        const peEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of procesoEducativo) { peEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Programa Educativo", String(peCount), () => new RecordListModal(this.app, "Programa Educativo", peEntries, (f) => this.openEditModal(f, "pe"), this.dataManager, onDeleted).open());

        const asReunionesFlat: string[] = [];
        for (const r of reuniones) {
            for (const a of r.data.asist_bahais) { asReunionesFlat.push(a); }
        }
        const asistentesReuniones = new Set(asReunionesFlat);

        const reunionesEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of reuniones) { reunionesEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Reuniones", String(reuniones.length), () => new RecordListModal(this.app, "Reuniones", reunionesEntries, (f) => this.openEditModal(f, "reunion"), this.dataManager, onDeleted).open());

        kpi(grid, "Asistentes a reuniones", String(asistentesReuniones.size), () => new PersonListModal(this.app, "Asistentes a reuniones", [...asistentesReuniones].sort()).open());

        const declEntries: { file: TFile; data: Record<string, unknown> }[] = [];
        for (const r of declaraciones) { declEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
        kpi(grid, "Ingresos", String(declaraciones.length), () =>
            new RecordListModal(this.app, "Ingresos", declEntries, (f) => this.openEditModal(f, "declaracion"), this.dataManager, onDeleted).open());
    }

    updateSettings(settings: MiAgrupacionSettings): void { this.settings = settings; }
    async onClose(): Promise<void> { this.contentEl.empty(); }

    private openEditModal(file: TFile, kind: "visita" | "vc" | "pe" | "reunion" | "declaracion"): void {
        const onSaved = () => { void this.render(); };
        if (kind === "visita") new VisitaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "vc") new VidaComunitariaModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "pe") new ProcesoEducativoModal(this.app, this.dataManager, onSaved, file).open();
        else if (kind === "reunion") new ReunionModal(this.app, this.dataManager, onSaved, file).open();
        else new DeclaracionModal(this.app, this.dataManager, onSaved, file).open();
    }
}
