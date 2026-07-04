export function formatDate(date: Date): string {
    const dayStr = String(date.getDate());
    const monStr = String(date.getMonth() + 1);
    const d = dayStr.padStart(2, "0");
    const m = monStr.padStart(2, "0");
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
