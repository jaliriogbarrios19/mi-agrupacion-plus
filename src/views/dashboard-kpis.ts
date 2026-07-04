import { App, Setting, TFile } from "obsidian";
import type { Visita, VidaComunitaria, ProcesoEducativo, Reunion, Declaracion } from "../types";
import { type ScanResult } from "../data/manager-scan";
import type { DataManager } from "../data/manager";
import { RecordListModal } from "../modals/record-list-modal";
import { PersonListModal } from "../modals/person-list-modal";
import { estimarHogares } from "../utils/hogares";
import { kpi } from "./report-utils";

export function renderGeneralKPIs(
    grid: HTMLElement,
    app: App,
    visitas: ScanResult<Visita>[],
    vc: ScanResult<VidaComunitaria>[],
    pe: ScanResult<ProcesoEducativo>[],
    reuniones: ScanResult<Reunion>[],
    declaraciones: ScanResult<Declaracion>[],
    openEditModal: (file: TFile, kind: "visita" | "vc" | "pe" | "reunion" | "declaracion") => void,
    dataManager?: DataManager,
    onDeleted?: () => void,
): void {
    const totalV = visitas.length;
    const visitadosFlat: string[] = [];
    for (const v of visitas) {
        for (const n of v.data.nombres_visitados) { visitadosFlat.push(n); }
    }
    const personas = new Set(visitadosFlat).size;
    const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosFlat: string[] = [];
    for (const v of visitas) {
        for (const m of v.data.maestros) { maestrosFlat.push(m); }
    }
    const maestrosSet = new Set(maestrosFlat);
    const fiestas: ScanResult<VidaComunitaria>[] = [];
    for (const v of vc) {
        if (v.data.tipo_actividad === "Fiesta de 19 días") fiestas.push(v);
    }
    const sagrados: ScanResult<VidaComunitaria>[] = [];
    for (const v of vc) {
        if (v.data.tipo_actividad === "Día Sagrado") sagrados.push(v);
    }
    const otras: ScanResult<VidaComunitaria>[] = [];
    for (const v of vc) {
        if (v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado") otras.push(v);
    }
    const f19PartFlat: string[] = [];
    for (const v of fiestas) {
        const asist_bahais = v.data.asist_bahais || [];
        const asist_simpatizantes = v.data.asist_simpatizantes || [];
        for (const p of asist_bahais) { f19PartFlat.push(p); }
        for (const p of asist_simpatizantes) { f19PartFlat.push(p); }
    }
    const participantesUnicos = new Set(f19PartFlat);
    const modalOpts = dataManager ? { dataManager, onDeleted } : {};

    const visitasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of visitas) { visitasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(app, "Visitas", visitasEntries, (f) => openEditModal(f, "visita"), modalOpts.dataManager, modalOpts.onDeleted).open());

    const personasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of visitas) { personasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(app, "Personas", personasEntries, (f) => openEditModal(f, "visita"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "~Hogares visitados", String(hogares));
    kpi(grid, "Maestros participantes", String(maestrosSet.size), () => new PersonListModal(app, "Maestros participantes", [...maestrosSet].sort()).open());

    const fiestasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of fiestas) { fiestasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(app, "Fiestas", fiestasEntries, (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());

    const sagradosEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of sagrados) { sagradosEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(app, "Días Sagrados", sagradosEntries, (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());

    const otrasEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of otras) { otrasEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(app, "Otras", otrasEntries, (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());

    kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () =>
        new PersonListModal(app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());

    const peEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of pe) { peEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Programa Educativo", String(pe.length), () => new RecordListModal(app, "Programa Educativo", peEntries, (f) => openEditModal(f, "pe"), modalOpts.dataManager, modalOpts.onDeleted).open());

    const reunionesEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of reuniones) { reunionesEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Reuniones", String(reuniones.length), () => new RecordListModal(app, "Reuniones", reunionesEntries, (f) => openEditModal(f, "reunion"), modalOpts.dataManager, modalOpts.onDeleted).open());

    const asistReunionesFlat: string[] = [];
    for (const r of reuniones) {
        for (const a of r.data.asist_bahais) { asistReunionesFlat.push(a); }
    }
    const asistentesReuniones = new Set(asistReunionesFlat);
    kpi(grid, "Asistentes a reuniones", String(asistentesReuniones.size), () =>
        new PersonListModal(app, "Asistentes a reuniones", [...asistentesReuniones].sort()).open());

    const declEntries: { file: TFile; data: Record<string, unknown> }[] = [];
    for (const r of declaraciones) { declEntries.push({ file: r.file, data: r.data as unknown as Record<string, unknown> }); }
    kpi(grid, "Ingresos", String(declaraciones.length), () =>
        new RecordListModal(app, "Ingresos", declEntries, (f) => openEditModal(f, "declaracion"), modalOpts.dataManager, modalOpts.onDeleted).open());
}

export function renderSRPVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
    const s = container.createDiv({ cls: "mi-agrupacion-section" });
    const h = new Setting(s);
    h.setName("Visitas");
    h.setHeading();
    const total = visitas.length;
    const visitadosSRPFlat: string[] = [];
    for (const v of visitas) {
        for (const n of v.data.nombres_visitados) { visitadosSRPFlat.push(n); }
    }
    const per = new Set(visitadosSRPFlat).size;
    const hog = total > 0 ? estimarHogares(visitas) : 0;
    let simp = 0;
    for (const v of visitas) {
        if (v.data.condicion === "Simpatizante") simp++;
    }
    let nuevos = 0;
    for (const v of visitas) {
        if (v.data.hogar_nuevo === true) nuevos++;
    }
    let dev = 0;
    for (const v of visitas) {
        if (v.data.hubo_oracion === true) dev++;
    }
    let camp = 0;
    for (const v of visitas) {
        if (v.data.campana_expansion === true) camp++;
    }
    const mFlat: string[] = [];
    for (const v of visitas) {
        for (const m of v.data.maestros) { mFlat.push(m); }
    }
    const mSet = new Set(mFlat);
    for (const l of [
        `Total de visitas: ${total}`, `Personas visitadas: ${per}`,
        `~Hogares visitados: ${hog}`, `Visitas a simpatizantes: ${simp}`,
        `Hogares nuevos: ${nuevos}`, `RD durante las visitas: ${dev}`,
        `Maestros visitantes: ${mSet.size}`, `Visitas en campaña: ${camp}`,
    ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
}

export function renderSRPVida(container: HTMLElement, vida: ScanResult<VidaComunitaria>[]): void {
    const s = container.createDiv({ cls: "mi-agrupacion-section" });
    const h = new Setting(s);
    h.setName("Vida Comunitaria");
    h.setHeading();
    const f19: ScanResult<VidaComunitaria>[] = [];
    for (const v of vida) {
        if (v.data.tipo_actividad === "Fiesta de 19 días") f19.push(v);
    }
    const ds: ScanResult<VidaComunitaria>[] = [];
    for (const v of vida) {
        if (v.data.tipo_actividad === "Día Sagrado") ds.push(v);
    }
    const ot: ScanResult<VidaComunitaria>[] = [];
    for (const v of vida) {
        if (v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado") ot.push(v);
    }
    let af = 0;
    for (const v of f19) {
        af += v.data.numero_participantes || 0;
    }
    let ad = 0;
    for (const v of ds) {
        ad += v.data.numero_participantes || 0;
    }
    for (const l of [
        `Fiestas de 19 días: ${f19.length} (Asistencia: ${af})`,
        `Días Sagrados: ${ds.length} (Asistencia: ${ad})`,
        `Otras actividades: ${ot.length}`,
    ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
}
