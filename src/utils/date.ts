export function formatDate(date: Date): string {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const d = day < 10 ? `0${day}` : `${day}`;
    const m = month < 10 ? `0${month}` : `${month}`;
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

export function parseDate(str: string): Date {
    const [d, m, y] = str.split("/").map(Number);
    return new Date(y, m - 1, d);
}

export function generateId(): string {
    return crypto.randomUUID();
}

export function timestampForFile(): string {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
