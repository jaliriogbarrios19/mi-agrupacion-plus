export interface RateLimitResult {
    allowed: boolean;
    reason?: string;
}

interface WindowCounter {
    count: number;
    windowStart: number;
}

const WINDOWS = {
    push_per_hour: { max: 100, ms: 3600_000 },
    delete_per_hour: { max: 20, ms: 3600_000 },
    sync_per_minute: { max: 60, ms: 60_000 },
} as const;

type Operation = keyof typeof WINDOWS;

const counters = new Map<string, WindowCounter>();

function checkLimit(key: string, max: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const counter = counters.get(key);

    if (!counter || now - counter.windowStart > windowMs) {
        counters.set(key, { count: 1, windowStart: now });
        return { allowed: true };
    }

    if (counter.count >= max) {
        const resetIn = Math.ceil((windowMs - (now - counter.windowStart)) / 60_000);
        return { allowed: false, reason: `Límite alcanzado. Intentá de nuevo en ${resetIn} min.` };
    }

    counter.count++;
    return { allowed: true };
}

export function checkRateLimit(operation: Operation): RateLimitResult {
    const rule = WINDOWS[operation];
    return checkLimit(`global:${operation}`, rule.max, rule.ms);
}

export function validateContent(content: string): RateLimitResult {
    if (content.length < 10) {
        return { allowed: false, reason: "Nota demasiado corta (mínimo 10 caracteres)." };
    }

    if (content.length > 1_000_000) {
        return { allowed: false, reason: "Nota demasiado grande (máximo 1MB)." };
    }

    return { allowed: true };
}

export function resetRateLimits(): void {
    counters.clear();
}
