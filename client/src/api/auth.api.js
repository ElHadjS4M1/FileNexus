export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://localhost:4000";

function buildHeaders(hasBody, customHeaders = {}) {
    return {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...customHeaders,
    };
}

async function apiRequest(path, options = {}) {
    const hasBody = typeof options.body !== "undefined";
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...options,
        headers: buildHeaders(hasBody, options.headers),
    });

    if (response.status === 204) {
        return { ok: true };
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : "Solicitud rechazada";
        throw new Error(message);
    }
    return body;
}

export const authApi = {
    init: (payload) => apiRequest("/auth/init", {
        method: "POST",
        body: JSON.stringify(payload),
    }),

    login: (payload) => apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    }),

    getMaterials: () => apiRequest("/me/keys/materials"),

    // Comprobar si la sesión actual es válida (devuelve información del usuario si ha iniciado sesión)
    checkSession: async () => {
        try {
            return await apiRequest("/me");
        } catch {
            return null;
        }
    },

    setupTotp: (payload) => apiRequest("/auth/totp/setup", {
        method: "POST",
        body: JSON.stringify(payload),
    }),

    logout: () => apiRequest("/auth/logout", { method: "POST" }),
};
