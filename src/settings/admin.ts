import { Setting, Notice, type App } from "obsidian";
import type { SettingsContext } from "./setup-wizard";
import {
    isLoggedIn,
    getSession,
    logout,
    isSessionExpired,
} from "../supabase/client";
import { rpcGenerateInvitation } from "../supabase/rpc";
import { LoginModal } from "../supabase/login-modal";

export function renderAdminPanel(ctx: SettingsContext, containerEl: HTMLElement): void {
    new Setting(containerEl).setHeading().setName(ctx.settings.vaultName || "Mi Agrupación");

    new Setting(containerEl)
        .setName("Nombre de la agrupación")
        .setDesc("Aparece en el dashboard y reportes")
        .addText((text) =>
            text
                .setValue(ctx.settings.nombreAgrupacion)
                .onChange(async (value) => {
                    ctx.settings.nombreAgrupacion = value;
                    await ctx.saveFn();
                })
        );

    renderSectores(ctx, containerEl);
    renderInvitation(ctx, containerEl);
    renderSyncSettings(ctx, containerEl);
    renderSession(ctx, containerEl);
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
                .onChange(async (value) => {
                    ctx.settings.sectores = value.split(",").map((s) => s.trim()).filter(Boolean);
                    await ctx.saveAndSyncSectores();
                });
            text.inputEl.style.width = "100%";
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
            btn.setButtonText("Generar código").setCta().onClick(async () => {
                btn.setDisabled(true);
                const res = await rpcGenerateInvitation(ctx.settings.vaultId);
                if (res.success && res.code) {
                    codeDisplay.empty();
                    codeDisplay.createEl("code", { text: res.code }).setCssStyles({ fontSize: "18px", fontWeight: "bold" });
                    new Setting(codeDiv).addButton((copyBtn) =>
                        copyBtn.setButtonText("Copiar").onClick(() => {
                            void navigator.clipboard.writeText(res.code!);
                            new Notice("Código copiado");
                        })
                    );
                } else {
                    new Notice(res.error || "Error al generar código");
                }
                btn.setDisabled(false);
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
                .onChange(async (value) => {
                    ctx.settings.syncInterval = parseInt(value, 10);
                    await ctx.saveFn();
                })
        );

    if (isLoggedIn()) {
        new Setting(containerEl)
            .setName("Sincronizar ahora")
            .addButton((btn) =>
                btn.setButtonText("Subir y bajar").setCta().onClick(() => {
                    new Notice("Sync iniciada...");
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
                btn.setButtonText("Cerrar sesión").onClick(async () => {
                    await logout();
                    ctx.settings.authToken = "";
                    ctx.settings.authEmail = "";
                    ctx.settings.authRefreshToken = "";
                    await ctx.saveFn();
                    new Notice("Sesión cerrada");
                    ctx.render();
                })
            );
    } else if (isSessionExpired()) {
        new Setting(containerEl)
            .setName("Sesión expirada")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    new LoginModal(ctx.app, async (email) => {
                        ctx.settings.authEmail = email;
                        await ctx.saveFn();
                        ctx.render();
                    }).open();
                })
            );
    } else {
        new Setting(containerEl)
            .setName("Iniciá sesión para sincronizar")
            .addButton((btn) =>
                btn.setButtonText("Iniciar sesión").setCta().onClick(() => {
                    new LoginModal(ctx.app, async (email) => {
                        ctx.settings.authEmail = email;
                        await ctx.saveFn();
                        ctx.render();
                    }).open();
                })
            );
    }
}

function renderFooter(containerEl: HTMLElement): void {
    containerEl.createEl("hr");
    containerEl.createEl("p", { text: "Mi Agrupacion Plus v1.0.0 — Plugin centralizado de registro de actividades bahá'ís" });
}
