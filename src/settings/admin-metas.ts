import { Setting } from "obsidian";
import type { SettingsContext } from "./setup-wizard";
import type { CicloMetas, CicloMetasCampana, CicloMetasProcesoEducativo, CicloMetasActividad } from "../types";
import { CICLOS } from "../types";

function defaultMetasCampana(): CicloMetasCampana {
    return { maestrosParticipantes: 0, numeroVisitas: 0, numeroHogares: 0, bahais: 0, hogaresNuevos: 0, simpatizantes: 0 };
}

function defaultMetasPE(): CicloMetasProcesoEducativo {
    return { clasesNinos: 0, gpj: 0, circulosEstudio: 0 };
}

function defaultMetasActividad(): CicloMetasActividad {
    return { participacionTotal: 0, participantesUnicos: 0, cantidadActividades: 0 };
}

function defaultMetasCiclo(): CicloMetas {
    return { campana: defaultMetasCampana(), procesoEducativo: defaultMetasPE(), diasSagrados: defaultMetasActividad(), fiesta19Dias: defaultMetasActividad() };
}

function getMetasForCiclo(ctx: SettingsContext, ciclo: string): CicloMetas {
    return ctx.settings.metasCiclo[ciclo] || defaultMetasCiclo();
}

export function renderMetasCiclo(ctx: SettingsContext, containerEl: HTMLElement): void {
    if (ctx.settings.setupMode !== "admin") return;

    new Setting(containerEl).setHeading().setName("Metas del ciclo");

    let selectedCiclo = CICLOS[0];
    const metasDiv = containerEl.createDiv({ cls: "mi-agrupacion-card" });

    function renderMetasForCiclo(ciclo: string): void {
        metasDiv.empty();
        const metas = getMetasForCiclo(ctx, ciclo);

        const saveMetas = async () => {
            ctx.settings.metasCiclo[ciclo] = metas;
            await ctx.saveFn();
        };

        renderCampanaInputs(ctx, metasDiv, metas.campana, saveMetas);
        renderPEInputs(ctx, metasDiv, metas.procesoEducativo, saveMetas);
        renderActividadInputs(ctx, metasDiv, "Días Sagrados", metas.diasSagrados, saveMetas);
        renderActividadInputs(ctx, metasDiv, "Fiesta de 19 días", metas.fiesta19Dias, saveMetas);
    }

    new Setting(containerEl)
        .setName("Ciclo")
        .addDropdown((d) => {
            for (const c of CICLOS) { d.addOption(c, c); }
            d.setValue(selectedCiclo);
            d.onChange((value) => {
                selectedCiclo = value;
                renderMetasForCiclo(value);
            });
        });

    renderMetasForCiclo(selectedCiclo);
}

function numberInput(
    container: HTMLElement,
    label: string,
    value: number,
    onChange: (v: number) => void,
): void {
    new Setting(container)
        .setName(label)
        .addText((text) => {
            text.setValue(value > 0 ? String(value) : "")
                .setPlaceholder("0")
                .onChange((v) => { onChange(parseInt(v, 10) || 0); });
            text.inputEl.type = "number";
            text.inputEl.min = "0";
        });
}

function renderCampanaInputs(
    ctx: SettingsContext,
    container: HTMLElement,
    metas: CicloMetasCampana,
    save: () => Promise<void>,
): void {
    const section = container.createDiv();
    new Setting(section).setName("Campaña de Expansión").setHeading();
    numberInput(section, "Maestros participantes", metas.maestrosParticipantes, (v) => { metas.maestrosParticipantes = v; void save(); });
    numberInput(section, "Número de visitas", metas.numeroVisitas, (v) => { metas.numeroVisitas = v; void save(); });
    numberInput(section, "Número de hogares", metas.numeroHogares, (v) => { metas.numeroHogares = v; void save(); });
    numberInput(section, "Bahá'ís", metas.bahais, (v) => { metas.bahais = v; void save(); });
    numberInput(section, "Hogares nuevos", metas.hogaresNuevos, (v) => { metas.hogaresNuevos = v; void save(); });
    numberInput(section, "Simpatizantes", metas.simpatizantes, (v) => { metas.simpatizantes = v; void save(); });
}

function renderPEInputs(
    ctx: SettingsContext,
    container: HTMLElement,
    metas: CicloMetasProcesoEducativo,
    save: () => Promise<void>,
): void {
    const section = container.createDiv();
    new Setting(section).setName("Proceso Educativo").setHeading();
    numberInput(section, "Clases de niños", metas.clasesNinos, (v) => { metas.clasesNinos = v; void save(); });
    numberInput(section, "GPJ", metas.gpj, (v) => { metas.gpj = v; void save(); });
    numberInput(section, "Círculos de estudio", metas.circulosEstudio, (v) => { metas.circulosEstudio = v; void save(); });
}

function renderActividadInputs(
    ctx: SettingsContext,
    container: HTMLElement,
    title: string,
    metas: CicloMetasActividad,
    save: () => Promise<void>,
): void {
    const section = container.createDiv();
    new Setting(section).setName(title).setHeading();
    numberInput(section, "Participación total", metas.participacionTotal, (v) => { metas.participacionTotal = v; void save(); });
    numberInput(section, "Participantes únicos", metas.participantesUnicos, (v) => { metas.participantesUnicos = v; void save(); });
    numberInput(section, "Cantidad de actividades", metas.cantidadActividades, (v) => { metas.cantidadActividades = v; void save(); });
}
