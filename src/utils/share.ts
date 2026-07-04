import { App, Notice, Platform } from "obsidian";

function emojiCondicion(c: string): string {
    return c === "Bahá'í" ? "⭐" : "🤝";
}

export function formatVisitaForShare(raw: Record<string, unknown>): string {
    const data = raw as { nombres_visitados?: string[]; maestros?: string[]; condicion?: string; hubo_oracion?: boolean; hogar_nuevo?: boolean; fecha?: string; sector?: string; proposito_visita?: string; resumen?: string; campana_expansion?: boolean };
    const nombres = data.nombres_visitados || [];
    const maestros = data.maestros || [];
    const cond = emojiCondicion(String(data.condicion || ""));
    const oracion = data.hubo_oracion ? "Sí" : "No";
    const nuevo = data.hogar_nuevo ? "Sí" : "No";
    let text = `📋 *Visita — ${String(data.fecha || "")}*\n\n`;
    text += `🏠 Visitados: ${nombres.join(", ")}\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    text += `👥 Maestros: ${maestros.join(", ")}\n`;
    text += `🎯 Propósito: ${String(data.proposito_visita || "")}\n`;
    if (data.resumen) text += `📝 Resumen: ${String(data.resumen)}\n`;
    text += `\n${cond} Condición: ${String(data.condicion || "")}\n`;
    text += `🏡 Hogar nuevo: ${nuevo}\n`;
    text += `🙏 Hubo oración: ${oracion}\n`;
    if (data.campana_expansion) text += `📢 Campaña de Expansión\n`;
    return text;
}

export function formatVidaComunitariaForShare(raw: Record<string, unknown>): string {
    const data = raw as { tipo_actividad?: string; fecha?: string; nombre_evento?: string; sector?: string; numero_participantes?: number; asist_bahais?: string[]; asist_simpatizantes?: string[]; descripcion_actividad?: string };
    const bahais = data.asist_bahais || [];
    const simps = data.asist_simpatizantes || [];
    const total = data.numero_participantes || (bahais.length + simps.length);
    let text = `🎉 *${String(data.tipo_actividad || "Actividad")} — ${String(data.fecha || "")}*\n`;
    text += `📌 ${String(data.nombre_evento || "")}\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    text += `👥 Participantes: ${total}\n`;
    if (bahais.length > 0) text += `⭐ Bahá'ís: ${bahais.join(", ")}\n`;
    if (simps.length > 0) text += `🤝 Simpatizantes: ${simps.join(", ")}\n`;
    if (data.descripcion_actividad) text += `📝 ${String(data.descripcion_actividad)}\n`;
    return text;
}

export function formatProcesoEducativoForShare(raw: Record<string, unknown>): string {
    const data = raw as { tipo?: string; fecha?: string; sector?: string; leccion?: string; libro?: string; participantes?: string[] };
    const participantes = data.participantes || [];
    let text = `📚 *${String(data.tipo || "Proceso Educativo")} — ${String(data.fecha || "")}*\n`;
    text += `📍 Sector: ${String(data.sector || "")}\n`;
    if (data.leccion) text += `📖 Lección: ${String(data.leccion)}\n`;
    if (data.libro) text += `📘 Libro: ${String(data.libro)}\n`;
    text += `👥 Participantes: ${participantes.length > 0 ? participantes.join(", ") : "—"}\n`;
    return text;
}

export async function shareText(text: string, app: App): Promise<void> {
    if (Platform.isMobile || Platform.isAndroidApp || Platform.isIosApp) {
        try {
            await navigator.share({ text });
        } catch {
            await copyToClipboard(text, app);
        }
    } else {
        await copyToClipboard(text, app);
    }
}

interface VisitaExportEntry { nombres_visitados?: string[]; maestros?: string[]; proposito_visita?: string; resumen?: string; hubo_oracion?: boolean }

export function formatVisitasExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} visitas`;
    const todosNombres: string[] = [];
    for (const r of records) {
        const arr = ((r as VisitaExportEntry).nombres_visitados) || [];
        for (const n of arr) { todosNombres.push(n); }
    }
    const personas = new Set(todosNombres).size;
    text += ` | ${personas} personas`;
    const todosMaestros: string[] = [];
    for (const r of records) {
        const arr = ((r as VisitaExportEntry).maestros) || [];
        for (const m of arr) { todosMaestros.push(m); }
    }
    const allMaestros = new Set(todosMaestros).size;
    text += ` | ${allMaestros} maestros\n`;

    const groups = new Map<string, { maestros: string; visitas: Record<string, unknown>[] }>();
    for (const r of records) {
        const v = r as VisitaExportEntry;
        const ms = (v.maestros || []).join(", ");
        if (!groups.has(ms)) {
            groups.set(ms, { maestros: ms, visitas: [] });
        }
        groups.get(ms)!.visitas.push(r);
    }

    let first = true;
    for (const [, group] of groups) {
        if (!first) text += "\n---\n";
        first = false;
        text += `\n👥 ${group.maestros}\n`;
        for (const r of group.visitas) {
            const v = r as VisitaExportEntry;
            const visitados = (v.nombres_visitados || []).join(", ");
            text += `\n• ${visitados}`;
            if (v.proposito_visita) text += `\n  🎯 ${String(v.proposito_visita)}`;
            if (v.resumen) text += `\n  📝 ${String(v.resumen)}`;
            if (v.hubo_oracion) text += `\n  🙏 Hubo oración`;
            text += "\n";
        }
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

interface ActividadExportEntry { fecha?: string; nombre_evento?: string; numero_participantes?: number; asist_bahais?: string[]; asist_simpatizantes?: string[] }

export function formatActividadesExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} actividades`;
    let totalP = 0;
    for (const r of records) {
        totalP += Number((r as ActividadExportEntry).numero_participantes) || 0;
    }
    text += ` | ${totalP} participantes\n\n`;
    for (const r of records) {
        const v = r as ActividadExportEntry;
        const fecha = String(v.fecha || "").slice(0, 5);
        const nombre = String(v.nombre_evento || "");
        const p = v.numero_participantes || 0;
        text += `• ${fecha} — ${nombre} (${p} part.)\n`;
        const bahais = v.asist_bahais || [];
        if (bahais.length > 0) text += `  ⭐ ${bahais.join(", ")}\n`;
        const simps = v.asist_simpatizantes || [];
        if (simps.length > 0) text += `  🤝 ${simps.join(", ")}\n`;
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

interface PExportEntry { fecha?: string; tipo?: string; participantes?: string[]; leccion?: string; libro?: string }

export function formatPExport(
    records: Record<string, unknown>[],
    title: string,
    subtitle: string,
): string {
    let text = `📊 *${title}*\n${subtitle}\n`;
    text += `${records.length} registros\n\n`;
    for (const r of records) {
        const v = r as PExportEntry;
        const fecha = String(v.fecha || "").slice(0, 5);
        const tipo = String(v.tipo || "");
        const part = (v.participantes || []).join(", ");
        text += `• ${fecha} — ${tipo}\n`;
        if (part) text += `  👥 ${part}\n`;
        if (v.leccion) text += `  📖 ${String(v.leccion)}\n`;
        if (v.libro) text += `  📘 ${String(v.libro)}\n`;
    }
    text += "\n📱 Registrado con Mi Agrupación";
    return text;
}

async function copyToClipboard(text: string, app: App): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        new Notice("Copiado al portapapeles");
    } catch {
        new Notice("No se pudo copiar al portapapeles");
    }
}
