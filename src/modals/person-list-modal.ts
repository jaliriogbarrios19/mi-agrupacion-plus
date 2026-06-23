import { Modal, App } from "obsidian";

export class PersonListModal extends Modal {
    private title: string;
    private names: string[];
    private searchQuery = "";

    constructor(app: App, title: string, names: string[]) {
        super(app);
        this.title = title;
        this.names = names;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass("mi-agrupacion-modal");
        contentEl.createEl("h3", { text: `${this.title} (${this.names.length})` });
        const searchInput = contentEl.createEl("input", {
            type: "text",
            placeholder: "Buscar...",
        });
        searchInput.addClass("mi-agrupacion-full-width");
        const listContainer = contentEl.createDiv();

        searchInput.addEventListener("input", () => {
            this.searchQuery = searchInput.value;
            this.renderList(listContainer);
        });

        this.renderList(listContainer);
    }

    private renderList(container: HTMLElement): void {
        container.empty();
        const q = this.searchQuery.toLowerCase();
        const filtered = q
            ? this.names.filter(n => n.toLowerCase().includes(q))
            : this.names;

        if (filtered.length === 0) {
            container.createEl("p", {
                text: "No se encontró el dato suministrado",
                cls: "mi-agrupacion-stat",
            });
            return;
        }

        for (const name of filtered) {
            const row = container.createDiv({ cls: "mi-agrupacion-record-row" });
            row.createSpan({ text: name });
        }
    }

    onClose(): void { this.contentEl.empty(); }
}
