export interface ChangelogEntry {
    version: string;
    date: string;
    changes: {
        type: "feature" | "fix" | "improvement";
        text: string;
    }[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        version: "1.4.0",
        date: "2026-07-12",
        changes: [
            { type: "feature", text: "Toggle \"Primera visita del ciclo\" en formulario de visitas para conteo exacto de hogares." },
            { type: "feature", text: "Nuevo view \"Balance por período\" con agrupación semanal, quincenal, mensual y personalizado." },
            { type: "fix", text: "Las vistas ahora se refrescan automáticamente después de cada sincronización." },
            { type: "improvement", text: "~Hogares visitados usa flag explícito como prioridad, Union-Find como fallback para datos legacy." },
        ],
    },
    {
        version: "0.5.1",
        date: "2026-06-14",
        changes: [
            { type: "feature", text: "Modal de Novedades — muestra changelog al actualizar el plugin" },
        ],
    },
];
