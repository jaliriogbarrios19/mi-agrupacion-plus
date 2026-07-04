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
    const personas = new Set(visitas.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados)).size;
    const hogares = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosSet = new Set(visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros));
    const fiestas = vc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Fiesta de 19 días");
    const sagrados = vc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Día Sagrado");
    const otras = vc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const participantesUnicos = new Set(fiestas.flatMap((v: ScanResult<VidaComunitaria>) => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]));
    const tc = <T extends ScanResult<Visita | VidaComunitaria | ProcesoEducativo | Reunion>>(d: T[]) =>
        d.map(r => ({ file: r.file, data: r.data as unknown as Record<string, unknown> }));
    const modalOpts = dataManager ? { dataManager, onDeleted } : {};
    kpi(grid, "Visitas realizadas", String(totalV), () => new RecordListModal(app, "Visitas", tc(visitas), (f) => openEditModal(f, "visita"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "Personas visitadas", String(personas), () => new RecordListModal(app, "Personas", tc(visitas), (f) => openEditModal(f, "visita"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "~Hogares visitados", String(hogares));
    kpi(grid, "Maestros participantes", String(maestrosSet.size), () => new PersonListModal(app, "Maestros participantes", [...maestrosSet].sort()).open());
    kpi(grid, "Fiestas de 19 días", String(fiestas.length), () => new RecordListModal(app, "Fiestas", tc(fiestas), (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "Días Sagrados", String(sagrados.length), () => new RecordListModal(app, "Días Sagrados", tc(sagrados), (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "Otras actividades", String(otras.length), () => new RecordListModal(app, "Otras", tc(otras), (f) => openEditModal(f, "vc"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "Participantes en F19D", String(participantesUnicos.size), () =>
        new PersonListModal(app, "Participantes en Fiestas de 19 días", [...participantesUnicos].sort()).open());
    kpi(grid, "Programa Educativo", String(pe.length), () => new RecordListModal(app, "Programa Educativo", tc(pe), (f) => openEditModal(f, "pe"), modalOpts.dataManager, modalOpts.onDeleted).open());
    kpi(grid, "Reuniones", String(reuniones.length), () => new RecordListModal(app, "Reuniones", tc(reuniones), (f) => openEditModal(f, "reunion"), modalOpts.dataManager, modalOpts.onDeleted).open());
    const asistentesReuniones = new Set(reuniones.flatMap((r: ScanResult<Reunion>) => r.data.asist_bahais));
    kpi(grid, "Asistentes a reuniones", String(asistentesReuniones.size), () =>
        new PersonListModal(app, "Asistentes a reuniones", [...asistentesReuniones].sort()).open());
    kpi(grid, "Ingresos", String(declaraciones.length), () =>
        new RecordListModal(app, "Ingresos", declaraciones.map((r: ScanResult<Declaracion>) => ({ file: r.file, data: r.data as unknown as Record<string, unknown> })), (f) => openEditModal(f, "declaracion"), modalOpts.dataManager, modalOpts.onDeleted).open());
}

export function renderSRPVisitas(container: HTMLElement, visitas: ScanResult<Visita>[]): void {
    const s = container.createDiv({ cls: "mi-agrupacion-section" });
    const h = new Setting(s);
    h.setName("Visitas");
    h.setHeading();
    const total = visitas.length;
    const per = new Set(visitas.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados)).size;
    const hog = total > 0 ? estimarHogares(visitas) : 0;
    const simp = visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Simpatizante").length;
    const nuevos = visitas.filter((v: ScanResult<Visita>) => v.data.hogar_nuevo === true).length;
    const dev = visitas.filter((v: ScanResult<Visita>) => v.data.hubo_oracion === true).length;
    const camp = visitas.filter((v: ScanResult<Visita>) => v.data.campana_expansion === true).length;
    const mSet = new Set(visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros));
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
    const f19 = vida.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Fiesta de 19 días");
    const ds = vida.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Día Sagrado");
    const ot = vida.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const af = f19.reduce((a: number, v: ScanResult<VidaComunitaria>) => a + (v.data.numero_participantes || 0), 0);
    const ad = ds.reduce((a: number, v: ScanResult<VidaComunitaria>) => a + (v.data.numero_participantes || 0), 0);
    for (const l of [
        `Fiestas de 19 días: ${f19.length} (Asistencia: ${af})`,
        `Días Sagrados: ${ds.length} (Asistencia: ${ad})`,
        `Otras actividades: ${ot.length}`,
    ]) s.createEl("p", { text: l, cls: "mi-agrupacion-stat" });
}
