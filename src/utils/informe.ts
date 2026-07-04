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
    const sectoresSet = new Set<string>();
    for (const v of visitas) { sectoresSet.add(v.data.sector); }
    const sectores = [...sectoresSet];
    let md = "";
    md += `# Informe General — ${settings.nombreAgrupacion.trim() || "Mi Agrupación"}\n`;
    md += `### Ciclo ${cicloLabel}\n`;
    md += `*Generado el ${fecha}*\n\n---\n`;

    // ── KPIs Globales ──
    md += section("📊 Resumen del Ciclo");
    const totalV = visitas.length;
    const nombresVSet = new Set<string>();
    for (const v of visitas) {
        for (const n of v.data.nombres_visitados) {
            nombresVSet.add(n);
        }
    }
    const personasV = nombresVSet.size;
    const hogaresV = totalV > 0 ? estimarHogares(visitas) : 0;
    const maestrosSet = new Set<string>();
    for (const v of visitas) {
        for (const m of v.data.maestros) {
            maestrosSet.add(m);
        }
    }
    const f19: ScanResult<VidaComunitaria>[] = [];
    for (const v of vidaComunitaria) {
        if (v.data.tipo_actividad === "Fiesta de 19 días") f19.push(v);
    }
    const ds: ScanResult<VidaComunitaria>[] = [];
    for (const v of vidaComunitaria) {
        if (v.data.tipo_actividad === "Día Sagrado") ds.push(v);
    }
    const otras: ScanResult<VidaComunitaria>[] = [];
    for (const v of vidaComunitaria) {
        if (v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado") otras.push(v);
    }
    const pF19 = new Set<string>();
    for (const v of f19) {
        for (const b of (v.data.asist_bahais || [])) { pF19.add(b); }
        for (const s of (v.data.asist_simpatizantes || [])) { pF19.add(s); }
    }
    const clases: ScanResult<ProcesoEducativo>[] = [];
    for (const p of procesoEducativo) {
        if (p.data.tipo === "Clase de Niños") clases.push(p);
    }
    const gpj: ScanResult<ProcesoEducativo>[] = [];
    for (const p of procesoEducativo) {
        if (p.data.tipo === "GPJ") gpj.push(p);
    }
    const ce: ScanResult<ProcesoEducativo>[] = [];
    for (const p of procesoEducativo) {
        if (p.data.tipo === "Círculo de Estudio") ce.push(p);
    }

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
        const sv: ScanResult<Visita>[] = [];
        for (const v of visitas) {
            if (v.data.sector === s) sv.push(v);
        }
        const svc: ScanResult<VidaComunitaria>[] = [];
        for (const v of vidaComunitaria) {
            if (v.data.sector === s) svc.push(v);
        }
        const spe: ScanResult<ProcesoEducativo>[] = [];
        for (const p of procesoEducativo) {
            if (p.data.sector === s) spe.push(p);
        }
        const spF19: ScanResult<VidaComunitaria>[] = [];
        for (const v of svc) {
            if (v.data.tipo_actividad === "Fiesta de 19 días") spF19.push(v);
        }
        const spDS: ScanResult<VidaComunitaria>[] = [];
        for (const v of svc) {
            if (v.data.tipo_actividad === "Día Sagrado") spDS.push(v);
        }
        const spOtras: ScanResult<VidaComunitaria>[] = [];
        for (const v of svc) {
            if (v.data.tipo_actividad !== "Fiesta de 19 días" && v.data.tipo_actividad !== "Día Sagrado") spOtras.push(v);
        }
        const spClases: ScanResult<ProcesoEducativo>[] = [];
        for (const p of spe) {
            if (p.data.tipo === "Clase de Niños") spClases.push(p);
        }

        md += `### ${s}\n`;
        const svPersonasSet = new Set<string>();
        for (const v of sv) {
            for (const n of v.data.nombres_visitados) {
                svPersonasSet.add(n);
            }
        }
        const svMaestrosSet = new Set<string>();
        for (const v of sv) {
            for (const m of v.data.maestros) {
                svMaestrosSet.add(m);
            }
        }
        md += `- **Visitas:** ${sv.length} | ${svPersonasSet.size} personas`;
        md += ` | ${svMaestrosSet.size} maestros`;
        md += ` | ${sv.length > 0 ? estimarHogares(sv) : 0} hogares\n`;

        const vcParts: string[] = [];
        let totalPartF19 = 0;
        for (const v of spF19) {
            totalPartF19 += v.data.numero_participantes || 0;
        }
        if (spF19.length > 0) vcParts.push(`${spF19.length} F19D (${totalPartF19} part.)`);
        let totalPartDS = 0;
        for (const v of spDS) {
            totalPartDS += v.data.numero_participantes || 0;
        }
        if (spDS.length > 0) vcParts.push(`${spDS.length} Días Sagrados (${totalPartDS} part.)`);
        if (spOtras.length > 0) vcParts.push(`${spOtras.length} Otra(s)`);
        if (vcParts.length > 0) md += `- **Vida Comunitaria:** ${vcParts.join(" · ")}\n`;

        if (spClases.length > 0) {
            const spClasesNombresSet = new Set<string>();
            for (const p of spClases) {
                for (const n of (p.data.participantes || [])) {
                    spClasesNombresSet.add(n);
                }
            }
            md += `- **Proceso Educativo:** ${spClases.length} Clase(s) de Niños (${spClasesNombresSet.size} part.)\n`;
        }

        const speGPJ: ScanResult<ProcesoEducativo>[] = [];
        for (const p of spe) {
            if (p.data.tipo === "GPJ") speGPJ.push(p);
        }
        const speCE: ScanResult<ProcesoEducativo>[] = [];
        for (const p of spe) {
            if (p.data.tipo === "Círculo de Estudio") speCE.push(p);
        }
        if (speGPJ.length > 0) md += `- **GPJ:** ${speGPJ.length} activo(s)\n`;
        if (speCE.length > 0) md += `- **CE:** ${speCE.length} activo(s)\n`;
    }

    // ── Actividades Destacadas ──
    const hasAny = f19.length > 0 || ds.length > 0 || clases.length > 0 || gpj.length > 0 || ce.length > 0;
    if (hasAny) {
        md += section("🎉 Actividades Destacadas");
        if (f19.length > 0) {
            md += "**Fiestas de 19 días:**\n";
            const f19Sorted = [...f19];
            f19Sorted.sort((a: ScanResult<VidaComunitaria>, b: ScanResult<VidaComunitaria>) => (a.data.fecha || "").localeCompare(b.data.fecha || ""));
            for (const v of f19Sorted) {
                md += `- ${String(v.data.fecha || "").slice(0, 5)} — ${String(v.data.nombre_evento || "")}`;
                md += ` (${String(v.data.sector || "")}, ${v.data.numero_participantes || 0} part.)\n`;
            }
        }
        if (ds.length > 0) {
            md += "\n**Días Sagrados:**\n";
            const dsSorted = [...ds];
            dsSorted.sort((a: ScanResult<VidaComunitaria>, b: ScanResult<VidaComunitaria>) => (a.data.fecha || "").localeCompare(b.data.fecha || ""));
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
    const enCamp: ScanResult<Visita>[] = [];
    for (const v of visitas) {
        if (v.data.campana_expansion === true) enCamp.push(v);
    }
    if (enCamp.length > 0) {
        md += section("📱 Campaña de Expansión");
        const enCampNombresSet = new Set<string>();
        for (const v of enCamp) {
            for (const n of v.data.nombres_visitados) {
                enCampNombresSet.add(n);
            }
        }
        const alcanzadas = enCampNombresSet.size;
        let nuevos = 0;
        for (const v of enCamp) {
            if (v.data.hogar_nuevo === true) nuevos++;
        }
        let bahais = 0;
        for (const v of visitas) {
            if (v.data.condicion === "Bahá'í") bahais++;
        }
        let simp = 0;
        for (const v of visitas) {
            if (v.data.condicion === "Simpatizante") simp++;
        }
        const campMaestrosSet = new Set<string>();
        for (const v of visitas) {
            for (const m of v.data.maestros) {
                campMaestrosSet.add(m);
            }
        }
        const totalV = visitas.length;
        const hog = totalV > 0 ? estimarHogares(visitas) : 0;
        md += `- Personas alcanzadas: ${alcanzadas}\n`;
        md += `- Maestros únicos: ${campMaestrosSet.size}\n`;
        md += `- Hogares nuevos: ${nuevos}\n`;
        md += `- Bahá'ís: ${bahais} · Simpatizantes: ${simp}\n`;
        md += `- Total de visitas: ${totalV}\n`;
        md += `- ~Hogares visitados: ${hog}\n`;
    }

    md += `\n---\n📱 *Generado con Mi Agrupación*\n`;
    return md;
}
