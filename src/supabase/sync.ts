import { type App, Notice } from "obsidian";
import { restGet, restInsertOrUpdate, restDelete, isLoggedIn, getVaultSectores, setVaultSectores, checkApprovalCached } from "./client";
import { PullHandler, type SyncState } from "./sync-pull";
import { PushHandler } from "./sync-push";
import { ConfirmModal } from "../utils/confirm";
import { PromptModal } from "../utils/prompt-modal";

export class SyncManager {
    private app: App;
    private vaultId: string;
    private vaultName: string;
    private pullInterval: number | null = null;
    private syncIntervalMs = 0;
    private onStatusChange: (text: string) => void;
    private onSectoresUpdate: (sectores: string[]) => void;
    private defaultSectores: string[];
    private state: SyncState;
    private pullHandler: PullHandler;
    private pushHandler: PushHandler;
    private syncing = false;
    private isAdmin = false;
    public isPulling = false;

    constructor(
        app: App,
        vaultId: string,
        vaultName: string,
        onStatusChange: (text: string) => void,
        syncFolders: string[] = ["Registros"],
        onSectoresUpdate: (sectores: string[]) => void = () => {},
        defaultSectores: string[] = [],
        isAdmin = false
    ) {
        this.app = app;
        this.vaultId = vaultId;
        this.vaultName = vaultName;
        this.onStatusChange = onStatusChange;
        this.onSectoresUpdate = onSectoresUpdate;
        this.defaultSectores = defaultSectores;
        this.isAdmin = isAdmin;
        this.state = {
            vaultReady: false,
            lastPullAt: "",
            currentSectores: [...defaultSectores],
        };
        this.pullHandler = new PullHandler(
            app, vaultId, syncFolders,
            onStatusChange, onSectoresUpdate,
            () => this.ensureVault(),
            defaultSectores
        );
        this.pushHandler = new PushHandler(
            app, vaultId, syncFolders, onStatusChange
        );
        this.pullHandler.setPushHandler(this.pushHandler);
    }

    start(syncIntervalMinutes: number): void {
        this.syncIntervalMs = syncIntervalMinutes * 60 * 1000;
        void this.ensureVault().then((ok) => {
            if (!ok) return;
            this.state.vaultReady = true;
            this.pushHandler.registerVaultEvents(() => this.state.vaultReady);
            if (this.syncIntervalMs > 0) {
                this.pullInterval = window.setInterval(
                    () => { void this.pullChanges(); },
                    this.syncIntervalMs
                );
            }
            void this.pullChanges();
        });
    }

    private async ensureVault(): Promise<boolean> {
        try {
            const existing = await restGet<{ id: string }>(
                "vaults",
                { id: `eq.${this.vaultId}`, select: "id" }
            );
            if (existing.length === 0) {
                this.onStatusChange("⚠️ Agrupación no encontrada");
                return false;
            }
            const sectores = await getVaultSectores(this.vaultId);
            if (sectores.length > 0) {
                this.state.currentSectores = sectores;
                this.onSectoresUpdate(sectores);
            } else if (this.defaultSectores.length > 0) {
                this.state.currentSectores = this.defaultSectores;
                await setVaultSectores(this.vaultId, this.defaultSectores);
                this.onSectoresUpdate(this.defaultSectores);
            }
            return true;
        } catch (e) {
            console.error("Mi Agrupacion Plus — ensureVault failed:", e instanceof Error ? e.message : String(e));
            this.onStatusChange("⚠️ Error de conexión");
            return false;
        }
    }

    stop(): void {
        if (this.pullInterval) {
            window.clearInterval(this.pullInterval);
            this.pullInterval = null;
        }
    }

    async pullChanges(): Promise<number> {
        if (this.syncing) return 0;
        if (!isLoggedIn()) return 0;
        if (this.isAdmin) {
            const approved = await checkApprovalCached();
            if (!approved) {
                this.onStatusChange("⚠️ Pendiente de aprobación");
                return 0;
            }
        }
        this.syncing = true;
        this.isPulling = true;
        try {
            return await this.pullHandler.pullChanges();
        } finally {
            this.isPulling = false;
            this.syncing = false;
        }
    }

