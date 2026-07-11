import { requestUrl, type RequestUrlParam } from "obsidian";

// ── Centralized Supabase credentials ──
export const SUPABASE_URL = "https://dxrhvusvplcotwmxpbov.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cmh2dXN2cGxjb3R3bXhwYm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzg5NDUsImV4cCI6MjA5NzgxNDk0NX0.xK5H1f2BRurrU1OEl2rU623pMJKgLCuDRNs1sq3bNiU";

function translateAuthError(error: string): string {
    const translations: Record<string, string> = {
        "Invalid login credentials": "Email o contraseña incorrectos",
        "Email not confirmed": "Email no confirmado. Revisá tu bandeja de entrada",
        "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres",
        "A user with this email address has already been registered": "Ya existe una cuenta con este email",
        "Unable to validate email address: invalid format": "Formato de email inválido",
    };
    for (const en of Object.keys(translations)) {
        const es = translations[en];
        if (error.toLowerCase().includes(en.toLowerCase())) return es;
    }
    return error;
}

let accessToken = "";
let refreshToken = "";
let userEmail = "";
let sessionExpired = false;
let refreshing: Promise<boolean> | null = null;
let onTokenRefresh: ((token: string, refresh: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshTimer: number | null = null;

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes (before default 1h JWT expiry)

export function setOnTokenRefresh(cb: (token: string, refresh: string) => void): void {
    onTokenRefresh = cb;
}

export function setOnSessionExpired(cb: () => void): void {
    onSessionExpired = cb;
}

export function setSession(token: string, email: string, refresh: string = ""): void {
    accessToken = token;
    userEmail = email;
    refreshToken = refresh;
    sessionExpired = false;
}

export function clearSession(): void {
    accessToken = "";
    refreshToken = "";
    userEmail = "";
    sessionExpired = false;
    stopRefreshTimer();
}

export function markSessionExpired(): void {
    accessToken = "";
    refreshToken = "";
    sessionExpired = true;
    stopRefreshTimer();
    if (onSessionExpired) onSessionExpired();
}

export function startRefreshTimer(): void {
    stopRefreshTimer();
    if (!accessToken || sessionExpired) return;
    refreshTimer = window.setInterval(() => {
        void (async () => {
            if (!accessToken || sessionExpired) { stopRefreshTimer(); return; }
            const ok = await refreshSession();
            if (!ok) markSessionExpired();
        })();
    }, REFRESH_INTERVAL_MS);
}

export function stopRefreshTimer(): void {
    if (refreshTimer) {
        window.clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

export function isSessionExpired(): boolean {
    return sessionExpired;
}

export function getSession(): { token: string; email: string; refresh: string } {
    return { token: accessToken, email: userEmail, refresh: refreshToken };
}

export function isLoggedIn(): boolean {
    return !!accessToken;
}

function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    };
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return headers;
}

export async function api(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
): Promise<{ status: number; json: unknown }> {
    const fullUrl = `${SUPABASE_URL}${path}`;
    const params: RequestUrlParam = {
        url: fullUrl,
        method,
        headers: { ...authHeaders(), ...extraHeaders },
    };
    if (body !== undefined) {
        params.body = JSON.stringify(body);
    }

    try {
        const res = await requestUrl(params);
        let json: unknown;
        try { json = res.json; } catch { json = null; }
        return { status: res.status, json };
    } catch (e) {
        const err = e as Record<string, unknown> | undefined;
        const status = typeof err?.status === "number" ? err.status : 0;
        const json = err?.json ?? null;

        if (status === 401 && accessToken && !sessionExpired) {
            const refreshed = await refreshSession();
            if (refreshed) {
                params.headers = { ...authHeaders(), ...extraHeaders };
                try {
                    const retry = await requestUrl(params);
                    let retryJson: unknown;
                    try { retryJson = retry.json; } catch { retryJson = null; }
                    return { status: retry.status, json: retryJson };
                } catch (retryErr) {
                    const rObj = retryErr as Record<string, unknown> | undefined;
                    const rStatus = typeof rObj?.status === "number" ? rObj.status : 0;
                    return { status: rStatus, json: rObj?.json ?? null };
                }
            }
            markSessionExpired();
        }

        return { status, json };
    }
}

async function refreshSession(): Promise<boolean> {
    if (!refreshToken || refreshToken.length < 20) return false;
    if (sessionExpired) return false;
    if (refreshing) return refreshing;
    refreshing = (async () => {
        try {
            const res = await requestUrl({
                url: `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
                method: "POST",
                headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (res.status >= 200 && res.status < 300) {
                const data = res.json as { access_token: string; refresh_token: string };
                accessToken = data.access_token;
                refreshToken = data.refresh_token;
                sessionExpired = false;
                if (onTokenRefresh) onTokenRefresh(data.access_token, data.refresh_token);
                return true;
            }
        } catch { /* refresh failed */ }
        return false;
    })();
    const result = await refreshing;
    refreshing = null;
    return result;
}

export async function signup(
    email: string,
    password: string
): Promise<{ success: boolean; autoConfirmed: boolean; error?: string }> {
    try {
        const res = await api("POST", "/auth/v1/signup", { email, password });
        console.log("Mi Agrupacion Plus — signup:", res.status);
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as Record<string, unknown>;
            const hasToken = !!(data.access_token as string | undefined);
            if (hasToken) {
                const d = data as { access_token: string; refresh_token?: string; user?: { email: string } };
                accessToken = d.access_token;
                refreshToken = d.refresh_token || "";
                userEmail = d.user?.email || email;
                sessionExpired = false;
                startRefreshTimer();
            }
            return { success: true, autoConfirmed: hasToken };
        }
        const data = res.json as Record<string, unknown>;
        const raw = (data.msg as string) || "Error al registrar";
        return { success: false, autoConfirmed: false, error: translateAuthError(raw) };
    } catch {
        return { success: false, autoConfirmed: false, error: "Error de conexión. Verificá tu conexión a internet." };
    }
}

export async function login(
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    try {
        clearSession();
        const res = await api("POST", `/auth/v1/token?grant_type=password`, { email, password });
        console.log("Mi Agrupacion Plus — login:", res.status);
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as { access_token: string; refresh_token: string; user: { email: string } };
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            userEmail = data.user?.email || email;
            sessionExpired = false;
            startRefreshTimer();
            return { success: true };
        }
        const data = res.json as Record<string, unknown>;
        const raw = (data.error_description as string) || (data.msg as string) || "Credenciales inválidas";
        return { success: false, error: translateAuthError(raw) };
    } catch {
        return { success: false, error: "Error de conexión. Verificá tu conexión a internet." };
    }
}

export async function logout(): Promise<void> {
    try { await api("POST", "/auth/v1/logout"); } catch { /* ignore */ }
    clearSession();
}

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
    try {
        const res = await api("GET", "/auth/v1/user");
        if (res.status >= 200 && res.status < 300) {
            return res.json as { id: string; email: string };
        }
    } catch { /* token expired */ }
    return null;
}

// ── REST helpers ──

export async function restGet<T>(table: string, params: Record<string, string>): Promise<T[]> {
    const query = new URLSearchParams(params).toString();
    try {
        const res = await api("GET", `/rest/v1/${table}?${query}`);
        if (res.status >= 200 && res.status < 300) {
            return (res.json as T[]) || [];
        }
        console.warn(`Mi Agrupacion Plus — restGet ${table}: ${res.status}`);
        return [];
    } catch (e) {
        console.warn(`Mi Agrupacion Plus — restGet ${table} failed:`, e instanceof Error ? e.message : String(e));
        return [];
    }
}

export async function restUpsert<T>(table: string, body: T, onConflict: string): Promise<boolean> {
    try {
        const res = await api("POST", `/rest/v1/${table}?on_conflict=${onConflict}`, body, { "Prefer": "resolution=merge-duplicates" });
        if (res.status < 200 || res.status >= 300) {
            console.warn(`Mi Agrupacion Plus — restUpsert ${table} failed:`, res.status);
        }
        return res.status >= 200 && res.status < 300;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`Mi Agrupacion Plus — restUpsert ${table} error:`, msg);
        return false;
    }
}

export async function restInsertOrUpdate(
    table: string,
    body: Record<string, unknown>,
    matchParams: Record<string, string>,
): Promise<boolean> {
    // Build filter query with eq. prefix for PostgREST
    const filterParams: Record<string, string> = {};
    for (const key in matchParams) {
        const val: string = matchParams[key];
        filterParams[key] = val.startsWith("eq.") ? val : `eq.${val}`;
    }
    const query = new URLSearchParams(filterParams).toString();
    const existing = await api("GET", `/rest/v1/${table}?${query}&limit=1`);
    if (existing.status >= 200 && existing.status < 300) {
        const rows = (existing.json as unknown[]) || [];
        if (rows.length > 0) {
            const res = await api("PATCH", `/rest/v1/${table}?${query}`, body);
            if (res.status < 200 || res.status >= 300) {
                const err = res.json as Record<string, unknown> | undefined;
                const msg = (err?.message as string) || (err?.error as string) || `HTTP ${res.status}`;
                console.warn(`Mi Agrupacion Plus — PATCH ${table} failed (${res.status}):`, msg);
            }
            return res.status >= 200 && res.status < 300;
        }
    }
    const res = await api("POST", `/rest/v1/${table}`, body);
    if (res.status < 200 || res.status >= 300) {
        const err = res.json as Record<string, unknown> | undefined;
        const msg = (err?.message as string) || (err?.error as string) || `HTTP ${res.status}`;
        console.warn(`Mi Agrupacion Plus — POST ${table} failed (${res.status}):`, msg);
    }
    return res.status >= 200 && res.status < 300;
}

export async function restDelete(table: string, params: Record<string, string>): Promise<boolean> {
    const query = new URLSearchParams(params).toString();
    const res = await api("DELETE", `/rest/v1/${table}?${query}`);
    return res.status >= 200 && res.status < 300;
}

// ── Vault helpers ──

export async function getVaultSectores(vaultId: string): Promise<string[]> {
    try {
        const rows = await restGet<{ sectores: string }>("vaults", { id: `eq.${vaultId}`, select: "sectores" });
        if (rows.length > 0 && rows[0].sectores) {
            const parsed = JSON.parse(rows[0].sectores) as unknown;
            return Array.isArray(parsed) ? (parsed as string[]) : [];
        }
    } catch { /* vault or column might not exist */ }
    return [];
}

export async function setVaultSectores(vaultId: string, sectores: string[]): Promise<void> {
    await restUpsert("vaults", { id: vaultId, sectores: JSON.stringify(sectores) }, "id");
}

export async function isVaultAdmin(vaultId: string): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        const rows = await restGet<{ role: string }>("vault_members", { vault_id: `eq.${vaultId}`, user_id: `eq.${user.id}`, select: "role" });
        return rows.length > 0 && rows[0].role === "admin";
    } catch { return false; }
}

export async function findUserVault(): Promise<{ vaultId: string; vaultName: string; role: string } | null> {
    try {
        const user = await getCurrentUser();
        if (!user) return null;
        const memberships = await restGet<{ vault_id: string; role: string }>("vault_members", { user_id: `eq.${user.id}`, select: "vault_id,role" });
        if (memberships.length === 0) return null;
        const m = memberships[0];
        const vaults = await restGet<{ id: string; name: string }>("vaults", { id: `eq.${m.vault_id}`, select: "id,name" });
        if (vaults.length === 0) return null;
        return { vaultId: vaults[0].id, vaultName: vaults[0].name, role: m.role };
    } catch { return null; }
}

let approvalCache: { approved: boolean; checkedAt: number } | null = null;
const APPROVAL_CACHE_TTL_MS = 30 * 60_000;

export async function checkUserApproval(): Promise<boolean> {
    try {
        const user = await getCurrentUser();
        if (!user) return false;
        const rows = await restGet<{ approved: boolean }>("profiles", { user_id: `eq.${user.id}`, select: "approved" });
        if (rows.length === 0) {
            await restUpsert("profiles", { user_id: user.id, approved: true }, "user_id");
            approvalCache = { approved: true, checkedAt: Date.now() };
            return true;
        }
        const approved = rows[0].approved;
        approvalCache = { approved, checkedAt: Date.now() };
        return approved;
    } catch {
        return approvalCache?.approved ?? false;
    }
}

export async function checkApprovalCached(): Promise<boolean> {
    if (approvalCache && Date.now() - approvalCache.checkedAt < APPROVAL_CACHE_TTL_MS) {
        return approvalCache.approved;
    }
    return checkUserApproval();
}

export function invalidateApprovalCache(): void {
    approvalCache = null;
}
