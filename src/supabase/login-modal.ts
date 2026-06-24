import { App, Modal, Setting, Notice } from "obsidian";
import { login, signup } from "./client";

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
            text:
                this.mode === "login" ? "Iniciar sesión" : "Registrarse",
        });

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
                t.setPlaceholder("••••••••");
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
            text:
                this.mode === "login"
                    ? "Crear cuenta"
                    : "Ya tengo cuenta",
        });
        toggleBtn.addEventListener("click", () => {
            this.mode =
                this.mode === "login" ? "register" : "login";
            this.onOpen();
        });

        const cancelBtn = actions.createEl("button", {
            text: "Cancelar",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const submitBtn = actions.createEl("button", {
            text:
                this.mode === "login" ? "Ingresar" : "Registrarse",
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
                        new Notice("Cuenta creada. Sesión iniciada.");
                        this.onSuccess(this.email);
                        this.close();
                    } else {
                        new Notice("Cuenta creada. Revisá tu email para confirmar.");
                        this.mode = "login";
                        this.onOpen();
                    }
                } else {
                    new Notice(res.error || "Error al registrar");
                }
            } else {
                const res = await login(this.email, this.password);
                if (res.success) {
                    this.onSuccess(this.email);
                    this.close();
                } else {
                    new Notice(res.error || "Error al iniciar sesión");
                }
            }
        } finally {
            this.submitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
