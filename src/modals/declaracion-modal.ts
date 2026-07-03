import { App, Modal, Setting, Notice, TFile } from "obsidian";
import { DataManager } from "../data/manager";
import { detectarCiclo } from "../utils/ciclo";
import { generateId, parseDate } from "../utils/date";
import { declaracionTemplate } from "../data/templates";
import type { Declaracion } from "../types";

export class DeclaracionModal extends Modal {
    private dataManager: DataManager;
    private onSaved: () => void;
    private editFile: TFile | null = null;
    private editId = "";
    private nombre = "";
    private apellido = "";
    private fechaStr = "";

    constructor(app: App, dataManager: DataManager, onSaved: () => void, editFile?: TFile) {
        super(app);
        this.dataManager = dataManager;
        this.onSaved = onSaved;
        this.editFile = editFile || null;
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName(this.editFile ? "Editar ingreso" : "Registrar ingreso").setHeading();

        let initialNombre = "";
        let initialApellido = "";
        let initialFecha = "";

        if (this.editFile) {
            try {
                const data = await this.dataManager.readRecord(this.editFile);
                initialNombre = String(data.nombre || "");
                initialApellido = String(data.apellido || "");
                initialFecha = String(data.fecha_declaracion || "");
                this.editId = String(data.id || "");
                this.nombre = initialNombre;
                this.apellido = initialApellido;
                this.fechaStr = initialFecha;
            } catch { /* fall through with empty defaults */ }
        }

        new Setting(contentEl)
            .setName("Nombre")
            .addText((text) => {
                text.setValue(initialNombre).setPlaceholder("Juan");
                text.onChange((v) => { this.nombre = v.trim(); });
            });

        new Setting(contentEl)
            .setName("Apellido")
            .addText((text) => {
                text.setValue(initialApellido).setPlaceholder("García");
                text.onChange((v) => { this.apellido = v.trim(); });
            });

        new Setting(contentEl)
            .setName("Fecha de declaración")
            .addText((text) => {
                text.setValue(initialFecha).setPlaceholder("DD/MM/AAAA");
                text.onChange((v) => { this.fechaStr = v.trim(); });
            });

        new Setting(contentEl)
            .addButton((btn) => {
                btn.setButtonText(this.editFile ? "Actualizar" : "Guardar")
                    .setCta()
                    .onClick(() => { void this.guardar(); });
            })
            .addButton((btn) => {
                btn.setButtonText("Cancelar").onClick(() => this.close());
            });
    }

    private async guardar(): Promise<void> {
        if (!this.nombre || !this.apellido || !this.fechaStr) {
            new Notice("Nombre, apellido y fecha son obligatorios");
            return;
        }

        const fechaDecl = parseDate(this.fechaStr);
        const cicloInfo = detectarCiclo(fechaDecl);
        const frontmatter: Record<string, unknown> = {
            id: this.editId || generateId(),
            nombre: this.nombre,
            apellido: this.apellido,
            fecha_declaracion: this.fechaStr,
            reportado_por: "",
        };

        const body = declaracionTemplate(frontmatter as unknown as Declaracion);

        try {
            if (this.editFile) {
                await this.dataManager.updateRecord(this.editFile, frontmatter, body);
            } else {
                await this.dataManager.saveDeclaracion(frontmatter, cicloInfo.anioEtiqueta, cicloInfo.ciclo);
            }
            new Notice(this.editFile ? "Ingreso actualizado" : "Ingreso registrado");
            this.onSaved();
            this.close();
        } catch (e) {
            console.error("Mi Agrupacion — guardar declaracion:", e);
            new Notice("Error al guardar");
        }
    }
}
