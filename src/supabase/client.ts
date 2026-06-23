import { requestUrl, type RequestUrlParam } from "obsidian";

// ── Centralized Supabase credentials ──
export const SUPABASE_URL = "https://dxrhvusvplcotwmxpbov.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cmh2dXN2cGxjb3R3bXhwYm92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzg5NDUsImV4cCI6MjA5NzgxNDk0NX0.xK5H1f2BRurrU1OEl2rU623pMJKgLCuDRNs1sq3bNiU";

let accessToken = "";
let refreshToken = "";
let userEmail = "";
let sessionExpired = false;
let refreshing: Promise<boolean> | null = null;
let onTokenRefresh: ((token: string, refresh: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

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
}

export function markSessionExpired(): void {
    accessToken = "";
    refreshToken = "";
    sessionExpired = true;
    if (onSessionExpired) onSessionExpired();
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
        return { status: res.status, json: res.json };
    } catch (e) {
        const msg = String(e);
        if (msg.includes("401") && accessToken && !sessionExpired) {
            const refreshed = await refreshSession();
            if (refreshed) {
                params.headers = authHeaders();
                const retry = await requestUrl(params);
                return { status: retry.status, json: retry.json };
            }
            markSessionExpired();
        }
        throw e;
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
            }
            return { success: true, autoConfirmed: hasToken };
        }
        const data = res.json as Record<string, unknown>;
        return { success: false, autoConfirmed: false, error: (data.msg as string) || "Error al registrar" };
    } catch (e) {
        return { success: false, autoConfirmed: false, error: String(e) };
    }
}

export async function login(
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await api("POST", `/auth/v1/token?grant_type=password`, { email, password });
        console.log("Mi Agrupacion Plus — login:", res.status);
        if (res.status >= 200 && res.status < 300) {
            const data = res.json as { access_token: string; refresh_token: string; user: { email: string } };
            accessToken = data.access_token;
            refreshToken = data.refresh_token;
            userEmail = data.user?.email || email;
            sessionExpired = false;
            return { success: true };
        }
        const data = res.json as Record<string, unknown>;
        const desc = (data.error_description as string) || (data.msg as string) || "Credenciales inválidas";
        return { success: false, error: desc };
    } catch (e) {
        return { success: false, error: String(e) };
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
        console.warn(`Mi Agrupacion Plus — restGet ${table} failed:`, e);
        return [];
    }
}

export async function restUpsert<T>(table: string, body: T, onConflict: string): Promise<boolean> {
    const res = await api("POST", `/rest/v1/${table}?on_conflict=${onConflict}`, body, { "Prefer": "resolution=merge-duplicates" });
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
