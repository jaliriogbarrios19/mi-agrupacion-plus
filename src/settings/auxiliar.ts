import { Setting, Notice } from "obsidian";
import type { SettingsContext } from "./setup-wizard";
import { isLoggedIn, getSession, logout, isSessionExpired } from "../supabase/client";
import { LoginModal } from "../supabase/login-modal";
import { ConfirmModal } from "../utils/confirm";

export function renderAuxiliarPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    // ── Agrupación header ──
    new Setting(containerEl).setHeading().setName(ctx.settings.vaultName || "Mi Agrupación");

    containerEl.createEl("p", {
        text: `Conectado a: ${ctx.settings.vaultName}`,
    });

    // ── Sync settings ──
    renderSyncSettings(ctx, containerEl);

    // ── Session ──
    renderSession(ctx, containerEl);

    // ── Change mode ──
    renderChangeMode(ctx, containerEl);

    // ── Footer ──
    renderFooter(containerEl);
}

function renderSyncSettings(ctx: SettingsContext, containerEl: HTMLElement): void {
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

    if (isLoggedIn()) {
        new Setting(containerEl)
            .setName("Sincronizar ahora")
            .addButton((btn) =>
                btn.setButtonText("Sincronizar").setCta().onClick(() => {
                    void (async () => {
                        btn.setDisabled(true);
                        try {
                            const plugin = ctx.plugin as unknown as { syncNow?: () => Promise<void> };
                            await plugin.syncNow?.();
                            new Notice("Sincronización completada");
                        } catch {
                            new Notice("Error al sincronizar");
                        }
                        btn.setDisabled(false);
                    })();
                })
            );
    }
}

function renderSession(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Sesión");

    if (isLoggedIn()) {
        const session = getSession();
        new Setting(containerEl)
            .setName(`Conectado como ${session.email}`)
            .addButton((btn) =>
                btn.setButtonText("Cerrar sesión").onClick(() => {
                    void (async () => {
                        await logout();
                        ctx.settings.authToken = "";
                        ctx.settings.authEmail = "";
                        ctx.settings.authRefreshToken = "";
                        await ctx.saveFn();
                        new Notice("Sesión cerrada");
                        ctx.render();
                    })();
                })
            );
    } else if (isSessionExpired()) {
        new Setting(containerEl)
            .setName("Sesión expirada")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    new LoginModal(ctx.app, (email) => {
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
                            }
                            await ctx.saveFn();
                            ctx.render();
                            if (ctx.settings.vaultId) ctx.plugin.startSync();
                        })();
                    }).open();
                })
            );
    } else {
        new Setting(containerEl)
            .setName("Iniciá sesión para sincronizar")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    new LoginModal(ctx.app, (email) => {
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
                            }
                            await ctx.saveFn();
                            ctx.render();
                            if (ctx.settings.vaultId) ctx.plugin.startSync();
                        })();
                    }).open();
                })
            );
    }
}

function renderChangeMode(ctx: SettingsContext, containerEl: HTMLElement): void {
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

function renderFooter(containerEl: HTMLElement): void {
    containerEl.createEl("hr");
    const footer = containerEl.createDiv();
    footer.createEl("p", {
        text: "Mi Agrupacion Plus v1.0.0 — Plugin centralizado de registro de actividades bahá'ís",
    });
}
