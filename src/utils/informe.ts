import type { Visita, VidaComunitaria, ProcesoEducativo, MiAgrupacionSettings } from "../types";
import type { ScanResult } from "../data/manager-scan";
import { estimarHogares } from "./hogares";

function section(title: string): string {
    return `\n## ${title}\n\n`;
}

export function generateInforme(
    settings: MiAgrupacionSettings,
    cicloLabel: string,
    visitas: ScanResult<Visita>[],
    vidaComunitaria: ScanResult<VidaComunitaria>[],
    procesoEducativo: ScanResult<ProcesoEducativo>[],
): string {
    const fecha = new Date().toLocaleDateString("es-VE");
    const sectoresNombres: string[] = visitas.map((v: ScanResult<Visita>) => v.data.sector);
    const sectores = [...new Set(sectoresNombres)];
    let md = "";
    md += `# Informe General — ${settings.nombreAgrupacion.trim() || "Mi Agrupación"}\n`;
    md += `### Ciclo ${cicloLabel}\n`;
    md += `*Generado el ${fecha}*\n\n---\n`;

    // ── KPIs Globales ──
    md += section("📊 Resumen del Ciclo");
    const totalV = visitas.length;
    const nombresVisitados: string[] = visitas.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados);
    const personasV = new Set(nombresVisitados).size;
    const hogaresV = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosNombres: string[] = visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros);
    const maestrosSet = new Set(maestrosNombres);
    const f19 = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Fiesta de 19 días");
    const ds = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Día Sagrado");
    const otras = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
    const participantesF19: string[] = f19.flatMap((v: ScanResult<VidaComunitaria>) => [...(v.data.asist_bahais || []), ...(v.data.asist_simpatizantes || [])]);
    const pF19 = new Set(participantesF19);
    const clases = procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Clase de Niños");
    const gpj = procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "GPJ");
    const ce = procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Círculo de Estudio");

    const kpis: [string, string][] = [
        ["Visitas realizadas", String(totalV)],
        ["Personas visitadas", String(personasV)],
        ["~Hogares visitados", String(hogaresV)],
        ["Maestros participantes", String(maestrosSet.size)],
    ];
    if (f19.length > 0) kpis.push(["Fiestas de 19 días", String(f19.length)]);
    if (ds.length > 0) kpis.push(["Días Sagrados", String(ds.length)]);
    if (otras.length > 0) kpis.push(["Otras actividades", String(otras.length)]);
    if (pF19.size > 0) kpis.push(["Participantes en F19D", String(pF19.size)]);
    if (clases.length > 0) kpis.push(["Clases de niños", `${clases.length} (activas)`]);
    if (gpj.length > 0) kpis.push(["GPJ", `${gpj.length} (activos)`]);
    if (ce.length > 0) kpis.push(["CE", `${ce.length} (activas)`]);

    md += "| Indicador | Total |\n|-----------|-------|\n";
    for (const [label, value] of kpis) md += `| ${label} | ${value} |\n`;

    // ── Por Sector ──
    md += section("🏘️ Por Sector");
    const sortedSectors: string[] = [...sectores].sort();
    for (const s of sortedSectors) {
        const sv = visitas.filter((v: ScanResult<Visita>) => v.data.sector === s);
        const svc = vidaComunitaria.filter((v: ScanResult<VidaComunitaria>) => v.data.sector === s);
        const spe = procesoEducativo.filter((p: ScanResult<ProcesoEducativo>) => p.data.sector === s);
        const spF19 = svc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Fiesta de 19 días");
        const spDS = svc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad === "Día Sagrado");
        const spOtras = svc.filter((v: ScanResult<VidaComunitaria>) => v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado");
        const spClases = spe.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Clase de Niños");

        md += `### ${s}\n`;
        const svPersonas: string[] = sv.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados);
        const svMaestros: string[] = sv.flatMap((v: ScanResult<Visita>) => v.data.maestros);
        md += `- **Visitas:** ${sv.length} | ${new Set(svPersonas).size} personas`;
        md += ` | ${new Set(svMaestros).size} maestros`;
        md += ` | ${sv.length > 0 ? estimarHogares(sv) : 0} hogares\n`;

        const vcParts: string[] = [];
        const totalPartF19: number = spF19.reduce((a: number, v: ScanResult<VidaComunitaria>) => a + (v.data.numero_participantes || 0), 0);
        if (spF19.length > 0) vcParts.push(`${spF19.length} F19D (${totalPartF19} part.)`);
        const totalPartDS: number = spDS.reduce((a: number, v: ScanResult<VidaComunitaria>) => a + (v.data.numero_participantes || 0), 0);
        if (spDS.length > 0) vcParts.push(`${spDS.length} Días Sagrados (${totalPartDS} part.)`);
        if (spOtras.length > 0) vcParts.push(`${spOtras.length} Otra(s)`);
        if (vcParts.length > 0) md += `- **Vida Comunitaria:** ${vcParts.join(" · ")}\n`;

        if (spClases.length > 0) {
            const nombres: string[] = spClases.flatMap((p: ScanResult<ProcesoEducativo>) => p.data.participantes || []);
            md += `- **Proceso Educativo:** ${spClases.length} Clase(s) de Niños (${new Set(nombres).size} part.)\n`;
        }

        const speGPJ = spe.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "GPJ");
        const speCE = spe.filter((p: ScanResult<ProcesoEducativo>) => p.data.tipo === "Círculo de Estudio");
        if (speGPJ.length > 0) md += `- **GPJ:** ${speGPJ.length} activo(s)\n`;
        if (speCE.length > 0) md += `- **CE:** ${speCE.length} activo(s)\n`;
    }

    // ── Actividades Destacadas ──
    const hasAny = f19.length > 0 || ds.length > 0 || clases.length > 0 || gpj.length > 0 || ce.length > 0;
    if (hasAny) {
        md += section("🎉 Actividades Destacadas");
        if (f19.length > 0) {
            md += "**Fiestas de 19 días:**\n";
            const f19Sorted: ScanResult<VidaComunitaria>[] = f19.sort((a: ScanResult<VidaComunitaria>, b: ScanResult<VidaComunitaria>) => (a.data.fecha || "").localeCompare(b.data.fecha || ""));
            for (const v of f19Sorted) {
                md += `- ${String(v.data.fecha || "").slice(0, 5)} — ${String(v.data.nombre_evento || "")}`;
                md += ` (${String(v.data.sector || "")}, ${v.data.numero_participantes || 0} part.)\n`;
            }
        }
        if (ds.length > 0) {
            md += "\n**Días Sagrados:**\n";
            const dsSorted: ScanResult<VidaComunitaria>[] = ds.sort((a: ScanResult<VidaComunitaria>, b: ScanResult<VidaComunitaria>) => (a.data.fecha || "").localeCompare(b.data.fecha || ""));
            for (const v of dsSorted) {
                md += `- ${String(v.data.fecha || "").slice(0, 5)} — ${String(v.data.nombre_evento || "")}`;
                md += ` (${String(v.data.sector || "")}, ${v.data.numero_participantes || 0} part.)\n`;
            }
        }
        if (clases.length > 0) {
            md += "\n**Clases de Niños:**\n";
            for (const p of clases) {
                const part = (p.data.participantes || []).join(", ");
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.leccion || "Sin lección")}`;
                md += ` (${String(p.data.sector || "")}, ${part || "—"} part.)\n`;
            }
        }
        if (gpj.length > 0) {
            md += "\n**GPJ:**\n";
            for (const p of gpj) {
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.libro || "")}`;
                md += ` (${String(p.data.sector || "")})\n`;
            }
        }
        if (ce.length > 0) {
            md += "\n**Círculos de Estudio:**\n";
            for (const p of ce) {
                md += `- ${String(p.data.fecha || "").slice(0, 5)} — ${String(p.data.libro || "")}`;
                md += ` (${String(p.data.sector || "")})\n`;
            }
        }
    }

    // ── Campaña ──
    const enCamp = visitas.filter((v: ScanResult<Visita>) => v.data.campana_expansion === true);
    if (enCamp.length > 0) {
        md += section("📱 Campaña de Expansión");
        const enCampNombres: string[] = enCamp.flatMap((v: ScanResult<Visita>) => v.data.nombres_visitados);
        const alcanzadas = new Set(enCampNombres).size;
        const nuevos = enCamp.filter((v: ScanResult<Visita>) => v.data.hogar_nuevo === true).length;
        const bahais = visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Bahá'í").length;
        const simp = visitas.filter((v: ScanResult<Visita>) => v.data.condicion === "Simpatizante").length;
        const campMaestros: string[] = visitas.flatMap((v: ScanResult<Visita>) => v.data.maestros);
        const mSet = new Set(campMaestros);
        const totalV = visitas.length;
        const hog = totalV > 0 ? estimarHogares(visitas) : 0;
        md += `- Personas alcanzadas: ${alcanzadas}\n`;
        md += `- Maestros únicos: ${mSet.size}\n`;
        md += `- Hogares nuevos: ${nuevos}\n`;
        md += `- Bahá'ís: ${bahais} · Simpatizantes: ${simp}\n`;
        md += `- Total de visitas: ${totalV}\n`;
        md += `- ~Hogares visitados: ${hog}\n`;
    }

    md += `\n---\n📱 *Generado con Mi Agrupación*\n`;
    return md;
}
