import { type App } from "obsidian";
import { DashboardView } from "./views/dashboard-view";
import { GeneralView } from "./views/general-view";
import { ResumenSRPView } from "./views/resumen-srp-view";
import { CampanaView } from "./views/campana-view";
import { VisitaModal } from "./modals/visita-modal";
import { VidaComunitariaModal } from "./modals/vida-comunitaria-modal";
import { ProcesoEducativoModal } from "./modals/proceso-educativo-modal";
import { MaestroModal } from "./modals/maestro-modal";
import { ReunionModal } from "./modals/reunion-modal";
import type { MiAgrupacionSettings } from "./types";
import { VIEW_TYPE_DASHBOARD, VIEW_TYPE_GENERAL, VIEW_TYPE_RESUMEN_SRP, VIEW_TYPE_CAMPANA } from "./types";
import type { DataManager } from "./data/manager";

export function openVisitaModal(app: App, dataManager: DataManager, refresh: () => void): void {
    new VisitaModal(app, dataManager, refresh).open();
}

export function openVidaComunitariaModal(app: App, dataManager: DataManager, refresh: () => void): void {
    new VidaComunitariaModal(app, dataManager, refresh).open();
}

export function openProcesoEducativoModal(app: App, dataManager: DataManager, refresh: () => void): void {
    new ProcesoEducativoModal(app, dataManager, refresh).open();
}

export function openMaestroModal(app: App, dataManager: DataManager, refresh: () => void): void {
    new MaestroModal(app, dataManager, refresh).open();
}

export function openReunionModal(app: App, dataManager: DataManager, refresh: () => void): void {
    new ReunionModal(app, dataManager, refresh).open();
}

export function getModalOpeners(app: App, dataManager: DataManager, refresh: () => void) {
    return {
        openVisita: () => openVisitaModal(app, dataManager, refresh),
        openVidaComunitaria: () => openVidaComunitariaModal(app, dataManager, refresh),
        openProcesoEducativo: () => openProcesoEducativoModal(app, dataManager, refresh),
        openMaestro: () => openMaestroModal(app, dataManager, refresh),
        openReunion: () => openReunionModal(app, dataManager, refresh),
    };
}

export function registerViews(
    registerView: (type: string, cb: (leaf: unknown) => unknown) => void,
    settings: MiAgrupacionSettings,
    dataManager: DataManager,
    callbacks: {
        openVisita: () => void;
        openVidaComunitaria: () => void;
        openProcesoEducativo: () => void;
        openMaestro: () => void;
        openReunion: () => void;
        openStandalone: (type: string) => void;
    }
): void {
    registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf as never, settings, dataManager, callbacks));
    registerView(VIEW_TYPE_GENERAL, (leaf) => new GeneralView(leaf as never, settings, dataManager, () => {}));
    registerView(VIEW_TYPE_RESUMEN_SRP, (leaf) => new ResumenSRPView(leaf as never, settings, dataManager, () => {}));
    registerView(VIEW_TYPE_CAMPANA, (leaf) => new CampanaView(leaf as never, settings, dataManager, () => {}));
}
