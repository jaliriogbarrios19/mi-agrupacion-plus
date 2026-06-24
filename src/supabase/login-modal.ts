import { App, Modal, Setting, Notice } from "obsidian";
import { login, signup, logout, checkUserApproval, invalidateApprovalCache } from "./client";

export class LoginModal extends Modal {
    private onSuccess: (email: string) => void;
    private mode: "login" | "register" = "login";
    private email = "";
    private password = "";
    private submitting = false;

    constructor(app: App, onSuccess: (email: string) => void) {
        super(app);
        this.onSuccess = onSuccess;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", {
            text: this.mode === "login" ? "Iniciar sesión" : "Registrarse",
        });

        if (this.mode === "register") {
            contentEl.createEl("p", {
                text: "Creá tu cuenta para sincronizar tus datos con la nube.",
                cls: "mi-agrupacion-stat",
            });
        }

        const form = contentEl.createDiv({ cls: "mi-agrupacion-form" });
        let submitBtnRef: HTMLButtonElement | undefined;

        new Setting(form)
            .setName("Email")
            .addText((t) => {
                t.setPlaceholder("correo@ejemplo.com");
                t.inputEl.type = "email";
                t.inputEl.setAttribute("inputmode", "email");
                t.onChange((v) => { this.email = v.trim(); });
            });

        new Setting(form)
            .setName("Contraseña")
            .addText((t) => {
                t.setPlaceholder("Mínimo 6 caracteres");
                t.inputEl.type = "password";
                t.onChange((v) => { this.password = v; });
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") { void this.submit(submitBtnRef); }
                });
            });

        const actions = contentEl.createDiv({
            cls: "mi-agrupacion-form-actions",
        });

        const toggleBtn = actions.createEl("button", {
            text: this.mode === "login" ? "Crear cuenta" : "Ya tengo cuenta",
        });
        toggleBtn.addEventListener("click", () => {
            this.mode = this.mode === "login" ? "register" : "login";
            this.onOpen();
        });

        const cancelBtn = actions.createEl("button", {
            text: "Cancelar",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const submitBtn = actions.createEl("button", {
            text: this.mode === "login" ? "Ingresar" : "Registrarse",
            cls: "mod-cta",
        });
        submitBtnRef = submitBtn;
        submitBtn.addEventListener("click", () => { void this.submit(submitBtn); });
    }

    private async submit(submitBtn?: HTMLButtonElement): Promise<void> {
        if (this.submitting) return;
        if (!this.email || !this.password) {
            new Notice("Completá email y contraseña");
            return;
        }
        if (this.password.length < 6) {
            new Notice("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        this.submitting = true;
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (this.mode === "register") {
                const res = await signup(this.email, this.password);
                if (res.success) {
                    if (res.autoConfirmed) {
                        invalidateApprovalCache();
                        const approved = await checkUserApproval();
                        if (!approved) {
                            await logout();
                            this.showPendingApproval();
                            return;
                        }
                        new Notice("Cuenta creada. Sesión iniciada.");
                        this.onSuccess(this.email);
                        this.close();
                    } else {
                        new Notice("Cuenta creada. Revisá tu email para confirmar, luego iniciá sesión.");
                        this.mode = "login";
                        this.onOpen();
                    }
                } else {
                    new Notice(res.error || "Error al registrar");
                }
            } else {
                const res = await login(this.email, this.password);
                if (res.success) {
                    invalidateApprovalCache();
                    const approved = await checkUserApproval();
                    if (!approved) {
                        await logout();
                        this.showPendingApproval();
                        return;
                    }
                    this.onSuccess(this.email);
                    this.close();
                } else {
                    new Notice(res.error || "Error al iniciar sesión");
                }
            }
        } catch {
            new Notice("Error de conexión. Verificá tu conexión a internet.");
        } finally {
            this.submitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    private showPendingApproval(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("mi-agrupacion-modal");

        contentEl.createEl("h3", { text: "Cuenta pendiente de aprobación" });

        contentEl.createEl("p", {
            text: "Tu cuenta fue creada pero aún no fue aprobada. Para acceder a la sincronización, necesitamos verificar que sos parte de la comunidad bahá'í.",
            cls: "mi-agrupacion-stat",
        });

        const contactCard = contentEl.createDiv({ cls: "mi-agrupacion-card" });
        contactCard.createEl("p", {
            text: "Enviá un correo a:",
        });
        contactCard.createEl("p", {
            text: "jaliriogbarrios@gmail.com",
            cls: "mi-agrupacion-pending-email",
        });
        contactCard.createEl("p", {
            text: "Indicando tu nombre, localidad y comunidad bahá'í a la que pertenecés.",
        });

        const actions = contentEl.createDiv({
            cls: "mi-agrupacion-form-actions",
        });

        const closeBtn = actions.createEl("button", { text: "Cerrar" });
        closeBtn.addEventListener("click", () => this.close());
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
