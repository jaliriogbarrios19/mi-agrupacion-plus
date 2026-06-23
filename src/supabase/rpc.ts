import { api } from "./client";

export async function rpcCreateVault(name: string): Promise<{ success: boolean; vaultId?: string; error?: string }> {
    try {
        const res = await api("POST", "/rest/v1/rpc/create_vault", { p_name: name });
        if (res.status >= 200 && res.status < 300) {
            return { success: true, vaultId: res.json as string };
        }
        const data = res.json as Record<string, unknown>;
        return { success: false, error: (data.message as string) || "Error creating vault" };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function rpcGenerateInvitation(vaultId: string): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
        const res = await api("POST", "/rest/v1/rpc/generate_invitation", { p_vault_id: vaultId });
        if (res.status >= 200 && res.status < 300) {
            return { success: true, code: res.json as string };
        }
        const data = res.json as Record<string, unknown>;
        return { success: false, error: (data.message as string) || "Error generating invitation" };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function rpcResolveInvitation(code: string): Promise<{ success: boolean; vaultId?: string; vaultName?: string; error?: string }> {
    try {
        const res = await api("POST", "/rest/v1/rpc/resolve_invitation", { p_code: code });
        if (res.status >= 200 && res.status < 300) {
            const rows = res.json as Array<{ vault_id: string; vault_name: string }>;
            if (rows.length > 0) {
                return { success: true, vaultId: rows[0].vault_id, vaultName: rows[0].vault_name };
            }
            return { success: false, error: "Código de invitación inválido o expirado" };
        }
        const data = res.json as Record<string, unknown>;
        return { success: false, error: (data.message as string) || "Error resolving invitation" };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

export async function rpcJoinVault(code: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await api("POST", "/rest/v1/rpc/join_vault", { p_code: code });
        if (res.status >= 200 && res.status < 300) {
            return { success: true };
        }
        const data = res.json as Record<string, unknown>;
        return { success: false, error: (data.message as string) || "Error joining vault" };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}
