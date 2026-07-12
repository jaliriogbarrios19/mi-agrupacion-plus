import type { ScanResult } from "../data/manager-scan";
import type { Visita } from "../types";

export function estimarHogares(visitas: ScanResult<Visita>[]): number {
    if (visitas.length === 0) return 0;

    // Visitantes marcados explícitamente como primera visita del ciclo
    const firstVisits = visitas.filter(v => v.data.primera_visita_ciclo === true);
    // Visitantes marcados explícitamente como seguimiento (no primera vez)
    const followUps = new Set(
        visitas.filter(v => v.data.primera_visita_ciclo === false)
            .map(v => v.file.path)
    );
    // Datos legacy sin el flag
    const legacy = visitas.filter(v =>
        v.data.primera_visita_ciclo !== true && !followUps.has(v.file.path)
    );

    const exactCount = firstVisits.length;
    const legacyEstimate = legacy.length > 0 ? estimarHogaresUnionFind(legacy) : 0;

    return exactCount + legacyEstimate;
}

function estimarHogaresUnionFind(visitas: ScanResult<Visita>[]): number {
    if (visitas.length === 0) return 0;

    const namesToVisits = new Map<string, number[]>();
    for (let i = 0; i < visitas.length; i++) {
        for (const name of visitas[i].data.nombres_visitados) {
            const list = namesToVisits.get(name);
            if (list) list.push(i);
            else namesToVisits.set(name, [i]);
        }
    }

    const parent = Array.from({ length: visitas.length }, (_, i) => i);

    function find(x: number): number {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        return x;
    }

    function union(a: number, b: number): void {
        parent[find(a)] = find(b);
    }

    for (const indices of Array.from(namesToVisits.values())) {
        if (indices.length < 2) continue;
        const first = indices[0];
        for (let j = 1; j < indices.length; j++) {
            union(first, indices[j]);
        }
    }

    const components = new Set<number>();
    for (let i = 0; i < visitas.length; i++) {
        components.add(find(i));
    }
    return components.size;
}