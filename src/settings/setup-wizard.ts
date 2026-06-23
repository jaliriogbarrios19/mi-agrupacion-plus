import { App, Setting, Notice } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import {
    rpcCreateVault,
    rpcResolveInvitation,
    rpcJoinVault,
} from "../supabase/rpc";

export interface SettingsContext {
    plugin: { saveSettings: () => Promise<void>; settings: MiAgrupacionSettings };
    settings: MiAgrupacionSettings;
    saveFn: () => Promise<void>;
    saveAndSyncSectores: () => Promise<void>;
    app: App;
    render: () => void;
}

export function renderSetupWizard(ctx: SettingsContext, containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Mi Agrupacion Plus" });
    containerEl.createEl("p", {
        text: "Conectate con tu agrupación en segundos. Elegí una opción:",
    });

    const adminCard = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    adminCard.createEl("h4", { text: "Crear agrupación" });
    adminCard.createEl("p", {
        text: "Sos el admin de tu agrupación. Creá una nueva y compartí el código con tus auxiliares.",
    });
    new Setting(adminCard)
        .setName("Nombre de la agrupación")
        .addText((t) =>
            t.setPlaceholder("Ej: Agrupación Caracas").onChange(() => {})
        );
    new Setting(adminCard)
        .addButton((btn) =>
            btn
                .setButtonText("Crear agrupación")
                .setCta()
                .onClick(async () => {
                    const input = adminCard.querySelector("input");
                    const name = input?.value?.trim();
                    if (!name) {
                        new Notice("Escribí el nombre de la agrupación");
                        return;
                    }
                    btn.setDisabled(true);
                    const res = await rpcCreateVault(name);
                    if (res.success && res.vaultId) {
                        ctx.settings.vaultId = res.vaultId;
                        ctx.settings.vaultName = name;
                        ctx.settings.setupMode = "admin";
                        ctx.settings.sectores = ["General"];
                        await ctx.saveFn();
                        new Notice(`Agrupación "${name}" creada`);
                        ctx.render();
                    } else {
                        new Notice(res.error || "Error al crear agrupación");
                        btn.setDisabled(false);
                    }
                })
        );

    const auxCard = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    auxCard.createEl("h4", { text: "Unirse a agrupación" });
    auxCard.createEl("p", {
        text: "Pegá el código que te compartió tu admin para unirte a una agrupación existente.",
    });
    new Setting(auxCard)
        .setName("Código de invitación")
        .addText((t) => {
            t.setPlaceholder("Ej: MA-ABC12345");
            t.inputEl.style.width = "200px";
        });
    new Setting(auxCard)
        .addButton((btn) =>
            btn
                .setButtonText("Unirse")
                .setCta()
                .onClick(async () => {
                    const input = auxCard.querySelector("input");
                    const code = input?.value?.trim();
                    if (!code) {
                        new Notice("Pegá el código de invitación");
                        return;
                    }
                    btn.setDisabled(true);
                    const resolve = await rpcResolveInvitation(code);
                    if (!resolve.success || !resolve.vaultId) {
                        new Notice(resolve.error || "Código inválido");
                        btn.setDisabled(false);
                        return;
                    }
                    const join = await rpcJoinVault(code);
                    if (join.success) {
                        ctx.settings.vaultId = resolve.vaultId;
                        ctx.settings.vaultName = resolve.vaultName || "";
                        ctx.settings.setupMode = "auxiliar";
                        ctx.settings.sectores = ["General"];
                        await ctx.saveFn();
                        new Notice(`Te uniste a "${resolve.vaultName}"`);
                        ctx.render();
                    } else {
                        new Notice(join.error || "Error al unirse");
                        btn.setDisabled(false);
                    }
                })
        );
}

export function renderAuxiliarPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName(ctx.settings.vaultName || "Mi Agrupación");
    containerEl.createEl("p", { text: `Conectado a: ${ctx.settings.vaultName}` });

    new Setting(containerEl).setHeading().setName("Sincronización");
    new Setting(containerEl)
        .setName("Intervalo de sync")
        .setDesc("Minutos entre sincronizaciones automáticas (0 = manual)")
        .addDropdown((dropdown) =>
            dropdown
                .addOption("0", "Manual")
                .addOption("1", "1 minuto")
                .addOption("2", "2 minutos")
                .addOption("5", "5 minutos")
                .addOption("10", "10 minutos")
                .setValue(String(ctx.settings.syncInterval))
                .onChange(async (value) => {
                    ctx.settings.syncInterval = parseInt(value, 10);
                    await ctx.saveFn();
                })
        );

    new Setting(containerEl).setHeading().setName("Sesión");
    if (ctx.settings.authToken) {
        new Setting(containerEl)
            .setName(`Conectado como ${ctx.settings.authEmail}`)
            .addButton((btn) =>
                btn.setButtonText("Cerrar sesión").onClick(async () => {
                    ctx.settings.authToken = "";
                    ctx.settings.authEmail = "";
                    ctx.settings.authRefreshToken = "";
                    await ctx.saveFn();
                    new Notice("Sesión cerrada");
                    ctx.render();
                })
            );
    } else {
        new Setting(containerEl)
            .setName("Iniciá sesión para sincronizar")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    const { LoginModal } = require("../supabase/login-modal");
                    new LoginModal(ctx.app, async (email: string) => {
                        ctx.settings.authEmail = email;
                        await ctx.saveFn();
                        ctx.render();
                    }).open();
                })
            );
    }

    new Setting(containerEl).setHeading().setName("Configuración");
    new Setting(containerEl)
        .setName("Cambiar agrupación")
        .setDesc("Desconectate de esta agrupación y unite a otra o creá una nueva")
        .addButton((btn) =>
            btn.setButtonText("Cambiar modo").setWarning().onClick(async () => {
                ctx.settings.vaultId = "";
                ctx.settings.vaultName = "";
                ctx.settings.setupMode = "";
                await ctx.saveFn();
                new Notice("Desconectado. Elegí una nueva agrupación.");
                ctx.render();
            })
        );
}
