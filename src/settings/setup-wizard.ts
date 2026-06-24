import { App, Modal, Setting, Notice } from "obsidian";
import type { MiAgrupacionSettings } from "../types";
import {
    rpcCreateVault,
    rpcResolveInvitation,
    rpcJoinVault,
} from "../supabase/rpc";
import { checkUserApproval } from "../supabase/client";
import { ConfirmModal } from "../utils/confirm";

export interface SettingsContext {
    plugin: { saveSettings: () => Promise<void>; settings: MiAgrupacionSettings; startSync: () => void };
    settings: MiAgrupacionSettings;
    saveFn: () => Promise<void>;
    saveAndSyncSectores: () => Promise<void>;
    app: App;
    render: () => void;
}

export function renderSetupWizard(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Mi Agrupacion Plus");
    containerEl.createEl("p", {
        text: "Conectate con tu agrupación en segundos. Elegí una opción:",
    });

    const adminCard = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    new Setting(adminCard).setHeading().setName("Crear agrupación");
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
                .onClick(() => {
                    void (async () => {
                        const input = adminCard.querySelector("input");
                        const name = input?.value?.trim();
                        if (!name) {
                            new Notice("Escribí el nombre de la agrupación");
                            return;
                        }
                        btn.setDisabled(true);

                        const approved = await checkUserApproval();
                        if (!approved) {
                            showAdminPendingApproval(ctx.app);
                            btn.setDisabled(false);
                            return;
                        }

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
                    })();
                })
        );

    const auxCard = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    new Setting(auxCard).setHeading().setName("Unirse a agrupación");
    auxCard.createEl("p", {
        text: "Pegá el código que te compartió tu admin para unirte a una agrupación existente.",
    });
    new Setting(auxCard)
        .setName("Código de invitación")
        .addText((t) => {
            t.setPlaceholder("Ej: MA-ABC12345");
            t.inputEl.addClass("mi-agrupacion-input-md");
        });
    new Setting(auxCard)
        .addButton((btn) =>
            btn
                .setButtonText("Unirse")
                .setCta()
                .onClick(() => {
                    void (async () => {
                        const input = auxCard.querySelector("input");
                        const code = input?.value?.trim().replace(/[\u200B\uFEFF\u00A0\r\n]/g, '').toUpperCase();
                        if (!code || !/^MA-[A-Z0-9]{8}$/.test(code)) {
                            new Notice("Código inválido. Debe tener formato MA-XXXXXXXX");
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
                            ctx.plugin.startSync();
                        } else {
                            new Notice(join.error || "Error al unirse");
                            btn.setDisabled(false);
                        }
                    })();
                })
        );

    const loginCard = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    new Setting(loginCard)
        .setName("¿Ya tenés cuenta?")
        .setDesc("Iniciá sesión para conectarte a tu agrupación existente")
        .addButton((btn) =>
            btn
                .setButtonText("Iniciar sesión")
                .setCta()
                .onClick(() => {
                    void (async () => {
                        const { LoginModal } = await import("../supabase/login-modal");
                        const { getSession, findUserVault } = await import("../supabase/client");
                        new LoginModal(ctx.app, (email: string) => {
                            void (async () => {
                                const session = getSession();
                                ctx.settings.authToken = session.token;
                                ctx.settings.authEmail = email;
                                ctx.settings.authRefreshToken = session.refresh;
                                const vault = await findUserVault();
                                if (vault) {
                                    ctx.settings.vaultId = vault.vaultId;
                                    ctx.settings.vaultName = vault.vaultName;
                                    ctx.settings.setupMode = vault.role === "admin" ? "admin" : "auxiliar";
                                    new Notice(`Conectado a "${vault.vaultName}" como ${vault.role}`);
                                }
                                await ctx.saveFn();
                                ctx.render();
                            })();
                        }).open();
                    })();
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
                .onChange((value) => {
                    void (async () => {
                        ctx.settings.syncInterval = parseInt(value, 10);
                        await ctx.saveFn();
                    })();
                })
        );

    new Setting(containerEl).setHeading().setName("Sesión");
    if (ctx.settings.authToken) {
        new Setting(containerEl)
            .setName(`Conectado como ${ctx.settings.authEmail}`)
            .addButton((btn) =>
                btn.setButtonText("Cerrar sesión").onClick(() => {
                    void (async () => {
                        ctx.settings.authToken = "";
                        ctx.settings.authEmail = "";
                        ctx.settings.authRefreshToken = "";
                        await ctx.saveFn();
                        new Notice("Sesión cerrada");
                        ctx.render();
                    })();
                })
            );
    } else {
        new Setting(containerEl)
            .setName("Iniciá sesión para sincronizar")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    void (async () => {
                        const { LoginModal } = await import("../supabase/login-modal");
                        const { getSession } = await import("../supabase/client");
                        new LoginModal(ctx.app, (email: string) => {
                            void (async () => {
                                const session = getSession();
                                ctx.settings.authToken = session.token;
                                ctx.settings.authEmail = email;
                                ctx.settings.authRefreshToken = session.refresh;
                                const { findUserVault } = await import("../supabase/client");
                                const vault = await findUserVault();
                                if (vault) {
                                    ctx.settings.vaultId = vault.vaultId;
                                    ctx.settings.vaultName = vault.vaultName;
                                    ctx.settings.setupMode = vault.role === "admin" ? "admin" : "auxiliar";
                                    new Notice(`Conectado a "${vault.vaultName}" como ${vault.role}`);
                                }
                                await ctx.saveFn();
                                ctx.render();
                                if (ctx.settings.vaultId) {
                                    ctx.plugin.startSync();
                                }
                            })();
                        }).open();
                    })();
                })
            );
    }

    new Setting(containerEl).setHeading().setName("Configuración");
    new Setting(containerEl)
        .setName("Cambiar agrupación")
        .setDesc("Desconectate de esta agrupación y unite a otra o creá una nueva")
        .addButton((btn) =>
            btn.setButtonText("Cambiar modo").onClick(() => {
                void new ConfirmModal(
                    ctx.app,
                    "¿Estás seguro de desconectarte de esta agrupación? Tus datos locales no se perderán, pero perderás la conexión con la nube.",
                ).show().then((confirmed) => {
                    if (!confirmed) return;
                    void (async () => {
                        ctx.settings.vaultId = "";
                        ctx.settings.vaultName = "";
                        ctx.settings.setupMode = "";
                        await ctx.saveFn();
                        new Notice("Desconectado. Elegí una nueva agrupación.");
                        ctx.render();
                    })();
                });
            })
        );
}

function showAdminPendingApproval(app: App): void {
    const modal = new Modal(app);
    modal.contentEl.addClass("mi-agrupacion-modal");

    modal.contentEl.createEl("h3", { text: "Aprobación requerida para crear agrupación" });

    modal.contentEl.createEl("p", {
        text: "Para crear una agrupación necesitamos verificar que sos parte de la comunidad bahá'í. Los auxiliares no necesitan este paso — solo los administradores.",
        cls: "mi-agrupacion-stat",
    });

    const contactCard = modal.contentEl.createDiv({ cls: "mi-agrupacion-card" });
    contactCard.createEl("p", { text: "Enviá un correo a:" });
    contactCard.createEl("p", {
        text: "jaliriogbarrios@gmail.com",
        cls: "mi-agrupacion-pending-email",
    });
    contactCard.createEl("p", {
        text: "Indicando tu nombre, localidad y comunidad bahá'í a la que pertenecés.",
    });

    new Setting(modal.contentEl)
        .addButton((btn) =>
            btn.setButtonText("Cerrar").onClick(() => { modal.close(); })
        );

    modal.open();
}
