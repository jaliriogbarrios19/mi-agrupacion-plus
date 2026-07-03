import { Setting, Notice } from "obsidian";
import type { SettingsContext } from "./setup-wizard";
import {
    isLoggedIn,
    getSession,
    logout,
    isSessionExpired,
    isVaultAdmin,
} from "../supabase/client";
import { rpcGenerateInvitation, rpcGetPendingUsers, rpcApproveUser } from "../supabase/rpc";
import { LoginModal } from "../supabase/login-modal";
import { renderMetasCiclo } from "./admin-metas";

export function renderAdminPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName(ctx.settings.vaultName || "Mi Agrupación");

    new Setting(containerEl)
        .setName("Nombre de la agrupación")
        .setDesc("Aparece en el dashboard y reportes")
        .addText((text) =>
            text
                .setValue(ctx.settings.nombreAgrupacion)
                .onChange((value) => {
                    void (async () => {
                        ctx.settings.nombreAgrupacion = value;
                        await ctx.saveFn();
                    })();
                })
        );

    renderSectores(ctx, containerEl);
    renderInvitation(ctx, containerEl);
    renderSyncSettings(ctx, containerEl);
    renderMetasCiclo(ctx, containerEl);
    renderSession(ctx, containerEl);
    renderPendingUsers(ctx, containerEl);
    renderFooter(containerEl);
}

function renderSectores(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Sectores");
    containerEl.createEl("p", { text: "Separá los sectores con coma. Ej: Norte, Sur, Este" });
    new Setting(containerEl)
        .setName("Sectores")
        .addTextArea((text) => {
            text
                .setValue(ctx.settings.sectores.join(", "))
                .setPlaceholder("General, Norte, Sur")
                .onChange((value) => {
                    void (async () => {
                        ctx.settings.sectores = value.split(",").map((s) => s.trim()).filter(Boolean);
                        await ctx.saveAndSyncSectores();
                    })();
                });
            text.inputEl.addClass("mi-agrupacion-full-width");
            text.inputEl.rows = 3;
        });
}

function renderInvitation(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName("Compartir agrupación");
    const codeDiv = containerEl.createDiv({ cls: "mi-agrupacion-card" });
    codeDiv.createEl("p", { text: "Generá un código para que tus auxiliares se unan a tu agrupación." });
    const codeDisplay = codeDiv.createDiv({ cls: "mi-agrupacion-code-display" });
    codeDisplay.createEl("code", { text: "Código no generado" });

    new Setting(codeDiv)
        .addButton((btn) =>
            btn.setButtonText("Generar código").setCta().onClick(() => {
                void (async () => {
                    btn.setDisabled(true);
                    const res = await rpcGenerateInvitation(ctx.settings.vaultId);
                    if (res.success && res.code) {
                        codeDisplay.empty();
                        codeDisplay.createEl("code", { text: res.code }).addClass("mi-agrupacion-code-display-bold");
                        new Setting(codeDiv).addButton((copyBtn) =>
                            copyBtn.setButtonText("Copiar").onClick(() => {
                                void (async () => {
                                    try {
                                        await navigator.clipboard.writeText(res.code!);
                                        new Notice("Código copiado");
                                    } catch {
                                        const ta = activeDocument.createElement("textarea");
                                        ta.value = res.code!;
                                        ta.addClass("mi-agrupacion-hidden-textarea");
                                        activeDocument.body.appendChild(ta);
                                        ta.select();
                                        try {
                                            activeDocument.execCommand("copy");
                                            new Notice("Código copiado");
                                        } catch {
                                            new Notice("No se pudo copiar. Seleccioná el código manualmente.");
                                        }
                                        activeDocument.body.removeChild(ta);
                                    }
                                })();
                            })
                        );
                    } else {
                        new Notice(res.error || "Error al generar código");
                    }
                    btn.setDisabled(false);
                })();
            })
        );
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
                btn.setButtonText("Subir y bajar").setCta().onClick(() => {
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

function renderPendingUsers(ctx: SettingsContext, containerEl: HTMLElement): void {
    if (!isLoggedIn() || !ctx.settings.vaultId) return;

    const section = containerEl.createDiv();
    new Setting(section).setHeading().setName("Usuarios pendientes de aprobación");

    const listContainer = section.createDiv({ cls: "mi-agrupacion-card" });
    listContainer.createEl("p", { text: "Cargando..." });

    void (async () => {
        const isAdmin = await isVaultAdmin(ctx.settings.vaultId);
        if (!isAdmin) {
            section.remove();
            return;
        }

        const pending = await rpcGetPendingUsers();
        listContainer.empty();

        if (pending.length === 0) {
            listContainer.createEl("p", { text: "No hay usuarios pendientes.", cls: "mi-agrupacion-stat" });
            return;
        }

        for (const user of pending) {
            const row = listContainer.createDiv({ cls: "mi-agrupacion-pending-user-row" });
            const info = row.createDiv();
            info.createEl("span", { text: user.email });
            const date = new Date(user.created_at).toLocaleDateString("es-AR");
            info.createEl("span", { text: ` — registrado el ${date}`, cls: "mi-agrupacion-stat" });

            const approveBtn = row.createEl("button", { text: "Aprobar" });
            approveBtn.addClass("mod-cta");
            approveBtn.addEventListener("click", () => {
                void (async () => {
                    approveBtn.disabled = true;
                    const res = await rpcApproveUser(user.user_id);
                    if (res.success) {
                        new Notice(`${user.email} aprobado`);
                        row.remove();
                    } else {
                        new Notice(res.error || "Error al aprobar");
                        approveBtn.disabled = false;
                    }
                })();
            });
        }
    })();
}

function renderFooter(containerEl: HTMLElement): void {
    containerEl.createEl("hr");
    containerEl.createEl("p", { text: "Mi Agrupacion Plus v1.0.0 — Plugin centralizado de registro de actividades bahá'ís" });
}