    async pushNow(): Promise<void> {
        if (this.syncing) return;
        this.syncing = true;
        try {
            await this._pushNow();
        } finally {
            this.syncing = false;
        }
    }

    private async _pushNow(): Promise<void> {
        if (!isLoggedIn()) {
            new Notice("Iniciá sesión primero para sincronizar");
            return;
        }
        if (this.isAdmin) {
            const approved = await checkApprovalCached();
            if (!approved) {
                new Notice("Tu cuenta está pendiente de aprobación.");
                return;
            }
        }
        if (!this.state.vaultReady) {
            const ok = await this.ensureVault();
            if (!ok) {
                if (!isLoggedIn()) {
                    new Notice("Sesión expirada. Cerrá sesión y volvé a iniciar.");
                } else {
                    new Notice("No se pudo conectar al servidor. Intentá de nuevo más tarde.");
                }
                this.onStatusChange("⚠️ Error de conexión");
                return;
            }
            this.state.vaultReady = true;
        }
        this.onStatusChange("↑ Sincronizando...");
        this.pushHandler.clearQueue();
        const files = this.app.vault.getMarkdownFiles();
        if (files.length === 0) {
            new Notice("No se encontraron archivos. Si estás en mobile, esperá unos segundos y reintentá.");
            this.onStatusChange("☁️ Conectado");
            return;
        }
        let pushed = 0;
        let skipped = 0;
        for (const file of files) {
            if (this.pushHandler.isExcluded(file.path)) continue;
            try {
                const content = await this.app.vault.cachedRead(file);
                const ok = await restInsertOrUpdate(
                    "notes",
                    {
                        vault_id: this.vaultId,
                        path: file.path,
                        content,
                        updated_at: new Date().toISOString(),
                    },
                    { vault_id: this.vaultId, path: file.path }
                );
                if (ok) pushed++; else skipped++;
            } catch {
                skipped++;
            }
            if (pushed % 10 === 0 && pushed > 0) {
                this.onStatusChange(`↑ ${pushed}/${files.length}`);
            }
        }
        const pulled = await this.pullChanges();
        new Notice(`Sync: ↑${pushed} enviados, ↓${pulled} recibidos, ${skipped} errores`);
    }

    async clearAndResync(): Promise<void> {
        if (!isLoggedIn()) {
            new Notice("Iniciá sesión primero");
            return;
        }
        // First confirmation: generic warning
        const confirmed = await new ConfirmModal(
            this.app,
            "⚠️ Esto va a BORRAR todos los registros remotos de tu agrupación y volver a subir todo desde cero.\n\n¿Estás seguro?",
            "Cancelar",
            "Sí, borrar todo"
        ).show();
        if (!confirmed) return;

        // Second confirmation: type the vault name
        const prompt = new PromptModal(
            this.app,
            `Para confirmar, escribí el nombre exacto de tu agrupación: "${this.vaultName}"`,
            this.vaultName
        );
        const typed = await prompt.prompt();
        if (typed !== this.vaultName) {
            new Notice("Nombre incorrecto. Operación cancelada.");
            return;
        }

        if (!this.state.vaultReady) {
            const ok = await this.ensureVault();
            if (!ok) { new Notice("No se pudo conectar con Supabase"); return; }
            this.state.vaultReady = true;
        }
        this.onStatusChange("🗑️ Limpiando...");
        try {
            const deleted = await restDelete("notes", { vault_id: `eq.${this.vaultId}` });
            if (!deleted) {
                this.onStatusChange("⚠️ Error al limpiar");
                new Notice("No se pudo limpiar Supabase. ¿Token expirado? Cerrá sesión y volvé a iniciar.");
                return;
            }
        } catch (e) {
            this.onStatusChange("⚠️ Error al limpiar");
            new Notice(`Error al limpiar: ${String(e).slice(0, 80)}`);
            return;
        }
        new Notice("Supabase limpio. Volviendo a subir...");
        await this.pushNow();
    }
}
