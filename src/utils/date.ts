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

export function getWeekId(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getWeekEnd(date: Date): Date {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
}

export function getBiweekLabel(date: Date): string {
    const month = date.getMonth();
    const day = date.getDate();
    const period = day <= 15 ? "1" : "2";
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `1-15 ${months[month]}` + (period === "2" ? ` / 16-${new Date(date.getFullYear(), month + 1, 0).getDate()} ${months[month]}` : "");
}

export function getMonthLabel(date: Date): string {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function generateId(): string {
    return crypto.randomUUID();
}

export function timestampForFile(): string {
    return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
